import { App, MarkdownView, Notice, Platform, TFile, apiVersion, normalizePath } from "obsidian";
import type CustomNoteWidth from "src/main";
import { t } from "src/i18n/i18n";
import { DIAGNOSTICS_FILE_NAME } from "src/utility/constants";
import { widthValueToCss } from "src/utility/config";
import { pixelsDiffer } from "src/utility/utilities";
import type DiagnosticsLog from "src/diagnostics/diagnosticsLog";

/**
 * Optional internal Obsidian surfaces the diagnostics report reads. Each is
 * feature-detected at runtime and every access is optional, so on a build where
 * one is missing the corresponding report field simply degrades to a null/empty
 * value rather than failing. These are declared locally as narrow, typed shapes.
 */
interface CustomCssLike
{
	theme?: string;
	themes?: Record<string, { version?: string } | undefined>;
	enabledSnippets?: Set<string>;
}

interface PluginManifestLike
{
	id?: string;
	name?: string;
	version?: string;
}

interface PluginsLike
{
	manifests?: Record<string, PluginManifestLike | undefined>;
	enabledPlugins?: Set<string>;
	plugins?: Record<string, unknown>;
}

interface InternalApp
{
	customCss?: CustomCssLike;
	plugins?: PluginsLike;
	/** Reveals a vault-relative path in the OS file manager, highlighting it. */
	showInFolder?: (path: string) => void;
	/** Opens a vault-relative path with the OS default application. */
	openWithDefaultApp?: (path: string) => void;
}

/** Vault carries an internal `getConfig` for editor settings not in the public API. */
interface VaultConfigLike
{
	getConfig?: (key: string) => unknown;
}

/** One entry in the "plugin files" section: presence, size and hash of a shipped file. */
interface PluginFileInfo
{
	name: string;
	present: boolean;
	bytes: number | null;
	sha256: string | null;
}

/** One CSS rule found to set the note width (or its override), with its origin. */
interface WinningRule
{
	target: "sizer-max-width" | "view-file-line-width";
	selector: string;
	property: string;
	value: string;
	important: boolean;
	/** Classified origin ('app', 'theme', 'snippet', 'plugin:<id>', ...). Never a raw path. */
	origin: string;
}

/** Marks known width-controlling plugin ids so a conflict is easy to spot. */
const CONFLICT_HINT = /width|readable|line.?length/i;

/** Cap on collected winning-rule matches, to keep the report small. */
const MAX_WINNING_RULES = 30;

/**
 * Builds an anonymised diagnostics report and hands it to the user: written to
 * `diagnostics.json` in the plugin folder (overwritten each time), copied to
 * the clipboard, then revealed in the OS file manager with a Notice.
 *
 * The report deliberately excludes note contents, file names, vault name and
 * paths; the only per-note value it carries is the resolved width.
 */
export default class DiagnosticsManager
{
	/**
	 * @param app - The Obsidian application instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 * @param log - Shared ring-buffer log and runtime counters.
	 */
	constructor(private app: App, private plugin: CustomNoteWidth, private log: DiagnosticsLog) { }

	/**
	 * Creates the report, writes it, copies it to the clipboard, reveals it and
	 * notifies the user. Any failure surfaces as a Notice plus a console error;
	 * nothing here throws to the caller.
	 */
	public async createReportAndReveal(): Promise<void>
	{
		try
		{
			const dir = this.plugin.manifest.dir;
			if (!dir)
			{
				throw new Error("plugin manifest.dir is not set");
			}

			const report = await this.buildReport();
			const json = JSON.stringify(report, null, 2);
			const relPath = normalizePath(`${dir}/${DIAGNOSTICS_FILE_NAME}`);

			await this.app.vault.adapter.write(relPath, json);
			await this.copyToClipboard(json);
			this.revealReport(relPath);

			new Notice(t("notice.diagnostics_created"), 10000);
		}
		catch (error)
		{
			console.error("Custom Note Width: failed to create diagnostics report", error);
			new Notice(t("notice.diagnostics_failed"), 10000);
		}
	}

