import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default [
	{
		ignores: ["main.js", "**/*.mjs", "node_modules/", "test-vault/", "test-vault-master/", "e2e/", "dist/"],
	},
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.{ts,tsx,cts,mts}"],
		languageOptions: {
			parserOptions: {
				project: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Match the Obsidian Community Directory scanner's stricter type-check rules.
			"@typescript-eslint/no-unnecessary-type-assertion": "error",
		},
	},
];
