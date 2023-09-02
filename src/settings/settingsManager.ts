import CustomNoteWidth from "src/main";
import { PRIORITY_LIST } from "src/utility/constants";

/**
 * Interface representing the settings structure for CustomNoteWidth.
 */
export interface CustomNoteWidthSettings
{
	widthPercentage: number;
	sliderWidth: number;
	defaultNoteWidth: number;
	yamlKey: string;
	enableSlider: boolean;
	enableTextInput: boolean;
	enableYAMLWidth: boolean;
	enableSaveWidthIndividually: boolean;
	enableChangeDefaultNoteWidth: boolean;
	priorityList: string[];
}

/**
 * Manages settings functionalities for the CustomNoteWidth plugin.
 */
export default class SettingsManager
{
	settings: CustomNoteWidthSettings;

	/** Default settings for the plugin. */
	DEFAULT_SETTINGS: CustomNoteWidthSettings = {
		widthPercentage: 36,
		sliderWidth: 85,
		defaultNoteWidth: 36,
		yamlKey: "custom-width",
		enableSlider: true,
		enableTextInput: true,
		enableYAMLWidth: true,
		enableSaveWidthIndividually: true,
		enableChangeDefaultNoteWidth: false,
		priorityList: [PRIORITY_LIST.SAVED_NOTE_WIDTH, PRIORITY_LIST.YAML_NOTE_WIDTH]
	};

	/**
	 * Constructs a new SettingsManager instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(private plugin: CustomNoteWidth)
	{
	}

	/**
	 * Retrieves a specific setting from the plugin's settings object.
	 * @param key - The setting key to retrieve.
	 * @returns - Value associated with the specified key.
	 */
	private getSetting<T extends keyof CustomNoteWidthSettings>(key: T): CustomNoteWidthSettings[T]
	{
		const value = this.settings[key];

		if (value === undefined)
		{
			throw new Error(`Invalid setting key: ${key}`);
		}

		return value;
	}

	/**
	 * Retrieves the width percentage setting.
	 * @returns - The width percentage setting value.
	 */
	public getWidthPercentage(): number
	{
		return this.getSetting("widthPercentage");
	}

	/**
	 * Retrieves the enable slider setting.
	 * @returns - The enable slider setting value.
	 */
	public getEnableSlider(): boolean
	{
		return this.getSetting("enableSlider");
	}

	/**
	 * Retrieves the YAML key setting.
	 * @returns - The YAML key setting value.
	 */
	public getYAMLKey(): string
	{
		return this.getSetting("yamlKey");
	}

	/**
	 * Retrieves the enable text input setting.
	 * @returns - The enable text input setting value.
	 */
	public getEnableTextInput(): boolean
	{
		return this.getSetting("enableTextInput");
	}

	/**
	 * Retrieves the slider width setting.
	 * @returns - The slider width setting value.
	 */
	public getSliderWidth(): number
	{
		return this.getSetting("sliderWidth");
	}

	/**
	 * Retrieves the enable save width individually setting.
	 * @returns - The enable save width individually setting value.
	 */
	public getEnableSaveWidthIndividually(): boolean
	{
		return this.getSetting("enableSaveWidthIndividually");
	}

	/**
	 * Retrieves the enable change default note width setting.
	 * @returns - The enable change default note width setting value.
	 */
	public getEnableChangeDefaultNoteWidth(): boolean
	{
		return this.getSetting("enableChangeDefaultNoteWidth");
	}

	/**
	 * Retrieves the enable YAML width setting.
	 * @returns - The enable YAML width setting value.
	 */
	public getEnableYAMLWidth(): boolean
	{
		return this.getSetting("enableYAMLWidth");
	}

	/**
	 * Asynchronously saves the defaultNoteWidth setting.
	 * @param defaultNoteWidth - The default note width value to be saved.
	 */
	public getDefaultNoteWidth(): number
	{
		return this.getSetting("defaultNoteWidth");
	}

	/**
	 * Retrieves the current priority setting.
	 * @returns - The current priority setting value.
	 */
	public getCurrentPriority(): string
	{
		return this.getSetting("priorityList")[0];
	}

	/**
	 * Retrieves the priority list setting.
	 * @returns - The priority list setting value.
	 */
	public getPriorityList(): string[]
	{
		return this.getSetting("priorityList");
	}

	/**
	 * Asynchronously saves the default note width setting.
	 * @param defaultNoteWidth - The default note width value to be saved.
	 */
	public async saveDefaultNoteWidth(defaultNoteWidth: number): Promise<void>
	{
		this.settings.defaultNoteWidth = defaultNoteWidth;
		await this.plugin.saveData(this.settings);
	}

	/**
	 * Asynchronously saves the widthPercentage setting.
	 * @param widthPercentage - The width percentage value to be saved.
	 */
	public async saveWidthPercentage(widthPercentage: number): Promise<void>
	{
		this.settings.widthPercentage = widthPercentage;
		await this.plugin.saveData(this.settings);
	}

	/**
	 * Asynchronously loads the settings by combining the default settings with the loaded data from the plugin.
	 */
	public async loadSettings(): Promise<void>
	{
		this.settings = Object.assign({}, this.DEFAULT_SETTINGS, await this.plugin.loadData());
	}

	/**
	 * Asynchronously saves the provided settings.
	 * @param settings - The settings to be saved.
	 */
	public async saveSettings(settings: CustomNoteWidthSettings): Promise<void>
	{
		this.settings = settings;
		await this.plugin.saveData(settings);
	}

	/**
	 * Asynchronously resets the editor & saved width to the default value.
	 */
	public async resetEditorWidth(): Promise<void>
	{
		this.plugin.noteWidthManager.removeNoteWidthEditorStyle();
	}
}