	/**
	 * Gathers the full report. Async because the plugin-file hashes are read
	 * and digested from disk.
	 * @returns The report object, ready to be serialised.
	 */
	public async buildReport(): Promise<Record<string, unknown>>
	{
		const environment = this.collectEnvironment();
		const obsidianSettings = this.collectObsidianSettings();
		const appearance = this.collectAppearance();
		const otherPlugins = this.collectOtherPlugins();
		const pluginSettings = this.collectPluginSettings();
		const pluginFiles = await this.collectPluginFiles();
		const styles = this.collectStyles();
		const activeNote = this.collectActiveNote();
		const winningCssRules = this.collectWinningRules();
		const runtime = this.collectRuntime();
		const log = this.log.getEntries();

		return {
			schema: { reportVersion: 3, generatedAt: new Date().toISOString() },
			environment,
			obsidianSettings,
			appearance,
			otherPlugins,
			pluginSettings,
			pluginFiles,
			styles,
			activeNote,
			winningCssRules,
			runtime,
			log,
		};
	}

	/** Environment: versions, platform, viewport metrics. No OS detection via navigator. */
	private collectEnvironment(): Record<string, unknown>
	{
		const proc = this.readProcessInfo();
		return {
			pluginVersion: this.plugin.manifest.version,
			obsidianVersion: apiVersion,
			electronVersion: proc.electron,
			chromeVersion: proc.chrome,
			nodeVersion: proc.node,
			platform: this.platformName(),
			osVersion: proc.osVersion,
			uiLanguage: this.readUiLanguage(),
			devicePixelRatio: window.devicePixelRatio,
			windowInnerWidth: window.innerWidth,
			editorWidth: this.activeEditorWidth(),
		};
	}

	/** Obsidian editor settings that decide whether the width can apply at all. */
	private collectObsidianSettings(): Record<string, unknown>
	{
		const vault = this.app.vault as unknown as VaultConfigLike;
		const getConfig = (key: string): unknown =>
		{
			try { return vault.getConfig?.(key); }
			catch { return null; }
		};
		return {
			readableLineLength: getConfig("readableLineLength") ?? null,
			defaultViewMode: getConfig("defaultViewMode") ?? null,
			livePreview: getConfig("livePreview") ?? null,
			baseFontSize: getConfig("baseFontSize") ?? null,
		};
	}

	/** Active theme (name + version) and the names of enabled CSS snippets. */
	private collectAppearance(): Record<string, unknown>
	{
		const customCss = (this.app as unknown as InternalApp).customCss;
		const themeName = customCss?.theme ?? "";
		return {
			theme: themeName === "" ? "default" : themeName,
			themeVersion: themeName ? (customCss?.themes?.[themeName]?.version ?? null) : null,
			enabledSnippets: customCss?.enabledSnippets ? [...customCss.enabledSnippets] : [],
		};
	}

	/**
	 * Other enabled community plugins (id + version), with a flag for those whose
	 * id/name suggests they also control line width. Also reports loaded vs
	 * enabled counts, which together indicate whether community plugins are in
	 * restricted mode (a report can only be generated while this plugin runs, so
	 * that is effectively never the case here).
	 */
	private collectOtherPlugins(): Record<string, unknown>
	{
		const plugins = (this.app as unknown as InternalApp).plugins;
		const manifests = plugins?.manifests ?? {};
		const enabled = plugins?.enabledPlugins ?? new Set<string>();
		const loadedCount = plugins?.plugins ? Object.keys(plugins.plugins).length : 0;

		const active: Array<{ id: string; version: string | null; conflictCandidate: boolean }> = [];
		for (const id of enabled)
		{
			if (id === this.plugin.manifest.id)
			{
				continue;
			}
			const manifest = manifests[id];
			const name = manifest?.name ?? id;
			active.push({
				id,
				version: manifest?.version ?? null,
				conflictCandidate: CONFLICT_HINT.test(`${id} ${name}`),
			});
		}

		return {
			enabledCount: enabled.size,
			loadedCount,
			active,
		};
	}

