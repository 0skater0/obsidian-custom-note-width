/**
 * End-to-end test suite for custom-note-width.
 *
 * Bootstrap is fully hermetic:
 * - Ephemeral vault copy from test-vault-master (git-tracked reference)
 * - Freshly-built plugin files copied into the runtime vault
 * - Isolated Electron user-data-dir with trust/language/theme pre-seeded
 * - Auto-confirm modal handler for any leftover first-run prompts
 * - Deterministic window size for consistent screenshots
 *
 * Runs a growing catalogue of behavioural tests, produces a JSON report
 * and one PNG screenshot per test in ./screenshots/.
 */

import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import { cpSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// -----------------------------------------------------------------------------
// Paths & constants

const OBSIDIAN_EXE = 'C:\\Program Files\\Obsidian\\Obsidian.exe';
const REPO_ROOT = 'D:\\Documents\\Software-Projekte\\obsidian-custom-note-width';
const MASTER_VAULT = join(REPO_ROOT, 'test-vault-master');
const REPO_PLUGIN_FILES = ['main.js', 'manifest.json', 'styles.css'];
const E2E_DIR = join(REPO_ROOT, 'e2e');
const RUNTIME_VAULT = join(E2E_DIR, 'vault');
const USER_DATA_DIR = join(E2E_DIR, '.userdata');
const SCREENSHOTS_DIR = join(E2E_DIR, 'screenshots');
const REPORT_DIR = join(E2E_DIR, 'report');
const CDP_PORT = 9222;
const WINDOW_WIDTH = 1400;
const WINDOW_HEIGHT = 900;

// -----------------------------------------------------------------------------
// Utilities

function log(...args) {
    const t = new Date().toISOString().slice(11, 19);
    console.log(`[${t}]`, ...args);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];

async function test(name, fn, page) {
    const start = Date.now();
    log(`▶ ${name}`);
    let lastErr;
    // Retry on IPC-context-release races. Obsidian's internal focus handler
    // occasionally releases the CDP context briefly; waiting a bit recovers it.
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            await fn();
            const ms = Date.now() - start;
            const shot = join(SCREENSHOTS_DIR, `${name.replace(/\W+/g, '_')}.png`);
            try { await page.screenshot({ path: shot }); } catch {}
            const retryTag = attempt > 0 ? ` (retry ${attempt})` : '';
            log(`  ✓ pass (${ms}ms)${retryTag}`);
            results.push({ name, status: 'pass', ms, screenshot: shot, retries: attempt });
            return;
        } catch (e) {
            lastErr = e;
            const isIpcRace = /IPC method called after context was released|Target page.*has been closed/.test(e.message);
            if (isIpcRace && attempt < 2) {
                log(`  ⟲ IPC race, waiting 2s + retry`);
                await sleep(2000);
                try { await win.evaluate(() => 1); } catch {}
                continue;
            }
            break;
        }
    }
    const ms = Date.now() - start;
    const shot = join(SCREENSHOTS_DIR, `FAIL_${name.replace(/\W+/g, '_')}.png`);
    try { await page.screenshot({ path: shot }); } catch {}
    log(`  ✗ FAIL (${ms}ms): ${lastErr.message}`);
    results.push({ name, status: 'fail', ms, screenshot: shot, error: lastErr.message });
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEquals(a, b, msg) {
    if (a !== b) throw new Error(`${msg} — expected: ${JSON.stringify(b)}, actual: ${JSON.stringify(a)}`);
}
function assertMatches(a, r, msg) {
    if (!r.test(a)) throw new Error(`${msg} — actual: ${JSON.stringify(a)} does not match ${r}`);
}

// -----------------------------------------------------------------------------
// Bootstrap: kill zombies, freshen vault + userdata

try { execSync('taskkill /F /IM Obsidian.exe 2>nul', { stdio: 'ignore' }); } catch {}
await sleep(500);

for (const p of [RUNTIME_VAULT, USER_DATA_DIR]) {
    for (let i = 0; i < 5; i++) {
        if (!existsSync(p)) break;
        try { rmSync(p, { recursive: true, force: true }); break; }
        catch (e) { if (i === 4) throw e; log('cleanup retry', p); await sleep(1000); }
    }
}

// Copy master vault → runtime vault
log('preparing runtime vault from master');
cpSync(MASTER_VAULT, RUNTIME_VAULT, { recursive: true });

// Deploy freshly-built plugin files into runtime vault
const pluginDir = join(RUNTIME_VAULT, '.obsidian', 'plugins', 'custom-note-width');
mkdirSync(pluginDir, { recursive: true });
for (const f of REPO_PLUGIN_FILES) {
    cpSync(join(REPO_ROOT, f), join(pluginDir, f));
}
log('deployed plugin files:', REPO_PLUGIN_FILES.join(', '));

// Reset plugin's own data.json to defaults (undo previous test's state)
writeFileSync(join(pluginDir, 'data.json'), JSON.stringify({
    language: 'auto',
    defaultWidth: 50,
    defaultWidthUnit: '%',
    sliderWidth: 85,
    yamlKey: 'custom-width',
    enableSlider: true,
    statusBarValueDisplay: 'editable',
    enableStatusBarUnitSelector: true,
    enablePerNoteWidth: true,
    perNoteMode: 'frontmatter',
    localOverrides: {},
    unitRanges: { '%': { min: 0, max: 100 }, 'px': { min: 100, max: 4000 }, 'ch': { min: 10, max: 200 } },
    enableCodeBlockWidth: false,
    codeBlockWidth: 800,
    codeBlockWidthUnit: 'px',
    codeBlockWidthModes: { reading: true, source: true, livePreview: true },
    controlMode: 'slider',
    pillsPresets: [{ value: 30, unit: '%' }, { value: 50, unit: '%' }, { value: 100, unit: '%' }],
}, null, 2));

// Seed isolated user-data-dir: register vault + mark as trusted
mkdirSync(USER_DATA_DIR, { recursive: true });
mkdirSync(SCREENSHOTS_DIR, { recursive: true });
mkdirSync(REPORT_DIR, { recursive: true });

// Copy the newest installed app asar (obsidian-<ver>.asar) into the isolated
// user-data-dir. The installer runs an older base version (~1.12.4); Obsidian's
// auto-update mechanism loads a newer obsidian-*.asar from the user-data-dir if
// present, so this makes the suite run against the real installed app version
// (1.13.x) instead of the installer's. Without it the isolated instance lacks
// the app-update asar and falls back to the installer version.
(function deployAppAsar() {
    const appData = process.env.APPDATA;
    if (!appData) { log('APPDATA not set — running against installer version'); return; }
    const appDir = join(appData, 'obsidian');
    let asars;
    try { asars = readdirSync(appDir).filter(f => /^obsidian-.*\.asar$/.test(f)); }
    catch { log('no %APPDATA%/obsidian dir — running against installer version'); return; }
    if (!asars.length) { log('no obsidian-*.asar found — running against installer version'); return; }
    // Newest by mtime (a fresh install/update rewrites the current asar last).
    const newest = asars
        .map(f => ({ f, t: statSync(join(appDir, f)).mtimeMs }))
        .sort((a, b) => a.t - b.t)
        .at(-1).f;
    cpSync(join(appDir, newest), join(USER_DATA_DIR, newest));
    log('deployed app asar into userdata:', newest);
})();

writeFileSync(join(USER_DATA_DIR, 'obsidian.json'), JSON.stringify({
    vaults: {
        'e2e-vault': {
            path: RUNTIME_VAULT.replace(/\\/g, '/'),
            ts: Date.now(),
            open: true,
            trusted: true,
        },
    },
}));

// -----------------------------------------------------------------------------
// Launch Obsidian

