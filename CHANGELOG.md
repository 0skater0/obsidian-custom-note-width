# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## 3.1.0 — 2026-09-28

Makes the note width more robust against themes and other plugins, and adds a diagnostics report so a bug like #14 can be investigated with facts instead of guesses. Also folds in the unreleased 3.0.1 lint fixes.

### Added
- **Diagnostics report.** A new *Create diagnostics report* command (also a button under *Settings → Custom Note Width → Diagnostics*) writes an anonymised `diagnostics.json` into the plugin folder, copies it to the clipboard, and reveals it in your file manager. It records, as plain fields, the environment (versions, platform, viewport), the relevant Obsidian editor settings (including `readableLineLength`), the active theme and snippets, other enabled plugins (with a `conflictCandidate` flag for any that also control line width), the plugin's own settings, the plugin files with sizes and hashes, the resolved width for the current note (source, raw value, unit, computed px, and the inline value with its `!important` flag), and which CSS rules actually set the line width and `max-width` (with origin, selector, value and `!important`), plus a `mismatch` boolean comparing the width the plugin set against the width in effect. The cause is meant to be read directly from these values; there is no prose conclusion. It never includes note contents, file names or vault paths.
- **Width consistency logging.** After each width change the plugin compares the width it set against the width that actually took effect. A divergence (a rule overriding `max-width` directly) is recorded in the diagnostics log. This is silent; nothing interrupts your work.
- **Error capture.** Uncaught errors and promise rejections that originate in the plugin are recorded (message only, paths stripped) so they show up in the report.
- **Required diagnostics field in the bug report template**, plus a rewritten *Reporting bugs* section in the README explaining how to generate the report.

