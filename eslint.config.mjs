import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".pnpm-store/**",
      ".electron-cache/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "react-refresh/only-export-components": ["warn", { "allowConstantExport": true }]
    }
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ["scripts/dev-desktop.mjs"],
    rules: {
      "no-control-regex": "off"
    }
  },
  {
    files: [
      "**/*.test.{ts,tsx,js,mjs,cjs}",
      "src/test/setup.ts"
    ],
    languageOptions: {
      globals: {
        ...globals.vitest
      }
    }
  }
];
