import { DOM_IDENTIFIERS } from "src/utility/constants";

/**
 * Manages the wrapper functionalities for the status bar.
 */
export default class WrapperManager
{
	/** Wrapper element for the status bar. */
	wrapper: HTMLDivElement | null = null;

	/**
	 * Constructs a new WrapperManager instance and creates a wrapper.
	 */
	constructor()
	{
		this.createWrapper();
	}

	/**
	 * Creates a wrapper div to hold all elements added to the status bar.
	 */
	public createWrapper(): void
	{
		this.wrapper = document.createElement("div");
		this.wrapper.id = DOM_IDENTIFIERS.WRAPPER;
	}

	/**
	 * Removes the wrapper div from the status bar.
	 */
	public removeWrapper(): void
	{
		if (!this.wrapper) return;

		this.wrapper.remove();
		this.wrapper = null;
	}

	/**
	 * Appends the provided elements to the wrapper.
	 * @param elements - Array of HTML elements to be appended to the wrapper.
	 */
	public appendToWrapper(...elements: (HTMLElement | void)[]): void
	{
		if (!this.wrapper) return;

		for (const element of elements)
		{
			if (element)
			{
				this.wrapper.appendChild(element);
			}
		}
	}

	/**
	 * Retrieves the wrapper element.
	 * @returns The wrapper element or null if not present.
	 */
	public getWrapper(): HTMLDivElement | null
	{
		return this.wrapper;
	}
}