	/** The plugin's own settings, with local overrides reduced to a count (keys are paths). */
	private collectPluginSettings(): Record<string, unknown>
	{
		const settings = this.plugin.settingsManager.settings;
		const localOverridesCount = Object.keys(settings.localOverrides ?? {}).length;
		const { localOverrides: _localOverrides, ...rest } = settings;
		return { ...rest, localOverridesCount };
	}

	/** Size and SHA-256 of the shipped plugin files, to catch stale or missing deployments. */
	private async collectPluginFiles(): Promise<PluginFileInfo[]>
	{
		const dir = this.plugin.manifest.dir;
		const names = ["main.js", "manifest.json", "styles.css"];
		const out: PluginFileInfo[] = [];
		if (!dir)
		{
			return out;
		}
		for (const name of names)
		{
			const path = normalizePath(`${dir}/${name}`);
			try
			{
				if (!(await this.app.vault.adapter.exists(path)))
				{
					out.push({ name, present: false, bytes: null, sha256: null });
					continue;
				}
				const buffer = await this.app.vault.adapter.readBinary(path);
				out.push({ name, present: true, bytes: buffer.byteLength, sha256: await this.sha256(buffer) });
			}
			catch
			{
				out.push({ name, present: false, bytes: null, sha256: null });
			}
		}
		return out;
	}

