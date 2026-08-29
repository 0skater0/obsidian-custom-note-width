import obsidianmd from "eslint-plugin-obsidianmd";

export default [
	{
		ignores: ["main.js", "**/*.mjs", "node_modules/", "test-vault/", "dist/"],
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
	},
];
