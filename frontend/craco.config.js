const path = require("path");

const brandEmailsJson = path.resolve(__dirname, "../backend/brand_emails.json");

module.exports = {
  style: {
    postcss: {
      plugins: {
        tailwindcss: {},
        autoprefixer: {},
      },
    },
  },
  webpack: {
    alias: {
      // Committed SOT shared with the API (see backend/brand_emails.json).
      "@brandEmails": brandEmailsJson,
    },
    configure: (webpackConfig) => {
      // Allow the alias to resolve one file outside CRA's src/ (monorepo SOT).
      webpackConfig.resolve.plugins = (
        webpackConfig.resolve.plugins || []
      ).filter((plugin) => plugin.constructor.name !== "ModuleScopePlugin");
      return webpackConfig;
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
        "^@brandEmails$": brandEmailsJson,
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
