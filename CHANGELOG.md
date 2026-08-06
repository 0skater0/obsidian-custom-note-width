# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

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
