import { Modal, App } from "obsidian";
import { APPLY_BUTTON_TEXT, DOM_IDENTIFIERS } from "src/utility/constants";

/**
 * Modal for adjusting the note width.
 */
export default class NoteWidthModal extends Modal
{
	/** Current value entered in the modal. */
	private currentNumber: number | null = null;

	/** Handler for the keydown event. */
	private keydownHandler: (ev: KeyboardEvent) => void;

	/**
	 * Constructs a new NoteWidthModal instance.
	 * @param app - The Obsidian application instance.
	 * @param onNumberEntered - Callback to execute when a number is entered.
	 * @param modalTitle - Title to display on the modal.
	 */
	constructor(app: App, private onNumberEntered: (number: number) => void, private modalTitle: string)
	{
		super(app);
		this.keydownHandler = (ev: KeyboardEvent) =>
		{
			if (ev.key !== "Enter" || this.currentNumber === null)
			{
				return;
			}

			ev.preventDefault();
			this.onNumberEntered(this.currentNumber);
			this.close();
		};
	}

	/**
	 * Adds an input field to the modal for entering the note width value.
	 */
	private addInputField(): void
	{
		const inputContainer = this.contentEl.createDiv();
		inputContainer.id = DOM_IDENTIFIERS.NWM_INPUT_CONTAINER;
		const inputEl = inputContainer.createEl("input", { type: "number" });
		inputEl.oninput = (ev: InputEvent) =>
		{
			let number = parseFloat((ev.target as HTMLInputElement).value);
			if (isNaN(number))
			{
				this.currentNumber = 0;
				(ev.target as HTMLInputElement).value = "0";
				return;
			}

			number = Math.max(0, Math.min(100, number));
			this.currentNumber = number;
			(ev.target as HTMLInputElement).value = number.toString();
		};
	}

	/**
	 * Adds a submit button to the modal for confirming the entered note width value.
	 */
	private addSubmitButton(): void
	{
		const buttonContainer = this.contentEl.createDiv();
		buttonContainer.id = DOM_IDENTIFIERS.NWM_BUTTON_CONTAINER;
		const submitButton = buttonContainer.createEl("button", { text: APPLY_BUTTON_TEXT });
		submitButton.onclick = () =>
		{
			if (this.currentNumber === null)
			{
				return;
			}

			this.onNumberEntered(this.currentNumber);
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
