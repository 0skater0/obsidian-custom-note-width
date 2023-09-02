import { DOM_IDENTIFIERS, DONATION_DISCLAIMER_TEXT, DONATION_LINK, KOFI_SVG } from "src/utility/constants";

/**
 * Represents a donation button component.
 */
export default class DonationButton
{
	/** DOM parser used for parsing SVG content. */
	parser: DOMParser;

	/**
	 * Constructs a new DonationButton instance.
	 */
	constructor()
	{
		this.parser = new DOMParser();
	}

	/**
	 * Creates a donation button element.
	 * @param link - The URL to which the donation button should redirect.
	 * @param img - The image element to use for the donation button.
	 * @returns - The created donation button as an HTMLElement.
	 */
	private createDonateButtonElement(link: string, img: HTMLElement): HTMLElement
	{
		// Create an anchor element for the donation link
		const a = document.createElement("a");
		a.setAttribute("href", link);

		// Set image styles to adjust height and width
		img.style.height = "auto";
		img.style.width = "100%";

		// Append the image element to the anchor element
		a.appendChild(img);

		// Create a flex container (div) and center the anchor element inside it
		const div = document.createElement("div");
		div.appendChild(a);

		return div;
	}

	/**
	 * Creates a donation button with a disclaimer.
	 * @param containerEl - The container element to which the donation button should be appended.
	 * @returns - The container element with the appended donation button.
	 */
	public createDonationButton(containerEl: HTMLElement): HTMLElement
	{
		const div = containerEl.createEl("div");
		div.id = DOM_IDENTIFIERS.DONATION_BUTTON;

		// Create a paragraph element to display a disclaimer message
		const p = document.createElement("p");
		p.textContent = DONATION_DISCLAIMER_TEXT;

		// Create the donation button and append it to the container div
		div.appendChild(this.createDonateButtonElement(DONATION_LINK, this.parser.parseFromString(KOFI_SVG, "text/xml").documentElement));

		// Append the disclaimer paragraph to the container div
		div.appendChild(p);

		return div;
	}
}
