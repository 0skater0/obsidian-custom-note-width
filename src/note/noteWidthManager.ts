import { App, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import CustomNoteWidth from "src/main";
import ProgressBarModal from "src/modals/progressBarModal";
import { t } from "src/i18n/i18n";
import { WidthValue, parseWidthValue, widthValueToCss, formatWidthForYaml } from "src/utility/config";
import { getActiveEditorDiv, getActiveMarkdownView, getEditorDivForView, validateWidthValue } from "src/utility/utilities";

/**
 * Manages the note width functionalities.
 *
 * Uses a dual strategy to eliminate visual flash on tab switch:
 * 1. A persistent <style> element with per-leaf CSS rules (survives tab switches)
 * 2. Inline styles with !important set synchronously on leaf change
 *
 * Width is resolved synchronously from Obsidian's metadataCache (YAML-only).
 */
export default class NoteWidthManager
{
	/** Persistent <style> element in <head> for per-leaf width rules. */
	private readonly styleElement: HTMLStyleElement;
	/** Maps leaf data-cnw-id to CSS value (e.g., "500px"). */
	private leafRules: Map<string, string> = new Map();
	/** Maps leaf data-cnw-id to code block CSS value. */
	private leafCodeBlockRules: Map<string, string> = new Map();
	/** Counter for generating unique leaf IDs. */
	private leafIdCounter: number = 0;

	/**
	 * Constructs a new NoteWidthManager instance.
	 * @param app - The Obsidian application instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(private app: App, private plugin: CustomNoteWidth)
	{
		this.styleElement = document.createElement('style');
		this.styleElement.id = 'custom-note-width-rules';
		document.head.appendChild(this.styleElement);
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
		}
		return id;
	}

	/**
	 * Rebuilds the <style> element content from all active leaf rules.
	 */
	private rebuildStylesheet(): void
	{
		const rules: string[] = [];
		const codeBlockEnabled = this.plugin.settingsManager.getEnableCodeBlockWidth();

		this.leafRules.forEach((cssValue, leafId) =>
		{
			const codeBlockCss = codeBlockEnabled ? this.leafCodeBlockRules.get(leafId) : null;
			let rule = `.workspace-leaf-content[data-cnw-id="${leafId}"] { --file-line-width: ${cssValue} !important;`;
			if (codeBlockCss)
			{
				rule += ` --cnw-code-block-width: ${codeBlockCss};`;
			}
			rule += ` }`;
			rules.push(rule);
		});

		if (codeBlockEnabled && this.leafCodeBlockRules.size > 0)
		{
			const modes = this.plugin.settingsManager.getCodeBlockWidthModes();
			const cbProps = ` width: var(--cnw-code-block-width) !important;`
				+ ` max-width: var(--cnw-code-block-width) !important;`
				+ ` box-sizing: border-box !important;`;

			// Reading mode: target <pre> elements in preview view
			if (modes.reading)
			{
				rules.push(`.workspace-leaf-content[data-cnw-id] .markdown-preview-view pre {${cbProps} }`);
			}

			// Source / Live Preview mode: target CodeMirror code block lines
			if (modes.source && modes.livePreview)
			{
				rules.push(`.workspace-leaf-content[data-cnw-id] .cm-line.HyperMD-codeblock {${cbProps} }`);
			}
			else if (modes.source)
			{
				rules.push(`.workspace-leaf-content[data-cnw-id] .markdown-source-view:not(.is-live-preview) .cm-line.HyperMD-codeblock {${cbProps} }`);
			}
			else if (modes.livePreview)
			{
				rules.push(`.workspace-leaf-content[data-cnw-id] .markdown-source-view.is-live-preview .cm-line.HyperMD-codeblock {${cbProps} }`);
			}
		}

		this.styleElement.textContent = rules.join('\n');
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

		const yamlKey = this.plugin.settingsManager.getYAMLKey();
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;

		if (!frontmatter)
		{
			return defaultWv;
		}

		const rawValue = frontmatter[yamlKey];
		const parsed = parseWidthValue(rawValue, defaultUnit);

		if (parsed)
		{
			const unitConfig = this.plugin.settingsManager.getUnitConfig(parsed.unit);
			return validateWidthValue(parsed, unitConfig);
		}

		return defaultWv;
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

		if (!view || !view.file) return;

		const wv = this.resolveWidthForFile(view.file);
		const editorMode = view.getMode();
		const editorDiv = getEditorDivForView(view, editorMode);
		if (!editorDiv) return;

		const cssValue = widthValueToCss(wv, editorDiv);
		if (!cssValue) return;

		const leafId = this.getLeafId(view);

		// Strategy 1: Inline style with !important (immediate, highest priority)
		view.containerEl.style.setProperty('--file-line-width', cssValue, 'important');

		// Strategy 2: Update stylesheet rule (persistent across tab switches)
		this.leafRules.set(leafId, cssValue);

		// Code block width (global setting, computed per-leaf for % mode)
		this.applyCodeBlockWidth(view, editorDiv, leafId);

		this.rebuildStylesheet();

		// Update slider UI to reflect the note's width and unit
		this.plugin.uiManager.setSliderAndTextField(wv.value);
		this.plugin.uiManager.updateSliderRange(wv.unit);
		this.plugin.uiManager.setUnitSelector(wv.unit);
	}

	/**
	 * Removes all custom width styles from all views and clears leaf rules.
	 */
	public removeNoteWidthEditorStyle(): void
	{
		this.leafRules.clear();
		this.leafCodeBlockRules.clear();
		this.styleElement.textContent = '';
		this.app.workspace.iterateAllLeaves((leaf) =>
		{
			if (leaf.view instanceof MarkdownView)
			{
				leaf.view.containerEl.removeAttribute('data-cnw-id');
				leaf.view.containerEl.style.removeProperty('--file-line-width');
				leaf.view.containerEl.style.removeProperty('--cnw-code-block-width');
			}
		});
	}

	/**
	 * Removes the <style> element from the DOM. Call on plugin unload.
	 */
	public destroy(): void
	{
		this.removeNoteWidthEditorStyle();
		this.styleElement.remove();
	}

	/**
	 * Applies the code block width CSS variable for a given leaf.
	 * When enabled, computes and sets --cnw-code-block-width.
	 * When disabled, removes the variable.
	 * @param view - The MarkdownView to apply code block width for.
	 * @param editorDiv - The editor DOM element for width calculations.
	 * @param leafId - The unique leaf identifier.
	 */
	private applyCodeBlockWidth(view: MarkdownView, editorDiv: Element, leafId: string): void
	{
		if (!this.plugin.settingsManager.getEnableCodeBlockWidth())
		{
			view.containerEl.style.removeProperty('--cnw-code-block-width');
			this.leafCodeBlockRules.delete(leafId);
			return;
		}

		const cbWv: WidthValue = {
			value: this.plugin.settingsManager.getCodeBlockWidth(),
			unit: this.plugin.settingsManager.getCodeBlockWidthUnit(),
		};
		const cbCssValue = widthValueToCss(cbWv, editorDiv);
		if (cbCssValue)
		{
			view.containerEl.style.setProperty('--cnw-code-block-width', cbCssValue);
			this.leafCodeBlockRules.set(leafId, cbCssValue);
		}
	}

	/**
	 * Updates the custom editor style with a new WidthValue on the active view.
	 * Sets both an inline style and a stylesheet rule for the leaf.
	 * Used for user-driven width changes (slider, commands).
	 * @param wv - The WidthValue to be applied.
	 */
	public updateNoteWidthEditorStyle(wv: WidthValue): void
	{
		const view = getActiveMarkdownView(this.app);
		if (!view) return;

		const editorMode = view.getMode();
		const editorDiv = getActiveEditorDiv(this.app, editorMode);
		if (!editorDiv) return;

		const cssValue = widthValueToCss(wv, editorDiv);
		if (!cssValue)
		{
			console.error("Something went wrong while changing the note width!", new Error().stack);
			return;
		}

		const leafId = this.getLeafId(view);

		// Set inline style with !important for immediate effect
		view.containerEl.style.setProperty('--file-line-width', cssValue, 'important');

		// Update stylesheet rule for persistence across tab switches
		this.leafRules.set(leafId, cssValue);

		// Code block width
		this.applyCodeBlockWidth(view, editorDiv, leafId);

		this.rebuildStylesheet();
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
