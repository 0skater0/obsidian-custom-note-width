import { App } from "obsidian";
import CustomNoteWidth from "src/main";
import ProgressBarModal from "src/modals/progressBarModal";
import { DOM_IDENTIFIERS, NOTE_ID_KEY, PRIORITY_LIST, PROGRESS_BAR_MODAL_VALUE_TITLE_TEXT } from "src/utility/constants";
import { calculateNoteWidth, getActiveEditorDiv, getEditorMode, validateWidth } from "src/utility/utilities";
import UUIDGenerator from "src/utility/uuidGenerator";

/**
 * Manages the note width functionalities.
 */
export default class NoteWidthManager
{
	/** Element for injecting custom styles. */
	styleElement: HTMLStyleElement | null = null;

	/**
	 * Constructs a new NoteWidthManager instance.
	 * @param app - The Obsidian application instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(private app: App, private plugin: CustomNoteWidth)
	{
		// Create a new style element and append it to the head of the document
		this.styleElement = document.createElement("style");
		this.styleElement.id = DOM_IDENTIFIERS.CUSTOM_NOTE_WIDTH;
		document.getElementsByTagName("head")[0].appendChild(this.styleElement);
	}

	/**
	 * Removes the custom editor style, if it exists.
	 */
	public removeNoteWidthEditorStyle(): void
	{
		if (!this.styleElement) return;

		this.styleElement.remove();
		this.styleElement = null;
	}

	/**
	 * Updates the custom editor style with a new width percentage, if it exists.
	 * @param widthPercentage - The width percentage to be applied.
	 */
	public async updateNoteWidthEditorStyle(widthPercentage: number): Promise<void>
	{
		if (!this.styleElement) throw "custom-note-width style element not found!";

		const editorMode = getEditorMode();
		if (editorMode === null) return;

		const editorDiv = getActiveEditorDiv(this.app, editorMode);
		if (!editorDiv) return;

		const noteWidth = await calculateNoteWidth(widthPercentage, editorDiv);
		if (!noteWidth)
		{
			console.error("Something went wrong while changing the note width!", new Error().stack);
			return;
		}

		this.styleElement.innerText = `body { --file-line-width: ${noteWidth}px;}`;
	}

	/**
	 * Changes the width of all notes.
	 * @param width - The width to be applied.
	 */
	public async changeAllNoteWidth(width: number): Promise<void>
	{
		const CUSTOM_WIDTH_YAML_KEY = this.plugin.settingsManager.getYAMLKey();
		let noteWidth = validateWidth(width);
		const isSaveWidthIndividuallyEnabled = this.plugin.settingsManager.getEnableSaveWidthIndividually();
		const isYAMLWidthEnabled = this.plugin.settingsManager.getEnableYAMLWidth();

		if (isSaveWidthIndividuallyEnabled && isYAMLWidthEnabled)
		{
			this.plugin.database.updateAllNotesWidth(width);
			const progressBarModal = new ProgressBarModal(this.app, PROGRESS_BAR_MODAL_VALUE_TITLE_TEXT);
			progressBarModal.display();

			await this.plugin.yamlFrontMatterProcessor.updateAllYamlValues(CUSTOM_WIDTH_YAML_KEY, noteWidth, progressBarModal);

			progressBarModal.close();
		}
		else if (isYAMLWidthEnabled)
		{
			const progressBarModal = new ProgressBarModal(this.app, PROGRESS_BAR_MODAL_VALUE_TITLE_TEXT);
			progressBarModal.display();

			await this.plugin.yamlFrontMatterProcessor.updateAllYamlValues(CUSTOM_WIDTH_YAML_KEY, noteWidth, progressBarModal);

			progressBarModal.close();
		}
		else if (isSaveWidthIndividuallyEnabled)
		{
			this.plugin.database.updateAllNotesWidth(width);
		}

		this.updateNoteWidthEditorStyle(width);
		this.plugin.uiManager.setSliderAndTextField(width);
		await this.plugin.settingsManager.saveWidthPercentage(width);
	}

	/**
	 * Updates the default width of a note.
	 * @param width - The new width to set for the note.
	 * @returns A promise which resolves when the operation completes.
	 */
	public async changeDefaultNoteWidth(width: number): Promise<void>
	{
		await this.plugin.settingsManager.saveDefaultNoteWidth(width);
	}

