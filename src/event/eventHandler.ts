import { App, Notice, WorkspaceLeaf } from "obsidian";
import CustomNoteWidth from "src/main";
import { t } from "src/i18n/i18n";
import { isActiveLeafMarkdown, validateWidth } from "src/utility/utilities";
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
	 */
	public registerEventHandlers(): void
	{
		this.plugin.registerEvent(this.app.workspace.on("resize", this.handleResize));
		this.plugin.registerEvent(this.app.workspace.on("active-leaf-change", this.handleActiveLeafChange));
		this.plugin.registerEvent(this.app.workspace.on("layout-change", this.handleLayoutChange));
	}

	/**
	 * Deregister event handlers related to the plugin.
	 */
	public deregisterEventHandlers(): void
	{
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.app.workspace.off("resize", this.handleResize as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.app.workspace.off("active-leaf-change", this.handleActiveLeafChange as any);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.app.workspace.off("layout-change", this.handleLayoutChange as any);
	}

	/**
	 * Handles the resize event of the workspace.
	 */
	private handleResize = async (): Promise<void> =>
	{
		// Check if the slider width exceeds the threshold and reset it if necessary
		if (this.plugin.settingsManager.getSliderWidth() / window.innerWidth > CONFIG.SLIDER_HIDE_THRESHOLD)
		{
			new Notice(t("notice.slider_too_large"), 5000);
			const slider = this.plugin.uiManager.getSliderElement();
			await this.plugin.settingsManager.saveSettings({
				...this.plugin.settingsManager.settings,
				sliderWidth: this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth
			});
			if (slider) slider.style.width = this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth + 'px';
		}

		// Re-apply width for the current leaf using synchronous resolution.
		this.plugin.noteWidthManager.applyWidthForLeaf();
	};

	/**
	 * Handles the active leaf change event.
	 */
	private handleActiveLeafChange = async (leaf: WorkspaceLeaf | null): Promise<void> =>
	{
		// Cancel any pending YAML write from slider interaction
		if (this.updateTimeout) clearTimeout(this.updateTimeout);

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
		requestAnimationFrame(() =>
		{
			this.plugin.noteWidthManager.applyWidthForLeaf(leaf);
		});
	};

	/**
	 * Handles the layout-change event.
	 * Suppressed briefly after YAML writes to avoid stale metadataCache reads.
	 */
	private handleLayoutChange = (): void =>
	{
		if (this.layoutChangeSuppressed) return;
		this.plugin.noteWidthManager.applyWidthForLeaf();
	};

	/**
	 * Saves the width value based on the current per-note setting.
	 * If per-note width is enabled, debounces a YAML write.
	 * If disabled, saves as the default width.
	 * @param wv - The WidthValue to save.
	 */
	private saveWidth(wv: WidthValue): void
	{
		if (this.plugin.settingsManager.getEnablePerNoteWidth())
		{
			// Per-note: debounce save to YAML frontmatter
			if (this.updateTimeout) clearTimeout(this.updateTimeout);
			this.updateTimeout = window.setTimeout(async () =>
			{
				// Suppress layout-change during YAML write to prevent stale metadataCache reads
				this.layoutChangeSuppressed = true;
				const yamlKey = this.plugin.settingsManager.getYAMLKey();
				const yamlValue = formatWidthForYaml(wv);
				await this.plugin.yamlFrontMatterProcessor.setYamlValue(yamlKey, yamlValue);
				window.setTimeout(() => { this.layoutChangeSuppressed = false; }, 500);
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
	 * Configures the events for the slider element with text input.
	 * @param slider - The slider HTML element.
	 * @param sliderValueText - The text display associated with the slider.
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
		sliderValueText.addEventListener("input", async () =>
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

		// Slider input event
		slider.addEventListener("input", async () =>
		{
			const unit = this.plugin.uiManager.getCurrentUnit();
			const value = parseInt(slider.value);
			const wv: WidthValue = { value, unit };

			this.plugin.noteWidthManager.updateNoteWidthEditorStyle(wv);
			this.saveWidth(wv);

			if (sliderValueText instanceof HTMLInputElement)
			{
				sliderValueText.value = value.toString();
			} else if (sliderValueText instanceof HTMLSpanElement)
			{
				sliderValueText.textContent = value.toString();
			}
		});
	}

	/**
	 * Configures the events for text span.
	 * @param slider - The slider HTML element.
	 * @param sliderValueText - The text display associated with the slider.
	 */
	public handleTextSpanEvent(slider: HTMLInputElement, sliderValueText: HTMLElement): void
	{
		slider.addEventListener("input", async () =>
		{
			const unit = this.plugin.uiManager.getCurrentUnit();
			const value = parseInt(slider.value);
			const wv: WidthValue = { value, unit };

			this.plugin.noteWidthManager.updateNoteWidthEditorStyle(wv);
			this.saveWidth(wv);

			sliderValueText.textContent = value.toString();
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
