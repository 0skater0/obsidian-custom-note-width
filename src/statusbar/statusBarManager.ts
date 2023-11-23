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
	statusBarItemEl: HTMLElement | null = null;

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

		this.statusBarItemEl = this.plugin.addStatusBarItem();
		this.statusBarItemEl.appendChild(this.wrapper);
		this.statusBarItemEl.style.paddingLeft = "0px";
		const statusBar = domElementManager.querySelector(classSelector(DOM_IDENTIFIERS.STATUSBAR));
		statusBar?.insertBefore(this.statusBarItemEl, statusBar.firstChild);
	}

	/**
	 * Removes the status bar item.
	 */
	public removeStatusBarItem(): void
	{
		if (!this.statusBarItemEl)
			return;

		this.statusBarItemEl.detach();
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
		if (!this.statusBarItemEl)
			return;

		this.statusBarItemEl.style.display = "flex";
	}

	/**
	 * Hides the status bar item.
	 */
	public hideStatusBarItem(): void
	{
		if (!this.statusBarItemEl)
			return;

		this.statusBarItemEl.style.display = "none";
	}
}