	/**
	 * Updates the width of the current note based on settings and available note ID.
	 * @param width - The new width to set for the current note.
	 * @returns A promise which resolves when the operation completes.
	 */
	public async changeNoteWidth(width: number): Promise<void>
	{
		let noteWidth = validateWidth(width);
		const CUSTOM_WIDTH_YAML_KEY = this.plugin.settingsManager.getYAMLKey();
		const yamlProcessor = this.plugin.yamlFrontMatterProcessor;
		const isSaveWidthIndividuallyEnabled = this.plugin.settingsManager.getEnableSaveWidthIndividually();
		const isYAMLWidthEnabled = this.plugin.settingsManager.getEnableYAMLWidth();
		const hasNoteID = await yamlProcessor.hasYamlKey(NOTE_ID_KEY);
		const hasCustomKey = await yamlProcessor.hasYamlKey(CUSTOM_WIDTH_YAML_KEY);

		if (isSaveWidthIndividuallyEnabled && isYAMLWidthEnabled)
		{
			if (hasNoteID)
			{
				const noteID = await yamlProcessor.getYamlValue(NOTE_ID_KEY);

				if (this.plugin.database.noteExists(noteID))
				{
					this.plugin.database.addNote(noteID, noteWidth);
				}
				else
				{
					let noteWidth = validateWidth(width);
					this.plugin.database.addNote(noteID, noteWidth);
				}
			} else if (hasCustomKey)
			{
				yamlProcessor.setYamlValue(CUSTOM_WIDTH_YAML_KEY, noteWidth);
			}
			else
			{
				yamlProcessor.setYamlValue(NOTE_ID_KEY, UUIDGenerator.getUniqueUUID(this.plugin.database));
				this.plugin.database.addNote(UUIDGenerator.getUniqueUUID(this.plugin.database), noteWidth);
			}
		}
		else if (isSaveWidthIndividuallyEnabled)
		{
			if (hasNoteID)
			{
				const noteID = await yamlProcessor.getYamlValue(NOTE_ID_KEY);

				if (this.plugin.database.noteExists(noteID))
				{
					this.plugin.database.addNote(noteID, noteWidth);
				}
				else
				{
					let noteWidth = validateWidth(width);
					this.plugin.database.addNote(noteID, noteWidth);
				}
			}
			else
			{
				this.plugin.yamlFrontMatterProcessor.setYamlValue(NOTE_ID_KEY, UUIDGenerator.getUniqueUUID(this.plugin.database));
				this.plugin.database.addNote(UUIDGenerator.getUniqueUUID(this.plugin.database), noteWidth);
			}
		}
		else if (isYAMLWidthEnabled)
		{
			yamlProcessor.setYamlValue(CUSTOM_WIDTH_YAML_KEY, noteWidth);
		}

		this.plugin.uiManager.setSliderAndTextField(noteWidth);
		await this.updateNoteWidthEditorStyle(noteWidth);
		await this.plugin.settingsManager.saveWidthPercentage(noteWidth);
	}

