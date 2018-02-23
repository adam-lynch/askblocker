const tabs = {};
let currentTabId;

const closePopup = function() {
  browser.runtime
    .connect({ name: "background" })
    .postMessage({ type: "closePopup" });
};

const initTab = function(location) {
  tabs[currentTabId] = {
    blockedRequests: [],
    location,
    isCurrentlyAskingForAPermissionAgain: false
  };
};

const resetTab = function() {
  tabs[currentTabId] = {
    ...tabs[currentTabId],
    blockedRequests: [],
    isCurrentlyAskingForAPermissionAgain: false
  };
};

const sendCurrentTabDetailsToPopup = function() {
  if (!currentTabId) {
    throw new Error(
      "Trying to send current tab details to popup but there is no currentTabId"
    );
  }
  browser.runtime.connect({ name: "background" }).postMessage({
    tab: {
      id: currentTabId,
      ...tabs[currentTabId]
    },
    type: "tabDetails"
  });
};

const updateDetailsForCurrentTab = function() {
  if (!currentTabId) {
    throw new Error("No current tab?!");
  }
  const numberOfBlockedRequests = tabs[currentTabId].blockedRequests.length;
  browser.browserAction.setBadgeText({
    text: (numberOfBlockedRequests && numberOfBlockedRequests.toString()) || ""
  });
};

const onMessageFromContentScript = function(message, sender) {
  if (!message._askBlocker) {
    return;
  }

  if (message._askBlocker.type === "initTab") {
    if (!currentTabId) {
      currentTabId = sender.sender.tab.id;
    }
    initTab(message._askBlocker.location);
    updateDetailsForCurrentTab();
  }

  if (message._askBlocker.type === "onBlock") {
    if (!(currentTabId in tabs)) {
      initTab(message._askBlocker.location);
    }
    tabs[currentTabId].blockedRequests.push(message._askBlocker.payload);
    updateDetailsForCurrentTab();
    sendCurrentTabDetailsToPopup();
  }

  if (message._askBlocker.type === "askAgainComplete") {
    if (!(currentTabId in tabs)) {
      return;
    }

    tabs[currentTabId].isCurrentlyAskingForAPermissionAgain = false;
  }
};

const onMessageFromPopup = function(message, sender) {
  if (message.type === "initPopup") {
    /*
     * Prevent the popup from opening when we're waiting for them to respond to a (re-ask) request
     * or on about:// or chrome:// pages
     */
    if (
      !currentTabId
      || (
        tabs[currentTabId].location
        && ["about:", "chrome:"].includes(tabs[currentTabId].location.protocol)
      )
      || tabs[currentTabId].isCurrentlyAskingForAPermissionAgain
    ) {
      closePopup();
    } else {
      sendCurrentTabDetailsToPopup();
    }
  } else if (message.type === "askAgain") {
    if (!currentTabId) {
      throw new Error("Trying to askAgain but there's no currentTabId");
    }

    const data = { type: "askAgain", permissionName: message.permissionName };
    const blockedRequests = tabs[currentTabId].blockedRequests;
    const notFoundErrorMessage = "Trying to ask again but no relevant requests found";
    const isRelevantRequest = function({ name }) {
      return name === message.permissionName;
    };

    if (message.permissionName === "geolocation") {
      const relevantRequests = blockedRequests.filter(isRelevantRequest);
      if (!relevantRequests.length) {
        throw new Error(notFoundErrorMessage);
      }

      const firstRequestWithOptions = relevantRequests.find(function(blockedRequest) {
        return blockedRequest.additionalInfo && blockedRequest.additionalInfo.options;
      });
      let options;
      if (firstRequestWithOptions) {
        options = firstRequestWithOptions.additionalInfo.options;
      }
      data.additionalInfo = {
        options
      };
    } else if (message.permissionName === "getUserMedia") {
      // Get requests that match
      const relevantRequests = blockedRequests.filter(isRelevantRequest);
      if (!relevantRequests.length) {
        throw new Error(notFoundErrorMessage);
      }

      // getUserMedia is a special case. If there are two requests and one asked for audio, while the other asked for video, we want to show both icons.
      data.additionalInfo = relevantRequests
        .map(function({additionalInfo}){
          return additionalInfo;
        })
        .reduce(function(result, additionalInfo){
          if (result.audio && result.video) {
            return result;
          }

          let newAdditionalInfo = {};
          if (additionalInfo.audio && additionalInfo.video) {
            newAdditionalInfo = additionalInfo;
          } else {
            if (result.audio || additionalInfo.audio) {
              newAdditionalInfo.audio = result.audio || additionalInfo.audio;
            }

            if (result.video || additionalInfo.video) {
              newAdditionalInfo.video = result.video || additionalInfo.video;
            }
          }

          return newAdditionalInfo;
        }, {});
    } else if (message.permissionName === "midi") {
      const relevantRequests = blockedRequests.filter(isRelevantRequest);
      if (!relevantRequests.length) {
        throw new Error(notFoundErrorMessage);
      }

      data.additionalInfo = {
        sysex: relevantRequests.find(function(blockedRequest) {
          return blockedRequest.additionalInfo.sysex;
        })
      };
    } else {
      const relevantRequest = blockedRequests.find(isRelevantRequest);
      if (!relevantRequest) {
        throw new Error(notFoundErrorMessage);
      }
      data.additionalInfo = relevantRequest.additionalInfo;
    }

    tabs[currentTabId].isCurrentlyAskingForAPermissionAgain = true;
    browser.tabs.sendMessage(currentTabId, { _askBlocker: data }).catch(console.error);
  }
};

browser.runtime.onConnect.addListener(function(port) {
  port.onMessage.addListener(function(message, sender) {
    if (sender.name === "content") {
      return onMessageFromContentScript(message, sender);
    }

    if (sender.name === "popup") {
      return onMessageFromPopup(message, sender);
    }
  });
});

browser.tabs.onActivated.addListener(function({ tabId }) {
  currentTabId = tabId;
  if (!(currentTabId in tabs)) {
    initTab();
    tabs[currentTabId].wasOpenBeforeInstall = true;
  } else if (tabs[currentTabId].isCurrentlyAskingForAPermissionAgain) {
    closePopup();
  }
  updateDetailsForCurrentTab();
});

browser.tabs.onRemoved.addListener(function(tabId) {
  if (!(tabId in tabs)) {
    return;
  }
  delete tabs[tabId];
});

// This shouldn't be needed but if the tab reloads, reset the count, etc. to be safe.
browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (tab.id === currentTabId) {
    resetTab();
  }
});

browser.browserAction.setBadgeBackgroundColor({
  color: "#b10000"
});
