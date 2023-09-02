import { Modal, App } from "obsidian";
import { CANCEL_BUTTON_TEXT, DOM_IDENTIFIERS } from "src/utility/constants";
import { classSelector } from "src/utility/utilities";
import { domElementManager } from "src/ui/domElementManager";

/**
 * Modal displaying a progress bar.
 */
export default class ProgressBarModal extends Modal
{
	/** Current progress percentage. */
	progress: number = 0;

	/** Flag indicating if the progress has been cancelled. */
	isCancelled: boolean = false;

	/**
	 * Constructs a new ProgressBarModal instance.
	 * @param app - The Obsidian application instance.
	 * @param title - String which represents the modal title
	 */
	constructor(app: App, private title: string)
	{
		super(app);
		this.progress = 0;
	}

	/**
	 * Adds a cancel button to the modal.
	 */
	private addCancelButton(): void
	{
		const cancelButton = this.contentEl.createEl("button", { text: CANCEL_BUTTON_TEXT });
		cancelButton.style.marginTop = "20px";
		cancelButton.style.float = "right";
		cancelButton.onclick = () =>
		{
			this.isCancelled = true;
			this.close();
		};
	}

	/**
	 * Updates the displayed progress in the modal.
	 */
	private updateProgress(): void
	{
		const innerDiv = this.contentEl.querySelector(classSelector(DOM_IDENTIFIERS.PROGRESS_INNER)) as HTMLElement;
		if (innerDiv)
		{
			innerDiv.style.width = `${this.progress}%`;
		}
	}

	/**
	 * Adds a container for the progress bar to the modal.
	 */
	private addProgressBarContainer(): void
	{
		if (domElementManager.querySelector(classSelector(DOM_IDENTIFIERS.PROGRESS_BAR_CONTAINER), this.contentEl))
		{
			return;
		}

		const progressBarContainer = this.contentEl.createDiv({ cls: DOM_IDENTIFIERS.PROGRESS_BAR_CONTAINER });

		const outerDiv = progressBarContainer.createDiv({ cls: DOM_IDENTIFIERS.PROGRESS_OUTER });
		const innerDiv = outerDiv.createDiv({ cls: DOM_IDENTIFIERS.PROGRESS_INNER });
	}

	/**
	 * Increments the displayed progress by a given percentage.
	 * @param percentage - The percentage by which to increment the progress.
	 */
	public incrementProgress(percentage: number): void
	{
		this.progress += percentage;
		this.updateProgress();
	}

	/**
	 * Called when the modal is opened.
	 * Sets up the modal elements and event listeners.
	 */
	public onOpen(): void
	{
		this.titleEl.setText(this.title);
		const closeEl = this.containerEl.querySelector(".modal-close-button");
		if (closeEl) closeEl.remove();

		document.body.addEventListener("click", this.handleClickOutside, true);
	}

	/**
	 * Handles clicks outside the modal.
	 * @param event - The mouse event object.
	 */
	private handleClickOutside = (event: MouseEvent): void =>
	{
		if (this.modalEl && this.modalEl.contains(event.target as Node))
		{
			return;
		}
		this.isCancelled = true;
		this.close();
		document.body.removeEventListener("click", this.handleClickOutside, true);
	};

	/**
	 * Displays the progress bar modal.
	 */
	public display(): void
	{
		this.open();
		this.addProgressBarContainer();
		this.addCancelButton();
		this.updateProgress();
	}

	/**
	 * Closes the modal and removes event listeners.
	 */
	public close(): void
	{
		const cacheKey = domElementManager.generateCacheKey(classSelector(DOM_IDENTIFIERS.PROGRESS_INNER), this.contentEl);
		domElementManager.invalidateCache(cacheKey);

		document.body.removeEventListener("click", this.handleClickOutside);
		super.close();
	}
}