### Changed
- **The width is applied inline again, with `!important`.** The plugin writes `--file-line-width` directly onto each note's editor view with priority `!important`, restoring the behaviour 2.4.1 had (which 3.0.0 dropped when it removed the old `<style>` element and its inline important). An inline `!important` declaration beats any theme or snippet that marks `--file-line-width` `!important` on a selector, which is the most likely cause of #14, and the width no longer depends on `styles.css` being loaded. The only rule that can still win is one that sets `max-width` directly on the editor sizer with `!important` (bypassing the variable); the diagnostics report identifies exactly that rule.
- **ESLint config now enforces `@typescript-eslint/no-unnecessary-type-assertion`** as an error, matching the stricter ruleset the community directory scanner runs (from the #13 directory review). This folds in the unreleased 3.0.1 fix for the two type-assertion warnings on that scorecard.

### Fixed
- **Width overridden by themes/snippets that use `!important` (#14).** With the inline `!important` restored, a theme or CSS snippet that sets `--file-line-width` `!important` no longer defeats the plugin. This is the most plausible cause of the reports that the width stopped working after 3.0.0.
- **Width lost after re-enabling the plugin.** After disabling and re-enabling the plugin with a note open, the note kept the default width until it was reopened. The plugin now re-resolves and applies each note's real width as soon as the layout is ready.
- **Two unnecessary type assertions in `SettingsManager`** (`codeBlockWidthUnit: 'px' as WidthUnit` and the `Object.assign(...) as CustomNoteWidthSettings` in `loadSettings`). TypeScript already infers the correct types.

### Tests
- **The end-to-end suite now runs against the installed Obsidian version** by copying the app's own `.asar` into the isolated user-data directory, and enables the plugin explicitly under Obsidian 1.13's restricted mode. New regression tests cover the inline `!important` width path (beating a snippet `--file-line-width !important`), a direct `max-width !important` override that the plugin cannot beat and the report must name, width without a loaded `styles.css`, the re-enable width fix, and a diagnostics self-check that verifies the report pinpoints each real failure mode (missing/stale `styles.css`, Readable line length off, aborted apply, width-source resolution, conflicting plugin, privacy).

## 3.0.0 — 2026-08-28

Internal refactor to satisfy the Obsidian Community Directory guidelines (#13). No user-visible feature changes: every setting, command and status-bar behaviour of 2.4.1 works the same way in 3.0.0. Bumped to a major version because the code around the note-width application path was rewritten end-to-end.

### Changed
- **Per-leaf width is now driven by CSS variables and shared stylesheet rules.** The plugin no longer creates or maintains a `<style>` element in `<head>`. Each tagged leaf receives `--cnw-note-width` inline via `setCssProps`; `styles.css` feeds that value into Obsidian's `--file-line-width` with a scoped `[data-cnw-id]` selector. The bridge rule keeps `!important` (this is a deliberate exception to the community guideline) because Obsidian's own defaults for `--file-line-width` sit on more specific selectors like `.markdown-source-view.mod-cm6.is-readable-line-width`, and themes may also mark the property `!important`. Without the marker the plugin would silently lose against those rules.
- **Code block width modes are now body-scoped classes.** `enableCodeBlockWidth` plus the three mode toggles (reading / source / live preview) map to `cnw-cb-reading`, `cnw-cb-source`, `cnw-cb-livepreview` on `document.body`. One toggle affects every open leaf, same as before, but without regenerating a stylesheet on every change.
- **All inline styles moved to CSS classes or `setCssStyles`.** Modals, the status-bar wrapper, the donation button, the version footer, the reset-overrides list and every other UI surface now style themselves through `styles.css` classes prefixed with `cnw-`. Dynamic values (slider width, progress bar) go through `setCssStyles` / `setCssProps`.
- **DOM creation goes through Obsidian's helpers.** `document.createElement` is replaced everywhere with `createEl` / `createDiv` / `createSpan` (or the parent-scoped `parent.createEl(...)` / `parent.createDiv(...)`) so the plugin works correctly in popout windows.
- **Window-scoped timers.** `setTimeout`, `clearTimeout` and `requestAnimationFrame` calls now go through `window.` so they behave correctly in popout windows.
- **Cross-window-safe DOM type checks.** The `instanceof HTMLInputElement` / `instanceof HTMLSpanElement` guards on the status-bar text element go through Obsidian's `.instanceOf()` extension, so the checks stay correct across popout windows.
- **`console.log` startup / shutdown messages are now `console.debug`.** They are still visible in the developer console at the *Verbose* log level; other levels stay quiet, matching Obsidian's own logging expectations.
- **`onunload` is no longer marked `async`.** All cleanup is synchronous. `registerEvent` also takes care of removing the workspace and vault listeners on unload, so the manual deregistration path was removed.
- **Legacy settings migration is now type-safe.** The migration logic in `SettingsManager.loadSettings` reads its input through a dedicated `LoadedSettings` type instead of `any`, so both current and pre-2.0 saved data flow through the same guarded path. Dangerous keys (`__proto__`, `constructor`, `prototype`) are stripped from the loaded object before it is merged with the defaults, so a hand-edited `data.json` can no longer poison the settings prototype chain.
- **YAML frontmatter key input is now guarded.** The settings tab rejects `__proto__`, `constructor` and `prototype` as YAML keys so a batch frontmatter write cannot tamper with the callback's own object.
- **`layout-change` re-applies the width via `requestAnimationFrame`.** The event fires on split, sidebar toggle and other layout mutations that remount leaf containers; matching the existing `active-leaf-change` path keeps the plugin's `--cnw-note-width` the last writer to the container in every layout scenario.
- **Bundler no longer depends on the `builtin-modules` npm package.** `esbuild.config.mjs` uses Node's built-in `module.builtinModules` list instead.
- **Release workflow installs from the lockfile.** `npm ci` replaces `npm install` so the build the attestation is signing is the exact one the lockfile pins.
- **`manifest.json.description` typo fixed** (`Let's you` → `Lets you`).
- **Dev-only dependencies pruned.** `@eslint/js` and `typescript-eslint` are no longer direct dev-dependencies; both are still pulled in transitively by `eslint-plugin-obsidianmd`.

### Added
- **`getSettingDefinitions()` on the settings tab.** Placeholder implementation returning an empty list so the plugin no longer trips Obsidian 1.13's declarative-settings scanner. Full search integration is deferred to a follow-up.
- **GitHub artifact attestations for release assets.** The release workflow now runs `actions/attest-build-provenance@v2` against `main.js`, `manifest.json` and `styles.css`, so the community directory can verify the published binaries against the workflow that produced them.

### Removed
- **Release ZIP asset.** The three release files (`main.js`, `manifest.json`, `styles.css`) are still uploaded individually; the extra `custom-note-width.zip` upload was dropped to keep the release contents aligned with Obsidian's expected asset set.
- **`!important` from `styles.css`.** The remaining `transition: max-width 0s !important` rule was rewritten with a selector chain scoped by `data-cnw-id`, which is specific enough on its own.

### Tests
- **End-to-end test suite** under `e2e/`. Playwright drives an isolated Obsidian instance against a git-tracked reference vault (`test-vault-master/`), reproducibly, in English + Dark Mode. 112 tests across 57 groups cover every public code path plus a dedicated regression test for every historical bug in the CHANGELOG. Full run ~75 seconds. Details in `e2e/README.md`.

## 2.4.1 — 2026-08-27

### Fixed
- **Slider had no effect when *Value display in status bar* was set to *Hidden*** (#12). The slider's own input listener was bound together with the companion text element and was never registered when no text element was created. Reported by @DuckTapeSpaceship.
- **Changing a status-bar setting temporarily reset the visible note width to the global default** until the next tab switch or layout change. `updateUI()` now re-applies the per-note width for the active leaf right after the rebuild.

## 2.4.0 — 2026-08-25

### Added
- **Minimal status bar** (#12). Thanks to @DuckTapeSpaceship.
  - **Value display in status bar** replaces the old *Enable text field* toggle with a three-way choice: *Editable* (input field, previous behaviour), *Read-only* (plain text), or *Hidden* (no value in the status bar).
  - **Show unit selector in status bar** *(slider mode)* removes the `%`/`px`/`ch` dropdown when off.
  - Setting both to *Hidden* / off gives a slider-only status bar.

### Changed
- The old *Enable text field* boolean is replaced by the three-way *Value display in status bar* dropdown. Existing installs migrate automatically: `enableTextInput: true` (default) becomes *Editable*, `enableTextInput: false` becomes *Read-only*. No visible change unless the setting is opened.

## 2.3.0 — 2026-08-06

### Added
- **Per-note width storage modes** — the old *Automatically save to YAML* toggle became a three-way choice under *Enable per-note width* (#11). Thanks to @koloved.
  - **Frontmatter** *(default)*: writes to the note's YAML, the previous behaviour. Existing installs migrate here automatically, no visible change.
  - **Locally**: widths persisted per note in the plugin's `data.json`, the note file is never touched. Rename and delete listeners keep the map in sync with the vault.
  - **View only**: kept in memory as long as the note is open somewhere, dropped once every leaf showing it is closed.
- **Reset local overrides** dialog with a search filter and per-item checkboxes, so a single note or the whole set can be cleared explicitly.

### Changed
- Setting descriptions rewritten around the three per-note modes so the difference between them is clear at first read.

### Fixed
- The settings tab no longer jumps back to the top when a toggle rebuilds the panel.

## 2.2.0 — 2026-06-10

### Added
- **Russian (ru) UI translation** — full localisation with automatic language detection (#10). Thanks to @Frumkin13.

## 2.1.0 — 2026-04-18

### Added
- **Pills control mode** — alternative to the slider in the status bar. Three configurable preset buttons for instant width switching (#9).
- **Pill commands** — `Apply pill preset 1/2/3`, bindable via Settings → Hotkeys. Only active when Pills mode is enabled.
- **Active preset highlight** — the pill matching the currently applied width is visually active and syncs automatically when switching notes.
- `CONTRIBUTING.md`, `CHANGELOG.md`, Pull Request template, `FUNDING.yml` for a more structured contribution workflow.

### Changed
- Control mode is selectable under *Settings → Custom Note Width → Control mode*. Default remains *Slider* — existing users see no visible change until they opt in.
- In Pills mode the text field and unit selector are hidden, since presets carry their own unit.
- Removed the redundant disclaimer text underneath the donation button.
- README restructured for clarity: compact Features block on top, every setting documented in a collapsible table.

### Fixed
- Crash during plugin activation caused by a dependency-ordering issue in the UI initialisation (`uiManager` was used by `UIElementCreator` before it existed).

## 2.0.0 — 2026-03-04

### Added
- **Internationalization (i18n)**: English, German and en-GB with automatic language detection.
- **Code block width**: independent width control for code blocks, separate from editor width, with per-mode toggles (Reading, Source, Live Preview).
- **Extended unit selection**: support for `%`, `px` and `ch` with user-configurable min/max ranges per unit.
- GitHub issue templates for bug reports and feature requests.
- ESLint 9.x + Prettier configuration.
- TypeScript strict mode.

### Changed
- **Flash-free tab switching**: dual CSS strategy (persistent stylesheets + inline styles) prevents visual flickering.
- Width calculation is now synchronous, reading directly from Obsidian's metadata cache.
- YAML writes are debounced (250 ms) during slider interactions.
- Redesigned settings UI: reorganised into Language, Width, Code Block and Per-Note sections.
- Updated build pipeline with esbuild.

### Removed
- **LokiDB** — replaced with native Obsidian data storage.
- **UUID generator** — no longer needed after storage refactor.

### Migration
- Legacy plain numeric YAML values are interpreted as percentages for backward compatibility.

## 1.0.2 — 2023-11-23

### Changed
- Uses a reference to `statusBarItem` and calls `statusBarItem.detach()` on unload.

### Removed
- Monkey patches.
- `previousWindowState` tracking.

## 1.0.1 — 2023-09-02

### Changed
- Uses the Obsidian API to debounce and process YAML frontmatter.
- Timeouts now use `window.setTimeout` as `number` instead of `NodeJS.Timeout`.
- Error messages are now in English only.
- Plugin name and paths now use `this.manifest.dir` from the plugin instance.

## 1.0.0 — 2023-09-02

### Added
- Initial release.
