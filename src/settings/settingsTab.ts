import { App, PluginSettingTab, Setting, ToggleComponent, Notice } from "obsidian";
import type CustomNoteWidth from "src/main";
import DonationButton from "src/settings/donationButton";
import YamlFrontMatterProcessor from "src/note/yamlFrontMatterProcessor";
import ProgressBarModal from "src/modals/progressBarModal";
import { PLUGIN_NAME } from "src/utility/constants";
import { t, setLocaleOverride, SUPPORTED_LOCALES } from "src/i18n/i18n";
import { WidthUnit, UNIT_CONFIGS, VALID_UNITS, UNIT_ABSOLUTE_BOUNDS } from "src/utility/config";

/**
 * Represents the settings tab for the CustomNoteWidth plugin.
 */
export default class CustomNoteWidthSettingTab extends PluginSettingTab
{
	donationButton: DonationButton;
	yamlProcessor: YamlFrontMatterProcessor;

	/**
	 * Constructs a new CustomNoteWidthSettingTab instance.
	 * @param app - The Obsidian application instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(app: App, private plugin: CustomNoteWidth)
	{
		super(app, plugin);
		this.donationButton = new DonationButton();
		this.yamlProcessor = new YamlFrontMatterProcessor(app);
	}

	public display(): void
	{
		let updateTimeout: number;

		// Get the container element for the settings modal.
		const { containerEl } = this;
		containerEl.empty();

		// --- Language Section ---

		new Setting(containerEl)
			.setName(t("settings.language.name"))
			.setDesc(t("settings.language.desc"))
			.addDropdown((dropdown) =>
			{
				for (const loc of SUPPORTED_LOCALES)
				{
					dropdown.addOption(loc.value, loc.label);
				}
				dropdown.setValue(this.plugin.settingsManager.getLanguage());
				dropdown.onChange(async (value) =>
				{
					setLocaleOverride(value === "auto" ? null : value);
					await this.plugin.settingsManager.saveSettings({
						...this.plugin.settingsManager.settings,
						language: value,
					});
					this.display();
				});
			});

		// --- UI Section ---

		// Toggle to enable the slider
		new Setting(containerEl)
			.setName(t("settings.enable_slider.name"))
			.setDesc(t("settings.enable_slider.desc"))
			.addToggle((cb: ToggleComponent) =>
			{
				cb.setValue(this.plugin.settingsManager.getEnableSlider());
				cb.onChange(async (value: boolean) =>
				{
					await this.plugin.settingsManager.saveSettings({
						...this.plugin.settingsManager.settings,
						enableSlider: value,
					});
					this.plugin.uiManager.updateUI();
					this.display();
				});
			});

		// Only show this setting if the slider is enabled to change slider width
		if (this.plugin.settingsManager.getEnableSlider())
		{
			new Setting(containerEl)
				.setName(t("settings.slider_width.name"))
				.setDesc(t("settings.slider_width.desc"))
				.addText((text) => text
					.setPlaceholder("85")
					.setValue(this.plugin.settingsManager.getSliderWidth().toString())
					.onChange(async (value) =>
					{
						const sliderWidth = parseInt(value);

						if (value === "")
						{
							return;
						}
						else if (isNaN(sliderWidth))
						{
							await this.plugin.settingsManager.saveSettings({
								...this.plugin.settingsManager.settings,
								sliderWidth: this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth
							});
							text.setValue(this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth.toString());
							const slider = this.plugin.uiManager.getSliderElement();
							if (slider) slider.style.width = this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth + "px";
						}
						else if (sliderWidth / window.innerWidth > 0.9)
						{
							new Notice(t("notice.slider_too_large"), 5000);
							await this.plugin.settingsManager.saveSettings({
								...this.plugin.settingsManager.settings,
								sliderWidth: this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth
							});
							text.setValue(this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth.toString());
							const slider = this.plugin.uiManager.getSliderElement();
							if (slider) slider.style.width = this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth + "px";
						}
						else
						{
							await this.plugin.settingsManager.saveSettings({
								...this.plugin.settingsManager.settings,
								sliderWidth: sliderWidth
							});
							const slider = this.plugin.uiManager.getSliderElement();
							if (slider) slider.style.width = sliderWidth + "px";
						}
					})
				);
		}

		// Allow the change of the note width via text field input
		new Setting(containerEl)
			.setName(t("settings.enable_text_field.name"))
			.setDesc(t("settings.enable_text_field.desc"))
			.addToggle((cb: ToggleComponent) =>
			{
				cb.setValue(this.plugin.settingsManager.getEnableTextInput());
				cb.onChange(async (value: boolean) =>
				{
					await this.plugin.settingsManager.saveSettings({
						...this.plugin.settingsManager.settings,
						enableTextInput: value,
					});
					this.plugin.uiManager.updateUI();
					this.display();
				});
			});

		// --- Width Section ---

		// Default width unit selector
		new Setting(containerEl)
			.setName(t("settings.default_width_unit.name"))
			.setDesc(t("settings.default_width_unit.desc"))
			.addDropdown((dropdown) =>
			{
				for (const unit of VALID_UNITS)
				{
					dropdown.addOption(unit, unit);
				}
				dropdown.setValue(this.plugin.settingsManager.getDefaultWidthUnit());
				dropdown.onChange(async (value) =>
				{
					const newUnit = value as WidthUnit;
					const config = this.plugin.settingsManager.getUnitConfig(newUnit);
					let currentWidth = this.plugin.settingsManager.getDefaultWidth();

					// Clamp to new unit's range
					if (currentWidth < config.min || currentWidth > config.max)
					{
						currentWidth = config.defaultValue;
					}

					await this.plugin.settingsManager.saveSettings({
						...this.plugin.settingsManager.settings,
						defaultWidthUnit: newUnit,
						defaultWidth: currentWidth,
					});
					this.plugin.uiManager.updateUI();
					this.display();
				});
			});

		// Default width setting (always visible)
		{
			const unit = this.plugin.settingsManager.getDefaultWidthUnit();
			const config = this.plugin.settingsManager.getUnitConfig(unit);

			new Setting(containerEl)
				.setName(t("settings.default_width.name"))
				.setDesc(t("settings.default_width.desc", { unit, min: config.min, max: config.max }))
				.addText((text) =>
					text
						.setPlaceholder(config.defaultValue.toString())
						.setValue(this.plugin.settingsManager.getDefaultWidth().toString())
						.onChange(async (value) =>
						{
							const defaultWidth = parseInt(value);

							if (value === "" || value.trim() === "")
							{
								return;
							}
							else if (isNaN(defaultWidth))
							{
								await this.plugin.settingsManager.saveSettings({
									...this.plugin.settingsManager.settings,
									defaultWidth: config.defaultValue
								});
								text.setValue(config.defaultValue.toString());
							}
							else if (defaultWidth < config.min)
							{
								await this.plugin.settingsManager.saveSettings({
									...this.plugin.settingsManager.settings,
									defaultWidth: config.min
								});
								text.setValue(config.min.toString());
							}
							else if (defaultWidth > config.max)
							{
								await this.plugin.settingsManager.saveSettings({
									...this.plugin.settingsManager.settings,
									defaultWidth: config.max
								});
								text.setValue(config.max.toString());
							}
							else
							{
								await this.plugin.settingsManager.saveSettings({
									...this.plugin.settingsManager.settings,
									defaultWidth: defaultWidth
								});
							}
						})
				);
		}

		// --- Range Section ---

		for (const rangeUnit of VALID_UNITS)
		{
			const bounds = UNIT_ABSOLUTE_BOUNDS[rangeUnit];
			const currentRanges = this.plugin.settingsManager.settings.unitRanges[rangeUnit];

			new Setting(containerEl)
				.setName(t("settings.unit_range.name", { unit: rangeUnit }))
				.setDesc(t("settings.unit_range.desc", { unit: rangeUnit, min: bounds.min, max: bounds.max }))
				.addText((text) =>
					text
						.setPlaceholder(UNIT_CONFIGS[rangeUnit].min.toString())
						.setValue(currentRanges.min.toString())
						.onChange(async (value) =>
						{
							let min = parseInt(value);
							if (value === "" || isNaN(min)) return;
							min = Math.max(bounds.min, Math.min(bounds.max, min));
							if (min >= currentRanges.max) min = currentRanges.max - 1;
							const updatedRanges = { ...this.plugin.settingsManager.settings.unitRanges };
							updatedRanges[rangeUnit] = { ...updatedRanges[rangeUnit], min };
							await this.plugin.settingsManager.saveSettings({
								...this.plugin.settingsManager.settings,
								unitRanges: updatedRanges,
							});
							this.plugin.uiManager.updateUI();
						})
				)
				.addText((text) =>
					text
						.setPlaceholder(UNIT_CONFIGS[rangeUnit].max.toString())
						.setValue(currentRanges.max.toString())
						.onChange(async (value) =>
						{
							let max = parseInt(value);
							if (value === "" || isNaN(max)) return;
							max = Math.max(bounds.min, Math.min(bounds.max, max));
							if (max <= currentRanges.min) max = currentRanges.min + 1;
							const updatedRanges = { ...this.plugin.settingsManager.settings.unitRanges };
							updatedRanges[rangeUnit] = { ...updatedRanges[rangeUnit], max };
							await this.plugin.settingsManager.saveSettings({
								...this.plugin.settingsManager.settings,
								unitRanges: updatedRanges,
							});
							this.plugin.uiManager.updateUI();
						})
				);
		}

		// --- Per-Note Section ---

		// Toggle to enable per-note width via YAML frontmatter
		new Setting(containerEl)
			.setName(t("settings.enable_per_note.name"))
			.setDesc(t("settings.enable_per_note.desc"))
			.addToggle((cb: ToggleComponent) =>
			{
				cb.setValue(this.plugin.settingsManager.getEnablePerNoteWidth());
				cb.onChange(async (value: boolean) =>
				{
					await this.plugin.settingsManager.saveSettings({
						...this.plugin.settingsManager.settings,
						enablePerNoteWidth: value,
					});
					this.display();
				});
			});

		// Only show YAML key setting if per-note width is enabled
		if (this.plugin.settingsManager.getEnablePerNoteWidth())
		{
			new Setting(containerEl)
				.setName(t("settings.yaml_key.name"))
				.setDesc(t("settings.yaml_key.desc"))
				.addText((text) =>
				{
					text.setPlaceholder("custom-width")
						.setValue(this.plugin.settingsManager.getYAMLKey())
						.onChange(async (value) =>
						{
							// Reset the timer on every change
							if (updateTimeout) clearTimeout(updateTimeout);

							updateTimeout = window.setTimeout(async () =>
							{
								const oldKey = this.plugin.settingsManager.getYAMLKey();

								if (!value || value.trim() === "")
								{
									return;
								}

								if (oldKey !== value)
								{
									const progressBarModal = new ProgressBarModal(this.app, t("progress.changing_keys"));
									progressBarModal.display();

									// Call the method to replace old key with new key in all notes
									await this.yamlProcessor.replaceYamlKeyInAllNotes(oldKey, value, progressBarModal);

									progressBarModal.close();
								}

								await this.plugin.settingsManager.saveSettings({
									...this.plugin.settingsManager.settings,
									yamlKey: value
								});
							}, 1500);
						});
				});
		}

		// --- Code Block Width Section ---

		// Toggle to enable separate code block width
		new Setting(containerEl)
			.setName(t("settings.enable_code_block.name"))
			.setDesc(t("settings.enable_code_block.desc"))
			.addToggle((cb: ToggleComponent) =>
			{
				cb.setValue(this.plugin.settingsManager.getEnableCodeBlockWidth());
				cb.onChange(async (value: boolean) =>
				{
					await this.plugin.settingsManager.saveSettings({
						...this.plugin.settingsManager.settings,
						enableCodeBlockWidth: value,
					});
					this.plugin.noteWidthManager.applyWidthForLeaf();
					this.display();
				});
			});

		if (this.plugin.settingsManager.getEnableCodeBlockWidth())
		{
			// Code block width unit selector
			new Setting(containerEl)
				.setName(t("settings.code_block_unit.name"))
				.setDesc(t("settings.code_block_unit.desc"))
				.addDropdown((dropdown) =>
				{
					for (const unit of VALID_UNITS)
					{
						dropdown.addOption(unit, unit);
					}
					dropdown.setValue(this.plugin.settingsManager.getCodeBlockWidthUnit());
					dropdown.onChange(async (value) =>
					{
						const newUnit = value as WidthUnit;
						const config = this.plugin.settingsManager.getUnitConfig(newUnit);
						let currentWidth = this.plugin.settingsManager.getCodeBlockWidth();

						if (currentWidth < config.min || currentWidth > config.max)
						{
							currentWidth = config.defaultValue;
						}

						await this.plugin.settingsManager.saveSettings({
							...this.plugin.settingsManager.settings,
							codeBlockWidthUnit: newUnit,
							codeBlockWidth: currentWidth,
						});
						this.plugin.noteWidthManager.applyWidthForLeaf();
						this.display();
					});
				});

			// Code block width value
			{
				const unit = this.plugin.settingsManager.getCodeBlockWidthUnit();
				const config = this.plugin.settingsManager.getUnitConfig(unit);

				new Setting(containerEl)
					.setName(t("settings.code_block_width.name"))
					.setDesc(t("settings.code_block_width.desc", { unit, min: config.min, max: config.max }))
					.addText((text) =>
						text
							.setPlaceholder(config.defaultValue.toString())
							.setValue(this.plugin.settingsManager.getCodeBlockWidth().toString())
							.onChange(async (value) =>
							{
								let width = parseInt(value);

								if (value === "" || value.trim() === "")
								{
									return;
								}
								else if (isNaN(width))
								{
									width = config.defaultValue;
									text.setValue(config.defaultValue.toString());
								}
								else if (width < config.min)
								{
									width = config.min;
									text.setValue(config.min.toString());
								}
								else if (width > config.max)
								{
									width = config.max;
									text.setValue(config.max.toString());
								}

								await this.plugin.settingsManager.saveSettings({
									...this.plugin.settingsManager.settings,
									codeBlockWidth: width,
								});
								this.plugin.noteWidthManager.applyWidthForLeaf();
							})
					);
			}

			// Mode toggles
			const modes = this.plugin.settingsManager.getCodeBlockWidthModes();

			new Setting(containerEl)
				.setName(t("settings.reading_mode.name"))
				.setDesc(t("settings.reading_mode.desc"))
				.addToggle((cb: ToggleComponent) =>
				{
					cb.setValue(modes.reading);
					cb.onChange(async (value: boolean) =>
					{
						const updated = { ...this.plugin.settingsManager.settings.codeBlockWidthModes, reading: value };
						await this.plugin.settingsManager.saveSettings({
							...this.plugin.settingsManager.settings,
							codeBlockWidthModes: updated,
						});
						this.plugin.noteWidthManager.applyWidthForLeaf();
					});
				});

			new Setting(containerEl)
				.setName(t("settings.source_mode.name"))
				.setDesc(t("settings.source_mode.desc"))
				.addToggle((cb: ToggleComponent) =>
				{
					cb.setValue(modes.source);
					cb.onChange(async (value: boolean) =>
					{
						const updated = { ...this.plugin.settingsManager.settings.codeBlockWidthModes, source: value };
						await this.plugin.settingsManager.saveSettings({
							...this.plugin.settingsManager.settings,
							codeBlockWidthModes: updated,
						});
						this.plugin.noteWidthManager.applyWidthForLeaf();
					});
				});

			new Setting(containerEl)
				.setName(t("settings.live_preview.name"))
				.setDesc(t("settings.live_preview.desc"))
				.addToggle((cb: ToggleComponent) =>
				{
					cb.setValue(modes.livePreview);
					cb.onChange(async (value: boolean) =>
					{
						const updated = { ...this.plugin.settingsManager.settings.codeBlockWidthModes, livePreview: value };
						await this.plugin.settingsManager.saveSettings({
							...this.plugin.settingsManager.settings,
							codeBlockWidthModes: updated,
						});
						this.plugin.noteWidthManager.applyWidthForLeaf();
					});
				});
		}

		// Donation button
		containerEl.appendChild(this.donationButton.createDonationButton(containerEl));

		// Version info
		const versionEl = containerEl.createEl("div");
		versionEl.style.textAlign = "center";
		versionEl.style.marginTop = "20px";
		versionEl.style.fontSize = "11px";
		versionEl.style.color = "var(--text-muted)";
		versionEl.setText(`${PLUGIN_NAME} v${this.plugin.manifest.version}`);
	}
}
