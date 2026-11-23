import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://autoclass.kikkey.com',
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  build: {
    inlineStylesheets: 'always',
    assets: '_a',
  },
  image: {
    // sharp is the default service
  },
  vite: {
    build: {
      cssMinify: true,
      modulePreload: { polyfill: false },
    },
  },
});
