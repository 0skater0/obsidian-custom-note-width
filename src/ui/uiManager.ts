import CustomNoteWidth from "src/main";
import { DOM_IDENTIFIERS } from "src/utility/constants";
import { WidthUnit } from "src/utility/config";
import { validateWidthValue } from "src/utility/utilities";

/**
 * Manages and updates the UI elements for the CustomNoteWidth plugin.
 */
export default class UIManager
{
	/**
	 * Constructs a new UIManager instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(private plugin: CustomNoteWidth)
	{
	}

	/**
	 * Retrieves the slider UI element directly from the DOM.
	 * Uses getElementById for reliable, cache-free lookups.
	 * @returns The slider element or null if not found.
	 */
	public getSliderElement(): HTMLInputElement | null
	{
		return document.getElementById(DOM_IDENTIFIERS.SLIDER) as HTMLInputElement | null;
	}

	/**
	 * Retrieves the text field input UI element directly from the DOM.
	 * Uses getElementById for reliable, cache-free lookups.
	 * @returns The text field input element or null if not found.
	 */
	public getTextFieldElement(): HTMLInputElement | null
	{
		return document.getElementById(DOM_IDENTIFIERS.SLIDER_VALUE) as HTMLInputElement | null;
	}

	/**
	 * Retrieves the unit selector element from the DOM.
	 * @returns The unit selector element or null if not found.
	 */
	public getUnitSelectorElement(): HTMLSelectElement | null
	{
		return document.getElementById(DOM_IDENTIFIERS.UNIT_SELECTOR) as HTMLSelectElement | null;
	}

	/**
	 * Sets the value for both the slider and text field input elements.
	 * @param value - The numeric value to set.
	 */
	public setSliderAndTextField(value: number): void
	{
		const slider = this.getSliderElement();
		const sliderTextField = this.getTextFieldElement();

		if (slider)
		{
			slider.value = value.toString();
		}

		if (sliderTextField)
		{
			sliderTextField.value = value.toString();
		}
	}

	/**
	 * Updates the slider's min, max, and step attributes based on the given unit.
	 * Also updates the text field's min/max if present.
	 * @param unit - The width unit to configure the slider for.
	 */
	public updateSliderRange(unit: WidthUnit): void
	{
		const config = this.plugin.settingsManager.getUnitConfig(unit);
		const slider = this.getSliderElement();
		const textField = this.getTextFieldElement();

		if (slider)
		{
			slider.min = config.min.toString();
			slider.max = config.max.toString();
			slider.step = config.step.toString();
		}

		if (textField)
		{
			textField.min = config.min.toString();
			textField.max = config.max.toString();
		}
	}

	/**
	 * Sets the unit selector dropdown to the given unit.
	 * @param unit - The unit to select.
	 */
	public setUnitSelector(unit: WidthUnit): void
	{
		const selector = this.getUnitSelectorElement();
		if (selector)
		{
			selector.value = unit;
		}
	}

	/**
	 * Gets the currently selected unit from the unit selector.
	 * Falls back to the default unit from settings if no selector is found.
	 * @returns The currently selected WidthUnit.
	 */
	public getCurrentUnit(): WidthUnit
	{
		const selector = this.getUnitSelectorElement();
		if (selector)
		{
			return selector.value as WidthUnit;
		}
		return this.plugin.settingsManager.getDefaultWidthUnit();
	}

	/**
	 * Updates the UI directly to apply changes made in the settings tab.
	 * Rebuilds DOM elements and applies the default width from settings.
	 * Per-note width is re-applied on the next active-leaf-change or layout-change.
	 */
	public updateUI(): void
	{
		this.plugin.wrapperManager.removeWrapper();
		this.plugin.statusBarManager.removeStatusBarItem();
		this.plugin.wrapperManager.createWrapper();
		this.plugin.statusBarManager.setWrapper(this.plugin.wrapperManager.getWrapper());
		this.plugin.uiElementCreator.createUIElements();

		// Apply the default width to reflect settings changes immediately
		const defaultUnit = this.plugin.settingsManager.getDefaultWidthUnit();
		const unitConfig = this.plugin.settingsManager.getUnitConfig(defaultUnit);
		const defaultWv = validateWidthValue({
			value: this.plugin.settingsManager.getDefaultWidth(),
			unit: defaultUnit,
		}, unitConfig);
		this.plugin.noteWidthManager.updateNoteWidthEditorStyle(defaultWv);
	}
}