	/**
	 * Whether styles.css is loaded (via its `--cnw-styles-loaded` sentinel) and
	 * which version it reports (`--cnw-styles-version`), so a stale copy (an old
	 * styles.css shipped next to a newer main.js) can be detected.
	 */
	private collectStyles(): { loaded: boolean; version: string | null; versionMatches: boolean }
	{
		const computed = window.getComputedStyle(document.body);
		const loaded = computed.getPropertyValue("--cnw-styles-loaded").trim() === "1";
		const version = computed.getPropertyValue("--cnw-styles-version").trim().replace(/^["']|["']$/g, "") || null;
		return { loaded, version, versionMatches: version !== null && version === this.plugin.manifest.version };
	}

	/**
	 * State of the active note (never its name): resolved width and its source,
	 * the inline variables the plugin set, and the width actually in effect.
	 */
	private collectActiveNote(): Record<string, unknown> | null
	{
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view.file)
		{
			return null;
		}

		const mode = view.getMode();
		const container = view.containerEl;
		const viewEl = mode === "preview"
			? container.querySelector<HTMLElement>(".markdown-preview-view")
			: container.querySelector<HTMLElement>(".markdown-source-view");
		const sizer = mode === "preview"
			? container.querySelector<HTMLElement>(".markdown-preview-sizer")
			: container.querySelector<HTMLElement>(".cm-sizer");
		const editorDiv = mode === "preview"
			? container.querySelector<HTMLElement>(".markdown-preview-view")
			: container.querySelector<HTMLElement>(".cm-scroller");

		const wv = this.plugin.noteWidthManager.resolveWidthForFile(view.file);
		const desiredCss = editorDiv ? widthValueToCss(wv, editorDiv) : null;

		const computedFileLineWidth = viewEl
			? window.getComputedStyle(viewEl).getPropertyValue("--file-line-width").trim()
			: null;
		const sizerMaxWidth = sizer ? window.getComputedStyle(sizer).maxWidth : null;

		return {
			viewMode: mode,
			widthSource: this.plugin.noteWidthManager.getWidthSource(view.file),
			desiredValue: wv.value,
			desiredUnit: wv.unit,
			desiredCss,
			// The note's own raw width value (only the width, never other frontmatter).
			rawFrontmatterWidth: this.readRawFrontmatterWidth(view.file),
			dataCnwIdPresent: container.hasAttribute("data-cnw-id"),
			cnwNoteWidthInline: container.style.getPropertyValue("--cnw-note-width") || null,
			fileLineWidthInline: viewEl?.style.getPropertyValue("--file-line-width") || null,
			fileLineWidthInlineImportant: viewEl
				? viewEl.style.getPropertyPriority("--file-line-width") === "important"
				: false,
			computedFileLineWidth: computedFileLineWidth || null,
			computedSizerMaxWidth: sizerMaxWidth,
			mismatch: pixelsDiffer(computedFileLineWidth, sizerMaxWidth),
		};
	}

	/**
	 * The note's raw width value from frontmatter, but only when it actually looks
	 * like a width (a number, optionally with px/%/ch). Any other string is
	 * replaced with a fixed marker so arbitrary frontmatter text can never be
	 * echoed into the report. Absent value returns null.
	 */
	private readRawFrontmatterWidth(file: TFile): number | string | null
	{
		const yamlKey = this.plugin.settingsManager.getYAMLKey();
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		// Frontmatter values are untyped by Obsidian; read as unknown and validate.
		const raw: unknown = frontmatter?.[yamlKey];
		if (raw === undefined || raw === null)
		{
			return null;
		}
		if (typeof raw === "number")
		{
			return raw;
		}
		if (typeof raw === "string" && /^\s*-?\d+(?:\.\d+)?\s*(?:px|%|ch)?\s*$/.test(raw))
		{
			return raw.trim();
		}
		return "<invalid-width-value>";
	}

	/**
	 * CSS rules from every readable stylesheet that set `max-width` on the active
	 * sizer or `--file-line-width` on the active view, with `!important` flags and
	 * their source element. This is the key signal for issue #14: it shows which
	 * rule (app, theme, snippet or another plugin) is actually winning.
	 */
	private collectWinningRules(): WinningRule[]
	{
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view)
		{
			return [];
		}
		const mode = view.getMode();
		const container = view.containerEl;
		const viewEl = mode === "preview"
			? container.querySelector<HTMLElement>(".markdown-preview-view")
			: container.querySelector<HTMLElement>(".markdown-source-view");
		const sizer = mode === "preview"
			? container.querySelector<HTMLElement>(".markdown-preview-sizer")
			: container.querySelector<HTMLElement>(".cm-sizer");

		const results: WinningRule[] = [];
		for (const sheet of Array.from(document.styleSheets))
		{
			let rules: CSSRuleList | null = null;
			try { rules = sheet.cssRules; }
			catch { continue; } // cross-origin stylesheet, not readable
			if (!rules)
			{
				continue;
			}
			this.walkRules(rules, sheet, sizer, viewEl, results);
			if (results.length >= MAX_WINNING_RULES)
			{
				break;
			}
		}
		return results;
	}

	/** Recursively walks a rule list (following @media/@supports) collecting matches. */
	private walkRules(rules: CSSRuleList, sheet: CSSStyleSheet, sizer: HTMLElement | null, viewEl: HTMLElement | null, out: WinningRule[]): void
	{
		for (const rule of Array.from(rules))
		{
			if (out.length >= MAX_WINNING_RULES)
			{
				return;
			}
			if (rule instanceof CSSStyleRule)
			{
				this.matchStyleRule(rule, sheet, sizer, viewEl, out);
			}
			else if (rule instanceof CSSMediaRule || rule instanceof CSSSupportsRule)
			{
				this.walkRules(rule.cssRules, sheet, sizer, viewEl, out);
			}
		}
	}

