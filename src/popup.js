const getPermissionDetails = function({ name, additionalInfo }) {
  // getUserMedia is a special case because they could be requesting audio, video, etc and we want to show the correct icons.
  if (name === "getUserMedia") {
    const icons = [];
    if (additionalInfo.audio || additionalInfo.video) {
      if (additionalInfo.video) {
        icons.push("006-photo-camera.svg");
      }
      if (additionalInfo.audio) {
        icons.push("004-karaoke-microphone-icon.svg");
      }
    } else {
      // if they've made a bad request specifiying neither, just show both icons
      icons.push("006-photo-camera.svg");
      icons.push("004-karaoke-microphone-icon.svg");
    }

    return {
      description:
        'The <a href="https://w3c.github.io/mediacapture-main">Media Capture and Streams specification</a> describes a set of JavaScript APIs that allow local media, including audio and video, to be requested from a platform.',
      icons,
      permission: "getUserMedia",
      title: "Media Capture"
    };
  }

  const permissionsMap = {
    geolocation: {
      description:
        'The <a href="https://w3c.github.io/geolocation-api/">Geolocation API</a> defines a high-level interface to location information associated only with the device hosting the implementation, such as latitude and longitude.',
      icons: ["010-facebook-placeholder-for-locate-places-on-maps.svg"],
      title: "Geolocation"
    },
    midi: {
      description:
        'The <a href="https://webaudio.github.io/web-midi-api/#midiaccess-interface">Web MIDI API</a> allows web developers to enumerate, manipulate and access MIDI devices.',
      icons: ["009-piano.svg"],
      title: "MIDI"
    },
    notifications: {
      description:
        'The <a href="https://notifications.spec.whatwg.org/">Notifications API</a> allows web developers to display notifications to the end user.',
      icons: ["011-sound.svg"],
      title: "Notifications"
    },
    "persistent-storage": {
      description:
        'The <a href="https://storage.spec.whatwg.org/">Storage API</a> describes persistent storage and quota estimates, as well as the platform storage architecture. When storage on the local machine is running tight ("under storage pressure"), user agents automatically clear storage to make more available space. However, "persistent" data will not be automatically cleared. If the system is still under storage pressure after clearing all non-persistent data, the user will need to manually clear any remaining persistent storage.',
      icons: ["007-database.svg"],
      title: "Persistent storage"
    }
  };

  if (name in permissionsMap) {
    return {
      permission: name,
      ...permissionsMap[name]
    };
  }
  throw new Error(`Cannot get details for permission: ${name}`);
};

const getUniqueBlockedRequestsWithDetails = function(tab) {
  // Unique
  const uniqueRequests = {};
  for (let i = 0; i < tab.blockedRequests.length; i++) {
    const request = tab.blockedRequests[i];
    if (request.name in uniqueRequests) {
      if (request.name !== "getUserMedia") {
        continue;
      }

      // getUserMedia is a special case. If there are two requests and one asked for audio, while the other asked for video, we want to show both icons.
      const existingAdditionalInfo = uniqueRequests[request.name].additionalInfo;
      if (existingAdditionalInfo.audio && existingAdditionalInfo.video) {
        continue;
      }

      let newAdditionalInfo = {};
      if (request.audio && request.video) {
        newAdditionalInfo = request.additionalInfo;
      } else {
        if (existingAdditionalInfo.audio || request.additionalInfo.audio) {
          newAdditionalInfo.audio = existingAdditionalInfo.audio || request.additionalInfo.audio;
        }

        if (existingAdditionalInfo.video || request.additionalInfo.video) {
          newAdditionalInfo.video = existingAdditionalInfo.video || request.additionalInfo.video;
        }
      }

      uniqueRequests[request.name].additionalInfo = newAdditionalInfo;
      continue;
    }

    uniqueRequests[request.name] = request;
  }

  // get details
  const keys = Object.keys(uniqueRequests);
  const results = [];
  for (let j = 0; j < keys.length; j++) {
    results.push(getPermissionDetails(uniqueRequests[keys[j]]));
  }

  return results;
};

const updateHtml = function(tab) {
  const numberOfBlockedRequests = tab.blockedRequests.length;

  const requestsSummaryClasses = ["requests__count"];
  let requestsSummaryHTML = '<span class="requests__count';
  let permissionRequestPlural = "";
  if (numberOfBlockedRequests !== 1) {
    permissionRequestPlural = "s";
  }

  let requestsHTML = "";
  if (numberOfBlockedRequests) {
    requestsSummaryClasses.push("requests__count--bad");

    requestsHTML = getUniqueBlockedRequestsWithDetails(tab)
      .map(function({ description, icons, permission, title }) {
        const iconsHtml = icons
          .map(function(icon) {
            return `<img class="request__icon" src="icons/${icon}">`;
          })
          .join("");

        return `<li class="request">
          <div class="request__head" tabindex="0">
            ${iconsHtml} <span class="request__title">${title}</span>
            <img class="request__toggle-icon" src="icons/008-signs.svg">
          </div>
          <div class="request__body">
            <p class="request__description">${description}</p>
            <button class="action request__ask" data-permission-name="${permission}"><img class="action-icon" src="icons/001-circular-counterclockwise-arrows.svg"> Ask again &amp; reload</button>
          </div>
        </li>`;
      })
      .join("");
  }

  document.getElementById("requests-summary").innerHTML = `<span class="${requestsSummaryClasses.join(" ")}">${numberOfBlockedRequests}</span> permission request${permissionRequestPlural} blocked`;
  document.getElementById("requests").innerHTML = requestsHTML;
  const footer = document.querySelector("footer");

  // Event handling
  if (requestsHTML) {
    // Expanded & collapsing requests
    const requestHeads = document.querySelectorAll(".request__head");
    for (var i = 0; i < requestHeads.length; i++) {
      requestHeads[i].addEventListener("click", function(event) {
        this.parentNode.classList.toggle("request--expanded");
      });

      requestHeads[i].addEventListener("keyup", function(event) {
        if ([13, 32].includes(event.keyCode)) {
          this.parentNode.classList.toggle("request--expanded");
        }
      });
    }

    // "Ask again" buttons
    const requestAskButtons = document.querySelectorAll(".request__ask");
    for (var i = 0; i < requestAskButtons.length; i++) {
      requestAskButtons[i].addEventListener("click", function(event) {
        browser.runtime.connect({ name: "popup" }).postMessage({
          type: "askAgain",
          permissionName: this.dataset.permissionName
        });
        window.close();
      });
    }
  }
};

const init = function() {
  updateHtml({ blockedRequests: [] });

  browser.runtime.connect({ name: "popup" }).postMessage({
    type: "initPopup"
  });
};

document.addEventListener("DOMContentLoaded", function() {
  init();

  browser.runtime.onConnect.addListener(function(port) {
    port.onMessage.addListener(function(message, sender) {
      if (sender.name !== "background") {
        return;
      }

      if (message.type === "tabDetails") {
        updateHtml(message.tab);
      }

      if (message.type === "closePopup") {
        window.close();
      }
    });
  });
});
