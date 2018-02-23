# Testing

Right now, the testing is manual. There could be unit tests but it would probably have too many assumptions and not really prove much. Actually testing this manually in real browsers seems to be best. I'm open to suggestions though.

1. Run `npm install browser-sync`.
2. Comment out the line in [`src/content.js`](../content.js) which allows the request if the domain is `localhost`. It's in the `shouldAllowRequest` function.
2. Load the extension.
    - [How to do that in Chrome](https://developer.chrome.com/extensions/getstarted#unpacked). The directory to load is the `src` directory.
    - [How to do that in Firefox](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Your_first_WebExtension), specifically the "Trying it out" section.
3. Run `browser-sync start -s -f **` (in the project root).
4. Visit `localhost:3000/test/index.html`. Permission requests should be blocked unless you interact with the page within 1 second.
5. Visit `referrer.html` and then navigate to `index.html` to prove nothing is blocked.
6. Tweak [`script.js`](script.js) to trigger different permission requests.

## Resetting permissions for a given site

Note that you can click the "i" (information) icon in the address bar on the left-hand side to change some permissions or reset everything for the site.