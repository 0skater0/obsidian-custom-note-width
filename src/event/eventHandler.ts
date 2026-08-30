import { App, Notice, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
import CustomNoteWidth from "src/main";
import { t } from "src/i18n/i18n";
import { getActiveMarkdownView, isActiveLeafMarkdown, validateWidth } from "src/utility/utilities";
import { CONFIG, WidthUnit, WidthValue, formatWidthForYaml } from "src/utility/config";

/**
 * Handles events related to the CustomNoteWidth plugin.
 */
export default class EventHandler
{
	updateTimeout: number = 0;
	private layoutChangeSuppressed: boolean = false;

	/**
	 * Constructs a new EventHandler instance.
	 * @param app - The Obsidian application instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(private app: App, private plugin: CustomNoteWidth)
	{
	}

	/**
	 * Register event handlers related to the plugin.
	 * Handlers registered via `plugin.registerEvent()` are automatically
	 * removed by Obsidian on plugin unload; no manual deregistration needed.
	 */
	public registerEventHandlers(): void
	{
		this.plugin.registerEvent(this.app.workspace.on("resize", this.handleResize));
		this.plugin.registerEvent(this.app.workspace.on("active-leaf-change", this.handleActiveLeafChange));
		this.plugin.registerEvent(this.app.workspace.on("layout-change", this.handleLayoutChange));
		this.plugin.registerEvent(this.app.vault.on("rename", this.handleFileRename));
		this.plugin.registerEvent(this.app.vault.on("delete", this.handleFileDelete));
	}

	/**
	 * Handles the resize event of the workspace.
	 */
	private handleResize = async (): Promise<void> =>
	{
		this.plugin.diagnosticsLog.recordEvent("resize");

		// Check if the slider width exceeds the threshold and reset it if necessary
		if (this.plugin.settingsManager.getSliderWidth() / window.innerWidth > CONFIG.SLIDER_HIDE_THRESHOLD)
		{
			new Notice(t("notice.slider_too_large"), 5000);
			const slider = this.plugin.uiManager.getSliderElement();
			await this.plugin.settingsManager.saveSettings({
				...this.plugin.settingsManager.settings,
				sliderWidth: this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth
			});
			if (slider) slider.setCssStyles({ width: `${this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth}px` });
		}

		// Re-apply width for the current leaf using synchronous resolution.
		this.plugin.noteWidthManager.applyWidthForLeaf();
	};

	/**
	 * Handles the active leaf change event.
	 */
	private handleActiveLeafChange = async (leaf: WorkspaceLeaf | null): Promise<void> =>
	{
		this.plugin.diagnosticsLog.recordEvent("activeLeafChange");

		// Cancel any pending YAML write from slider interaction
		if (this.updateTimeout) window.clearTimeout(this.updateTimeout);

		// Enable/Disable our statusbar elements(wrapper)
		if (isActiveLeafMarkdown(this.app))
		{
			this.plugin.statusBarManager.showStatusBarItem();
		} else
		{
			this.plugin.statusBarManager.hideStatusBarItem();
		}

		if (!leaf) return;

		// Immediately apply correct width via synchronous resolution from metadataCache
		this.plugin.noteWidthManager.applyWidthForLeaf(leaf);

		// Re-apply via rAF: Obsidian may override --file-line-width after this handler
		// returns. rAF runs after all synchronous code but before the browser paints.
		window.requestAnimationFrame(() =>
		{
			this.plugin.noteWidthManager.applyWidthForLeaf(leaf);
		});
	};

	/**
	 * Handles the layout-change event: drops view-only widths for files that are no
	 * longer open in any leaf, then re-applies width for the active leaf (unless a
	 * recent YAML write asked to suppress this cycle to avoid a stale metadataCache read).
	 */
	private handleLayoutChange = (): void =>
	{
		this.plugin.diagnosticsLog.recordEvent("layoutChange");
		this.plugin.noteWidthManager.cleanupViewOnlyWidths();
		if (this.layoutChangeSuppressed) return;
		this.plugin.noteWidthManager.applyWidthForLeaf();
		// Re-apply via rAF: split panes and sidebar toggles remount leaf
		// containers, and Obsidian may set --file-line-width on the fresh
		// container after this handler returns. rAF runs after all synchronous
		// code but before the browser paints, so we win the last-write race.
		window.requestAnimationFrame(() =>
		{
			this.plugin.noteWidthManager.applyWidthForLeaf();
		});
	};

	/** Moves per-note storage to the new path so a later note at the old path cannot inherit it. */
	private handleFileRename = async (file: TAbstractFile, oldPath: string): Promise<void> =>
	{
		if (!(file instanceof TFile)) return;
		await this.plugin.settingsManager.renameLocalOverride(oldPath, file.path);
		this.plugin.noteWidthManager.renameViewOnlyWidth(oldPath, file.path);
	};

	/** Drops per-note storage for a deleted file so its path cannot be inherited. */
	private handleFileDelete = async (file: TAbstractFile): Promise<void> =>
	{
		if (!(file instanceof TFile)) return;
		await this.plugin.settingsManager.clearLocalOverride(file.path);
		this.plugin.noteWidthManager.clearViewOnlyWidth(file.path);
	};

	/**
	 * Persists a width change from the status bar, according to the current per-note mode.
	 * With per-note width disabled the value becomes the global default.
	 * @param wv - The WidthValue to save.
	 */
	private saveWidth(wv: WidthValue): void
	{
		if (this.plugin.settingsManager.getEnablePerNoteWidth())
		{
			const mode = this.plugin.settingsManager.getPerNoteMode();
			const file = getActiveMarkdownView(this.app)?.file ?? null;

			if (mode === 'local')
			{
				if (file) void this.plugin.settingsManager.setLocalOverride(file.path, wv);
				return;
			}

			if (mode === 'view-only')
			{
				if (file) this.plugin.noteWidthManager.setViewOnlyWidth(file.path, wv);
				return;
			}

			// 'frontmatter' mode: debounced YAML write.
			if (this.updateTimeout) window.clearTimeout(this.updateTimeout);
			this.updateTimeout = window.setTimeout(() =>
			{
				// Suppress layout-change during YAML write to prevent stale metadataCache reads
				this.layoutChangeSuppressed = true;
				const yamlKey = this.plugin.settingsManager.getYAMLKey();
				const yamlValue = formatWidthForYaml(wv);
				void this.plugin.yamlFrontMatterProcessor.setYamlValue(yamlKey, yamlValue).then(() =>
				{
					window.setTimeout(() => { this.layoutChangeSuppressed = false; }, 500);
				});
			}, 250);
		}
		else
		{
			// Global: save default width + unit to settings
			void this.plugin.settingsManager.saveSettings({
				...this.plugin.settingsManager.settings,
				defaultWidth: wv.value,
				defaultWidthUnit: wv.unit,
			});
		}
	}

	/**
	 * Registers the slider's own input listener: applies the width, persists it,
	 * and syncs the optional text display. Independent of the value-display mode,
	 * so the slider works even when the value is hidden.
	 * @param slider - The slider HTML element.
	 * @param sliderValueText - Optional companion text element (input or span) to keep in sync.
	 */
	public handleSliderInputEvent(slider: HTMLInputElement, sliderValueText: HTMLElement | null): void
	{
		slider.addEventListener("input", () =>
		{
			const unit = this.plugin.uiManager.getCurrentUnit();
			const value = parseInt(slider.value);
			const wv: WidthValue = { value, unit };

			this.plugin.noteWidthManager.updateNoteWidthEditorStyle(wv);
			this.saveWidth(wv);

			if (sliderValueText?.instanceOf(HTMLInputElement))
			{
				sliderValueText.value = value.toString();
			}
			else if (sliderValueText?.instanceOf(HTMLSpanElement))
			{
				sliderValueText.textContent = value.toString();
			}
		});
	}

	/**
	 * Registers listeners on the editable text input field (clamp on blur/enter,
	 * live-apply on typing). The slider's own input listener is handled by
	 * `handleSliderInputEvent`.
	 * @param slider - The slider HTML element.
	 * @param sliderValueText - The editable text input associated with the slider.
	 */
	public handleTextInputEvent(slider: HTMLInputElement, sliderValueText: HTMLElement): void
	{
		// Clamp on change (blur/enter)
		sliderValueText.addEventListener("change", () =>
		{
			const unit = this.plugin.uiManager.getCurrentUnit();
			const config = this.plugin.settingsManager.getUnitConfig(unit);
			const enteredValue = parseInt((sliderValueText as HTMLInputElement).value);

			if (isNaN(enteredValue) || enteredValue < config.min)
			{
				(sliderValueText as HTMLInputElement).value = config.min.toString();
			} else if (enteredValue > config.max)
			{
				(sliderValueText as HTMLInputElement).value = config.max.toString();
			}
		});

		// Live input: clamp and apply
		sliderValueText.addEventListener("input", () =>
		{
			const unit = this.plugin.uiManager.getCurrentUnit();
			const config = this.plugin.settingsManager.getUnitConfig(unit);
			let enteredValue = parseInt((sliderValueText as HTMLInputElement).value);

			if (isNaN(enteredValue) || enteredValue < config.min)
			{
				enteredValue = config.min;
			} else if (enteredValue > config.max)
			{
				enteredValue = config.max;
			}

			const clampedValue = validateWidth(enteredValue, unit, config);
			slider.value = clampedValue.toString();

			const wv: WidthValue = { value: clampedValue, unit };
			this.plugin.noteWidthManager.updateNoteWidthEditorStyle(wv);
			this.saveWidth(wv);

			// Limit input length
			(sliderValueText as HTMLInputElement).value = (sliderValueText as HTMLInputElement).value.substring(0, config.maxInputLength);
		});
	}

	/**
	 * Applies the preset at the given index: updates UI, editor style and
	 * persists the width via the standard save flow.
	 * Callable from both pill clicks and command invocations.
	 * @param index - Index of the preset in the pills presets array.
	 */
	public applyPillPreset(index: number): void
	{
		const presets = this.plugin.settingsManager.getPillsPresets();
		const preset = presets[index];
		if (!preset) return;

		const config = this.plugin.settingsManager.getUnitConfig(preset.unit);
		const value = validateWidth(preset.value, preset.unit, config);
		const wv: WidthValue = { value, unit: preset.unit };

		// Sync other UI elements to the preset's unit and value
		this.plugin.uiManager.setUnitSelector(preset.unit);
		this.plugin.uiManager.updateSliderRange(preset.unit);
		this.plugin.uiManager.setSliderAndTextField(value);

		this.plugin.noteWidthManager.updateNoteWidthEditorStyle(wv);
		this.saveWidth(wv);

		this.plugin.uiManager.updatePillsActiveState(wv);
	}

	/**
	 * Configures the click event for a single pills preset button.
	 * @param pill - The pill button element.
	 * @param index - Index of the preset in the pills presets array.
	 */
	public handlePillClickEvent(pill: HTMLButtonElement, index: number): void
	{
		pill.addEventListener("click", () =>
		{
			this.applyPillPreset(index);
		});
	}

	/**
	 * Configures the event handler for the unit selector dropdown.
	 * When the unit changes, the slider range and current value are updated,
	 * and the new width is applied and saved.
	 * @param unitSelector - The unit selector select element.
	 */
	public handleUnitSelectorEvent(unitSelector: HTMLSelectElement): void
	{
		unitSelector.addEventListener("change", () =>
		{
			const newUnit = unitSelector.value as WidthUnit;
			const config = this.plugin.settingsManager.getUnitConfig(newUnit);

			// Update slider range
			this.plugin.uiManager.updateSliderRange(newUnit);

			// Clamp current value to new unit's range, or use the unit's default
			const slider = this.plugin.uiManager.getSliderElement();
			let currentValue = slider ? parseInt(slider.value) : config.defaultValue;

			if (isNaN(currentValue) || currentValue < config.min || currentValue > config.max)
			{
				currentValue = config.defaultValue;
			}

			const wv: WidthValue = { value: currentValue, unit: newUnit };

			this.plugin.uiManager.setSliderAndTextField(currentValue);
			this.plugin.noteWidthManager.updateNoteWidthEditorStyle(wv);
			this.saveWidth(wv);
		});
	}
}