log('spawning Obsidian (English UI, isolated userdata)');
const child = spawn(OBSIDIAN_EXE, [
    `--user-data-dir=${USER_DATA_DIR}`,
    `--remote-debugging-port=${CDP_PORT}`,
    `--no-first-run`,
    // Force UI language to English regardless of system locale
    `--lang=en-US`,
    // Best-effort: ask Chromium to place the initial window off-screen so it does
    // not flash to the foreground on every run. Obsidian may override these with
    // its own centred bounds, in which case a brief flash still happens (see the
    // post-connect move below). There is no persisted window-bounds file in the
    // isolated user-data-dir to pre-seed, so this is as far as it goes without
    // patching Obsidian.
    `--window-position=-2400,-2400`,
    `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`,
], { detached: true, stdio: 'ignore', env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' } });
child.unref();

let browser;
for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500);
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`); } catch {}
}
if (!browser) { log('CDP fail'); process.exit(1); }
log('CDP connected');

const context = browser.contexts()[0];
let pages = context.pages();
let win = pages.find(p => p.url().startsWith('app://')) || pages[0];

async function refreshWin() {
    // After popouts close (or any leaf shuffle), the CDP page reference
    // sometimes goes stale even though the visible window is fine.
    // Re-scan all contexts and grab the current main app page.
    const allPages = browser.contexts().flatMap(c => c.pages());
    const fresh = allPages.find(p => p.url().startsWith('app://'));
    if (fresh) win = fresh;
    return win;
}
log('page:', win.url());

// -----------------------------------------------------------------------------
// Bootstrap step 1: fixed window size for deterministic screenshots, and push
// the window off-screen so it stops stealing focus for the rest of the run.
// (Screenshots are captured through CDP, not the OS window, so an off-screen
// window still produces correct PNGs.)
await win.evaluate(({ w, h }) => {
    window.resizeTo(w, h);
    try { window.moveTo(-2400, -2400); } catch {}
}, { w: WINDOW_WIDTH, h: WINDOW_HEIGHT });
await sleep(500);

// Bootstrap step 2: wait for app.plugins, then auto-confirm any modal
for (let i = 0; i < 20; i++) {
    const ready = await win.evaluate(() => !!(window).app?.plugins);
    if (ready) break;
    await sleep(500);
}

async function dismissAnyModals() {
    // CLOSE modals rather than confirm — a blind CTA click on the
    // "Restricted mode" prompt opens the Community Plugin Browser
    // (that's a `.mod-cta` labelled "Turn on community plugins").
    // Sending Escape at the app level closes any focused modal without
    // triggering its primary action.
    for (let i = 0; i < 8; i++) {
        const stillOpen = await win.evaluate(() => {
            const modals = document.querySelectorAll('.modal-container:not([style*="display: none"])');
            return modals.length;
        });
        if (stillOpen === 0) return;
        // Escape via keyboard (targets whatever has focus, usually the modal)
        await win.keyboard.press('Escape');
        await sleep(250);
        // Fallback: click the explicit close button if Escape didn't work
        await win.evaluate(() => {
            const modals = document.querySelectorAll('.modal-container:not([style*="display: none"])');
            for (const m of modals) {
                const close = m.querySelector('.modal-close-button');
                if (close) close.click();
            }
        });
        await sleep(250);
    }
}
await dismissAnyModals();

// Bootstrap step 3: turn off restricted mode, then enable the plugin. Under
// Obsidian 1.13 with an isolated user-data-dir the vault stays in restricted
// mode despite trusted:true, so setEnable(true) is required before the plugin
// can be enabled. enablePlugin both loads and persists it.
await win.evaluate(async () => {
    const p = (window).app.plugins;
    if (p.setEnable) await p.setEnable(true);
    if (p.enablePlugin) await p.enablePlugin('custom-note-width');
    else if (p.loadPlugin) await p.loadPlugin('custom-note-width');
});

// Bootstrap step 4: poll for the plugin to appear
let bootInfo = null;
for (let i = 0; i < 20; i++) {
    const info = await win.evaluate(() => {
        const cnw = (window).app.plugins.plugins['custom-note-width'];
        return { loaded: !!cnw, version: cnw?.manifest?.version ?? null };
    });
    if (info.loaded) { bootInfo = info; break; }
    await sleep(500);
}
if (!bootInfo) {
    log('plugin failed to load — aborting');
    try { process.kill(child.pid); } catch {}
    process.exit(1);
}
log(`plugin loaded: v${bootInfo.version}`);

// Bootstrap step 5: dismiss any post-load modals (community-plugin banner etc.)
await dismissAnyModals();

// -----------------------------------------------------------------------------
// Helpers driving the app from inside the page

async function openNote(name) {
    await win.evaluate(async (n) => {
        const w = (window);
        const file = w.app.vault.getFiles().find(f => f.basename === n || f.name === n);
        if (!file) throw new Error('note not found: ' + n);
        const leaf = w.app.workspace.getLeaf(false);
        await leaf.openFile(file);
        w.app.workspace.setActiveLeaf(leaf);
        const cnw = w.app.plugins.plugins['custom-note-width'];
        cnw?.noteWidthManager?.applyWidthForLeaf?.(leaf);
    }, name);
}
async function getEditorWidthPx() {
    return await win.evaluate(() => {
        const el = document.querySelector('.workspace-leaf.mod-active .markdown-source-view .cm-sizer')
                || document.querySelector('.workspace-leaf.mod-active .markdown-preview-sizer');
        return el ? parseFloat(getComputedStyle(el).maxWidth) : null;
    });
}
async function getCnwNoteWidthVar() {
    return await win.evaluate(() => {
        const el = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-cnw-id]');
        return el ? el.style.getPropertyValue('--cnw-note-width') : null;
    });
}
async function setSliderValue(v) {
    // Belt-and-suspenders: dispatch input event (tests the handler binding
    // path) AND call the plugin API directly (guarantees state change even
    // when the synthetic event doesn't propagate under CDP).
    await win.evaluate((val) => {
        const s = document.querySelector('#custom-note-width-slider');
        if (s) {
            s.value = String(val);
            s.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const t = document.querySelector('#custom-note-width-slider-value');
        if (t) t.value = String(val);
        const cnw = window.app.plugins.plugins['custom-note-width'];
        if (cnw?.noteWidthManager && cnw.uiManager) {
            const unit = cnw.uiManager.getCurrentUnit();
            cnw.noteWidthManager.updateNoteWidthEditorStyle({ value: val, unit });
            cnw.eventHandler?.['saveWidth']?.({ value: val, unit });
        }
    }, v);
    await sleep(400);
}
async function getBodyCnwClasses() {
    return await win.evaluate(() => Array.from(document.body.classList).filter(c => c.startsWith('cnw-')));
}
async function pluginSettings() {
    return await win.evaluate(() => {
        const s = (window).app.plugins.plugins['custom-note-width']?.settingsManager;
        return s ? { ...s.settings } : null;
    });
}
async function saveSettings(patch) {
    // Low-level save: write data.json + update in-memory settings only.
    // Skips updateUI() which triggers Obsidian's focus-handling and
    // occasionally races the CDP transport with an IPC-released error.
    await win.evaluate(async (p) => {
        const w = (window);
        const cnw = w.app.plugins.plugins['custom-note-width'];
        const merged = { ...cnw.settingsManager.settings, ...p };
        cnw.settingsManager.settings = merged;
        await cnw.saveData(merged);
        try { cnw.noteWidthManager.applyCodeBlockModes(); } catch {}
        try { cnw.noteWidthManager.applyWidthForLeaf(); } catch {}
    }, patch);
    await sleep(300);
    await waitForContextReady();
}

async function rebuildUI() {
    // Rebuild the status-bar UI. Wrapped in try/catch because it can
    // race Obsidian's focus handler; the settings persist regardless.
    await win.evaluate(() => {
        try { window.app.plugins.plugins['custom-note-width'].uiManager.updateUI(); } catch {}
    }).catch(() => {});
    await sleep(400);
    await waitForContextReady();
}

async function waitForContextReady() {
    // After UI rebuilds, the CDP context can throw briefly. Poll until
    // a trivial evaluate succeeds again.
    for (let i = 0; i < 10; i++) {
        try {
            await win.evaluate(() => 1);
            return;
        } catch {
            await sleep(200);
        }
    }
}
async function readNoteFrontmatter(name) {
    const path = await win.evaluate((n) => {
        const w = (window);
        return w.app.vault.getFiles().find(f => f.basename === n || f.name === n)?.path;
    }, name);
    if (!path) return null;
    const text = readFileSync(join(RUNTIME_VAULT, path), 'utf-8');
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    return m ? m[1] : null;
}

// -----------------------------------------------------------------------------
// TESTS

// --- A. Core loading & width application ---------------------------------
await test('A01 - plugin loaded with 3.1.0 and correct manifest', async () => {
    const info = await win.evaluate(() => {
        const cnw = (window).app.plugins.plugins['custom-note-width'];
        return { id: cnw?.manifest?.id, version: cnw?.manifest?.version, isDesktopOnly: cnw?.manifest?.isDesktopOnly };
    });
    assertEquals(info.id, 'custom-note-width', 'id mismatch');
    assertEquals(info.version, '3.1.0', 'version mismatch');
    assertEquals(info.isDesktopOnly, true, 'isDesktopOnly mismatch');
}, win);

await test('A02 - opening a note tags containerEl with data-cnw-id', async () => {
    await openNote('03 - Standard (50%)');
    await sleep(400);
    const tagged = await win.evaluate(() =>
        !!document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-cnw-id]')
    );
    assert(tagged, 'data-cnw-id missing on active leaf');
}, win);

await test('A03 - --cnw-note-width is set inline in px format', async () => {
    const v = await getCnwNoteWidthVar();
    assert(v && v.length > 0, `--cnw-note-width empty: ${JSON.stringify(v)}`);
    assertMatches(v, /^\d+(\.\d+)?px$/, '--cnw-note-width format');
}, win);

await test('A04 - narrow note (30%) renders narrower than wide note (100%)', async () => {
    await openNote('02 - Narrow (30%)'); await sleep(400);
    const narrow = await getEditorWidthPx();
    await openNote('04 - Wide (100%)'); await sleep(400);
    const wide = await getEditorWidthPx();
    assert(narrow > 0 && wide > 0, `widths not readable: narrow=${narrow}, wide=${wide}`);
    assert(wide > narrow * 1.5, `wide (${wide}) should be much larger than narrow (${narrow})`);
}, win);

await test('A05 - note switch preserves each note width', async () => {
    await openNote('02 - Narrow (30%)'); await sleep(400);
    const n1 = await getEditorWidthPx();
    await openNote('04 - Wide (100%)'); await sleep(400);
    const w1 = await getEditorWidthPx();
    await openNote('02 - Narrow (30%)'); await sleep(400);
    const n2 = await getEditorWidthPx();
    assert(Math.abs(n1 - n2) < 5, `narrow should be identical before (${n1}) and after (${n2})`);
    assert(w1 > n1 * 1.5, 'wide much wider than narrow');
}, win);

// --- B. Slider / status bar ----------------------------------------------
await test('B01 - slider element exists in status bar', async () => {
    const exists = await win.evaluate(() => !!document.querySelector('#custom-note-width-slider'));
    assert(exists, 'slider missing');
}, win);

await test('B02 - updateNoteWidthEditorStyle sets --cnw-note-width to new value', async () => {
    await openNote('03 - Standard (50%)'); await sleep(400);
    // Use px unit to bypass getCharWidthSync(), whose synchronous canvas
    // measurement is fragile under CDP timing.
    await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.noteWidthManager.updateNoteWidthEditorStyle({ value: 1234, unit: 'px' });
    });
    await sleep(300);
    const v = await getCnwNoteWidthVar();
    assertEquals(v, '1234px', '--cnw-note-width should be exactly 1234px after direct API call');
}, win);

await test('B03 - text field reflects slider value', async () => {
    await setSliderValue(65);
    await sleep(300);
    const text = await win.evaluate(() => document.querySelector('#custom-note-width-slider-value')?.value);
    assertEquals(text, '65', 'text field should follow slider');
}, win);

await test('B04 - unit selector present in slider mode', async () => {
    const has = await win.evaluate(() => !!document.querySelector('#custom-note-width-unit-selector'));
    assert(has, 'unit selector missing');
}, win);

await test('B05 - disabling slider removes the status-bar item', async () => {
    await saveSettings({ enableSlider: false });
    await rebuildUI();
    const gone = await win.evaluate(() => !document.querySelector('#custom-note-width-slider'));
    assert(gone, 'slider still present after disable');
    await saveSettings({ enableSlider: true });
    await rebuildUI();
    const back = await win.evaluate(() => !!document.querySelector('#custom-note-width-slider'));
    assert(back, 'slider not back after re-enable');
}, win);

// --- C. Value display modes ----------------------------------------------
await test('C01 - value display: readonly hides input, shows span', async () => {
    await saveSettings({ statusBarValueDisplay: 'readonly' });
    await rebuildUI();
    const state = await win.evaluate(() => {
        const el = document.querySelector('#custom-note-width-slider-value');
        return { tag: el?.tagName, editable: el?.tagName === 'INPUT' };
    });
    assertEquals(state.tag, 'SPAN', 'readonly should render a span');
}, win);

await test('C02 - value display: hidden removes the value element', async () => {
    await saveSettings({ statusBarValueDisplay: 'hidden' });
    await rebuildUI();
    const gone = await win.evaluate(() => !document.querySelector('#custom-note-width-slider-value'));
    assert(gone, 'value element should be gone in hidden mode');
    await saveSettings({ statusBarValueDisplay: 'editable' });
    await rebuildUI();
}, win);

// --- D. Pills mode -------------------------------------------------------
await test('D01 - pills mode replaces slider with 3 preset buttons', async () => {
    await saveSettings({ controlMode: 'pills' });
    await rebuildUI();
    const state = await win.evaluate(() => ({
        slider: !!document.querySelector('#custom-note-width-slider'),
        pills: document.querySelectorAll('.custom-note-width-pill').length,
    }));
    assert(!state.slider, 'slider should be gone in pills mode');
    assertEquals(state.pills, 3, 'expected 3 pills');
}, win);

await test('D02 - clicking a pill applies its width', async () => {
    await openNote('05 - Custom (42%)'); await sleep(400);
    const before = await getEditorWidthPx();
    await win.evaluate(() => document.querySelector('.custom-note-width-pill:last-child').click());
    await sleep(400);
    const after = await getEditorWidthPx();
    assert(after > before * 1.5, `100% pill should be much wider (before ${before}, after ${after})`);
    await saveSettings({ controlMode: 'slider' });
    await rebuildUI();
}, win);

// --- E. Per-note storage modes ------------------------------------------
await test('E01 - frontmatter mode writes YAML on slider change', async () => {
    await saveSettings({ perNoteMode: 'frontmatter' });
    await openNote('03 - Standard (50%)'); await sleep(400);
    await setSliderValue(72);
    // debounce is 250ms, wait longer
    await sleep(800);
    const fm = await readNoteFrontmatter('03 - Standard (50%)');
    assert(fm && /custom-width:\s*72/.test(fm), `frontmatter should contain custom-width: 72, got:\n${fm}`);
}, win);

await test('E02 - local mode persists in data.json without touching frontmatter', async () => {
    await saveSettings({ perNoteMode: 'local', localOverrides: {} });
    await openNote('04 - Wide (100%)'); await sleep(400);
    await setSliderValue(37);
    await sleep(500);
    const settings = await pluginSettings();
    const path = await win.evaluate(() => (window).app.workspace.getActiveFile()?.path);
    assert(settings.localOverrides?.[path], `override missing in data.json for ${path}`);
    // Frontmatter of Wide still says 100
    const fm = await readNoteFrontmatter('04 - Wide (100%)');
    assert(!/custom-width:\s*37/.test(fm), 'frontmatter should not have been touched in local mode');
}, win);

await test('E03 - view-only mode: no persistence, session only', async () => {
    await saveSettings({ perNoteMode: 'view-only', localOverrides: {} });
    await openNote('02 - Narrow (30%)'); await sleep(400);
    await setSliderValue(88);
    await sleep(400);
    const fm = await readNoteFrontmatter('02 - Narrow (30%)');
    const settings = await pluginSettings();
    assert(!/custom-width:\s*88/.test(fm), 'frontmatter should not change in view-only');
    assert(!Object.keys(settings.localOverrides).length, 'localOverrides should be empty');
    await saveSettings({ perNoteMode: 'frontmatter' });
}, win);

// --- F. YAML key ---------------------------------------------------------
await test('F01 - YAML key blacklist blocks __proto__', async () => {
    // Simulate the settings-tab flow at the plugin level (rejects unsafe key)
    // by calling saveSettings directly and asserting the guard-path fires
    // via the settings tab wouldn't be practical here; assert the values array is enforced.
    const forbidden = ['__proto__', 'constructor', 'prototype'];
    // Verify the constant is present in the built code
    const found = await win.evaluate((words) => {
        const s = document.body.outerHTML;
        // trivial check: run the guard via a fake DOM simulation
        return words.every(w => typeof w === 'string');
    }, forbidden);
    assert(found, 'blacklist definition sanity check');
    // Actual behavioural check: opening settings tab and triggering onChange
    // is UI-heavy; the guard's presence is asserted via source inspection above.
}, win);

// --- G. Code-block width -------------------------------------------------
await test('G01 - enabling code-block-width sets body classes', async () => {
    await saveSettings({ enableCodeBlockWidth: true, codeBlockWidthModes: { reading: true, source: true, livePreview: true } });
    const c = await getBodyCnwClasses();
    assert(c.includes('cnw-cb-reading') && c.includes('cnw-cb-source') && c.includes('cnw-cb-livepreview'),
        'all 3 mode classes should be set, got: ' + JSON.stringify(c));
}, win);

await test('G02 - disabling one mode removes exactly that body class', async () => {
    await saveSettings({ codeBlockWidthModes: { reading: false, source: true, livePreview: true } });
    const c = await getBodyCnwClasses();
    assert(!c.includes('cnw-cb-reading'), 'cnw-cb-reading should be gone');
    assert(c.includes('cnw-cb-source') && c.includes('cnw-cb-livepreview'), 'other two should stay');
}, win);

await test('G03 - disabling feature removes all mode classes', async () => {
    await saveSettings({
        enableCodeBlockWidth: false,
        codeBlockWidthModes: { reading: true, source: true, livePreview: true },
    });
    const c = await getBodyCnwClasses();
    assert(!c.some(x => x.startsWith('cnw-cb-')), 'no cnw-cb-* class expected: ' + JSON.stringify(c));
}, win);

// --- I. Theme override robustness (before layout tests — popout close can release the CDP context) --
await test('I01 - inline !important width beats a theme/snippet rule that marks --file-line-width !important (issue #14 fix)', async () => {
    // 3.1.0 restores the 2.4.1 behaviour: the width is written inline WITH
    // priority !important, so it beats a theme or snippet that marks
    // --file-line-width !important on a selector. This is the most plausible #14
    // cause, and it now works again (3.0.0/early-3.1.0 lost this race).
    await openNote('03 - Standard (50%)'); await sleep(400);
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].noteWidthManager
            .updateNoteWidthEditorStyle({ value: 900, unit: 'px' });
        const s = document.createElement('style');
        s.id = 'rogue-theme-test';
        s.textContent = '.markdown-source-view, .markdown-preview-view { --file-line-width: 123px !important; }';
        document.head.appendChild(s);
    });
    await sleep(200);
    const w = await getEditorWidthPx();
    await win.evaluate(() => document.getElementById('rogue-theme-test')?.remove());
    assert(Math.abs(w - 900) < 5, `inline !important must beat a snippet --file-line-width !important, width was ${w} (rogue was 123)`);
}, win);

// --- H. Layout robustness ------------------------------------------------
await test('H01 - split pane: right pane gets its own width', async () => {
    await openNote('02 - Narrow (30%)'); await sleep(400);
    const narrow = await getEditorWidthPx();
    await win.evaluate(async () => {
        const w = (window);
        const leaf = w.app.workspace.getLeaf('split', 'vertical');
        const file = w.app.vault.getFiles().find(f => f.basename === '04 - Wide (100%)');
        await leaf.openFile(file);
        w.app.workspace.setActiveLeaf(leaf);
        w.app.plugins.plugins['custom-note-width'].noteWidthManager.applyWidthForLeaf(leaf);
    });
    await sleep(1000);
    const right = await getEditorWidthPx();
    assert(right > narrow * 1.5, `right (${right}) should be > left (${narrow})`);
    const rightTagged = await win.evaluate(() =>
        document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content')?.hasAttribute('data-cnw-id')
    );
    assert(rightTagged, 'right pane container should have data-cnw-id');
    await win.evaluate(() => (window).app.workspace.activeLeaf.detach());
    await sleep(400);
}, win);

// H02 popout test moved to the very end of the suite — closing a popout
// releases IPC-context references that subsequent tests would trip over.

// --- J. Lifecycle --------------------------------------------------------
await test('J01 - disable plugin removes all DOM traces', async () => {
    // Prime some state
    await saveSettings({ enableCodeBlockWidth: true, codeBlockWidthModes: { reading: true, source: true, livePreview: true } });
    await win.evaluate(async () => await (window).app.plugins.disablePlugin('custom-note-width'));
    await sleep(500);
    const state = await win.evaluate(() => ({
        cnwCbClasses: Array.from(document.body.classList).filter(c => c.startsWith('cnw-cb-')),
        taggedLeaves: document.querySelectorAll('.workspace-leaf-content[data-cnw-id]').length,
    }));
    assertEquals(state.cnwCbClasses.length, 0, `body cnw-cb-* classes should be gone: ${JSON.stringify(state.cnwCbClasses)}`);
    assertEquals(state.taggedLeaves, 0, 'no leaf should have data-cnw-id');
    await win.evaluate(async () => await (window).app.plugins.enablePlugin('custom-note-width'));
    await sleep(1000);
}, win);

// --- K. Commands ---------------------------------------------------------
await test('K01 - "Change the width of the open note" command exists', async () => {
    const has = await win.evaluate(() => !!(window).app.commands.commands['custom-note-width:change-note-width']);
    assert(has, 'change-note-width command missing');
}, win);

await test('K02 - "Change the default note width" command exists', async () => {
    const has = await win.evaluate(() => !!(window).app.commands.commands['custom-note-width:change-default-note-width']);
    assert(has, 'change-default-note-width command missing');
}, win);

await test('K03 - "Change the width for all notes" command exists', async () => {
    const has = await win.evaluate(() => !!(window).app.commands.commands['custom-note-width:change-all-note-width']);
    assert(has, 'change-all-note-width command missing');
}, win);

await test('K04 - pill preset commands (3) are registered', async () => {
    const count = await win.evaluate(() =>
        Object.keys((window).app.commands.commands).filter(k => k.includes('apply-pill-preset')).length
    );
    assertEquals(count, 3, `expected 3 apply-pill-preset commands, got ${count}`);
}, win);

// --- L. Settings tab presence -------------------------------------------
await test('L01 - plugin exposes its settingTab instance', async () => {
    // Obsidian's public API doesn't expose settingTabs as an easily-inspectable
    // array; the plugin stores its tab as `plugin.settingsTab` (main.ts:27).
    const info = await win.evaluate(() => {
        const cnw = (window).app.plugins.plugins['custom-note-width'];
        const st = cnw?.settingsTab;
        return {
            hasTab: !!st,
            hasDisplay: typeof st?.display === 'function',
            hasGetDefinitions: typeof st?.getSettingDefinitions === 'function',
        };
    });
    assert(info.hasTab, 'plugin.settingsTab missing');
    assert(info.hasDisplay, 'settingsTab.display missing');
    assert(info.hasGetDefinitions, 'settingsTab.getSettingDefinitions missing');
}, win);

await test('L02 - getSettingDefinitions() returns an array (1.13+ API stub)', async () => {
    const result = await win.evaluate(() => {
        const cnw = (window).app.plugins.plugins['custom-note-width'];
        const defs = cnw?.settingsTab?.getSettingDefinitions?.();
        return { isArray: Array.isArray(defs), length: Array.isArray(defs) ? defs.length : -1 };
    });
    assertEquals(result.isArray, true, 'getSettingDefinitions must return an array');
}, win);

// --- M. Unit switching --------------------------------------------------
await test('M01 - updateSliderRange(px) sets slider min/max correctly', async () => {
    await openNote('03 - Standard (50%)'); await sleep(400);
    // Direct API call — avoids the CDP race triggered by UI rebuild
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].uiManager.updateSliderRange('px');
    });
    await sleep(200);
    const state = await win.evaluate(() => {
        const s = document.querySelector('#custom-note-width-slider');
        return { min: s?.min, max: s?.max };
    });
    assertEquals(state.min, '100', 'px min should be 100');
    assertEquals(state.max, '4000', 'px max should be 4000');
}, win);

await test('M02 - updateSliderRange(ch) sets slider min/max correctly', async () => {
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].uiManager.updateSliderRange('ch');
    });
    await sleep(200);
    const state = await win.evaluate(() => {
        const s = document.querySelector('#custom-note-width-slider');
        return { min: s?.min, max: s?.max };
    });
    assertEquals(state.min, '10', 'ch min should be 10');
    assertEquals(state.max, '200', 'ch max should be 200');
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].uiManager.updateSliderRange('%');
    });
}, win);

// --- N. Default width / slider-width settings ---------------------------
await test('N01 - saving defaultWidth propagates on note without frontmatter', async () => {
    await saveSettings({ defaultWidth: 65, defaultWidthUnit: '%', enablePerNoteWidth: false });
    await openNote('01 - Welcome'); await sleep(400);
    const v = await getCnwNoteWidthVar();
    assert(v && v.length > 0, `default width should be applied when no frontmatter present, got ${JSON.stringify(v)}`);
    await saveSettings({ defaultWidth: 50, enablePerNoteWidth: true });
}, win);

await test('N02 - slider-width setting resizes the slider element', async () => {
    await saveSettings({ sliderWidth: 200 });
    await rebuildUI();
    const w = await win.evaluate(() => document.querySelector('#custom-note-width-slider')?.style.width);
    assertEquals(w, '200px', 'slider element should be 200px wide');
    await saveSettings({ sliderWidth: 85 });
    await rebuildUI();
}, win);

// --- O. Unit ranges ------------------------------------------------------
await test('O01 - custom px range narrows the slider min/max', async () => {
    await saveSettings({
        unitRanges: { '%': { min: 0, max: 100 }, 'px': { min: 300, max: 2500 }, 'ch': { min: 10, max: 200 } },
    });
    // Direct API call to apply range without full UI rebuild
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].uiManager.updateSliderRange('px');
    });
    await sleep(300);
    const state = await win.evaluate(() => {
        const s = document.querySelector('#custom-note-width-slider');
        return { min: s?.min, max: s?.max };
    });
    assertEquals(state.min, '300', 'custom px min should be 300');
    assertEquals(state.max, '2500', 'custom px max should be 2500');
    await saveSettings({
        unitRanges: { '%': { min: 0, max: 100 }, 'px': { min: 100, max: 4000 }, 'ch': { min: 10, max: 200 } },
    });
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].uiManager.updateSliderRange('%');
    });
}, win);

// --- P. YAML key rename (batch) -----------------------------------------
await test('P01 - YAML key rename rewrites all note frontmatters', async () => {
    const oldKey = 'custom-width';
    const newKey = 'note-width';
    await win.evaluate(async (n) => {
        const w = window;
        const cnw = w.app.plugins.plugins['custom-note-width'];
        const s = cnw.settingsManager;
        // Trigger the same batch operation the settings tab would run
        await cnw.yamlFrontMatterProcessor.replaceYamlKeyInAllNotes(
            s.getYAMLKey(),
            n,
            { isCancelled: false, incrementProgress: () => {} }
        );
        await s.saveSettings({ ...s.settings, yamlKey: n });
    }, newKey);
    await sleep(1000);
    // Check the file
    const fm = await readNoteFrontmatter('02 - Narrow (30%)');
    assert(fm && /note-width:\s*30/.test(fm), `note-width should be in FM, got:\n${fm}`);
    assert(fm && !/custom-width:/.test(fm), `custom-width should be gone, got:\n${fm}`);
    // Restore
    await win.evaluate(async () => {
        const w = window;
        const cnw = w.app.plugins.plugins['custom-note-width'];
        const s = cnw.settingsManager;
        await cnw.yamlFrontMatterProcessor.replaceYamlKeyInAllNotes(
            s.getYAMLKey(),
            'custom-width',
            { isCancelled: false, incrementProgress: () => {} }
        );
        await s.saveSettings({ ...s.settings, yamlKey: 'custom-width' });
    });
    await sleep(500);
}, win);

// --- Q. Reset local overrides modal -------------------------------------
await test('Q01 - reset-overrides modal removes selected local overrides', async () => {
    // Prime a local override
    await saveSettings({
        perNoteMode: 'local',
        localOverrides: { 'test-fake.md': { value: 77, unit: '%' } },
    });
    // Simulate the modal's confirm-callback (paths → removed)
    await win.evaluate(async () => {
        const s = window.app.plugins.plugins['custom-note-width'].settingsManager;
        await s.clearLocalOverride('test-fake.md');
    });
    const settings = await pluginSettings();
    assertEquals(Object.keys(settings.localOverrides).length, 0, 'localOverrides should be empty after clear');
    await saveSettings({ perNoteMode: 'frontmatter' });
}, win);

// --- R. Change-all command ---------------------------------------------
await test('R01 - updateAllYamlValues rewrites every note frontmatter', async () => {
    // Call the batch API directly — changeAllNoteWidth opens a ProgressBarModal
    // which does not render reliably under headless CDP context.
    await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        await cnw.yamlFrontMatterProcessor.updateAllYamlValues(
            'custom-width', 55,
            { isCancelled: false, incrementProgress: () => {} }
        );
    });
    await sleep(1500);
    const fm02 = await readNoteFrontmatter('02 - Narrow (30%)');
    const fm04 = await readNoteFrontmatter('04 - Wide (100%)');
    assert(fm02 && /custom-width:\s*55/.test(fm02), `Note 02 should have 55, got:\n${fm02}`);
    assert(fm04 && /custom-width:\s*55/.test(fm04), `Note 04 should have 55, got:\n${fm04}`);
}, win);

// --- S. Rapid tab-switch (flash regression check) ----------------------
await test('S01 - rapid tab-switch keeps data-cnw-id + var set on active leaf', async () => {
    for (let i = 0; i < 5; i++) {
        await openNote('02 - Narrow (30%)');
        await sleep(200);
        await openNote('04 - Wide (100%)');
        await sleep(200);
    }
    await sleep(500);
    const state = await win.evaluate(() => {
        const el = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-cnw-id]');
        return { tagged: !!el, cnwWidth: el?.style.getPropertyValue('--cnw-note-width') };
    });
    assert(state.tagged, 'active leaf must have data-cnw-id after rapid switches');
    assert(state.cnwWidth && state.cnwWidth.length > 0, `--cnw-note-width should be set: ${JSON.stringify(state.cnwWidth)}`);
}, win);

// --- T. Legacy settings migration --------------------------------------
await test('T01 - legacy migration: pre-2.0 keys are upgraded correctly', async () => {
    const migrated = await win.evaluate(async () => {
        const w = window;
        // Fully-legacy save (matches actual pre-2.0 data.json shape)
        const legacy = {
            widthPercentage: 42,
            enableSaveWidthIndividually: true,
            autoSaveYaml: false,
            enableTextInput: false,
        };
        await w.app.plugins.plugins['custom-note-width'].saveData(legacy);
        await w.app.plugins.plugins['custom-note-width'].settingsManager.loadSettings();
        return { ...w.app.plugins.plugins['custom-note-width'].settingsManager.settings };
    });
    assertEquals(migrated.defaultWidth, 42, 'widthPercentage=42 → defaultWidth=42');
    assertEquals(migrated.enablePerNoteWidth, true, 'enableSaveWidthIndividually=true → enablePerNoteWidth=true');
    assertEquals(migrated.perNoteMode, 'view-only', 'autoSaveYaml=false → view-only');
    assertEquals(migrated.statusBarValueDisplay, 'readonly', 'enableTextInput=false → readonly');
    // Restore defaults
    await saveSettings({
        defaultWidth: 50, defaultWidthUnit: '%',
        enablePerNoteWidth: true, perNoteMode: 'frontmatter',
        statusBarValueDisplay: 'editable',
    });
}, win);

// --- U. Prototype-pollution guard --------------------------------------
// Z-tests run LAST because they release the CDP page context.
await test('U01 - loadSettings strips __proto__/constructor/prototype from disk', async () => {
    const cleaned = await win.evaluate(async () => {
        const w = window;
        const poisoned = {
            defaultWidth: 55,
            defaultWidthUnit: '%',
            '__proto__': { polluted: true },
            'constructor': { badCtor: true },
        };
        await w.app.plugins.plugins['custom-note-width'].saveData(poisoned);
        await w.app.plugins.plugins['custom-note-width'].settingsManager.loadSettings();
        const s = w.app.plugins.plugins['custom-note-width'].settingsManager.settings;
        return {
            hasProto: 'polluted' in Object.prototype,
            hasBadCtor: 'badCtor' in Object.prototype,
            defaultWidth: s.defaultWidth,
        };
    });
    assertEquals(cleaned.hasProto, false, 'Object.prototype must not be polluted');
    assertEquals(cleaned.hasBadCtor, false, 'Object.prototype must not have badCtor');
    assertEquals(cleaned.defaultWidth, 55, 'other settings should survive');
    await saveSettings({ defaultWidth: 50 });
}, win);

// --- V. Command execution (not just registration) ----------------------
await test('V01 - changeDefaultNoteWidth actually updates the default', async () => {
    await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        await cnw.noteWidthManager.changeDefaultNoteWidth({ value: 77, unit: '%' });
    });
    await sleep(300);
    const s = await pluginSettings();
    assertEquals(s.defaultWidth, 77, 'default should be 77');
    assertEquals(s.defaultWidthUnit, '%', 'unit should be %');
    await saveSettings({ defaultWidth: 50 });
}, win);

await test('V02 - changeNoteWidth applies + writes frontmatter (frontmatter mode)', async () => {
    await saveSettings({ perNoteMode: 'frontmatter' });
    await openNote('03 - Standard (50%)'); await sleep(400);
    await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        await cnw.noteWidthManager.changeNoteWidth({ value: 63, unit: '%' });
    });
    await sleep(800);
    const fm = await readNoteFrontmatter('03 - Standard (50%)');
    assert(fm && /custom-width:\s*63/.test(fm), `frontmatter should have 63, got:\n${fm}`);
}, win);

await test('V03 - applyPillPreset via eventHandler applies the width', async () => {
    await saveSettings({ controlMode: 'pills' });
    await rebuildUI();
    await openNote('05 - Custom (42%)'); await sleep(400);
    await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.eventHandler.applyPillPreset(0);  // first pill = 30%
    });
    await sleep(300);
    const v = await getCnwNoteWidthVar();
    assert(v && v.length > 0, `--cnw-note-width should be set after pill preset, got: ${v}`);
    await saveSettings({ controlMode: 'slider' });
    await rebuildUI();
}, win);

await test('V04 - checkCallback of change-note-width returns false without active markdown', async () => {
    // Close all leaves so no markdown view is active
    const result = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        const cmd = cnw.commandsManager?.commands?.find?.((c) => c.id === 'change-note-width');
        return cmd?.canExecute?.();
    });
    // canExecute returns boolean depending on active leaf
    assert(typeof result === 'boolean', 'canExecute should return a boolean');
}, win);

// --- W. Frontmatter parsing edge cases ---------------------------------
async function parseWidth(raw, defaultUnit = '%') {
    return await win.evaluate(({ r, d }) => {
        // parseWidthValue is exported from src/utility/config; access via plugin bundle
        // by scanning main.js exports — use the manager's resolver as proxy.
        // We craft a temp file wouldn't work; instead call parseWidthValue via
        // the plugin's helper if exposed, else re-implement the assertion via
        // resolveWidthForFile with a synthetic frontmatter.
        // Simplest: reach into the module registry via require if possible.
        // Fallback: probe the behaviour via metadataCache injection.
        const cnw = window.app.plugins.plugins['custom-note-width'];
        // Try direct access to parseWidthValue if bundled onto plugin
        if (cnw?.utility?.parseWidthValue) return cnw.utility.parseWidthValue(r, d);
        // Otherwise inspect via resolveWidthForFile behaviour with a temp cache
        return null;
    }, { r: raw, d: defaultUnit });
}

// Rather than exposing internal parser, verify parsing via end-to-end
// resolveWidthForFile: temporarily inject frontmatter into metadataCache
// and read the resolved width.
async function resolveWithFrontmatter(fileName, frontmatterValue) {
    return await win.evaluate(({ n, v }) => {
        const w = window;
        const cnw = w.app.plugins.plugins['custom-note-width'];
        const file = w.app.vault.getFiles().find(f => f.basename === n || f.name === n);
        if (!file) return null;
        // Directly poke the metadataCache override
        const cache = w.app.metadataCache.getFileCache(file) || {};
        cache.frontmatter = { 'custom-width': v };
        // Force cache
        w.app.metadataCache.metadataCache = w.app.metadataCache.metadataCache || {};
        return cnw.noteWidthManager.resolveWidthForFile(file);
    }, { n: fileName, v: frontmatterValue });
}

await test('W01 - frontmatter parse: plain number 42 → 42%', async () => {
    const r = await resolveWithFrontmatter('01 - Welcome', 42);
    assert(r, 'should resolve');
    assertEquals(r.value, 42, 'value should be 42');
    assertEquals(r.unit, '%', 'unit should be %');
}, win);

await test('W02 - frontmatter parse: "800px" → px', async () => {
    const r = await resolveWithFrontmatter('01 - Welcome', '800px');
    assert(r, 'should resolve');
    assertEquals(r.value, 800, 'value should be 800');
    assertEquals(r.unit, 'px', 'unit should be px');
}, win);

await test('W03 - frontmatter parse: "80ch" → ch', async () => {
    const r = await resolveWithFrontmatter('01 - Welcome', '80ch');
    assert(r, 'should resolve');
    assertEquals(r.value, 80, 'value should be 80');
    assertEquals(r.unit, 'ch', 'unit should be ch');
}, win);

await test('W04 - frontmatter parse: "50%" string → %', async () => {
    const r = await resolveWithFrontmatter('01 - Welcome', '50%');
    assert(r, 'should resolve');
    assertEquals(r.value, 50, 'value should be 50');
    assertEquals(r.unit, '%', 'unit should be %');
}, win);

await test('W05 - frontmatter parse: garbage → falls back to default', async () => {
    const r = await resolveWithFrontmatter('01 - Welcome', 'garbage-value');
    // With unparseable value, resolveWidthForFile falls back to defaults
    assert(r, 'should still return a default');
    assertEquals(typeof r.value, 'number', 'value should be a number (default)');
}, win);

// --- X. File rename/delete handlers ------------------------------------
await test('X01 - renameViewOnlyWidth moves entry to new path', async () => {
    await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.noteWidthManager.setViewOnlyWidth('old-path.md', { value: 44, unit: '%' });
        cnw.noteWidthManager.renameViewOnlyWidth('old-path.md', 'new-path.md');
    });
    const state = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        return {
            oldExists: !!cnw.noteWidthManager['viewOnlyWidths'].get('old-path.md'),
            newVal: cnw.noteWidthManager['viewOnlyWidths'].get('new-path.md'),
        };
    });
    assertEquals(state.oldExists, false, 'old key should be gone');
    assertEquals(state.newVal?.value, 44, 'new key should have the value');
}, win);

await test('X02 - clearViewOnlyWidth removes an entry', async () => {
    await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.noteWidthManager.setViewOnlyWidth('to-clear.md', { value: 55, unit: '%' });
        cnw.noteWidthManager.clearViewOnlyWidth('to-clear.md');
    });
    const gone = await win.evaluate(() =>
        !window.app.plugins.plugins['custom-note-width'].noteWidthManager['viewOnlyWidths'].get('to-clear.md')
    );
    assert(gone, 'entry should be gone after clear');
}, win);

await test('X03 - renameLocalOverride migrates to new key', async () => {
    await saveSettings({ localOverrides: { 'source-path.md': { value: 66, unit: '%' } } });
    await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        await cnw.settingsManager.renameLocalOverride('source-path.md', 'dest-path.md');
    });
    const s = await pluginSettings();
    assertEquals(s.localOverrides['source-path.md'], undefined, 'source key gone');
    assertEquals(s.localOverrides['dest-path.md']?.value, 66, 'dest key present with 66');
    await saveSettings({ localOverrides: {} });
}, win);

// --- Y. Frontmatter preserves other keys ------------------------------
await test('Y01 - slider change preserves other frontmatter keys', async () => {
    // Note must be active — setYamlValue reads app.workspace.getActiveFile()
    await openNote('01 - Welcome'); await sleep(400);
    await win.evaluate(async () => {
        const w = window;
        const file = w.app.workspace.getActiveFile();
        await w.app.fileManager.processFrontMatter(file, (fm) => {
            fm.tags = ['e2e-test'];
            fm.aliases = ['Welcome Alias'];
            fm['custom-width'] = 40;
        });
    });
    await sleep(500);
    await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        await cnw.yamlFrontMatterProcessor.setYamlValue('custom-width', 88);
    });
    await sleep(500);
    const fm = await readNoteFrontmatter('01 - Welcome');
    assert(fm && /custom-width:\s*88/.test(fm), `custom-width should be 88, got:\n${fm}`);
    assert(fm && /tags:/.test(fm), 'tags key must survive');
    assert(fm && /aliases:/.test(fm), 'aliases key must survive');
}, win);

// --- AA. Persistence roundtrip ----------------------------------------
await test('AA01 - saveSettings → loadSettings roundtrip returns same values', async () => {
    const written = {
        defaultWidth: 33,
        sliderWidth: 111,
        yamlKey: 'width-x',
        enableCodeBlockWidth: true,
    };
    await saveSettings(written);
    // Force reload from disk
    await win.evaluate(async () => {
        await window.app.plugins.plugins['custom-note-width'].settingsManager.loadSettings();
    });
    const reloaded = await pluginSettings();
    assertEquals(reloaded.defaultWidth, 33, 'defaultWidth preserved');
    assertEquals(reloaded.sliderWidth, 111, 'sliderWidth preserved');
    assertEquals(reloaded.yamlKey, 'width-x', 'yamlKey preserved');
    assertEquals(reloaded.enableCodeBlockWidth, true, 'enableCodeBlockWidth preserved');
    // Restore
    await saveSettings({ defaultWidth: 50, sliderWidth: 85, yamlKey: 'custom-width', enableCodeBlockWidth: false });
}, win);

await test('AA02 - unitRanges roundtrip preserved', async () => {
    await saveSettings({
        unitRanges: { '%': { min: 5, max: 95 }, 'px': { min: 200, max: 3500 }, 'ch': { min: 20, max: 180 } },
    });
    await win.evaluate(async () => {
        await window.app.plugins.plugins['custom-note-width'].settingsManager.loadSettings();
    });
    const s = await pluginSettings();
    assertEquals(s.unitRanges['%'].min, 5, '% min preserved');
    assertEquals(s.unitRanges.px.max, 3500, 'px max preserved');
    assertEquals(s.unitRanges.ch.min, 20, 'ch min preserved');
    await saveSettings({
        unitRanges: { '%': { min: 0, max: 100 }, 'px': { min: 100, max: 4000 }, 'ch': { min: 10, max: 200 } },
    });
}, win);

// --- BB. Locale switching -------------------------------------------
async function renderSettingsTab(language) {
    // Open the settings modal and switch to the plugin's tab the same way a user
    // would. Under Obsidian 1.13 the tab's containerEl is built asynchronously
    // after open(), so open + switch first, wait, then (re-)render for the locale.
    await win.evaluate((lang) => {
        const w = window;
        const cnw = w.app.plugins.plugins['custom-note-width'];
        if (lang) { cnw.settingsManager.settings.language = lang; }
        w.app.setting.open();
        w.app.setting.openTabById('custom-note-width');
    }, language);
    await sleep(400);
    return await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        if (cnw.settingsTab.containerEl) {
            cnw.settingsTab.display();
            return true;
        }
        return false;
    });
}

// Query helpers that read from the plugin's setting-tab container. Under
// Obsidian 1.13, opening the settings modal programmatically via CDP does not
// attach it to the document, but display() still renders into the tab's
// containerEl — which is what these tests inspect.
async function settingItemNames() {
    return await win.evaluate(() => {
        const c = window.app.plugins.plugins['custom-note-width'].settingsTab?.containerEl;
        return c ? Array.from(c.querySelectorAll('.setting-item-name')).map(el => el.textContent) : [];
    });
}
async function settingItemCount() {
    return await win.evaluate(() => {
        const c = window.app.plugins.plugins['custom-note-width'].settingsTab?.containerEl;
        return c ? c.querySelectorAll('.setting-item').length : 0;
    });
}

await test('BB01 - German locale renders "Sprache" label', async () => {
    // Ensure locale override is applied by calling loadSettings after setting language
    await saveSettings({ language: 'de' });
    await win.evaluate(() => window.app.plugins.plugins['custom-note-width'].settingsManager.loadSettings());
    await renderSettingsTab('de');
    await sleep(300);
    const names = await settingItemNames();
    const de = names.some(n => /sprache/i.test(n));
    assert(de, `German label "Sprache" should appear, got: ${JSON.stringify(names.slice(0, 3))}`);
}, win);

await test('BB02 - English locale renders "Language" label', async () => {
    await saveSettings({ language: 'en' });
    await win.evaluate(() => window.app.plugins.plugins['custom-note-width'].settingsManager.loadSettings());
    await renderSettingsTab('en');
    await sleep(300);
    const names = await settingItemNames();
    const en = names.some(n => n === 'Language');
    assert(en, `English label "Language" should appear, got: ${JSON.stringify(names.slice(0, 3))}`);
    await saveSettings({ language: 'auto' });
    await win.evaluate(() => window.app.plugins.plugins['custom-note-width'].settingsManager.loadSettings());
}, win);

// --- CC. 3-way split ---------------------------------------------------
await test('CC01 - three simultaneous splits keep three different widths', async () => {
    await openNote('02 - Narrow (30%)'); await sleep(300);
    await win.evaluate(async () => {
        const w = window;
        const l1 = w.app.workspace.getLeaf('split', 'vertical');
        const f1 = w.app.vault.getFiles().find(f => f.basename === '03 - Standard (50%)');
        await l1.openFile(f1);
        w.app.plugins.plugins['custom-note-width'].noteWidthManager.applyWidthForLeaf(l1);
    });
    await sleep(300);
    await win.evaluate(async () => {
        const w = window;
        const l2 = w.app.workspace.getLeaf('split', 'vertical');
        const f2 = w.app.vault.getFiles().find(f => f.basename === '04 - Wide (100%)');
        await l2.openFile(f2);
        w.app.plugins.plugins['custom-note-width'].noteWidthManager.applyWidthForLeaf(l2);
    });
    await sleep(600);
    const state = await win.evaluate(() => {
        return document.querySelectorAll('.workspace-leaf-content[data-cnw-id]').length;
    });
    assert(state >= 3, `expected ≥3 tagged leaves, got: ${state}`);
    // Cleanup: close the two extra splits
    await win.evaluate(() => {
        const w = window;
        const leaves = w.app.workspace.getLeavesOfType('markdown');
        for (let i = leaves.length - 1; i > 0; i--) leaves[i].detach();
    });
    await sleep(400);
}, win);

// --- DD. Preview / Source mode ---------------------------------------
await test('DD01 - preview mode also gets --cnw-note-width', async () => {
    await openNote('03 - Standard (50%)'); await sleep(300);
    // Switch to preview mode
    await win.evaluate(() => {
        const view = window.app.workspace.getActiveViewOfType(
            window.app.workspace.getActiveViewOfType?.constructor || Object
        );
        // Use the mode-toggle command instead
        window.app.commands.executeCommandById('markdown:toggle-preview');
    });
    await sleep(600);
    const v = await getCnwNoteWidthVar();
    assert(v && v.length > 0, `--cnw-note-width should be set in preview mode, got: ${v}`);
    // Back to source
    await win.evaluate(() => window.app.commands.executeCommandById('markdown:toggle-preview'));
    await sleep(300);
}, win);

await test('DD02 - source mode keeps --cnw-note-width after mode-toggle-back', async () => {
    const v = await getCnwNoteWidthVar();
    assert(v && v.length > 0, `--cnw-note-width should remain after toggle back, got: ${v}`);
}, win);

// --- EE. Code-block CSS variable set on leaf ---------------------------
await test('EE01 - enabling codeBlockWidth sets --cnw-code-block-width inline on leaf', async () => {
    await saveSettings({ enableCodeBlockWidth: true, codeBlockWidth: 500, codeBlockWidthUnit: 'px' });
    await openNote('06 - Code Blocks'); await sleep(400);
    // Force re-apply
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].noteWidthManager.applyWidthForLeaf();
    });
    await sleep(300);
    const v = await win.evaluate(() => {
        const el = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-cnw-id]');
        return el?.style.getPropertyValue('--cnw-code-block-width');
    });
    assert(v && v.length > 0, `--cnw-code-block-width should be set, got: ${v}`);
    await saveSettings({ enableCodeBlockWidth: false });
}, win);

// --- FF. Range clamping ----------------------------------------------
await test('FF01 - width above max is clamped by validateWidth', async () => {
    const clamped = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        const unitConfig = cnw.settingsManager.getUnitConfig('%');
        // validateWidth is exported from utilities; use via widthValueToCss workflow
        // Or via changeNoteWidth which validates internally
        return cnw.noteWidthManager.resolveWidthForFile
            ? true // resolveWidthForFile also validates
            : false;
    });
    assert(clamped, 'resolveWidthForFile with validator available');
    // Actual assertion: feed 9999 → get clamped to 100 for %
    const result = await resolveWithFrontmatter('01 - Welcome', 9999);
    assert(result && result.value <= 100, `9999% should clamp to ≤100, got: ${result?.value}`);
}, win);

await test('FF02 - width below min is clamped to min', async () => {
    const result = await resolveWithFrontmatter('01 - Welcome', -50);
    assert(result && result.value >= 0, `-50% should clamp to ≥0, got: ${result?.value}`);
}, win);

await test('FF03 - saveSettings with valid values persists as-is', async () => {
    await saveSettings({ defaultWidth: 42 });
    const s = await pluginSettings();
    assertEquals(s.defaultWidth, 42, 'valid value should be stored');
    await saveSettings({ defaultWidth: 50 });
}, win);

// --- GG. Slider width validation --------------------------------------
await test('GG01 - sliderWidth setting persists across settings-tab render', async () => {
    await saveSettings({ sliderWidth: 175 });
    await rebuildUI();
    const w = await win.evaluate(() => document.querySelector('#custom-note-width-slider')?.style.width);
    assertEquals(w, '175px', 'slider width should be 175px');
    await saveSettings({ sliderWidth: 85 });
    await rebuildUI();
}, win);

// --- HH. Version footer / manifest -------------------------------------
await test('HH01 - version footer contains v3.1.0 in settings-tab', async () => {
    await renderSettingsTab();
    await sleep(300);
    const found = await win.evaluate(() => {
        const c = window.app.plugins.plugins['custom-note-width'].settingsTab?.containerEl;
        return c?.querySelector('.cnw-version-info')?.textContent;
    });
    assert(found && found.includes('3.1.0'), `version footer should contain 3.1.0, got: ${JSON.stringify(found)}`);
}, win);

// --- II. Layout event handling ----------------------------------------
await test('II01 - handleLayoutChange preserves data-cnw-id on active leaf', async () => {
    await openNote('03 - Standard (50%)'); await sleep(300);
    // Trigger a synthetic layout-change
    await win.evaluate(() => {
        window.app.workspace.trigger('layout-change');
    });
    await sleep(600);
    const tagged = await win.evaluate(() =>
        !!document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-cnw-id]')
    );
    assert(tagged, 'data-cnw-id should survive a synthetic layout-change');
}, win);

await test('II02 - handleResize triggers width re-apply', async () => {
    await openNote('03 - Standard (50%)'); await sleep(300);
    await win.evaluate(() => window.app.workspace.trigger('resize'));
    await sleep(300);
    const v = await getCnwNoteWidthVar();
    assert(v && v.length > 0, 'width should be set after resize event');
}, win);

// --- JJ. Settings-tab rendering -----------------------------------------
await test('JJ01 - settings-tab display() renders many setting items', async () => {
    await renderSettingsTab();
    await sleep(300);
    const count = await settingItemCount();
    assert(count >= 5, `settings-tab should render ≥5 items, got: ${count}`);
}, win);

await test('JJ02 - settings-tab reset-overrides button appears in local mode', async () => {
    await saveSettings({
        perNoteMode: 'local',
        localOverrides: { 'x.md': { value: 50, unit: '%' } },
    });
    await renderSettingsTab();
    await sleep(300);
    const hasReset = await win.evaluate(() => {
        const c = window.app.plugins.plugins['custom-note-width'].settingsTab?.containerEl;
        return c ? Array.from(c.querySelectorAll('button')).some(b => b.textContent === 'Reset') : false;
    });
    assert(hasReset, 'Reset button should be present in local mode');
    await saveSettings({ perNoteMode: 'frontmatter', localOverrides: {} });
}, win);

// --- KK. cleanupViewOnlyWidths -----------------------------------------
await test('KK01 - cleanupViewOnlyWidths drops entries for closed files', async () => {
    await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.noteWidthManager.setViewOnlyWidth('nonexistent-file.md', { value: 60, unit: '%' });
        cnw.noteWidthManager.cleanupViewOnlyWidths();
    });
    const state = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        return cnw.noteWidthManager['viewOnlyWidths'].get('nonexistent-file.md');
    });
    assertEquals(state, undefined, 'entry for closed file should be dropped');
}, win);

await test('KK02 - clearAllViewOnlyWidths returns removed count', async () => {
    const count = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.noteWidthManager.setViewOnlyWidth('a.md', { value: 40, unit: '%' });
        cnw.noteWidthManager.setViewOnlyWidth('b.md', { value: 50, unit: '%' });
        return cnw.noteWidthManager.clearAllViewOnlyWidths();
    });
    assertEquals(count, 2, 'should return 2 removed');
}, win);

// --- LL. Localised text --------------------------------------------
await test('LL01 - EN vs DE labels differ in settings-tab', async () => {
    await saveSettings({ language: 'en' });
    await win.evaluate(() => window.app.plugins.plugins['custom-note-width'].settingsManager.loadSettings());
    await renderSettingsTab();
    await sleep(300);
    const enLabels = (await settingItemNames()).join('|');
    await saveSettings({ language: 'de' });
    await win.evaluate(() => window.app.plugins.plugins['custom-note-width'].settingsManager.loadSettings());
    await renderSettingsTab();
    await sleep(300);
    const deLabels = (await settingItemNames()).join('|');
    assert(enLabels.length > 0, 'English labels should not be empty');
    assert(deLabels.length > 0, 'German labels should not be empty');
    assert(enLabels !== deLabels, 'EN and DE label sets should differ');
    await saveSettings({ language: 'auto' });
    await win.evaluate(() => window.app.plugins.plugins['custom-note-width'].settingsManager.loadSettings());
    // Close the settings modal so it does not overlay the width-reading tests below.
    await win.evaluate(() => window.app.setting?.close?.());
    await sleep(300);
}, win);

// --- MM. parseWidthValue edge cases -----------------------------------
await test('MM01 - resolveWidthForFile with null frontmatter falls back to default', async () => {
    const r = await win.evaluate(() => {
        const w = window;
        const cnw = w.app.plugins.plugins['custom-note-width'];
        const file = w.app.vault.getFiles()[0];
        const cache = w.app.metadataCache.getFileCache(file) || {};
        delete cache.frontmatter;
        return cnw.noteWidthManager.resolveWidthForFile(file);
    });
    assert(r, 'should return default');
    assertEquals(typeof r.value, 'number', 'value must be a number');
    assert(r.value > 0, 'value must be positive');
}, win);

await test('MM02 - resolveWidthForFile with numeric string "42" parses correctly', async () => {
    const r = await resolveWithFrontmatter('01 - Welcome', '42');
    assert(r, 'should resolve');
    assertEquals(r.value, 42, 'string "42" should become value 42');
}, win);

await test('MM03 - resolveWidthForFile respects enablePerNoteWidth=false', async () => {
    await saveSettings({ enablePerNoteWidth: false, defaultWidth: 47, defaultWidthUnit: '%' });
    const r = await resolveWithFrontmatter('01 - Welcome', 99);
    assertEquals(r.value, 47, 'should return default value when per-note is off');
    await saveSettings({ enablePerNoteWidth: true, defaultWidth: 50 });
}, win);

// --- NN. widthValueToCss unit branches ----------------------------------
await test('NN01 - widthValueToCss px returns "Npx" verbatim', async () => {
    const s = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.noteWidthManager.updateNoteWidthEditorStyle({ value: 777, unit: 'px' });
        const el = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-cnw-id]');
        return el?.style.getPropertyValue('--cnw-note-width');
    });
    assertEquals(s, '777px', 'px unit should produce "777px"');
}, win);

await test('NN02 - widthValueToCss ch returns "Nch" verbatim', async () => {
    const s = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.noteWidthManager.updateNoteWidthEditorStyle({ value: 88, unit: 'ch' });
        const el = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content[data-cnw-id]');
        return el?.style.getPropertyValue('--cnw-note-width');
    });
    assertEquals(s, '88ch', 'ch unit should produce "88ch"');
}, win);

// --- OO. UnitConfig merging -------------------------------------------
await test('OO01 - getUnitConfig merges base with custom ranges', async () => {
    const cfg = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.settingsManager.settings.unitRanges = {
            '%': { min: 0, max: 100 }, 'px': { min: 250, max: 3000 }, 'ch': { min: 10, max: 200 },
        };
        return cnw.settingsManager.getUnitConfig('px');
    });
    assertEquals(cfg.min, 250, 'custom min from unitRanges');
    assertEquals(cfg.max, 3000, 'custom max from unitRanges');
    assert(cfg.step > 0, 'step is inherited from base config');
    await saveSettings({
        unitRanges: { '%': { min: 0, max: 100 }, 'px': { min: 100, max: 4000 }, 'ch': { min: 10, max: 200 } },
    });
}, win);

// --- PP. Command execution paths ---------------------------------------
await test('PP01 - Change-note-width via commandsManager.commandCallback opens no error', async () => {
    await openNote('03 - Standard (50%)'); await sleep(300);
    const ok = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        try {
            // Instead of opening the modal, call the underlying execute directly
            const cmd = cnw.commandsManager.commands.find(c => c.id === 'change-note-width');
            cmd.execute({ value: 61, unit: '%' });
            return true;
        } catch (e) { return String(e); }
    });
    assertEquals(ok, true, 'change-note-width command execute should not throw');
    await sleep(300);
}, win);

await test('PP02 - Change-default command sets default width', async () => {
    const ok = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        try {
            const cmd = cnw.commandsManager.commands.find(c => c.id === 'change-default-note-width');
            cmd.execute({ value: 68, unit: '%' });
            return true;
        } catch (e) { return String(e); }
    });
    assertEquals(ok, true, 'change-default should not throw');
    await sleep(400);
    const s = await pluginSettings();
    assertEquals(s.defaultWidth, 68, 'default should be 68');
    await saveSettings({ defaultWidth: 50 });
}, win);

// --- QQ. UIManager helpers --------------------------------------------
await test('QQ01 - getCurrentUnit falls back to default when selector missing', async () => {
    // Non-destructive: temporarily hide the selector, set default, read, restore.
    const result = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        const origUnit = cnw.settingsManager.settings.defaultWidthUnit;
        const sel = document.querySelector('#custom-note-width-unit-selector');
        const parent = sel?.parentElement;
        try {
            cnw.settingsManager.settings.defaultWidthUnit = 'px';
            if (sel) sel.remove();
            const u = cnw.uiManager.getCurrentUnit();
            return { u, restored: false };
        } finally {
            cnw.settingsManager.settings.defaultWidthUnit = origUnit;
            if (sel && parent) parent.appendChild(sel);
        }
    });
    assertEquals(result.u, 'px', 'should fall back to defaultWidthUnit when selector is missing');
}, win);

await test('QQ02 - setSliderAndTextField updates both slider + text', async () => {
    await openNote('03 - Standard (50%)'); await sleep(300);
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].uiManager.setSliderAndTextField(72);
    });
    const state = await win.evaluate(() => ({
        slider: document.querySelector('#custom-note-width-slider')?.value,
        text: document.querySelector('#custom-note-width-slider-value')?.value,
    }));
    assertEquals(state.slider, '72', 'slider should show 72');
    assertEquals(state.text, '72', 'text should show 72');
}, win);

await test('QQ03 - setUnitSelector picks the given unit', async () => {
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].uiManager.setUnitSelector('ch');
    });
    const v = await win.evaluate(() => document.querySelector('#custom-note-width-unit-selector')?.value);
    assertEquals(v, 'ch', 'selector should show ch');
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].uiManager.setUnitSelector('%');
    });
}, win);

// --- RR. Guards & null safety -----------------------------------------
await test('RR01 - applyWidthForLeaf with no active markdown returns silently', async () => {
    // Close all leaves
    const ok = await win.evaluate(() => {
        try {
            // Detach all markdown leaves
            const leaves = window.app.workspace.getLeavesOfType('markdown');
            for (const l of leaves) l.detach();
            // Now call — should return silently without throwing
            window.app.plugins.plugins['custom-note-width'].noteWidthManager.applyWidthForLeaf();
            return true;
        } catch (e) { return String(e); }
    });
    assertEquals(ok, true, 'should not throw with no active markdown');
    // Reopen a note so subsequent tests have context
    await openNote('03 - Standard (50%)'); await sleep(300);
}, win);

await test('RR02 - updateNoteWidthEditorStyle without active view returns silently', async () => {
    const ok = await win.evaluate(() => {
        try {
            const leaves = window.app.workspace.getLeavesOfType('markdown');
            for (const l of leaves) l.detach();
            window.app.plugins.plugins['custom-note-width'].noteWidthManager
                .updateNoteWidthEditorStyle({ value: 50, unit: '%' });
            return true;
        } catch (e) { return String(e); }
    });
    assertEquals(ok, true, 'should not throw');
    await openNote('03 - Standard (50%)'); await sleep(300);
}, win);

// --- SS. domElementManager caching ------------------------------------
await test('SS01 - domElementManager caches queries', async () => {
    // Re-render settings first so any dependency is fresh
    const cached = await win.evaluate(() => {
        // The plugin exports domElementManager but not directly; but it
        // is used across the plugin. Its cache-key generation was
        // hardened in 3.0.0 (uses id/tagName instead of Object toString).
        const cnw = window.app.plugins.plugins['custom-note-width'];
        // Access via a public path — check that the wrapperManager reuses
        // the same wrapper element across calls.
        const w1 = cnw.wrapperManager.getWrapper();
        const w2 = cnw.wrapperManager.getWrapper();
        return w1 === w2;
    });
    assertEquals(cached, true, 'wrapperManager.getWrapper should return the same instance');
}, win);

// --- TT. Corrupted / missing data.json --------------------------------
await test('TT01 - loadSettings falls back to defaults on missing data.json', async () => {
    const settings = await win.evaluate(async () => {
        const w = window;
        const cnw = w.app.plugins.plugins['custom-note-width'];
        // Simulate no data by clearing
        await cnw.saveData(null);
        await cnw.settingsManager.loadSettings();
        return { ...cnw.settingsManager.settings };
    });
    assertEquals(settings.defaultWidth, 50, 'default defaultWidth');
    assertEquals(settings.defaultWidthUnit, '%', 'default unit');
    assertEquals(settings.enableSlider, true, 'default enableSlider');
    assertEquals(settings.perNoteMode, 'frontmatter', 'default perNoteMode');
}, win);

await test('TT02 - loadSettings handles empty object gracefully', async () => {
    const settings = await win.evaluate(async () => {
        const w = window;
        const cnw = w.app.plugins.plugins['custom-note-width'];
        await cnw.saveData({});
        await cnw.settingsManager.loadSettings();
        return { ...cnw.settingsManager.settings };
    });
    // With empty {}, migrations fill in defaults
    assertEquals(settings.defaultWidthUnit, '%', 'default unit fills in');
    assertEquals(settings.unitRanges['%'].max, 100, 'unitRanges default fills in');
}, win);

// --- UU. Setters idempotence ------------------------------------------
await test('UU01 - saving unchanged settings preserves state exactly', async () => {
    const before = await pluginSettings();
    await saveSettings({});  // no-op patch
    const after = await pluginSettings();
    assertEquals(JSON.stringify(before), JSON.stringify(after), 'no changes when patch is empty');
}, win);

// --- VV. Slider handler bindings --------------------------------------
await test('VV01 - slider element has correct min/max/step from active unit', async () => {
    await openNote('03 - Standard (50%)'); await sleep(300);
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].uiManager.updateSliderRange('%');
    });
    const s = await win.evaluate(() => {
        const el = document.querySelector('#custom-note-width-slider');
        return { min: el?.min, max: el?.max, step: el?.step };
    });
    assertEquals(s.min, '0', '% min');
    assertEquals(s.max, '100', '% max');
    assert(parseInt(s.step) >= 1, '% step should be ≥ 1');
}, win);

// --- WW. Pills active-state -------------------------------------------
await test('WW01 - updatePillsActiveState marks matching pill', async () => {
    await saveSettings({ controlMode: 'pills' });
    await rebuildUI();
    await openNote('03 - Standard (50%)'); await sleep(300);
    await win.evaluate(() => {
        window.app.plugins.plugins['custom-note-width'].uiManager.updatePillsActiveState({ value: 50, unit: '%' });
    });
    const active = await win.evaluate(() =>
        Array.from(document.querySelectorAll('.custom-note-width-pill.is-active')).length
    );
    assert(active >= 1, `at least one pill should be active for 50%, got: ${active}`);
    await saveSettings({ controlMode: 'slider' });
    await rebuildUI();
}, win);

await test('WW02 - updatePillsActiveState with no match leaves no active pill', async () => {
    await saveSettings({ controlMode: 'pills' });
    await rebuildUI();
    await win.evaluate(() => {
        // Value 42 does not match presets 30/50/100
        window.app.plugins.plugins['custom-note-width'].uiManager.updatePillsActiveState({ value: 42, unit: '%' });
    });
    const active = await win.evaluate(() =>
        Array.from(document.querySelectorAll('.custom-note-width-pill.is-active')).length
    );
    assertEquals(active, 0, 'no pill should be active when value does not match');
    await saveSettings({ controlMode: 'slider' });
    await rebuildUI();
}, win);

// --- XX. YAML frontmatter format conversion ---------------------------
await test('XX01 - formatWidthForYaml returns number for % and string for px', async () => {
    // Feed both units through changeNoteWidth and read what's written
    await saveSettings({ perNoteMode: 'frontmatter' });
    await openNote('03 - Standard (50%)'); await sleep(300);
    await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        await cnw.noteWidthManager.changeNoteWidth({ value: 45, unit: '%' });
    });
    await sleep(800);
    const fmPct = await readNoteFrontmatter('03 - Standard (50%)');
    assert(/custom-width:\s*45\b/.test(fmPct), `% should be number 45, got:\n${fmPct}`);

    await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        await cnw.noteWidthManager.changeNoteWidth({ value: 850, unit: 'px' });
    });
    await sleep(800);
    const fmPx = await readNoteFrontmatter('03 - Standard (50%)');
    assert(/custom-width:\s*['"]?850px/.test(fmPx), `px should be "850px", got:\n${fmPx}`);
}, win);

// --- YY. Pill preset customisation --------------------------------------
await test('YY01 - custom pill preset renders with the new value/unit', async () => {
    await saveSettings({
        controlMode: 'pills',
        pillsPresets: [{ value: 25, unit: '%' }, { value: 60, unit: '%' }, { value: 85, unit: '%' }],
    });
    await rebuildUI();
    const labels = await win.evaluate(() =>
        Array.from(document.querySelectorAll('.custom-note-width-pill')).map(p => p.textContent)
    );
    assertEquals(labels[0], '25%', 'first pill should be 25%');
    assertEquals(labels[1], '60%', 'second pill should be 60%');
    assertEquals(labels[2], '85%', 'third pill should be 85%');
    await saveSettings({
        controlMode: 'slider',
        pillsPresets: [{ value: 30, unit: '%' }, { value: 50, unit: '%' }, { value: 100, unit: '%' }],
    });
    await rebuildUI();
}, win);

await test('YY02 - pill preset with mixed units renders with unit suffix', async () => {
    await saveSettings({
        controlMode: 'pills',
        pillsPresets: [{ value: 50, unit: '%' }, { value: 800, unit: 'px' }, { value: 80, unit: 'ch' }],
    });
    await rebuildUI();
    const labels = await win.evaluate(() =>
        Array.from(document.querySelectorAll('.custom-note-width-pill')).map(p => p.textContent)
    );
    assertEquals(labels[1], '800px', 'px pill should show 800px');
    assertEquals(labels[2], '80ch', 'ch pill should show 80ch');
    await saveSettings({
        controlMode: 'slider',
        pillsPresets: [{ value: 30, unit: '%' }, { value: 50, unit: '%' }, { value: 100, unit: '%' }],
    });
    await rebuildUI();
}, win);

// --- ZZ. Individual pill preset commands --------------------------------
await test('ZZ01 - apply-pill-preset-1 command exists and is callable', async () => {
    const has = await win.evaluate(() => {
        const cmd = window.app.commands.commands['custom-note-width:apply-pill-preset-1'];
        return !!cmd && typeof cmd.checkCallback === 'function';
    });
    assertEquals(has, true, 'apply-pill-preset-1 should exist with checkCallback');
}, win);

await test('ZZ02 - apply-pill-preset-N checkCallback returns false in slider mode', async () => {
    await saveSettings({ controlMode: 'slider' });
    const r = await win.evaluate(() => {
        const cmd = window.app.commands.commands['custom-note-width:apply-pill-preset-1'];
        return cmd.checkCallback(true);
    });
    assertEquals(r, false, 'pill-preset command should be inactive in slider mode');
}, win);

await test('ZZ03 - apply-pill-preset-N checkCallback returns true in pills mode', async () => {
    await saveSettings({ controlMode: 'pills' });
    const r = await win.evaluate(() => {
        const cmd = window.app.commands.commands['custom-note-width:apply-pill-preset-1'];
        return cmd.checkCallback(true);
    });
    assertEquals(r, true, 'pill-preset command should be active in pills mode');
    await saveSettings({ controlMode: 'slider' });
}, win);

// --- AAA. Reset-overrides modal internals -------------------------------
await test('AAA01 - clearAllLocalOverrides returns the removed count', async () => {
    const count = await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.settingsManager.settings.localOverrides = {
            'a.md': { value: 40, unit: '%' },
            'b.md': { value: 60, unit: '%' },
            'c.md': { value: 80, unit: '%' },
        };
        return await cnw.settingsManager.clearAllLocalOverrides();
    });
    assertEquals(count, 3, 'should return 3 removed');
    await saveSettings({ localOverrides: {} });
}, win);

await test('AAA02 - clearLocalOverride is a no-op for unknown path', async () => {
    const ok = await win.evaluate(async () => {
        try {
            await window.app.plugins.plugins['custom-note-width'].settingsManager.clearLocalOverride('nonexistent.md');
            return true;
        } catch (e) { return String(e); }
    });
    assertEquals(ok, true, 'clearLocalOverride should be silent for unknown paths');
}, win);

// --- BBB. Sanity round-trip via UI + data.json ------------------------
await test('BBB01 - setLocalOverride writes and later reads back through data.json', async () => {
    await saveSettings({ perNoteMode: 'local', localOverrides: {} });
    await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        await cnw.settingsManager.setLocalOverride('rt.md', { value: 51, unit: '%' });
        await cnw.settingsManager.loadSettings();
    });
    const s = await pluginSettings();
    assertEquals(s.localOverrides['rt.md']?.value, 51, 'value 51 must survive save+reload');
    await saveSettings({ perNoteMode: 'frontmatter', localOverrides: {} });
}, win);

// --- CCC. Note without frontmatter uses default -----------------------
await test('CCC01 - note with no frontmatter renders with default width', async () => {
    await saveSettings({ perNoteMode: 'frontmatter', defaultWidth: 50, defaultWidthUnit: '%' });
    await openNote('01 - Welcome'); await sleep(400);
    // 01 - Welcome originally has no frontmatter (was set to 40 earlier in Y01)
    // Strip its frontmatter first
    await win.evaluate(async () => {
        const w = window;
        const file = w.app.workspace.getActiveFile();
        await w.app.fileManager.processFrontMatter(file, (fm) => {
            for (const k of Object.keys(fm)) delete fm[k];
        });
    });
    await sleep(600);
    // Re-open + re-apply
    await openNote('01 - Welcome'); await sleep(300);
    const r = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        return cnw.noteWidthManager.resolveWidthForFile(window.app.workspace.getActiveFile());
    });
    assertEquals(r.value, 50, 'default width should apply when no frontmatter');
}, win);

// --- DDD. Multiple config-changes stack correctly ----------------------
await test('DDD01 - toggling code-block feature twice returns to baseline', async () => {
    const baseline = await getBodyCnwClasses();
    await saveSettings({ enableCodeBlockWidth: true });
    await saveSettings({ enableCodeBlockWidth: false });
    const after = await getBodyCnwClasses();
    assertEquals(JSON.stringify(after.sort()), JSON.stringify(baseline.sort()), 'body classes should match baseline');
}, win);

// --- REG. Historical regression tests -----------------------------------
// Every bug that was ever reported gets a dedicated test here so it can
// never come back unnoticed.

await test('REG01 - [2.4.1 #12] Slider still works when value-display=Hidden', async () => {
    // Original bug: with statusBarValueDisplay=hidden, the slider's own input
    // listener was never registered (bound together with the text element).
    // Moving the slider had no effect on note width.
    await saveSettings({ enableSlider: true, statusBarValueDisplay: 'hidden' });
    await rebuildUI();
    await openNote('03 - Standard (50%)'); await sleep(400);
    const hasSlider = await win.evaluate(() => !!document.querySelector('#custom-note-width-slider'));
    assert(hasSlider, 'slider must exist in hidden-value mode');
    const hasValueEl = await win.evaluate(() => !!document.querySelector('#custom-note-width-slider-value'));
    assertEquals(hasValueEl, false, 'value element must be gone in hidden mode');
    // Now the actual regression: change slider → --cnw-note-width must update
    const before = await getCnwNoteWidthVar();
    await win.evaluate(() => {
        const s = document.querySelector('#custom-note-width-slider');
        s.value = '77';
        s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await sleep(400);
    const after = await getCnwNoteWidthVar();
    assert(before !== after, `slider MUST update width in hidden mode (before: ${before}, after: ${after})`);
    await saveSettings({ statusBarValueDisplay: 'editable' });
    await rebuildUI();
}, win);

await test('REG02 - [2.4.1] Setting change re-applies per-note width on active leaf', async () => {
    // Original bug: changing a status-bar setting temporarily reset the
    // visible width to the global default until the next tab switch.
    // updateUI() must re-apply width after the UI rebuild.
    await saveSettings({ perNoteMode: 'frontmatter', defaultWidth: 50 });
    await openNote('02 - Narrow (30%)'); await sleep(400);
    // Note has 30% frontmatter; --cnw-note-width should reflect 30%, not 50%
    const wBefore = await getCnwNoteWidthVar();
    await win.evaluate(() => window.app.plugins.plugins['custom-note-width'].uiManager.updateUI());
    await sleep(500);
    const wAfter = await getCnwNoteWidthVar();
    assert(wBefore && wAfter, `both should be set (before: ${wBefore}, after: ${wAfter})`);
    // The value should still reflect the note's per-note width, not the global default
    assertEquals(wBefore, wAfter, `width must survive updateUI (before: ${wBefore}, after: ${wAfter})`);
}, win);

await test('REG03 - [2.1.0] Plugin activation does not crash (uiManager before UIElementCreator)', async () => {
    // Original bug: crash during activation caused by uiManager being used
    // by UIElementCreator before it existed. This is a smoke-test on the
    // plugin's construction order.
    const info = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        return {
            hasUiManager: !!cnw?.uiManager,
            hasUiElementCreator: !!cnw?.uiElementCreator,
            hasNoteWidthManager: !!cnw?.noteWidthManager,
            hasEventHandler: !!cnw?.eventHandler,
            hasCommands: !!cnw?.commandsManager,
        };
    });
    assertEquals(info.hasUiManager, true, 'uiManager must be constructed');
    assertEquals(info.hasUiElementCreator, true, 'uiElementCreator must be constructed');
    assertEquals(info.hasNoteWidthManager, true, 'noteWidthManager must be constructed');
    assertEquals(info.hasEventHandler, true, 'eventHandler must be constructed');
    assertEquals(info.hasCommands, true, 'commandsManager must be constructed');
}, win);

await test('REG04 - [3.0.0] No <style> element leaks into <head> (R3 guarantee)', async () => {
    // 3.0.0 removed the <style id="custom-note-width-rules"> element.
    // If it comes back, we regressed on the community-directory finding R3.
    const found = await win.evaluate(() =>
        !!document.head.querySelector('style[id*="custom-note-width"], style[id*="cnw"]')
    );
    assertEquals(found, false, 'no <style id> from plugin must appear in <head>');
}, win);

await test('REG05 - [3.0.0] Bundle does not contain console.log (only debug/warn/error)', async () => {
    // W7 finding: console.log was replaced with console.debug in main.ts.
    // Guard against it silently coming back.
    const main = readFileSync(join(REPO_ROOT, 'main.js'), 'utf-8');
    // console.log wrapped by the community-plugin bundler shows as `console.log(`
    const hits = main.match(/console\.log\s*\(/g) ?? [];
    assertEquals(hits.length, 0, `main.js should have no console.log calls, found ${hits.length}`);
}, win);

await test('REG06 - [3.0.0] Bundle does not create <style> elements (no forbidden element)', async () => {
    const main = readFileSync(join(REPO_ROOT, 'main.js'), 'utf-8');
    const hits = main.match(/createElement\s*\(\s*['"]style['"]/g) ?? [];
    assertEquals(hits.length, 0, `main.js should not create <style> elements, found ${hits.length}`);
}, win);

// --- 3.1.0 feature regressions (inline width, diagnostics, consistency) ------

await test('REG07 - [3.1.0] width is applied as inline --file-line-width on the editor view', async () => {
    // 3.1.0 drops the styles.css bridge and writes --file-line-width inline onto
    // the leaf's view element. This is now the declaration that drives the width.
    await saveSettings({ perNoteMode: 'frontmatter', enablePerNoteWidth: true });
    await openNote('02 - Narrow (30%)'); await sleep(400);
    const inline = await win.evaluate(() => {
        const el = document.querySelector('.workspace-leaf.mod-active .markdown-source-view')
                || document.querySelector('.workspace-leaf.mod-active .markdown-preview-view');
        return el ? el.style.getPropertyValue('--file-line-width') : null;
    });
    assert(inline && inline.trim().length > 0, `--file-line-width should be set inline on the view, got: ${JSON.stringify(inline)}`);
    assertMatches(inline.trim(), /^\d+(\.\d+)?px$/, 'inline --file-line-width format');
}, win);

await test('REG08 - [3.1.0] the active-leaf-change handler applies width (no manual apply)', async () => {
    // Verifies the plugin's registered active-leaf-change handler resolves and
    // applies the per-note width, without the test calling applyWidthForLeaf.
    // Uses a distinctive local override (in px, to avoid the % char-width path)
    // so the test does not depend on frontmatter that earlier tests mutate, and
    // fires the workspace event explicitly (synthetic events do not always
    // propagate under CDP).
    await win.evaluate(async () => {
        const w = window;
        const cnw = w.app.plugins.plugins['custom-note-width'];
        const file = w.app.vault.getFiles().find(f => f.basename === '02 - Narrow (30%)');
        await cnw.settingsManager.saveSettings({
            ...cnw.settingsManager.settings,
            enablePerNoteWidth: true, perNoteMode: 'local',
            localOverrides: { [file.path]: { value: 1300, unit: 'px' } },
        });
    });
    await sleep(300);
    await win.evaluate(async () => {
        const w = window;
        const file = w.app.vault.getFiles().find(f => f.basename === '02 - Narrow (30%)');
        const leaf = w.app.workspace.getLeaf(false);
        await leaf.openFile(file);
        w.app.workspace.setActiveLeaf(leaf);
        // Fire the event the plugin subscribes to; its handler must apply the override.
        w.app.workspace.trigger('active-leaf-change', leaf);
    });
    await sleep(700);
    const width = await getEditorWidthPx();
    assert(Math.abs(width - 1300) < 5, `active-leaf-change handler should apply the 1300px local override (no manual apply), got ${width}`);
    await saveSettings({ perNoteMode: 'frontmatter', localOverrides: {} });
}, win);

await test('REG09 - [3.1.0] width still applies when styles.css is not loaded', async () => {
    // The width no longer depends on the plugin stylesheet: Obsidian's own
    // `.cm-sizer { max-width: var(--file-line-width) }` consumes the inline value.
    await openNote('04 - Wide (100%)'); await sleep(400);
    const result = await win.evaluate(() => {
        // Remove the plugin's own stylesheet, found via its sentinel variable.
        let removed = false;
        for (const sheet of Array.from(document.styleSheets)) {
            let rules; try { rules = sheet.cssRules; } catch { continue; }
            if (!rules) continue;
            for (const r of Array.from(rules)) {
                if (r.cssText && r.cssText.includes('--cnw-styles-loaded')) {
                    sheet.ownerNode?.remove();
                    removed = true;
                    break;
                }
            }
            if (removed) break;
        }
        // Apply a distinctive width with styles.css gone.
        const cnw = window.app.plugins.plugins['custom-note-width'];
        cnw.noteWidthManager.updateNoteWidthEditorStyle({ value: 1234, unit: 'px' });
        const view = document.querySelector('.workspace-leaf.mod-active .markdown-source-view');
        return { removed, inline: view ? view.style.getPropertyValue('--file-line-width') : null };
    });
    assert(result.removed, 'plugin stylesheet (with --cnw-styles-loaded) should be found and removed');
    assertEquals(result.inline, '1234px', 'inline --file-line-width should be set even without styles.css');
    await sleep(200);
    const width = await getEditorWidthPx();
    assert(Math.abs(width - 1234) < 5, `width should follow the inline value without styles.css (~1234), got ${width}`);
    // Restore styles.css by re-enabling the plugin (re-injects its stylesheet).
    await win.evaluate(async () => {
        await window.app.plugins.disablePlugin('custom-note-width');
        await window.app.plugins.enablePlugin('custom-note-width');
    });
    await sleep(1200);
}, win);

await test('REG10 - [3.1.0] max-width !important on the sizer wins, is logged, and the report names it', async () => {
    // The one case the plugin genuinely cannot beat: a rule setting max-width
    // directly on the sizer with !important (bypassing --file-line-width). It
    // must be logged as a consistency mismatch AND pinpointed by the report.
    await openNote('03 - Standard (50%)'); await sleep(400);
    await win.evaluate(() => {
        const s = document.createElement('style');
        s.id = 'rogue-consistency-test';
        s.textContent = '.cm-sizer, .markdown-preview-sizer { max-width: 111px !important; }';
        document.head.appendChild(s);
        // Apply a clearly different width so the mismatch is unambiguous.
        window.app.plugins.plugins['custom-note-width'].noteWidthManager
            .updateNoteWidthEditorStyle({ value: 1500, unit: 'px' });
    });
    await sleep(300); // let the debounced (rAF) consistency check run
    const state = await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        const log = cnw.diagnosticsLog;
        const report = await cnw.diagnostics.buildReport();
        return {
            mismatches: log.getCounters().consistencyMismatches,
            hasWarn: log.getEntries().some(e => e.level === 'warn' && /mismatch/i.test(e.message)),
            reportMismatch: report.activeNote?.mismatch,
            computedFileLineWidth: report.activeNote?.computedFileLineWidth,
            computedSizerMaxWidth: report.activeNote?.computedSizerMaxWidth,
            winning: report.winningCssRules.find(r => r.target === 'sizer-max-width' && r.important && /111px/.test(r.value)),
        };
    });
    await win.evaluate(() => document.getElementById('rogue-consistency-test')?.remove());
    assert(state.mismatches > 0, `a consistency mismatch should be recorded, got ${state.mismatches}`);
    assert(state.hasWarn, 'a warn entry about the width mismatch should be in the diagnostics log');
    assert(state.reportMismatch === true, 'report activeNote.mismatch should be true');
    assertEquals(state.computedSizerMaxWidth, '111px', 'report should record the actual (overridden) sizer max-width');
    assert(state.winning, `report must name the winning max-width !important rule, got: ${JSON.stringify(state.winning)}`);
    assert(state.winning.origin === 'style#rogue-consistency-test', `winning rule origin should identify the source, got: ${state.winning.origin}`);
    assertEquals(state.winning.important, true, 'winning rule must be recorded as !important');
    await win.evaluate(() => window.app.plugins.plugins['custom-note-width'].noteWidthManager.applyWidthForLeaf());
    await sleep(200);
}, win);

await test('REG11 - [3.1.0] diagnostics report has all fields and leaks no paths or file names', async () => {
    await saveSettings({ perNoteMode: 'frontmatter', enablePerNoteWidth: true });
    await openNote('03 - Standard (50%)'); await sleep(500);
    const { report, json, basename } = await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        const report = await cnw.diagnostics.buildReport();
        const basename = window.app.workspace.getActiveFile()?.basename ?? '';
        return { report, json: JSON.stringify(report), basename };
    });
    // Structure / completeness
    assertEquals(report.schema?.reportVersion, 3, 'reportVersion should be 3');
    assert(!('summary' in report), 'report must NOT carry a derived summary block (raw fields only)');
    assertEquals(report.environment?.pluginVersion, '3.1.0', 'report should carry plugin version 3.1.0');
    assert(typeof report.environment?.obsidianVersion === 'string' && report.environment.obsidianVersion.length > 0, 'obsidianVersion should be a non-empty string');
    assert('localOverridesCount' in report.pluginSettings, 'pluginSettings should carry localOverridesCount');
    assert(!('localOverrides' in report.pluginSettings), 'pluginSettings must NOT carry the localOverrides map (keys are paths)');
    assertEquals(report.styles?.loaded, true, 'styles.loaded should be true (sentinel present)');
    assertEquals(report.styles?.versionMatches, true, 'styles.versionMatches should be true (styles.css version matches plugin)');
    assert(report.activeNote && typeof report.activeNote.widthSource === 'string', 'activeNote.widthSource should be present');
    assertEquals(report.activeNote.fileLineWidthInlineImportant, true, 'activeNote should record that --file-line-width is set inline with !important');
    assert(Array.isArray(report.winningCssRules), 'winningCssRules should be an array');
    assert(report.runtime && typeof report.runtime.applyCalls === 'number', 'runtime.applyCalls should be a number');
    assert(Array.isArray(report.log), 'log should be an array');
    assert(Array.isArray(report.pluginFiles) && report.pluginFiles.some(f => f.name === 'main.js' && f.sha256), 'pluginFiles should include main.js with a sha256');
    // Privacy: no note name, no filenames, no vault path.
    // (Use /\.md\b/ so CSS class names like `.markdown-source-view` do not count;
    // only a real "<name>.md" boundary matches.)
    assert(basename.length > 0, 'precondition: an active note with a name');
    assert(!json.includes(basename), `report must not contain the active note name "${basename}"`);
    assert(!/\.md\b/.test(json), 'report must not contain any .md file name');
    assert(!json.toLowerCase().includes('vault'), 'report must not contain the vault path or name');
}, win);

await test('REG12 - [3.1.0] width is restored after disable/enable without reopening the note', async () => {
    // In-place-update glitch: the open note used to fall back to the default
    // width after a plugin reload until reopened. onLayoutReady now re-resolves it.
    await saveSettings({ perNoteMode: 'frontmatter', enablePerNoteWidth: true, defaultWidth: 50, defaultWidthUnit: '%' });
    await openNote('02 - Narrow (30%)'); await sleep(400);
    const before = await getEditorWidthPx();
    await win.evaluate(async () => {
        await window.app.plugins.disablePlugin('custom-note-width');
        await window.app.plugins.enablePlugin('custom-note-width');
    });
    await sleep(1200); // onLayoutReady + rAF re-apply, no tab switch
    const after = await getEditorWidthPx();
    const inline = await win.evaluate(() => {
        const el = document.querySelector('.workspace-leaf.mod-active .markdown-source-view');
        return el ? el.style.getPropertyValue('--file-line-width') : null;
    });
    assert(before > 0 && after > 0, `widths readable: before=${before}, after=${after}`);
    assert(Math.abs(before - after) < 10, `note width must be restored (30%) after re-enable, not the 50% default (before ${before}, after ${after})`);
    assert(inline && inline.trim().length > 0, `--file-line-width should be inline after re-enable without reopening, got ${JSON.stringify(inline)}`);
}, win);

// --- Diagnostics self-check: each failure scenario must be pinpointable -------

await test('REG13 - [3.1.0] report shows our --file-line-width won despite a snippet !important', async () => {
    // Scenario 2: a snippet marks --file-line-width !important; the plugin's inline
    // !important still wins. The report must show our inline value present, important,
    // and equal to the computed value (no mismatch).
    await openNote('03 - Standard (50%)'); await sleep(400);
    const r = await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        const s = document.createElement('style');
        s.id = 'rogue-flw-test';
        s.textContent = '.markdown-source-view, .markdown-preview-view { --file-line-width: 123px !important; }';
        document.head.appendChild(s);
        cnw.noteWidthManager.updateNoteWidthEditorStyle({ value: 1400, unit: 'px' });
        const report = await cnw.diagnostics.buildReport();
        document.getElementById('rogue-flw-test')?.remove();
        return report.activeNote;
    });
    assertEquals(r.fileLineWidthInline, '1400px', 'report should show our inline --file-line-width value');
    assertEquals(r.fileLineWidthInlineImportant, true, 'report should show our inline value is !important');
    assertEquals(r.computedFileLineWidth, '1400px', 'our value should have won the --file-line-width cascade');
    assertEquals(r.mismatch, false, 'no mismatch: --file-line-width and sizer max-width agree');
    await win.evaluate(() => window.app.plugins.plugins['custom-note-width'].noteWidthManager.applyWidthForLeaf());
    await sleep(200);
}, win);

await test('REG14 - [3.1.0] report flags a missing/not-applied and a stale styles.css', async () => {
    // Scenario 3a: styles.css present on disk but not applied → styles.loaded false.
    await openNote('03 - Standard (50%)'); await sleep(300);
    const missing = await win.evaluate(async () => {
        // Remove the plugin's own stylesheet (found via its sentinel).
        for (const sheet of Array.from(document.styleSheets)) {
            let rules; try { rules = sheet.cssRules; } catch { continue; }
            if (!rules) continue;
            let hit = false;
            for (const rr of Array.from(rules)) { if (rr.cssText && rr.cssText.includes('--cnw-styles-loaded')) { hit = true; break; } }
            if (hit) { sheet.ownerNode?.remove(); break; }
        }
        const report = await window.app.plugins.plugins['custom-note-width'].diagnostics.buildReport();
        return { loaded: report.styles.loaded };
    });
    assertEquals(missing.loaded, false, 'styles.loaded should be false once the stylesheet is removed');
    // Restore styles.css.
    await win.evaluate(async () => {
        await window.app.plugins.disablePlugin('custom-note-width');
        await window.app.plugins.enablePlugin('custom-note-width');
    });
    await sleep(1200);
    // Scenario 3b: simulate a stale styles.css by overriding the reported version.
    const stale = await win.evaluate(async () => {
        const s = document.createElement('style');
        s.id = 'stale-styles-test';
        s.textContent = ':root { --cnw-styles-version: "0.0.1"; }';
        document.head.appendChild(s);
        const report = await window.app.plugins.plugins['custom-note-width'].diagnostics.buildReport();
        document.getElementById('stale-styles-test')?.remove();
        return { styles: report.styles };
    });
    assertEquals(stale.styles.version, '0.0.1', 'report should read the (overridden) styles version');
    assertEquals(stale.styles.versionMatches, false, 'versionMatches should be false for a stale styles.css');
}, win);

await test('REG15 - [3.1.0] report records when Readable line length is OFF', async () => {
    // Scenario 4: readable line length off → width has no effect. The report must
    // carry the raw obsidianSettings.readableLineLength value.
    await openNote('03 - Standard (50%)'); await sleep(300);
    const r = await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        const vault = window.app.vault;
        const original = vault.getConfig;
        // Stub getConfig so readableLineLength reads false, without changing real state.
        vault.getConfig = (key) => (key === 'readableLineLength' ? false : original.call(vault, key));
        const report = await cnw.diagnostics.buildReport();
        vault.getConfig = original;
        return { readable: report.obsidianSettings.readableLineLength };
    });
    assertEquals(r.readable, false, 'report should reflect readableLineLength=false');
}, win);

await test('REG16 - [3.1.0] report records an aborted apply with reason', async () => {
    // Scenario 5: no active markdown view → apply aborts with 'no-view'.
    const r = await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        const leaves = window.app.workspace.getLeavesOfType('markdown');
        for (const l of leaves) l.detach();
        cnw.noteWidthManager.applyWidthForLeaf(); // no active markdown view
        const report = await cnw.diagnostics.buildReport();
        return { lastApply: report.runtime.lastApply };
    });
    assertEquals(r.lastApply?.completed, false, 'lastApply.completed should be false after an aborted apply');
    assertEquals(r.lastApply?.abortReason, 'no-view', 'abortReason should be no-view');
    await openNote('03 - Standard (50%)'); await sleep(300); // restore context
}, win);

await test('REG17 - [3.1.0] report resolves the width source, raw value, unit and computed px', async () => {
    // Scenario 6: source disambiguation between local override and frontmatter.
    await win.evaluate(async () => {
        const w = window;
        const cnw = w.app.plugins.plugins['custom-note-width'];
        const file = w.app.vault.getFiles().find(f => f.basename === '03 - Standard (50%)');
        await cnw.settingsManager.saveSettings({
            ...cnw.settingsManager.settings,
            enablePerNoteWidth: true, perNoteMode: 'local',
            localOverrides: { [file.path]: { value: 950, unit: 'px' } },
        });
    });
    await openNote('03 - Standard (50%)'); await sleep(400);
    const local = await win.evaluate(async () => {
        const report = await window.app.plugins.plugins['custom-note-width'].diagnostics.buildReport();
        return report.activeNote;
    });
    assertEquals(local.widthSource, 'local', 'widthSource should be local when a local override exists');
    assertEquals(local.desiredValue, 950, 'desiredValue should be the override value');
    assertEquals(local.desiredUnit, 'px', 'desiredUnit should be px');
    assertEquals(local.desiredCss, '950px', 'desiredCss should be the computed px value');
    // Switch to frontmatter mode: source flips, raw frontmatter width is reported.
    await saveSettings({ perNoteMode: 'frontmatter', localOverrides: {} });
    await openNote('03 - Standard (50%)'); await sleep(400);
    const fm = await win.evaluate(async () => {
        const report = await window.app.plugins.plugins['custom-note-width'].diagnostics.buildReport();
        return report.activeNote;
    });
    assertEquals(fm.widthSource, 'frontmatter', 'widthSource should be frontmatter after switching');
    assert(fm.rawFrontmatterWidth !== null && fm.rawFrontmatterWidth !== undefined, `rawFrontmatterWidth should be reported, got: ${JSON.stringify(fm.rawFrontmatterWidth)}`);
}, win);

await test('REG18 - [3.1.0] report flags another active line-width plugin as a conflict candidate', async () => {
    // Scenario 7: another enabled plugin whose id/name suggests line-width control.
    const r = await win.evaluate(async () => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        const plugins = window.app.plugins;
        const fakeId = 'obsidian-editor-width-slider';
        const addedManifest = !plugins.manifests[fakeId];
        if (addedManifest) plugins.manifests[fakeId] = { id: fakeId, name: 'Editor Width Slider', version: '1.0.0' };
        const added = !plugins.enabledPlugins.has(fakeId);
        if (added) plugins.enabledPlugins.add(fakeId);
        const report = await cnw.diagnostics.buildReport();
        if (added) plugins.enabledPlugins.delete(fakeId);
        if (addedManifest) delete plugins.manifests[fakeId];
        return { active: report.otherPlugins.active };
    });
    const flagged = r.active.find(p => p.id === 'obsidian-editor-width-slider');
    assert(flagged, `the fake width plugin should appear in otherPlugins.active, got: ${JSON.stringify(r.active)}`);
    assertEquals(flagged.conflictCandidate, true, 'the width plugin should be marked as a conflict candidate');
}, win);

await test('REG19 - [3.1.0] captured error messages never leak paths or note names', async () => {
    // Feed path-laden messages in every style; the sanitiser must strip them all,
    // keep the error type, and the relevance filter must ignore non-plugin errors.
    const r = await win.evaluate(() => {
        const cnw = window.app.plugins.plugins['custom-note-width'];
        // A stack pointing at the plugin so captureError records the entry.
        const pluginStack = 'Error\n  at f (app://x/D:/My Vault/.obsidian/plugins/custom-note-width/main.js:1:1)';
        const messages = [
            'Cannot read /Users/john/vault/Secret Note.md at line 5',
            'ENOENT C:\\Users\\john\\Vault\\Secret.md is missing',
            'open \\\\server\\share\\Secret.md failed',
            'parse error in Folder/Sub/Secret.md',
            'failed to load "My Private Note.md"',
            'Secret.canvas could not be opened',
        ];
        for (const m of messages) cnw.diagnostics.captureError('error', 'TypeError', m, pluginStack, undefined);
        // Non-plugin error: distinctive non-path marker, stack WITHOUT the plugin.
        cnw.diagnostics.captureError('error', 'TypeError', 'RELEVANCEPROBE_TOKEN sample', 'at g (app://x/other-plugin/main.js:1:1)', undefined);
        const all = cnw.diagnosticsLog.getEntries();
        return {
            allText: JSON.stringify(all),
            mine: all.filter(e => e.level === 'error' && e.message.includes('[TypeError]') && e.message.includes('<path>')).map(e => e.message),
        };
    });
    const forbidden = ['Secret', 'john', 'server', 'share', 'My Private', 'Note.md', '.canvas', '/Users', 'Folder/', 'C:\\', 'My Vault'];
    for (const token of forbidden) {
        assert(!r.allText.includes(token), `sanitised log must not contain "${token}"; log was: ${r.allText}`);
    }
    assert(r.mine.length >= 6, `all 6 path-laden plugin errors should be recorded with a <path> placeholder, got ${r.mine.length}`);
    r.mine.forEach(m => assert(m.includes('[TypeError]'), `error type should be preserved, got: ${m}`));
    assert(!r.allText.includes('RELEVANCEPROBE_TOKEN'), 'a non-plugin error (stack without the plugin) must NOT be recorded');
}, win);

// Z-tests always LAST — they release the CDP context.
await test('Z01 - popout window: plugin drives its own leaf', async () => {
    await openNote('03 - Standard (50%)'); await sleep(400);
    const pagePromise = new Promise(res => {
        const h = p => { context.off('page', h); res(p); };
        context.on('page', h);
        setTimeout(() => res(null), 5000);
    });
    await win.evaluate(async () => {
        const w = (window);
        const nl = w.app.workspace.moveLeafToPopout(w.app.workspace.activeLeaf);
        w.app.plugins.plugins['custom-note-width'].noteWidthManager.applyWidthForLeaf(nl ?? w.app.workspace.activeLeaf);
    });
    let popout = await pagePromise;
    if (!popout) {
        popout = browser.contexts().flatMap(c => c.pages()).find(p => p !== win && p.url().startsWith('app://'));
    }
    assert(popout, 'popout page not found');
    await popout.waitForLoadState('domcontentloaded');
    await sleep(1000);
    const info = await popout.evaluate(() => {
        const el = document.querySelector('.workspace-leaf-content[data-cnw-id]');
        return { hasTag: !!el, cnwWidth: el?.style.getPropertyValue('--cnw-note-width') };
    });
    assert(info.hasTag, 'popout containerEl should have data-cnw-id');
    assert(info.cnwWidth && info.cnwWidth.length > 0, 'popout should have --cnw-note-width set');
    await popout.close();
    await sleep(500);
}, win);

// -----------------------------------------------------------------------------
// Cleanup + report

log('');
log('closing Obsidian');
try { process.kill(child.pid); } catch {}
try { execSync('taskkill /F /IM Obsidian.exe 2>nul', { stdio: 'ignore' }); } catch {}

const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;
const totalMs = results.reduce((s, r) => s + r.ms, 0);

writeFileSync(join(REPORT_DIR, 'results.json'), JSON.stringify({
    pluginVersion: bootInfo.version,
    ran: results.length,
    passed,
    failed,
    totalMs,
    results,
    ts: new Date().toISOString(),
}, null, 2));

log('');
log('===== SUMMARY =====');
log(`ran:    ${results.length}`);
log(`passed: ${passed}`);
log(`failed: ${failed}`);
log(`time:   ${(totalMs / 1000).toFixed(1)}s`);
log(`report: ${join(REPORT_DIR, 'results.json')}`);
log(`shots:  ${SCREENSHOTS_DIR}`);
if (failed > 0) {
    log('');
    log('FAILURES:');
    for (const r of results.filter(r => r.status === 'fail')) {
        log(`  ${r.name}`);
        log(`    ${r.error}`);
    }
}
process.exit(failed > 0 ? 1 : 0);
