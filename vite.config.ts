import { defineConfig } from 'vite';

export default defineConfig({
  // Project pages live under /<repo>/, so asset URLs have to be relative.
  base: './',
  build: {
    // Vite's module-preload polyfill injects a fetch() into the app bundle. It
    // only ever requests same-origin chunks, but "there is no network code in
    // the app bundle" is a claim that can be checked mechanically and "there is
    // one fetch and it is fine, honestly" is not. Turning it off costs a little
    // preloading on old Safari and buys an enforceable guarantee.
    modulePreload: { polyfill: false },
    target: 'es2022',
  },
  worker: {
    format: 'es',
  },
});