	/** Records a match when a style rule sets max-width on the sizer or --file-line-width on the view. */
	private matchStyleRule(rule: CSSStyleRule, sheet: CSSStyleSheet, sizer: HTMLElement | null, viewEl: HTMLElement | null, out: WinningRule[]): void
	{
		const maxWidth = rule.style.getPropertyValue("max-width");
		const fileLineWidth = rule.style.getPropertyValue("--file-line-width");
		if (maxWidth === "" && fileLineWidth === "")
		{
			return;
		}
		const origin = this.classifyOrigin(sheet);
		try
		{
			if (maxWidth !== "" && sizer && sizer.matches(rule.selectorText))
			{
				out.push({
					target: "sizer-max-width",
					selector: rule.selectorText,
					property: "max-width",
					value: maxWidth,
					important: rule.style.getPropertyPriority("max-width") === "important",
					origin,
				});
			}
			if (fileLineWidth !== "" && viewEl && viewEl.matches(rule.selectorText))
			{
				out.push({
					target: "view-file-line-width",
					selector: rule.selectorText,
					property: "--file-line-width",
					value: fileLineWidth,
					important: rule.style.getPropertyPriority("--file-line-width") === "important",
					origin,
				});
			}
		}
		catch
		{
			// Ignore selectors the browser cannot evaluate (e.g. vendor pseudo-classes).
		}
	}

	/**
	 * Classifies where a stylesheet comes from, without ever exposing a raw path
	 * (which could contain the vault location). Derived from the stylesheet href
	 * or its owning element.
	 * @param sheet - The stylesheet to classify.
	 * @returns A safe origin label such as 'app', 'theme', 'snippet' or 'plugin:<id>'.
	 */
	private classifyOrigin(sheet: CSSStyleSheet): string
	{
		const href = sheet.href;
		if (href)
		{
			const pluginMatch = href.match(/\/plugins\/([^/?]+)/);
			if (pluginMatch) return `plugin:${this.safeName(pluginMatch[1])}`;
			const snippetMatch = href.match(/\/snippets\/([^/?]+)/);
			if (snippetMatch) return `snippet:${this.safeName(snippetMatch[1])}`;
			const themeMatch = href.match(/\/themes\/([^/?]+)/);
			if (themeMatch) return `theme:${this.safeName(themeMatch[1])}`;
			if (href.includes("app.css") || href.includes("obsidian.md")) return "app";
			return "external";
		}
		const el = sheet.ownerNode instanceof HTMLElement ? sheet.ownerNode : null;
		if (!el)
		{
			return "unknown";
		}
		// A test/plugin-set id, never a path.
		if (el.id)
		{
			return `style#${el.id}`;
		}
		// Obsidian injects the active theme and each enabled snippet as an untagged
		// <style>, which carries no reliable identifier. The reader pairs this
		// generic label with the report's appearance.theme and appearance.enabledSnippets.
		return "theme-or-snippet";
	}

	/** Reduces a path or name to a safe base name (no directory components, no query). */
	private safeName(value: string): string
	{
		let name = value;
		try { name = decodeURIComponent(name); }
		catch { /* leave as-is */ }
		name = name.split("?")[0].replace(/\\/g, "/");
		return name.split("/").pop() || name;
	}

	/** Runtime counters plus open-leaf and popout-window counts. */
	private collectRuntime(): Record<string, unknown>
	{
		return {
			...this.log.getCounters(),
			openMarkdownLeaves: this.app.workspace.getLeavesOfType("markdown").length,
			popoutWindows: this.countPopoutWindows(),
		};
	}

	/**
	 * Records an uncaught error or promise rejection whose stack points at this
	 * plugin. Only the error type and a message are stored, and the ring buffer
	 * sanitises every message before keeping it, so no path or note name survives.
	 * The stack is used solely to decide relevance and is never stored.
	 * @param kind - Which global event produced this.
	 * @param errorName - The error class/type (e.g. "TypeError").
	 * @param message - The error message (sanitised on store).
	 * @param stack - The stack trace, used only to test plugin relevance.
	 * @param filename - Optional source file, also used only for the relevance test.
	 */
	public captureError(kind: "error" | "unhandledrejection", errorName: string, message: string, stack: string | undefined, filename?: string): void
	{
		const haystack = `${stack ?? ""} ${filename ?? ""} ${message}`;
		if (!haystack.includes("custom-note-width"))
		{
			return;
		}
		this.log.log("error", `uncaught ${kind} [${errorName}]: ${message}`);
	}

