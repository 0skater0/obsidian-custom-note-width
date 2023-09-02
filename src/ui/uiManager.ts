import CustomNoteWidth from "src/main";
import { DOM_IDENTIFIERS } from "src/utility/constants";
import { idSelector } from "src/utility/utilities";
import { domElementManager } from "src/ui/domElementManager";

/**
 * Manages and updates the UI elements for the CustomNoteWidth plugin.
 */
export default class UIManager
{
	/** Reference to the slider element. */
	slider: HTMLInputElement | null = null;

	/** Reference to the text field input element. */
	textField: HTMLInputElement | null = null;

	/**
	 * Constructs a new UIManager instance and initializes the UI elements.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(private plugin: CustomNoteWidth)
	{
		this.initializeElements();
	}

	/**
	 * Initializes the slider and text field elements from the DOM.
	 */
	private initializeElements(): void
	{
		this.slider = this.getSliderElement();
		this.textField = this.getTextFieldElement();
	}

	/**
	 * Retrieves the slider UI element from the DOM.
	 * @returns The slider element or null if not found.
	 */
	public getSliderElement(): HTMLInputElement | null
	{
		let slider = this.slider;
		if (!slider)
		{
			slider = domElementManager.querySelector(idSelector(DOM_IDENTIFIERS.SLIDER)) as HTMLInputElement;
			if (!slider)
			{
				console.error("Slider element could not be found.");
				return null;
			}
		}
		return slider;
	}

	/**
	 * Retrieves the text field input UI element from the DOM.
	 * @returns The text field input element or null if not found.
	 */
	public getTextFieldElement(): HTMLInputElement | null
	{
		let textField = this.textField;
		if (!textField)
		{
			textField = domElementManager.querySelector(idSelector(DOM_IDENTIFIERS.SLIDER_VALUE)) as HTMLInputElement;
			if (!textField)
			{
				console.error("Text field element could not be found.");
				return null;
			}
		}
		return textField;
	}

	/**
	 * Sets the value for both the slider and text field input elements.
	 * @param value - The value to set.
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
	 * Updates the UI and the width of the editor based on the provided width value.
	 * @param width - The width value.
	 */
	public updateUIAndEditorWidth(width: number): void
	{
		this.plugin.uiManager.setSliderAndTextField(width);
		this.plugin.noteWidthManager.updateNoteWidthEditorStyle(width);
	}

	/**
	 * Updates the UI directly to apply changes made in the settings tab.
	 */
	public updateUI(): void
	{
		this.plugin.wrapperManager.removeWrapper();
		this.plugin.statusBarManager.removeStatusBarItem();
		this.plugin.wrapperManager.createWrapper();
		this.plugin.statusBarManager.setWrapper(this.plugin.wrapperManager.getWrapper());
		this.plugin.uiElementCreator.createUIElements();
		this.plugin.noteWidthManager.updateNoteWidthEditorStyle(this.plugin.settingsManager.getWidthPercentage());
	}
}
