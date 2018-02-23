# src

This direcrtory contains the actual extension, everything that's published to the Chrome store and more. The same code is used to create multiple extensions, thanks to [WebExtensions](https://developer.mozilla.org/en-US/Add-ons/WebExtensions).

- [`manifest.json`](manifest.json) contains metadata about the extension. See [manifest.json on MDN](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/manifest.json) for more information.
- [`content.js`](content.js) is injected into loaded in the page context.
- The `popup.*` files are related to what happens when you click the extension icon.
- [`background.js`](background.js)... well, it runs in the background. It talks to the content script and the popup, as well as detecting when tabs are closed, etc.
- [`browser-polyfill.min.js`](`browser-polyfill.min.js`) polyfills some stuff so we can write the exact same code for multiple browsers. See [](https://medium.com/@yorkxin/things-i-learned-from-migrating-a-chrome-extension-to-firefox-using-webextensions-975474d4fa77) for more information.