import CustomNoteWidth from "src/main";
import { DOM_IDENTIFIERS } from "src/utility/constants";

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
	 * Creates the slider UI element.
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

		const slider = document.createElement("input");
		slider.id = DOM_IDENTIFIERS.SLIDER;
		slider.type = "range";
		slider.min = "0";
		slider.max = "100";
		slider.value = this.plugin.settingsManager.getWidthPercentage().toString();
		slider.style.width = this.plugin.settingsManager.getSliderWidth() + "px";

		return slider;
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
				text = document.createElement("input");
				(text as HTMLInputElement).type = "number";
				(text as HTMLInputElement).value = slider.value;
				(text as HTMLInputElement).min = "0";
				(text as HTMLInputElement).max = "100";
				text.style.height = "160%";
				text.style.width = "38px";
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
			const dummySlider = document.createElement("input");
			dummySlider.value = this.plugin.settingsManager.getWidthPercentage().toString();
			sliderValueText = this.createAndConfigureText(dummySlider);
		}

		if (slider && sliderValueText)
		{
			this.plugin.wrapperManager.appendToWrapper(slider, sliderValueText);
		} else if (sliderValueText)
		{
			this.plugin.wrapperManager.appendToWrapper(sliderValueText);
		}

		this.plugin.statusBarManager.appendToStatusBar();
	}
}
