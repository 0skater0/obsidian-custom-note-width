import CustomNoteWidth from "src/main";
import { DOM_IDENTIFIERS } from "src/utility/constants";
import { VALID_UNITS } from "src/utility/config";

export default class UIElementCreator
{

	/**
	 * Constructs a new UIElementCreator instance and initializes UI elements.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(private plugin: CustomNoteWidth)
	{
		this.createUIElements();
	}

	/**
	 * Creates the slider UI element with range based on the current default unit.
	 * @returns The created slider element.
	 */
	private createSliderElement(): HTMLInputElement
	{
		// Return dummy input element if slider is not enabled
		if (!this.plugin.settingsManager.getEnableSlider())
		{
			const slider = document.createElement("input");
			slider.id = DOM_IDENTIFIERS.DUMMY;
			return slider;
		}

		const unit = this.plugin.settingsManager.getDefaultWidthUnit();
		const unitConfig = this.plugin.settingsManager.getUnitConfig(unit);
		const defaultWidth = this.plugin.settingsManager.getDefaultWidth();

		const slider = document.createElement("input");
		slider.id = DOM_IDENTIFIERS.SLIDER;
		slider.type = "range";
		slider.min = unitConfig.min.toString();
		slider.max = unitConfig.max.toString();
		slider.step = unitConfig.step.toString();
		slider.value = defaultWidth.toString();
		slider.style.width = this.plugin.settingsManager.getSliderWidth() + "px";

		return slider;
	}

	/**
	 * Creates a unit selector dropdown for the status bar.
	 * @returns The created select element.
	 */
	private createUnitSelector(): HTMLSelectElement
	{
		const select = document.createElement("select");
		select.id = DOM_IDENTIFIERS.UNIT_SELECTOR;

		for (const unit of VALID_UNITS)
		{
			const option = document.createElement("option");
			option.value = unit;
			option.textContent = unit;
			select.appendChild(option);
		}

		select.value = this.plugin.settingsManager.getDefaultWidthUnit();

		return select;
	}

	/**
	 * Creates either a text input field or a simple span element based on the provided slider.
	 * @param slider - The reference slider element.
	 * @param isInput - Flag indicating whether to create an input field or a span.
	 * @returns The created HTMLElement or null.
	 */
	private createTextInput(slider: HTMLInputElement | null, isInput: boolean): HTMLElement | null
	{
		let text: HTMLElement | null = null;

		if (slider)
		{
			if (isInput)
			{
				const unit = this.plugin.settingsManager.getDefaultWidthUnit();
				const unitConfig = this.plugin.settingsManager.getUnitConfig(unit);

				text = document.createElement("input");
				(text as HTMLInputElement).type = "number";
				(text as HTMLInputElement).value = slider.value;
				(text as HTMLInputElement).min = unitConfig.min.toString();
				(text as HTMLInputElement).max = unitConfig.max.toString();
				text.style.height = "160%";
				text.style.width = "50px";
				text.style.fontSize = "108%";
			} else
			{
				text = document.createElement("span");
				text.textContent = slider.value;
				text.style.fontSize = "102.5%";
				text.style.marginBottom = "-0.5px";
			}

			text.id = DOM_IDENTIFIERS.SLIDER_VALUE;
		}

		return text;
	}

	/**
	 * Creates and configures either the text input field or the span based on the provided slider and width value.
	 * @param slider - The reference slider element.
	 * @param widthValue - Optional width value to set.
	 * @returns The created HTMLElement or null.
	 */
	private createAndConfigureText(slider: HTMLInputElement | null, widthValue?: string): HTMLElement | null
	{
		let sliderValueText: HTMLElement | null = null;

		if (slider && this.plugin.settingsManager.getEnableTextInput())
		{
			sliderValueText = this.createTextInput(slider, this.plugin.settingsManager.getEnableTextInput());
			if (sliderValueText)
			{
				this.plugin.eventHandler.handleTextInputEvent(slider, sliderValueText);
			}
		} else if (slider)
		{
			sliderValueText = this.createTextInput(slider, this.plugin.settingsManager.getEnableTextInput());
			if (sliderValueText)
			{
				this.plugin.eventHandler.handleTextSpanEvent(slider, sliderValueText);
			}
		} else if (this.plugin.settingsManager.getEnableTextInput())
		{
			sliderValueText = this.createTextInput(null, this.plugin.settingsManager.getEnableTextInput());
			if (sliderValueText && widthValue)
			{
				(sliderValueText as HTMLInputElement).value = widthValue;
			}
		}

		return sliderValueText;
	}

	/**
	 * Creates the UI elements and attaches them to the plugin's wrapper.
	 */
	public createUIElements(): void
	{
		let slider: HTMLInputElement | null = null;
		let sliderValueText: HTMLElement | null = null;

		if (this.plugin.settingsManager.getEnableSlider())
		{
			slider = this.createSliderElement();
			if (slider)
			{
				sliderValueText = this.createAndConfigureText(slider);
			}
		}

		if (this.plugin.settingsManager.getEnableTextInput() && !slider)
		{
			const textUnit = this.plugin.settingsManager.getDefaultWidthUnit();
			const textUnitConfig = this.plugin.settingsManager.getUnitConfig(textUnit);
			const dummySlider = document.createElement("input");
			dummySlider.value = this.plugin.settingsManager.getDefaultWidth().toString();
			dummySlider.min = textUnitConfig.min.toString();
			dummySlider.max = textUnitConfig.max.toString();
			sliderValueText = this.createAndConfigureText(dummySlider);
		}

		// Create unit selector
		const unitSelector = this.createUnitSelector();
		this.plugin.eventHandler.handleUnitSelectorEvent(unitSelector);

		// Append elements to wrapper
		const elements: HTMLElement[] = [];
		if (slider)
		{
			elements.push(slider);
		}
		if (sliderValueText)
		{
			elements.push(sliderValueText);
		}
		elements.push(unitSelector);

		if (elements.length > 0)
		{
			this.plugin.wrapperManager.appendToWrapper(...elements);
		}

		this.plugin.statusBarManager.appendToStatusBar();
	}
}
