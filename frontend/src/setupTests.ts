import "@testing-library/jest-dom/vitest";

/**
 * jsdom implements no CSS object model for media queries, so `matchMedia` is
 * simply absent. Anything rendering the app shell would throw on the first
 * `useMediaQuery` call. The stub answers "not matching", which is the desktop
 * case — the one the components are designed around.
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/**
 * jsdom does no layout, so it implements no scrolling either and
 * `Element.prototype.scrollIntoView` is simply absent. The command palette calls
 * it to keep the selected row in view; without a stub every palette test dies in
 * an effect rather than on the assertion it was written for.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
