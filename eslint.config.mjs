const foundryGlobals = {
  Actor: "readonly",
  ChatMessage: "readonly",
  CONFIG: "readonly",
  Dialog: "readonly",
  FormApplication: "readonly",
  Handlebars: "readonly",
  Hooks: "readonly",
  Item: "readonly",
  Roll: "readonly",
  canvas: "readonly",
  foundry: "readonly",
  fromUuid: "readonly",
  game: "readonly",
  ui: "readonly",
};

const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  URL: "readonly",
};

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "packs/**",
      "resources/rules/**",
    ],
  },
  {
    files: ["module/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: foundryGlobals,
    },
  },
  {
    files: ["resources/scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: nodeGlobals,
    },
  },
];
