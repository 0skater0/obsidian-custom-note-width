import CustomNoteWidth from "src/main";
import { WidthUnit, UnitConfig, UnitRange, UNIT_CONFIGS } from "src/utility/config";
import { setLocaleOverride } from "src/i18n/i18n";

/**
 * Interface representing the settings structure for CustomNoteWidth.
 */
export interface CustomNoteWidthSettings
{
	language: string;
	defaultWidth: number;
	defaultWidthUnit: WidthUnit;
	sliderWidth: number;
	yamlKey: string;
	enableSlider: boolean;
	enableTextInput: boolean;
	enablePerNoteWidth: boolean;
	unitRanges: Record<WidthUnit, UnitRange>;
	enableCodeBlockWidth: boolean;
	codeBlockWidth: number;
	codeBlockWidthUnit: WidthUnit;
	codeBlockWidthModes: { reading: boolean; source: boolean; livePreview: boolean };
}

/**
 * Manages settings functionalities for the CustomNoteWidth plugin.
 */
export default class SettingsManager
{
	settings!: CustomNoteWidthSettings;

	/** Default settings for the plugin. */
	DEFAULT_SETTINGS: CustomNoteWidthSettings = {
		language: "auto",
		defaultWidth: 50,
		defaultWidthUnit: '%',
		sliderWidth: 85,
		yamlKey: "custom-width",
		enableSlider: true,
		enableTextInput: true,
		enablePerNoteWidth: true,
		unitRanges: {
			'%': { min: 0, max: 100 },
			'px': { min: 100, max: 4000 },
			'ch': { min: 10, max: 200 },
		},
		enableCodeBlockWidth: false,
		codeBlockWidth: 800,
		codeBlockWidthUnit: 'px' as WidthUnit,
		codeBlockWidthModes: { reading: true, source: true, livePreview: true },
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
	 * Retrieves the default width setting.
	 * @returns - The default width percentage.
	 */
	public getDefaultWidth(): number
	{
		return this.getSetting("defaultWidth");
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
	 * Retrieves the enable per-note width setting.
	 * @returns - Whether per-note width via YAML is enabled.
	 */
	public getEnablePerNoteWidth(): boolean
	{
		return this.getSetting("enablePerNoteWidth");
	}

	/**
	 * Retrieves the default width unit setting.
	 * @returns - The default width unit.
	 */
	public getDefaultWidthUnit(): WidthUnit
	{
		return this.getSetting("defaultWidthUnit");
	}

	/**
	 * Retrieves whether code block width is enabled.
	 * @returns - Whether code block width is enabled.
	 */
	public getEnableCodeBlockWidth(): boolean
	{
		return this.getSetting("enableCodeBlockWidth");
	}

	/**
	 * Retrieves the code block width value.
	 * @returns - The code block width value.
	 */
	public getCodeBlockWidth(): number
	{
		return this.getSetting("codeBlockWidth");
	}

	/**
	 * Retrieves the code block width unit.
	 * @returns - The code block width unit.
	 */
	public getCodeBlockWidthUnit(): WidthUnit
	{
		return this.getSetting("codeBlockWidthUnit");
	}

	/**
	 * Retrieves the code block width mode flags.
	 * @returns - Object with reading, source, livePreview booleans.
	 */
	public getCodeBlockWidthModes(): { reading: boolean; source: boolean; livePreview: boolean }
	{
		return this.getSetting("codeBlockWidthModes");
	}

	/**
	 * Retrieves the language setting.
	 * @returns - The language setting value ("auto", "en", "de").
	 */
	public getLanguage(): string
	{
		return this.getSetting("language");
	}

	/**
	 * Returns the effective UnitConfig for a given unit, merging
	 * the hardcoded defaults with the user's custom min/max ranges.
	 * @param unit - The width unit.
	 * @returns The effective UnitConfig.
	 */
	public getUnitConfig(unit: WidthUnit): UnitConfig
	{
		const base = UNIT_CONFIGS[unit];
		const ranges = this.settings.unitRanges?.[unit] ?? { min: base.min, max: base.max };
		return {
			...base,
			min: ranges.min,
			max: ranges.max,
			maxInputLength: Math.max(
				ranges.max.toString().length,
				ranges.min.toString().length,
			),
		};
	}

	/**
	 * Asynchronously loads the settings, migrating from old format if necessary.
	 */
	public async loadSettings(): Promise<void>
	{
		const loaded = await this.plugin.loadData();

		// Migrate old settings format (10 settings) to new format (7 settings)
		if (loaded && ('widthPercentage' in loaded || 'defaultNoteWidth' in loaded || 'enableSaveWidthIndividually' in loaded))
		{
			loaded.defaultWidth = loaded.defaultNoteWidth ?? loaded.widthPercentage ?? 100;
			loaded.enablePerNoteWidth = (loaded.enableSaveWidthIndividually || loaded.enableYAMLWidth) ?? true;
			loaded.defaultWidthUnit = '%';

			// Clean up old keys
			delete loaded.widthPercentage;
			delete loaded.defaultNoteWidth;
			delete loaded.enableSaveWidthIndividually;
			delete loaded.enableYAMLWidth;
			delete loaded.enableChangeDefaultNoteWidth;
			delete loaded.priorityList;
		}

		// Ensure defaultWidthUnit exists (migration from v1.x without units)
		if (loaded && !('defaultWidthUnit' in loaded))
		{
			loaded.defaultWidthUnit = '%';
		}

		// Ensure unitRanges exists (migration from versions without custom ranges)
		if (loaded && !('unitRanges' in loaded))
		{
			loaded.unitRanges = {
				'%': { min: 0, max: 100 },
				'px': { min: 100, max: 4000 },
				'ch': { min: 10, max: 200 },
			};
		}

		// Ensure code block width settings exist (migration from versions without code block width)
		if (loaded && !('enableCodeBlockWidth' in loaded))
		{
			loaded.enableCodeBlockWidth = false;
			loaded.codeBlockWidth = 800;
			loaded.codeBlockWidthUnit = 'px';
		}

		// Ensure code block width modes exist (migration from versions without mode selection)
		if (loaded && !('codeBlockWidthModes' in loaded))
		{
			loaded.codeBlockWidthModes = { reading: true, source: true, livePreview: true };
		}

		this.settings = Object.assign({}, this.DEFAULT_SETTINGS, loaded);

		// Apply locale override from saved language setting
		setLocaleOverride(this.settings.language === "auto" ? null : this.settings.language);
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

}
