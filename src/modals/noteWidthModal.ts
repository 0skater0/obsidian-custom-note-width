import { Modal, App } from "obsidian";
import { DOM_IDENTIFIERS } from "src/utility/constants";
import { t } from "src/i18n/i18n";
import { WidthUnit, WidthValue, UnitConfig, VALID_UNITS } from "src/utility/config";

/**
 * Modal for adjusting the note width with unit selection.
 */
export default class NoteWidthModal extends Modal
{
	/** Current value entered in the modal. */
	private currentNumber: number | null = null;
	/** Currently selected unit. */
	private currentUnit: WidthUnit;

	/** Handler for the keydown event. */
	private readonly keydownHandler: (ev: KeyboardEvent) => void;

	/**
	 * Constructs a new NoteWidthModal instance.
	 * @param app - The Obsidian application instance.
	 * @param onWidthEntered - Callback to execute when a width value is entered.
	 * @param modalTitle - Title to display on the modal.
	 * @param defaultUnit - The default unit to preselect.
	 * @param unitConfigs - Unit configuration for each supported width unit.
	 */
	constructor(app: App, private onWidthEntered: (wv: WidthValue) => void, private modalTitle: string, defaultUnit: WidthUnit, private unitConfigs: Record<WidthUnit, UnitConfig>)
	{
		super(app);
		this.currentUnit = defaultUnit;
		this.keydownHandler = (ev: KeyboardEvent) =>
		{
			if (ev.key !== "Enter" || this.currentNumber === null)
			{
				return;
			}

			ev.preventDefault();
			this.onWidthEntered({ value: this.currentNumber, unit: this.currentUnit });
			this.close();
		};
	}

	/**
	 * Adds an input field and unit selector to the modal.
	 */
	private addInputField(): void
	{
		const inputContainer = this.contentEl.createDiv();
		inputContainer.id = DOM_IDENTIFIERS.NWM_INPUT_CONTAINER;

		const config = this.unitConfigs[this.currentUnit];

		const inputEl = inputContainer.createEl("input", { type: "number" });
		inputEl.min = config.min.toString();
		inputEl.max = config.max.toString();
		inputEl.step = config.step.toString();
		inputEl.style.flex = "1";

		inputEl.oninput = (ev: Event) =>
		{
			const unitConfig = this.unitConfigs[this.currentUnit];
			let number = parseFloat((ev.target as HTMLInputElement).value);
			if (isNaN(number))
			{
				this.currentNumber = unitConfig.min;
				(ev.target as HTMLInputElement).value = unitConfig.min.toString();
				return;
			}

			number = Math.max(unitConfig.min, Math.min(unitConfig.max, number));
			this.currentNumber = number;
			(ev.target as HTMLInputElement).value = number.toString();
		};

		// Unit selector
		const unitSelect = inputContainer.createEl("select");
		unitSelect.id = DOM_IDENTIFIERS.NWM_UNIT_SELECTOR;
		unitSelect.style.marginLeft = "8px";

		for (const unit of VALID_UNITS)
		{
			const option = unitSelect.createEl("option", { text: unit, value: unit });
			if (unit === this.currentUnit)
			{
				option.selected = true;
			}
		}

		unitSelect.onchange = () =>
		{
			this.currentUnit = unitSelect.value as WidthUnit;
			const newConfig = this.unitConfigs[this.currentUnit];
			inputEl.min = newConfig.min.toString();
			inputEl.max = newConfig.max.toString();
			inputEl.step = newConfig.step.toString();

			// Clamp existing value to new range
			if (this.currentNumber !== null)
			{
				this.currentNumber = Math.max(newConfig.min, Math.min(newConfig.max, this.currentNumber));
				inputEl.value = this.currentNumber.toString();
			}
		};
	}

	/**
	 * Adds a submit button to the modal for confirming the entered note width value.
	 */
	private addSubmitButton(): void
	{
		const buttonContainer = this.contentEl.createDiv();
		buttonContainer.id = DOM_IDENTIFIERS.NWM_BUTTON_CONTAINER;
		const submitButton = buttonContainer.createEl("button", { text: t("button.apply") });
		submitButton.onclick = () =>
		{
			if (this.currentNumber === null)
			{
				return;
			}

			this.onWidthEntered({ value: this.currentNumber, unit: this.currentUnit });
			this.close();
		};
	}

	/**
	 * Called when the modal is opened.
	 * Sets up the modal elements and event listeners.
	 */
	public onOpen(): void
	{
		this.modalEl.id = DOM_IDENTIFIERS.NWM_CONTAINER;
		this.titleEl.textContent = this.modalTitle;
		this.addInputField();
		this.addSubmitButton();
		document.addEventListener("keydown", this.keydownHandler);
	}

	/**
	 * Called when the modal is closed.
	 * Removes event listeners.
	 */
	public onClose(): void
	{
		document.removeEventListener("keydown", this.keydownHandler);
	}
}
