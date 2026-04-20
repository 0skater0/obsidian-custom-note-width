# Contributing to Custom Note Width

Thanks for considering a contribution. This document covers everything you need to get started.

## Ways to contribute

- **Bug reports** — use the *Bug report* issue template
- **Feature requests** — use the *Feature request* issue template
- **Theme compatibility reports** — open a PR that adds a row to the compatibility table in the README
- **Code changes** — see below

## Development setup

**Requirements:** Node.js 18+, npm.

```bash
git clone https://github.com/0skater0/obsidian-custom-note-width.git
cd obsidian-custom-note-width
npm install
```

**Build once:**

```bash
npm run build
```

This runs the TypeScript check and produces the bundled `main.js`.

**Watch mode** (rebuilds on change):

```bash
npm run dev
```

### Test vault

The repo contains a `test-vault/` with demo notes. To load the plugin into this vault:

1. Create a symlink (Windows) or junction from `test-vault/.obsidian/plugins/custom-note-width` to the repo root.
   ```powershell
   New-Item -ItemType Junction -Path "test-vault/.obsidian/plugins/custom-note-width" -Target "."
   ```
2. Open the `test-vault` folder as a vault in Obsidian.
3. Enable the plugin under **Settings → Community plugins**.
4. After `npm run dev` rebuilds, reload Obsidian (`Ctrl+R`) or toggle the plugin off/on to pick up changes.

## Code style

- **TypeScript strict mode** is on.
- **Linting:** `npm run lint`
- **Formatting:** `npm run format` (Prettier). Check without writing: `npm run format:check`.
- Keep the snake_case variable style used in existing files.
- Add JSDoc for exported functions when types alone are not enough.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your change plus a reasonable test (manual testing in the test vault is fine).
3. Run `npm run build` — the build must pass.
4. Open the PR. Describe *what* changed and *why*. Reference any related issue with `Closes #N`.
5. Small, focused PRs are easier to review than large ones.

## Reporting bugs

See the [Reporting Bugs](README.md#reporting-bugs) section of the README for the information we need.

## License

By contributing you agree that your work will be released under the [MIT License](LICENSE).
