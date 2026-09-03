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
