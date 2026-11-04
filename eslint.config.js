import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "app/vendor/", "dist/", "pipeline/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  {
    files: ["app/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, L: "readonly", SunCalc: "readonly" },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
    },
  },
  {
    files: ["tools/**/*.mjs", "tests/**/*.mjs", "*.config.{js,mjs}"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.node },
  },
];