	/**
	 * Updates the note width based on user settings.
	 */
	public async refreshNoteWidth(isUserInputTriggered: boolean): Promise<void>
	{
		const yamlProcessor = this.plugin.yamlFrontMatterProcessor;
		const uiManager = this.plugin.uiManager;
		const database = this.plugin.database;
		const DEFAULT_WIDTH = this.plugin.settingsManager.getDefaultNoteWidth();
		const isSaveWidthIndividuallyEnabled = this.plugin.settingsManager.getEnableSaveWidthIndividually();
		const isYAMLWidthEnabled = this.plugin.settingsManager.getEnableYAMLWidth();
		const currentWidthPercentage = this.plugin.settingsManager.getWidthPercentage();
		const CUSTOM_WIDTH_YAML_KEY = this.plugin.settingsManager.getYAMLKey();
		const CURRENT_PRIORITY = this.plugin.settingsManager.getCurrentPriority();

		if (!isUserInputTriggered)
		{
			if (!isSaveWidthIndividuallyEnabled && !isYAMLWidthEnabled)
			{
				uiManager.updateUIAndEditorWidth(currentWidthPercentage);
				return;
			}

			if (isSaveWidthIndividuallyEnabled && isYAMLWidthEnabled)
			{
				if (!yamlProcessor.hasYamlFrontMatter())
				{
					uiManager.updateUIAndEditorWidth(DEFAULT_WIDTH);
					return;
				}

				if (CURRENT_PRIORITY === PRIORITY_LIST.SAVED_NOTE_WIDTH)
				{
					if (await yamlProcessor.hasYamlKey(NOTE_ID_KEY))
					{
						const noteID = await yamlProcessor.getYamlValue(NOTE_ID_KEY);

						if (database.noteExists(noteID))
						{
							let width = database.getNoteWidth(noteID);
							if (width !== null)
							{
								width = validateWidth(width);
								uiManager.updateUIAndEditorWidth(width);
								return;
							}
						}
						else
						{
							if (await yamlProcessor.isOnlyYamlKey(NOTE_ID_KEY))
							{
								yamlProcessor.removeYamlFrontMatter();
							}
							else
							{
								yamlProcessor.removeYamlKey(NOTE_ID_KEY);
							}

							uiManager.updateUIAndEditorWidth(DEFAULT_WIDTH);
							return;
						}
					}
					else if (await yamlProcessor.hasYamlKey(CUSTOM_WIDTH_YAML_KEY))
					{
						let width = await yamlProcessor.getYamlValue(CUSTOM_WIDTH_YAML_KEY);
						if (width !== null)
						{
							width = validateWidth(width);
							yamlProcessor.setYamlValue(CUSTOM_WIDTH_YAML_KEY, width);
							uiManager.updateUIAndEditorWidth(await width);
							return;
						}
					} else
					{
						uiManager.updateUIAndEditorWidth(DEFAULT_WIDTH);
						return;
					}
				}
				else if (CURRENT_PRIORITY === PRIORITY_LIST.YAML_NOTE_WIDTH)
				{
					if (await yamlProcessor.hasYamlKey(CUSTOM_WIDTH_YAML_KEY))
					{
						let width = await yamlProcessor.getYamlValue(CUSTOM_WIDTH_YAML_KEY);
						if (width !== null)
						{
							width = validateWidth(width);
							yamlProcessor.setYamlValue(CUSTOM_WIDTH_YAML_KEY, width);
							uiManager.updateUIAndEditorWidth(await width);
							return;
						}
					}
					else if (await yamlProcessor.hasYamlKey(NOTE_ID_KEY))
					{
						const noteID = await yamlProcessor.getYamlValue(NOTE_ID_KEY);

						if (database.noteExists(noteID))
						{
							let width = database.getNoteWidth(noteID);
							if (width !== null)
							{
								width = validateWidth(width);
								uiManager.updateUIAndEditorWidth(width);
								return;
							}
						}
						else
						{
							if (await yamlProcessor.isOnlyYamlKey(NOTE_ID_KEY))
							{
								yamlProcessor.removeYamlFrontMatter();
							}
							else
							{
								yamlProcessor.removeYamlKey(NOTE_ID_KEY);
							}

							uiManager.updateUIAndEditorWidth(DEFAULT_WIDTH);
							return;
						}
					}
					else
					{
						uiManager.updateUIAndEditorWidth(DEFAULT_WIDTH);
						return;
					}
				}
			}
			else if (isSaveWidthIndividuallyEnabled)
			{
				if (!yamlProcessor.hasYamlFrontMatter())
				{
					uiManager.updateUIAndEditorWidth(DEFAULT_WIDTH);
					return;
				}

				if (!yamlProcessor.hasYamlKey(NOTE_ID_KEY))
				{
					uiManager.updateUIAndEditorWidth(DEFAULT_WIDTH);
					return;
				}
				else
				{
					const noteID = await yamlProcessor.getYamlValue(NOTE_ID_KEY);

					if (database.noteExists(noteID))
					{
						let width = database.getNoteWidth(noteID);
						if (width !== null)
						{
							width = validateWidth(width);
							uiManager.updateUIAndEditorWidth(width);
							return;
						}
					}
					else
					{
						if (await yamlProcessor.isOnlyYamlKey(NOTE_ID_KEY))
						{
							yamlProcessor.removeYamlFrontMatter();
						}
						else
						{
							yamlProcessor.removeYamlKey(NOTE_ID_KEY);
						}

						uiManager.updateUIAndEditorWidth(DEFAULT_WIDTH);
						return;
					}
				}
			}
			else if (isYAMLWidthEnabled)
			{
				if (!yamlProcessor.hasYamlFrontMatter())
				{
					uiManager.updateUIAndEditorWidth(DEFAULT_WIDTH);
					return;
				}

				if (!yamlProcessor.hasYamlKey(CUSTOM_WIDTH_YAML_KEY))
				{
					uiManager.updateUIAndEditorWidth(DEFAULT_WIDTH);
					return;
				}
				else
				{
					let width = await yamlProcessor.getYamlValue(CUSTOM_WIDTH_YAML_KEY);
					if (width !== null)
					{
						width = validateWidth(width);
						yamlProcessor.setYamlValue(CUSTOM_WIDTH_YAML_KEY, width);
						uiManager.updateUIAndEditorWidth(await width);
						return;
					}
				}
			}
		}
		else
		{
			this.plugin.eventHandler.isUserInputTriggered = false;

			if (!isSaveWidthIndividuallyEnabled && !isYAMLWidthEnabled)
			{
				this.plugin.noteWidthManager.updateNoteWidthEditorStyle(currentWidthPercentage);
				return;
			}

			if (isSaveWidthIndividuallyEnabled && isYAMLWidthEnabled)
			{
				if (!yamlProcessor.hasYamlFrontMatter())
				{
					if (CURRENT_PRIORITY === PRIORITY_LIST.SAVED_NOTE_WIDTH)
					{
						const UUID = UUIDGenerator.getUniqueUUID(database);
						database.addNote(UUID, currentWidthPercentage);
						yamlProcessor.setYamlValue(NOTE_ID_KEY, UUID);
						uiManager.updateUIAndEditorWidth(currentWidthPercentage);
						return;
					}
					else if (CURRENT_PRIORITY === PRIORITY_LIST.YAML_NOTE_WIDTH)
					{
						yamlProcessor.setYamlValue(CUSTOM_WIDTH_YAML_KEY, currentWidthPercentage);
						uiManager.updateUIAndEditorWidth(currentWidthPercentage);
						return;
					}
				}
				else
				{
					if (!yamlProcessor.hasYamlKey(CUSTOM_WIDTH_YAML_KEY) && !yamlProcessor.hasYamlKey(NOTE_ID_KEY))
					{
						if (CURRENT_PRIORITY === PRIORITY_LIST.SAVED_NOTE_WIDTH)
						{
							const UUID = UUIDGenerator.getUniqueUUID(database);
							yamlProcessor.setYamlValue(NOTE_ID_KEY, UUID);
							database.addNote(UUID, currentWidthPercentage);
							uiManager.updateUIAndEditorWidth(currentWidthPercentage);
						}
						else if (CURRENT_PRIORITY === PRIORITY_LIST.YAML_NOTE_WIDTH)
						{
							yamlProcessor.setYamlValue(CUSTOM_WIDTH_YAML_KEY, currentWidthPercentage);
							uiManager.updateUIAndEditorWidth(currentWidthPercentage);
						}

						return;
					}

					if (await yamlProcessor.hasYamlKey(NOTE_ID_KEY))
					{
						const noteID = await yamlProcessor.getYamlValue(NOTE_ID_KEY);
						database.addNote(noteID, currentWidthPercentage);
						uiManager.updateUIAndEditorWidth(currentWidthPercentage);
					}

					if (await yamlProcessor.hasYamlKey(CUSTOM_WIDTH_YAML_KEY))
					{
						yamlProcessor.setYamlValue(CUSTOM_WIDTH_YAML_KEY, currentWidthPercentage);
						uiManager.updateUIAndEditorWidth(currentWidthPercentage);
					}

					return;
				}
			}
			else if (isSaveWidthIndividuallyEnabled)
			{
				if (await yamlProcessor.hasYamlKey(NOTE_ID_KEY))
				{
					const noteID = await yamlProcessor.getYamlValue(NOTE_ID_KEY);
					database.addNote(noteID, currentWidthPercentage);
					uiManager.updateUIAndEditorWidth(currentWidthPercentage);
					return;
				}
				else
				{
					const UUID = UUIDGenerator.getUniqueUUID(database);
					yamlProcessor.setYamlValue(NOTE_ID_KEY, UUID);
					database.addNote(UUID, currentWidthPercentage);
					return;
				}
			}
			else if (isYAMLWidthEnabled)
			{
				if (await yamlProcessor.hasYamlKey(CUSTOM_WIDTH_YAML_KEY))
				{
					yamlProcessor.setYamlValue(CUSTOM_WIDTH_YAML_KEY, currentWidthPercentage);
					return;
				}
			}

		}
	}
}
