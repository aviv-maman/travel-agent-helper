/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
  endOfLine: "lf",
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  printWidth: 100,
  jsxSingleQuote: false,
  arrowParens: "always",
  bracketSameLine: true,
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "app/globals.css",
  tailwindFunctions: ["cn", "cva"],
};

export default config;
