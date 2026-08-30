import { App, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import CustomNoteWidth from "src/main";
import ProgressBarModal from "src/modals/progressBarModal";
import { t } from "src/i18n/i18n";
import { WidthValue, WidthSource, parseWidthValue, widthValueToCss, formatWidthForYaml } from "src/utility/config";
import { getActiveEditorDiv, getActiveMarkdownView, getEditorDivForView, pixelsDiffer, validateWidthValue } from "src/utility/utilities";
import { ApplyAbortReason } from "src/diagnostics/diagnosticsLog";

/** Editor view elements the plugin writes `--file-line-width` onto, per leaf. */
const VIEW_SELECTORS = [".markdown-source-view", ".markdown-preview-view"] as const;

/**
 * Manages the note width functionalities.
 *
 * The width is applied by writing Obsidian's `--file-line-width` inline onto the
 * leaf's `.markdown-source-view` and `.markdown-preview-view` elements. An inline
 * declaration beats Obsidian's own selector-based defaults without `!important`,
 * and, unlike the previous stylesheet bridge, does not depend on `styles.css`
 * being loaded and current. The leaf also carries two reference variables:
 *   - `--cnw-note-width`         the width the plugin intends (mirrors the inline value)
 *   - `--cnw-code-block-width`   drives code block width (when enabled), via styles.css
 *
 * All three are set on the leaf via `setCssProps`, scoped by a `data-cnw-id`
 * attribute the plugin assigns lazily on first use. Code block modes (reading /
 * source / live preview) are global settings represented as body-scoped classes
 * so one toggle affects every open leaf.
 *
 * Width is resolved synchronously from Obsidian's metadataCache (YAML-only).
 */
export default class NoteWidthManager
{
	/** Counter for generating unique leaf IDs. */
	private leafIdCounter: number = 0;
	/** Session-only widths (per-note mode 'view-only'), dropped when the note is closed. */
	private viewOnlyWidths: Map<string, WidthValue> = new Map();
	/** Every containerEl the plugin has tagged with `data-cnw-id`, so cleanup
	 *  can find them without a global DOM query. */
	private taggedLeaves: Set<HTMLElement> = new Set();
	/** Pending rAF handle for the debounced consistency check (0 = none). */
	private consistencyRaf: number = 0;

	/**
	 * Constructs a new NoteWidthManager instance.
	 * @param app - The Obsidian application instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(private app: App, private plugin: CustomNoteWidth)
	{
		this.applyCodeBlockModes();
	}

	/**
	 * Ensures a view's container element has a data-cnw-id attribute and returns it.
	 * @param view - The MarkdownView to get/assign an ID for.
	 * @returns The unique leaf ID string.
	 */
	private getLeafId(view: MarkdownView): string
	{
		const el = view.containerEl;
		let id = el.getAttribute('data-cnw-id');
		if (!id)
		{
			id = `cnw-${this.leafIdCounter++}`;
			el.setAttribute('data-cnw-id', id);
			this.taggedLeaves.add(el);
		}
		return id;
	}

	/**
	 * Synchronously resolves the correct WidthValue for a given file
	 * by reading from Obsidian's metadataCache (YAML frontmatter only).
	 *
	 * @param file - The file to resolve width for.
	 * @returns The WidthValue for the file.
	 */
	public resolveWidthForFile(file: TFile): WidthValue
	{
		const defaultWidth = this.plugin.settingsManager.getDefaultWidth();
		const defaultUnit = this.plugin.settingsManager.getDefaultWidthUnit();
		const defaultWv: WidthValue = { value: defaultWidth, unit: defaultUnit };

		if (!this.plugin.settingsManager.getEnablePerNoteWidth())
		{
			return defaultWv;
		}

		const mode = this.plugin.settingsManager.getPerNoteMode();

		// In 'local' / 'view-only' the per-mode store shadows the frontmatter;
		// the frontmatter still acts as the initial value when no entry exists.
		if (mode === 'local')
		{
			const override = this.plugin.settingsManager.getLocalOverrides()[file.path];
			if (override)
			{
				const unitConfig = this.plugin.settingsManager.getUnitConfig(override.unit);
				return validateWidthValue(override, unitConfig);
			}
		}
		else if (mode === 'view-only')
		{
			const view = this.viewOnlyWidths.get(file.path);
			if (view)
			{
				const unitConfig = this.plugin.settingsManager.getUnitConfig(view.unit);
				return validateWidthValue(view, unitConfig);
			}
		}

		const yamlKey = this.plugin.settingsManager.getYAMLKey();
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

		if (!frontmatter)
		{
			return defaultWv;
		}

		// Frontmatter values are untyped by Obsidian; parseWidthValue accepts
		// `unknown` and validates the shape internally.
		const rawValue: unknown = frontmatter[yamlKey];
		const parsed = parseWidthValue(rawValue, defaultUnit);

		if (parsed)
		{
			const unitConfig = this.plugin.settingsManager.getUnitConfig(parsed.unit);
			return validateWidthValue(parsed, unitConfig);
		}

		return defaultWv;
	}

	/**
	 * Reports which store supplied the effective width for a file, mirroring the
	 * precedence in {@link resolveWidthForFile}. Used only by the diagnostics report.
	 * @param file - The file to inspect.
	 * @returns The origin of the width that {@link resolveWidthForFile} would return.
	 */
	public getWidthSource(file: TFile): WidthSource
	{
		if (!this.plugin.settingsManager.getEnablePerNoteWidth())
		{
			return 'default';
		}

		const mode = this.plugin.settingsManager.getPerNoteMode();
		if (mode === 'local' && this.plugin.settingsManager.getLocalOverrides()[file.path])
		{
			return 'local';
		}
		if (mode === 'view-only' && this.viewOnlyWidths.get(file.path))
		{
			return 'view-only';
		}

		const yamlKey = this.plugin.settingsManager.getYAMLKey();
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		if (frontmatter && parseWidthValue(frontmatter[yamlKey], this.plugin.settingsManager.getDefaultWidthUnit()))
		{
			return 'frontmatter';
		}

		return 'default';
	}

	/**
	 * Synchronously applies the correct width for a leaf by resolving
	 * the width from metadata and calculating the CSS value.
	 * Used on tab switch, resize, and layout change events.
	 *
	 * @param leaf - The workspace leaf to apply width for (defaults to active leaf).
	 */
	public applyWidthForLeaf(leaf?: WorkspaceLeaf): void
	{
		const view = (leaf?.view instanceof MarkdownView)
			? leaf.view
			: getActiveMarkdownView(this.app);

		if (!view || !view.file)
		{
			this.recordApply(false, "no-view");
			return;
		}

		const wv = this.resolveWidthForFile(view.file);
		const editorMode = view.getMode();
		const editorDiv = getEditorDivForView(view, editorMode);
		if (!editorDiv)
		{
			this.recordApply(false, "no-editor-element");
			return;
		}

		const cssValue = widthValueToCss(wv, editorDiv);
		if (!cssValue)
		{
			this.recordApply(false, "no-char-width");
			return;
		}

		this.applyWidthToLeaf(view, cssValue, this.computeCodeBlockCss(editorDiv));
		this.recordApply(true, null);
		this.scheduleConsistencyCheck(view);

		// Update slider UI to reflect the note's width and unit
		this.plugin.uiManager.setSliderAndTextField(wv.value);
		this.plugin.uiManager.updateSliderRange(wv.unit);
		this.plugin.uiManager.setUnitSelector(wv.unit);
		this.plugin.uiManager.updatePillsActiveState(wv);
	}

	/** Stores a view-only width for a file. */
	public setViewOnlyWidth(path: string, wv: WidthValue): void
	{
		this.viewOnlyWidths.set(path, wv);
	}

	/** Removes the view-only width for a file. */
	public clearViewOnlyWidth(path: string): void
	{
		this.viewOnlyWidths.delete(path);
	}

	/** Moves a view-only entry to a new path (used on rename). */
	public renameViewOnlyWidth(oldPath: string, newPath: string): void
	{
		const wv = this.viewOnlyWidths.get(oldPath);
		if (!wv) return;
		this.viewOnlyWidths.delete(oldPath);
		this.viewOnlyWidths.set(newPath, wv);
	}

	/** Drops view-only entries for files that no longer have any open leaf. */
	public cleanupViewOnlyWidths(): void
	{
		if (this.viewOnlyWidths.size === 0) return;

		const openPaths = new Set<string>();
		this.app.workspace.iterateAllLeaves((leaf) =>
		{
			if (leaf.view instanceof MarkdownView && leaf.view.file)
			{
				openPaths.add(leaf.view.file.path);
			}
		});

		for (const path of this.viewOnlyWidths.keys())
		{
			if (!openPaths.has(path))
			{
				this.viewOnlyWidths.delete(path);
			}
		}
	}

	/** Removes every view-only entry. Returns the number that were removed. */
	public clearAllViewOnlyWidths(): number
	{
		const count = this.viewOnlyWidths.size;
		this.viewOnlyWidths.clear();
		return count;
	}

	/**
	 * Removes all custom width styles from every tagged leaf: clears the inline
	 * `--file-line-width` on its editor views, the reference variables on the
	 * container, and drops the `data-cnw-id` attribute so the code-block rules
	 * stop matching.
	 */
	public removeNoteWidthEditorStyle(): void
	{
		for (const el of this.taggedLeaves)
		{
			el.removeAttribute('data-cnw-id');
			el.setCssProps({
				"--cnw-note-width": "",
				"--cnw-code-block-width": "",
			});
			this.setFileLineWidthOnViews(el, "");
		}
		this.taggedLeaves.clear();
	}

	/**
	 * Removes plugin state from the DOM. Call on plugin unload.
	 */
	public destroy(): void
	{
		if (this.consistencyRaf)
		{
			window.cancelAnimationFrame(this.consistencyRaf);
			this.consistencyRaf = 0;
		}
		this.removeNoteWidthEditorStyle();
		this.viewOnlyWidths.clear();
		document.body.removeClass("cnw-cb-reading");
		document.body.removeClass("cnw-cb-source");
		document.body.removeClass("cnw-cb-livepreview");
	}

	/**
	 * Applies the current code block mode flags to the shared body element.
	 * Because the flags are global settings, one call is enough to affect
	 * every open leaf. `toggleClass` is idempotent so the extra calls that
	 * happen during frequent `applyWidthForLeaf` runs are cheap.
	 */
	public applyCodeBlockModes(): void
	{
		const enabled = this.plugin.settingsManager.getEnableCodeBlockWidth();
		const modes = this.plugin.settingsManager.getCodeBlockWidthModes();
		document.body.toggleClass("cnw-cb-reading", enabled && modes.reading);
		document.body.toggleClass("cnw-cb-source", enabled && modes.source);
		document.body.toggleClass("cnw-cb-livepreview", enabled && modes.livePreview);
	}

	/**
	 * Computes the CSS value for the code block width, or null when the
	 * feature is disabled.
	 * @param editorDiv - The editor DOM element for width calculations.
	 * @returns The CSS value string, or null when the feature is off.
	 */
	private computeCodeBlockCss(editorDiv: Element): string | null
	{
		if (!this.plugin.settingsManager.getEnableCodeBlockWidth()) return null;
		const cbWv: WidthValue = {
			value: this.plugin.settingsManager.getCodeBlockWidth(),
			unit: this.plugin.settingsManager.getCodeBlockWidthUnit(),
		};
		return widthValueToCss(cbWv, editorDiv);
	}

	/**
	 * Applies a resolved width to a leaf: tags it, writes the reference variables
	 * on the container, writes `--file-line-width` inline onto its editor views,
	 * and keeps the body-scoped code-block mode classes in sync.
	 * @param view - The markdown view whose leaf receives the width.
	 * @param noteWidthCss - The CSS width value (e.g. "700px" or "80ch").
	 * @param codeBlockCss - The value for `--cnw-code-block-width`, or null to unset.
	 */
	private applyWidthToLeaf(view: MarkdownView, noteWidthCss: string, codeBlockCss: string | null): void
	{
		this.getLeafId(view);
		this.setLeafWidthVars(view.containerEl, noteWidthCss, codeBlockCss);
		this.setFileLineWidthOnViews(view.containerEl, noteWidthCss);
		// A settings change may have flipped a mode flag; keep the body classes in sync.
		this.applyCodeBlockModes();
	}

	/**
	 * Writes both reference CSS variables in one call. Passing `null` for the
	 * code block value unsets it so a leaf does not keep a stale width after
	 * the feature is turned off.
	 * @param el - The container element that owns the variables.
	 * @param noteWidthCss - The value for `--cnw-note-width`.
	 * @param codeBlockCss - The value for `--cnw-code-block-width`, or null to unset.
	 */
	private setLeafWidthVars(el: HTMLElement, noteWidthCss: string, codeBlockCss: string | null): void
	{
		el.setCssProps({
			"--cnw-note-width": noteWidthCss,
			"--cnw-code-block-width": codeBlockCss ?? "",
		});
	}

	/**
	 * Writes `--file-line-width` inline onto the leaf's editor view elements
	 * (source and preview), with priority `important`, or clears it when the
	 * value is empty. This is the declaration that drives the visible width.
	 *
	 * The `important` priority restores the 2.4.1 behaviour: an inline
	 * `!important` declaration beats even a theme or snippet that marks
	 * `--file-line-width` `!important` on a selector (inline wins over selectors
	 * in the cascade). `setCssProps` cannot set a priority, so this goes through
	 * `style.setProperty` directly with a dynamic value (not a static literal,
	 * so the `no-static-styles-assignment` rule does not apply).
	 * @param container - The leaf's container element.
	 * @param cssValue - The width value, or "" to clear it.
	 */
	private setFileLineWidthOnViews(container: HTMLElement, cssValue: string): void
	{
		for (const selector of VIEW_SELECTORS)
		{
			const el = container.querySelector<HTMLElement>(selector);
			if (!el)
			{
				continue;
			}
			if (cssValue === "")
			{
				el.style.removeProperty("--file-line-width");
			}
			else
			{
				el.style.setProperty("--file-line-width", cssValue, "important");
			}
		}
	}

	/** Records the outcome of a width apply in the diagnostics log. */
	private recordApply(completed: boolean, abortReason: ApplyAbortReason): void
	{
		this.plugin.diagnosticsLog.recordApply({ completed, abortReason });
	}

	/**
	 * Schedules a debounced consistency check on the next animation frame. The
	 * check only reads computed styles (never re-applies), so it cannot loop.
	 *
	 * A single shared frame handle is intentional: the sync apply and its rAF
	 * re-apply (and rapid successive applies) all target the same leaf, so the
	 * previous pending check is cancelled and only one check runs per frame,
	 * against the final applied state. That is the state worth verifying.
	 * @param view - The view to check after the browser has laid it out.
	 */
	private scheduleConsistencyCheck(view: MarkdownView): void
	{
		if (this.consistencyRaf)
		{
			window.cancelAnimationFrame(this.consistencyRaf);
		}
		this.consistencyRaf = window.requestAnimationFrame(() =>
		{
			this.consistencyRaf = 0;
			this.checkConsistency(view);
		});
	}

	/**
	 * Compares the `--file-line-width` the plugin set with the `max-width` that
	 * actually computed on the sizer. A divergence (beyond ~1px) means a theme or
	 * snippet is overriding the width; it is logged to the ring buffer for the
	 * diagnostics report. No Notice is shown.
	 * @param view - The view to check.
	 */
	private checkConsistency(view: MarkdownView): void
	{
		const mode = view.getMode();
		const container = view.containerEl;
		const viewEl = mode === "preview"
			? container.querySelector<HTMLElement>(".markdown-preview-view")
			: container.querySelector<HTMLElement>(".markdown-source-view");
		const sizer = mode === "preview"
			? container.querySelector<HTMLElement>(".markdown-preview-sizer")
			: container.querySelector<HTMLElement>(".cm-sizer");
		if (!viewEl || !sizer)
		{
			return;
		}

		const setWidth = window.getComputedStyle(viewEl).getPropertyValue("--file-line-width").trim();
		const actualWidth = window.getComputedStyle(sizer).maxWidth.trim();
		const mismatch = pixelsDiffer(setWidth, actualWidth);
		this.plugin.diagnosticsLog.recordConsistency(mismatch, setWidth || "(unset)", actualWidth || "(unset)");
	}

	/**
	 * Updates the custom editor style with a new WidthValue on the active view.
	 * Used for user-driven width changes (slider, commands).
	 * @param wv - The WidthValue to be applied.
	 */
	public updateNoteWidthEditorStyle(wv: WidthValue): void
	{
		const view = getActiveMarkdownView(this.app);
		if (!view)
		{
			this.recordApply(false, "no-view");
			return;
		}

		const editorMode = view.getMode();
		const editorDiv = getActiveEditorDiv(this.app, editorMode);
		if (!editorDiv)
		{
			this.recordApply(false, "no-editor-element");
			return;
		}

		const cssValue = widthValueToCss(wv, editorDiv);
		if (!cssValue)
		{
			console.error("Something went wrong while changing the note width!", new Error().stack);
			this.recordApply(false, "no-char-width");
			return;
		}

		this.applyWidthToLeaf(view, cssValue, this.computeCodeBlockCss(editorDiv));
		this.recordApply(true, null);
		this.scheduleConsistencyCheck(view);
	}

	/**
	 * Changes the width of all notes via YAML frontmatter.
	 * @param wv - The WidthValue to be applied.
	 */
	public async changeAllNoteWidth(wv: WidthValue): Promise<void>
	{
		const unitConfig = this.plugin.settingsManager.getUnitConfig(wv.unit);
		const validated = validateWidthValue(wv, unitConfig);

		if (this.plugin.settingsManager.getEnablePerNoteWidth())
		{
			const yamlKey = this.plugin.settingsManager.getYAMLKey();
			const yamlValue = formatWidthForYaml(validated);
			const progressBarModal = new ProgressBarModal(this.app, t("progress.changing_values"));
			progressBarModal.display();
			await this.plugin.yamlFrontMatterProcessor.updateAllYamlValues(yamlKey, yamlValue, progressBarModal);
			progressBarModal.close();
		}

		this.updateNoteWidthEditorStyle(validated);
		this.plugin.uiManager.setSliderAndTextField(validated.value);
		await this.plugin.settingsManager.saveSettings({
			...this.plugin.settingsManager.settings,
			defaultWidth: validated.value,
			defaultWidthUnit: validated.unit,
		});
	}

	/**
	 * Updates the default width of a note.
	 * @param wv - The new WidthValue to set as default.
	 */
	public async changeDefaultNoteWidth(wv: WidthValue): Promise<void>
	{
		await this.plugin.settingsManager.saveSettings({
			...this.plugin.settingsManager.settings,
			defaultWidth: wv.value,
			defaultWidthUnit: wv.unit,
		});
	}

	/**
	 * Updates the width of the current note via YAML frontmatter.
	 * @param wv - The new WidthValue to set for the current note.
	 */
	public async changeNoteWidth(wv: WidthValue): Promise<void>
	{
		const unitConfig = this.plugin.settingsManager.getUnitConfig(wv.unit);
		const validated = validateWidthValue(wv, unitConfig);

		if (this.plugin.settingsManager.getEnablePerNoteWidth())
		{
			const yamlKey = this.plugin.settingsManager.getYAMLKey();
			const yamlValue = formatWidthForYaml(validated);
			await this.plugin.yamlFrontMatterProcessor.setYamlValue(yamlKey, yamlValue);
		}

		this.plugin.uiManager.setSliderAndTextField(validated.value);
		this.updateNoteWidthEditorStyle(validated);
	}
}
