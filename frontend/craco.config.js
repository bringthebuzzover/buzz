const path = require("path");

module.exports = {
  style: {
    postcss: {
      plugins: {
        tailwindcss: {},
        autoprefixer: {},
      },
    },
  },
  jest: {
    configure: (config) => {
      // react-router v7 / react-router-dom v7 declare a broken `main`
      // (./dist/main.js, which doesn't exist) and rely on `exports` subpaths
      // (e.g. `react-router/dom`). Webpack honors `exports` so the app builds,
      // but CRA's jest resolver ignores `exports` and follows `main`, failing
      // with "Cannot find module 'react-router-dom'". CRA doesn't allow a
      // custom jest `resolver`, so map the affected entry points to their real
      // CJS files. (`react-router` itself resolves fine via its `main`.)
      config.moduleNameMapper = {
        ...config.moduleNameMapper,
        "^react-router-dom$": path.resolve(
          __dirname,
          "node_modules/react-router-dom/dist/index.js",
        ),
        "^react-router/dom$": path.resolve(
          __dirname,
          "node_modules/react-router/dist/development/dom-export.js",
        ),
      };
      return config;
    },
  },
};
