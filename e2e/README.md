# End-to-end test suite

Automated behavioural tests for the plugin. Launches an isolated Obsidian
instance via Playwright + CDP, drives it against a fresh copy of the
`test-vault-master/` reference vault, and asserts on the rendered DOM plus
plugin state.

## Prerequisites

- Windows with Obsidian installed at `C:\Program Files\Obsidian\Obsidian.exe`
- Node.js ≥ 20

## Setup

```bash
cd e2e
npm install
```

## Run

```bash
cd e2e
node run.mjs
```

The suite takes ~70 seconds. Output:

- Live progress in the terminal (`▶`/`✓`/`✗` per test)
- `report/results.json` with per-test timing + status
- `screenshots/` with one PNG per test (pass and fail)

## Bootstrap guarantees

Every run is fully deterministic:

- `test-vault-master/` (git-tracked reference) is copied to `e2e/vault/` fresh
- Freshly-built `main.js`/`manifest.json`/`styles.css` from the repo root is deployed into the runtime vault
- Isolated Electron `user-data-dir` (`e2e/.userdata/`) with the vault pre-registered as trusted
- `--lang=en-US` forces English UI regardless of system locale
- Dark Mode via the master `appearance.json`
- Fixed window size 1400×900 for stable screenshots
- Any lingering Obsidian process is killed before launch

## Coverage

112 tests across 57 groups covering:

- **A–J**: Core loading, per-note width, slider, value-display, pills, code-block, split-pane, popout, theme-override, disable
- **K–L**: Commands + settings-tab instance
- **M–O**: Unit-switching, custom ranges
- **P–R**: YAML-key rename, reset-modal, change-all-batch
- **S–U**: Rapid tab-switch, legacy migration, prototype-pollution
- **V–LL**: Command execution, frontmatter parsing edge cases, rename/delete handlers, locale, layout events, code-block CSS-variable, range clamping, settings-tab rendering
- **MM–DDD**: UnitConfig merging, guards, boundary values, pills customisation, individual pill commands, LocalOverride roundtrip
- **REG01–REG06**: Every historical bug (from CHANGELOG) gets a dedicated regression test
- **Z01**: Popout (always last — releases CDP context)

## Adding a new regression test

When a bug is reported and fixed, add a `REG*` test that would have caught
the bug before the fix. The bug is then never allowed to come back
unnoticed. The suite is the living safety net for this plugin.
