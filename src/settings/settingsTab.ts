import { App, PluginSettingTab, Setting, ToggleComponent, Notice } from "obsidian";
import type CustomNoteWidth from "src/main";
import DonationButton from "src/settings/donationButton";
import YamlFrontMatterProcessor from "src/note/yamlFrontMatterProcessor";
import ProgressBarModal from "src/modals/progressBarModal";
import { DATABASE_FILENAME, DOM_IDENTIFIERS, NOTICES, PROGRESSBAR_MODAL_KEY_TITLE_TEXT } from "src/utility/constants";
import LokiDatabase from "src/utility/lokiDatabase";
import { getDatabasePath } from "src/utility/utilities";

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
		let updateTimeout: NodeJS.Timeout;

		// Get the container element for the settings modal.
		const { containerEl } = this;
		containerEl.empty();

		// Toggle to enable the slider
		new Setting(containerEl)
			.setName("Enable slider")
			.setDesc("Toggle to enable/disable the slider.")
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
				.setName("Slider width")
				.setDesc("Change the width of the slider.")
				.addText((text) => text
					.setPlaceholder("85")
					.setValue(this.plugin.settingsManager.getSliderWidth().toString())
					.onChange(async (value) =>
					{
						let sliderWidth = parseInt(value);

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
							new Notice(NOTICES.SLIDER_HIDE_WARNING, 5000);
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
			.setName("Enable text field")
			.setDesc("Enable to change the width via text field input.")
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

		// Toggle to separately save the width of each note
		new Setting(containerEl)
			.setName("Change width for each note")
			.setDesc("Toggle to separately change and save the width of notes.")
			.addToggle((cb: ToggleComponent) =>
			{
				cb.setValue(
					this.plugin.settingsManager.getEnableSaveWidthIndividually()
				);
				cb.onChange(async (value: boolean) =>
				{
					await this.plugin.settingsManager.saveSettings({
						...this.plugin.settingsManager.settings,
						enableSaveWidthIndividually: value
					});

					if (value && !this.plugin.database)
					{
						this.plugin.database = new LokiDatabase(getDatabasePath(this.plugin.app, DATABASE_FILENAME));
						await this.plugin.database.init();
					}

					if (!value)
					{
						await this.plugin.settingsManager.saveSettings({
							...this.plugin.settingsManager.settings,
							enableChangeDefaultNoteWidth: false
						});
					}
					this.display();
				});
			});

		// Only show this setting if enableSaveWidthIndividually is enabled
		if (this.plugin.settingsManager.getEnableSaveWidthIndividually())
		{
			// Toggle to change default note width
			new Setting(containerEl)
				.setName("Change default note width")
				.setDesc("Toggle to change the default width of notes.")
				.addToggle((cb: ToggleComponent) =>
				{
					cb.setValue(
						this.plugin.settingsManager.getEnableChangeDefaultNoteWidth()
					);
					cb.onChange(async (value: boolean) =>
					{
						await this.plugin.settingsManager.saveSettings({
							...this.plugin.settingsManager.settings,
							enableChangeDefaultNoteWidth: value
						});
						if (value)
						{
							this.plugin.commandsManager.enableCommand(
								"change-default-note-width"
							);
						} else
						{
							this.plugin.commandsManager.disableCommand(
								"change-default-note-width"
							);
						}
						this.display();
					});
				});

			if (this.plugin.settingsManager.getEnableChangeDefaultNoteWidth())
			{
				// Change the default width for notes
				new Setting(containerEl)
					.setName("Default width")
					.setDesc("Set the Default width each new note should have.")
					.addText((text) =>
						text
							.setPlaceholder("36")
							.setValue(this.plugin.settingsManager.getDefaultNoteWidth().toString())
							.onChange(async (value) =>
							{
								let defaultWidth = parseInt(value);

								if (value === "" || value.trim() === "")
								{
									return;
								}
								else if (isNaN(defaultWidth))
								{
									await this.plugin.settingsManager.saveSettings({
										...this.plugin.settingsManager.settings,
										defaultNoteWidth: this.plugin.settingsManager.DEFAULT_SETTINGS.defaultNoteWidth
									});

									text.setValue(this.plugin.settingsManager.DEFAULT_SETTINGS.defaultNoteWidth.toString());
								} else if (defaultWidth < 0)
								{
									await this.plugin.settingsManager.saveSettings({
										...this.plugin.settingsManager.settings,
										defaultNoteWidth: 0
									});

									text.setValue("0");
								}
								else if (defaultWidth > 100)
								{
									await this.plugin.settingsManager.saveSettings({
										...this.plugin.settingsManager.settings,
										defaultNoteWidth: 100
									});

									text.setValue("100");
								}
								else
								{
									await this.plugin.settingsManager.saveSettings({ ...this.plugin.settingsManager.settings, defaultNoteWidth: defaultWidth });
								}
							})
					);
			}
		}

		// Toggle to enable the option to retrieve note width from the YAML Frontmatter.
		new Setting(containerEl)
			.setName("Enable custom width via YAML-Frontmatter")
			.setDesc("Enable the option to retrieve note width from the YAML Frontmatter.")
			.addToggle((cb: ToggleComponent) =>
			{
				cb.setValue(this.plugin.settingsManager.getEnableYAMLWidth());
				cb.onChange(async (value: boolean) =>
				{
					await this.plugin.settingsManager.saveSettings({
						...this.plugin.settingsManager.settings,
						enableYAMLWidth: value,
					});
					this.display();
				});
			});

		// Only show this setting if enableYAMLWidth is enabled
		if (this.plugin.settingsManager.getEnableYAMLWidth())
		{
			new Setting(containerEl)
				.setName("YAML-Frontmatter key for custom width")
				.setDesc("Specify the YAML Frontmatter key to use for setting the custom width of the editor. If a note includes this key in its YAML Frontmatter, the specified value will be used as the editor's width.")
				.addText((text) =>
				{
					text.setPlaceholder("custom-width")
						.setValue(this.plugin.settingsManager.getYAMLKey())
						.onChange(async (value) =>
						{
							// Reset the timer on every change
							if (updateTimeout) clearTimeout(updateTimeout);

							updateTimeout = setTimeout(async () =>
							{
								const oldKey = this.plugin.settingsManager.getYAMLKey();

								if (!value || value.trim() === "")
								{
									return;
								}

								if (oldKey !== value)
								{
									const progressBarModal = new ProgressBarModal(this.app, PROGRESSBAR_MODAL_KEY_TITLE_TEXT);
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

		// Only show priority list if getEnableYAMLWidth and getEnableSaveWidthIndividually
		if (this.plugin.settingsManager.getEnableYAMLWidth() &&
			this.plugin.settingsManager.getEnableSaveWidthIndividually())
		{
			new Setting(containerEl)
				.setName("Priority list")
				.setDesc("Choose the priority in which the following will be executed.");
			{
				const listContainer = containerEl.createEl("div");

				// For each function, create a list item with up/down buttons
				this.plugin.settingsManager.getPriorityList().forEach((funcName, index) =>
				{
					// Create a container for this list item
					const listItem = listContainer.createEl("div", { cls: DOM_IDENTIFIERS.PRIORITY_LIST_ITEM });

					// Add the priority number
					const priority = listItem.createEl("span", { cls: DOM_IDENTIFIERS.PRIORITY_NUMBER });
					priority.innerText = `${index + 1}. `;

					// Add the function name
					const funcNameContainer = listItem.createEl("div");
					const funcNameSpan = funcNameContainer.createEl("span");
					funcNameSpan.innerText = funcName;

					// Create the button container
					const buttonContainer = listItem.createEl("div");
					buttonContainer.style.float = "right";

					// Create the up button if this is not the first item
					if (index > 0)
					{
						const upButton = buttonContainer.createEl("button");
						upButton.innerText = "\u2191";
						upButton.style.marginRight = "8px";
						upButton.addEventListener("click", async () =>
						{
							const priorityList = this.plugin.settingsManager.getPriorityList();
							[priorityList[index], priorityList[index - 1]] = [priorityList[index - 1], priorityList[index]];
							await this.plugin.settingsManager.saveSettings({
								...this.plugin.settingsManager.settings,
								priorityList: priorityList
							});
							this.display();
						});
					}

					// Create the down button if this is not the last item
					if (index < this.plugin.settingsManager.getPriorityList().length - 1)
					{
						const downButton = buttonContainer.createEl("button");
						downButton.innerText = "\u2193";
						downButton.style.marginRight = "8px";
						downButton.addEventListener("click", async () =>
						{
							const priorityList = this.plugin.settingsManager.getPriorityList();
							[priorityList[index], priorityList[index + 1]] = [priorityList[index + 1], priorityList[index]];
							await this.plugin.settingsManager.saveSettings({
								...this.plugin.settingsManager.settings,
								priorityList: priorityList
							});
							this.display();
						});

					}
				});

			}
		}

		// Donation button
		containerEl.appendChild(this.donationButton.createDonationButton(containerEl));
	}
}