	/** Counts distinct popout windows by their owning document. */
	private countPopoutWindows(): number
	{
		const docs = new Set<Document>();
		try
		{
			this.app.workspace.iterateAllLeaves((leaf) =>
			{
				const el = (leaf.view as unknown as { containerEl?: HTMLElement }).containerEl;
				const doc = el?.ownerDocument;
				if (doc && doc !== document)
				{
					docs.add(doc);
				}
			});
		}
		catch { /* iteration is best-effort */ }
		return docs.size;
	}

	/** Copies text to the clipboard, tolerating environments where it is unavailable. */
	private async copyToClipboard(text: string): Promise<void>
	{
		try { await navigator.clipboard.writeText(text); }
		catch (error) { console.warn("Custom Note Width: clipboard write failed", error); }
	}

	/**
	 * Reveals the written report in the OS file manager. Prefers `showInFolder`
	 * (highlights the file in its folder); falls back to `openWithDefaultApp`.
	 * @param relPath - Vault-relative path to the report file.
	 */
	private revealReport(relPath: string): void
	{
		const internal = this.app as unknown as InternalApp;
		if (typeof internal.showInFolder === "function")
		{
			internal.showInFolder(relPath);
			return;
		}
		if (typeof internal.openWithDefaultApp === "function")
		{
			internal.openWithDefaultApp(relPath);
		}
	}

	/** SHA-256 of a buffer as a lowercase hex string, via the Web Crypto API. */
	private async sha256(buffer: ArrayBuffer): Promise<string>
	{
		const digest = await crypto.subtle.digest("SHA-256", buffer);
		return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	/** 'windows' | 'macos' | 'linux' | 'unknown', via the Platform API (not navigator). */
	private platformName(): string
	{
		if (Platform.isWin) return "windows";
		if (Platform.isMacOS) return "macos";
		if (Platform.isLinux) return "linux";
		return "unknown";
	}

	/** Electron/Chrome/Node versions and OS version from the `process` global (desktop-only plugin). */
	private readProcessInfo(): { electron: string | null; chrome: string | null; node: string | null; osVersion: string | null }
	{
		const empty = { electron: null, chrome: null, node: null, osVersion: null };
		try
		{
			if (typeof process === "undefined" || !process.versions)
			{
				return empty;
			}
			const proc = process as unknown as { getSystemVersion?: () => string; platform?: string };
			let osVersion: string | null = null;
			try { osVersion = proc.getSystemVersion?.() ?? proc.platform ?? null; }
			catch { osVersion = null; }
			return {
				electron: process.versions.electron ?? null,
				chrome: process.versions.chrome ?? null,
				node: process.versions.node ?? null,
				osVersion,
			};
		}
		catch
		{
			return empty;
		}
	}

	/** Obsidian's UI language via the bundled moment locale (no localStorage access). */
	private readUiLanguage(): string | null
	{
		try
		{
			const moment = (window as unknown as { moment?: { locale?: () => string } }).moment;
			return moment?.locale?.() ?? null;
		}
		catch { return null; }
	}

	/** Client width of the active editor element, for the width calculation context. */
	private activeEditorWidth(): number | null
	{
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view)
		{
			return null;
		}
		const mode = view.getMode();
		const el = mode === "preview"
			? view.containerEl.querySelector<HTMLElement>(".markdown-preview-view")
			: view.containerEl.querySelector<HTMLElement>(".cm-scroller");
		return el ? el.clientWidth : null;
	}
}
