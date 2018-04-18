const _askBlocker = {
  sendToBackground: function(...args){
    return browser.runtime.connect({ name: "content" }).postMessage(...args);
  }
};
_askBlocker.sendToBackground({
  _askBlocker: {
    type: "initTab",
    location: {
      protocol: window.location.protocol
    }
  }
});

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (!request._askBlocker) {
    return;
  }

  _askBlocker.onMessageFromBackground(request._askBlocker);
  return;
});

/*
 * The code that actually blocks the requests is injected in a <script/>, so if we want to send a message to our extension
 * from there, browsers won't let us. Instead we have to first send a message from the page/script using the window's
 * postMessage, catch it here in the content script and then send it to the extension via browser's postMessage function specifically for extension.
 */
window.addEventListener("message", function(event) {
    // We only accept messages from this window to itself
    if (event.source != window || !event.data._askBlocker) {
      return;
    }

    // send to extension background script
    _askBlocker.sendToBackground(event.data);
  },
  false
);

// Stick everything in this object so only one variable is exposed
Object.assign(_askBlocker, {
  changeOverlayBackground(color) {
    _askBlocker.getOverlay().style.background = color;
  },

  getOverlay() {
    return document.getElementById("o_askblocker");
  },

  hideOverlay() {
    const overlay = _askBlocker.getOverlay();
    overlay.style.opacity = 0;
    setTimeout(function() {
      overlay.parentElement.removeChild(overlay);
    }, 100);
  },

  /**
   * The only way I could get this extension to work reliably was to inject the code via a <script/>.
   * This also wraps the code as a self-executing anonymous function so the global namespace isn't polluted with variables.
   */
  inject() {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.textContent = _askBlocker.run.toString().replace(
      /^[^{]+?\{([\s\S]+)$/i,
      `/* AskBlocker (extension) */
      (function(){
        $1
      )()`
    );
    (document.head || document.documentElement).appendChild(script);
  },

  /**
   * This is called when a message is passed from background.js to this content script.
   * @param {object} message
   */
  onMessageFromBackground(message) {
    if (message.type === "askAgain") {
      if (message.permissionName in _askBlocker.requestTriggerMap) {
        let additionalText;
        if (message.permissionName === "geolocation") {
          additionalText = '<p>NOTE: there will be a small delay after clicking "Allow", it takes time to get your location.</p>';
        }

        _askBlocker.showOverlay(additionalText);
        const onDone = function(isGranted) {
          window.postMessage(
            {
              // wrap in an additional object to avoid any of the page scripts accidentally reacting to it
              _askBlocker: {
                type: "askAgainComplete"
              }
            },
            "*"
          );

          if (isGranted) {
            _askBlocker.changeOverlayBackground("rgba(0, 25, 0, 0.8)");
            setTimeout(function() {
              window.location.reload();
            }, 100);
            return; // just to be safe
          }

          // The user has blocked / denied it
          _askBlocker.changeOverlayBackground("rgba(25, 0, 0, 0.8)");
          setTimeout(function() {
            _askBlocker.hideOverlay();
          }, 100);
        };

        _askBlocker.requestTriggerMap[message.permissionName](
          message.additionalInfo,
          onDone
        );
      }
    }
  },

  /**
   * When the user clicks "Ask again & refresh", this map is used to trigger a new permissions request.
   */
  requestTriggerMap: {
    geolocation(additionalInfo = {}, onDone) {
      let options;
      if (additionalInfo.options) {
        options = additionalInfo.options;
      }

      navigator.geolocation.getCurrentPosition(
        function() {
          onDone(true);
        },
        function(e) {
          onDone(false);
          throw e;
        },
        options
      );
    },

    getUserMedia(additionalInfo = {}, onDone) {
      navigator.mediaDevices
        .getUserMedia({
          audio: additionalInfo.audio,
          video: additionalInfo.video
        })
        .then(function() {
          onDone(true);
        })
        .catch(function(e) {
          onDone(false);
          throw e;
        });
    },

    midi(additionalInfo = {}, onDone) {
      navigator
        .requestMIDIAccess({ sysex: additionalInfo.sysex })
        .then(function() {
          onDone(true);
        })
        .catch(function(e) {
          onDone(false);
          throw e;
        });
    },

    notifications(additionalInfo = {}, onDone) {
      Notification.requestPermission().then(
        function(permission) {
          onDone(permission === "granted");
        },
        function(e) {
          onDone(false);
          throw e;
        }
      );
    },

    "persistent-storage": function(additionalInfo = {}, onDone) {
      navigator.storage
        .persist()
        .then(function(granted) {
          if (granted) {
            onDone(true);
          } else {
            onDone(false);
          }
        })
        .catch(function(e) {
          onDone(false);
          throw e;
        });
    }
  },

  /**
   * When the user clicks "ask again & refresh" and a permissions request is trigged, we cover the content with an overlay containing some text
   */
  showOverlay(additionalHTML = "") {
    const overlay = document.createElement("div");
    overlay.id = "o_askblocker";
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.right = 0;
    overlay.style.bottom = 0;
    overlay.style.zIndex = 2147483647;
    overlay.style.opacity = 0;
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    overlay.style.transition = "opacity 0.1s, backgroundColor 0.1s";

    const overlayInner = document.createElement("div");
    overlayInner.style.position = "fixed";
    overlayInner.style.top = "50%";
    overlayInner.style.left = "50%";
    overlayInner.style.color = "#fff";
    overlayInner.style.fontSize = "26px";
    overlayInner.style.fontFamily = "'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
    overlayInner.style.transform = "translate(-50%, -50%)";
    overlayInner.innerHTML = `<p>Click "Allow" to grant the permission. Once you do, the page will reload.</p>${additionalHTML}`;
    overlay.appendChild(overlayInner);

    (document.body || document.documentElement).appendChild(overlay);
    setTimeout(function() {
      overlay.style.opacity = 1;
    }, 0);
  }
});

/**
 * This is the actual code ran on the page to detect and allow/block permissions request
 */
_askBlocker.run = function() {
  let hasInteracted; // i.e. click, tap, or keypress

  window.addEventListener("load", function() {
    const onInteraction = function() {
      hasInteracted = true;

      // Remove event listeners; we don't want to be listening to every key press, etc.
      document.body.removeEventListener("click", onInteraction, true);
      document.removeEventListener("keypress", onInteraction, true);
      window.removeEventListener("touchstart", onInteraction, true);
    };
    document.body.addEventListener("click", onInteraction, true);
    document.addEventListener("keypress", onInteraction, true);
    window.addEventListener("touchstart", onInteraction, true);
  }, false);

  // Let's create some custom errors so we can emulate browser behaviour as closely as possible
  class CustomError extends Error {
    constructor(origin, ...args) {
      super(...args);

      // Maintains proper stack trace for where our error was thrown (only available on V8)
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, origin);
      }
    }
  }
  class DOMException extends CustomError {}
  class PositionError extends CustomError {}

  /**
   * This is called whenever a request is blocked. It contacts our extension to update UI, etc.
   * @param {subject} options
   * @property {string} options.name e.g. getUserMedia or geolocation.
   * @property {object} [additionalInfo]
   */
  const onBlock = function(name, additionalInfo) {
    window.postMessage(
      {
        // wrap in an additional object to avoid any of the page scripts accidentally reacting to it
        _askBlocker: {
          type: "onBlock",
          payload: { name, additionalInfo }
        }
      },
      "*"
    );
  };

  /**
   * Whether the user has responsed to a request to enable this permission before, i.e. granted or denied it.
   * This is useful because if they have, then allowing the request won't trigger a popup, so we can let the browser do its thing.
   * @param {string} name - See permission registry: https://w3c.github.io/permissions/#permission-registry.
   * @param {object} [additionalArgs] - Contains any properties that need to be passed to the query call as well (e.g. sysex for MIDI).
   * @returns {object} - a promise which resolves to a Boolean
   */
  const hasRespondedToRequestPreviously = function(name, additionalArgs = {}) {
    if (!navigator.permissions) {
      return Promise.resolve(false);
    }

    return navigator.permissions
      .query(Object.assign(additionalArgs, { name }))
      .then(function(result) {
        return ["denied", "granted"].includes(result.state);
      })
      .catch(function() {
        return false;
      });
  };

  const shouldAllowRequest = function() {
    // Don't block if they're on a chrome:// or about:// page
    return (
      ["about:", "chrome:"].includes(window.location.protocol)
      // or if it's localhost
      || ["localhost", "127.0.0.1"].includes(window.location.hostname)
      // or if they've navigated to this page from another page on the same domain
      || (
        document.referrer
        && document.referrer !== window.location.href
        && new RegExp(`^[a-z]+\:\/\/${window.location.host}`).test(document.referrer)
      )
      // or the user interacted with the page
      || hasInteracted
    );
  };

  if ("geolocation" in navigator) {
    const method = navigator.geolocation.getCurrentPosition;
    Object.assign(navigator.geolocation, {
      getCurrentPosition: function(successCallback, errorCallback, options) {
        const args = arguments;
        hasRespondedToRequestPreviously("geolocation").then(
          hasRespondedPreviously => {
            if (hasRespondedPreviously || shouldAllowRequest()) {
              method.apply(navigator.geolocation, args);
              return;
            }

            onBlock("geolocation", { options });
            errorCallback(new PositionError(method, "User denied Geolocation"));
          }
        );
      }
    });
  }

  const prepGetUserMedia = function({ audio, video } = {}) {
    const permissionsToCheck = [];
    if (audio) {
      // microphone or speaker
      permissionsToCheck.push(
        hasRespondedToRequestPreviously("microphone").then(function(hasRespondedPreviously) {
          if (hasRespondedPreviously) {
            return true;
          }
          return hasRespondedToRequestPreviously("speaker");
        })
      );
    }
    if (video) {
      permissionsToCheck.push(hasRespondedToRequestPreviously("camera"));
    }

    let hasRespondedPreviously;
    // since hasRespondedToRequestPreviously resolves with false sometimes, the Promise.all call can return an array of Booleans
    if (permissionsToCheck.length) {
      hasRespondedPreviously = Promise.all(permissionsToCheck).then(function(permissions) {
        return permissions.every(hasResponded => hasResponded);
      });
    } else {
      hasRespondedPreviously = Promise.resolve(false);
    }

    return {
      hasRespondedPreviously
    };
  };

  // Deprecated callback based getUserMedia
  if ("getUserMedia" in navigator) {
    const method = navigator.getUserMedia;
    navigator.getUserMedia = function({ audio, video } = {}, successCallback, errorCallback) {
      const args = arguments;
      const { hasRespondedPreviously } = prepGetUserMedia({ audio, video });

      hasRespondedPreviously.then(hasResponded => {
        if (hasResponded || shouldAllowRequest()) {
          method.apply(navigator, arguments);
          return;
        }

        onBlock("getUserMedia", {
          audio: !!audio,
          video: !!video
        });
        errorCallback(new DOMException(method, "Permission dismissed"));
      });
    };
  }

  // Promise based getUserMedia
  if ("mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices) {
    const method = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = function({ audio, video }) {
      const args = arguments;
      const { hasRespondedPreviously } = prepGetUserMedia({ audio, video });

      return hasRespondedPreviously.then(function(hasResponded) {
        if (hasResponded || shouldAllowRequest()) {
          return method.apply(navigator.mediaDevices, args);
        }

        onBlock("getUserMedia", {
          audio: !!audio,
          video: !!video
        });
        return new Promise(function() {});
      });
    };
  }

  if ("Notification" in window) {
    const method = Notification.requestPermission;
    class WrappedNotification extends Notification {
      static requestPermission(callback) {
        const args = arguments;

        return hasRespondedToRequestPreviously("notifications").then(hasRespondedPreviously => {
          if (hasRespondedPreviously || this.shouldAllowRequest()) {
            return method.apply(this, args);
          }

          onBlock("notifications");
          const result = "default";
          // If they're using the old deprecated callback-based version of the API
          if (callback) {
            callback(result);
          }
          return Promise.resolve(result);
        });
      }
    }
    WrappedNotification.shouldAllowRequest = shouldAllowRequest;
    window.Notification = WrappedNotification;
  }

  if ("requestMIDIAccess" in navigator) {
    const method = navigator.requestMIDIAccess;
    navigator.requestMIDIAccess = function({ sysex } = {}) {
      const args = arguments;

      // If they're requesting sysex, we need to query the permissions API with that too, otherwise we could get false positives
      return hasRespondedToRequestPreviously("midi", { sysex }).then(hasRespondedPreviously => {
        if (hasRespondedPreviously || shouldAllowRequest()) {
          return method.apply(navigator, args);
        }

        onBlock("midi", {
          sysex: !!sysex
        });
        throw new DOMException(
          method,
          "An attempt was made to break through the security policy of the user agent."
        );
      });
    };
  }

  if ("storage" in navigator && "persist" in navigator.storage) {
    const method = navigator.storage.persist;
    navigator.storage.persist = function(...args) {
      return hasRespondedToRequestPreviously("persisted-storage")
        .then(function(hasRespondedPreviously) {
          if (hasRespondedPreviously || shouldAllowRequest()) {
            return method.apply(navigator.storage, args);
          }

          onBlock("persistent-storage");
          return false;
        });
    };
  }
};

if (document instanceof HTMLDocument) {
  _askBlocker.inject();
}