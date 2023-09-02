import CustomNoteWidth from "src/main";
import { DOM_IDENTIFIERS } from "src/utility/constants";
import { classSelector } from "src/utility/utilities";
import { domElementManager } from "src/ui/domElementManager";

/**
 * Manages the status bar related functionalities for the CustomNoteWidth plugin.
 */
export default class StatusBarManager
{
	wrapper: HTMLDivElement | null = null;
	plugin: CustomNoteWidth;

	/**
	 * Constructs a new StatusBarManager instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(plugin: CustomNoteWidth)
	{
		this.plugin = plugin;
		this.setWrapper(plugin.wrapperManager.getWrapper());
	}

	/**
	 * Appends the wrapper to the status bar.
	 */
	public appendToStatusBar(): void
	{
		if (!this.wrapper || (!this.plugin.settingsManager.getEnableSlider() && !this.plugin.settingsManager.getEnableTextInput()))
		{
			this.wrapper = null;
			return;
		}

		const statusBarItemEl = this.plugin.addStatusBarItem();
		statusBarItemEl.appendChild(this.wrapper);
		const statusBar = domElementManager.querySelector(classSelector(DOM_IDENTIFIERS.STATUSBAR));
		const elementToMove = statusBar?.querySelector(classSelector(DOM_IDENTIFIERS.STATUSBAR_ELEMENT)) as HTMLElement;
		if (!elementToMove) return;

		elementToMove.style.paddingLeft = "0px";
		statusBar?.insertBefore(elementToMove, statusBar.firstChild);
	}

	/**
	 * Removes the status bar item.
	 */
	public removeStatusBarItem(): void
	{
		const statusBarItem = domElementManager.querySelector(classSelector(DOM_IDENTIFIERS.STATUSBAR_ELEMENT));
		if (!statusBarItem) return;

		statusBarItem.remove();
	}

	/**
	 * Sets the wrapper element for the status bar.
	 * @param wrapper - The wrapper element to set.
	 */
	public setWrapper(wrapper: HTMLDivElement | null): void
	{
		this.wrapper = wrapper;
	}

	/**
	 * Displays the status bar item.
	 */
	public showStatusBarItem(): void
	{
		const statusBarItem = domElementManager.querySelector(classSelector(DOM_IDENTIFIERS.STATUSBAR_ELEMENT)) as HTMLElement;
		if (!statusBarItem)
			return;

		statusBarItem.style.display = "flex";
	}

	/**
	 * Hides the status bar item.
	 */
	public hideStatusBarItem(): void
	{
		const statusBarItem = domElementManager.querySelector(classSelector(DOM_IDENTIFIERS.STATUSBAR_ELEMENT)) as HTMLElement;
		if (!statusBarItem)
			return;

		statusBarItem.style.display = "none";
	}
}
