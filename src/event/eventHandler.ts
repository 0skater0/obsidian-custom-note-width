import { App, Notice, WorkspaceLeaf, debounce } from "obsidian";
import CustomNoteWidth from "src/main";
import { NOTICES } from "src/utility/constants";
import { isActiveLeafMarkdown } from "src/utility/utilities";
import { CONFIG } from "src/utility/config";

/**
 * Handles events related to the CustomNoteWidth plugin.
 */
export default class EventHandler
{
	updateTimeout: number;
	//previousWindowState: { width: number; height: number; };
	public isUserInputTriggered: boolean = false;

	/**
	 * Constructs a new EventHandler instance.
	 * @param app - The Obsidian application instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(private app: App, private plugin: CustomNoteWidth)
	{
		//this.previousWindowState = { width: window.innerWidth, height: window.innerHeight };
	}

	/**
	 * Register event handlers related to the plugin.
	 */
	public registerEventHandlers(): void
	{
		this.plugin.registerEvent(this.app.workspace.on("resize", this.handleResize));
		this.plugin.registerEvent(this.app.workspace.on("active-leaf-change", this.handleActiveLeafChange));
	}

	/**
	 * Deregister event handlers related to the plugin.
	 */
	public deregisterEventHandlers(): void
	{
		this.app.workspace.off("resize", this.handleResize);
		this.app.workspace.off("active-leaf-change", this.handleActiveLeafChange);
	}

	/**
	 * Handles the resize event of the workspace.
	 * Debounces updates and checks for window size changes.
	 */
	private handleResize = async (): Promise<void> =>
	{
		this.handleSidebarChange();

		// Check if the slider width exceeds the threshold and reset it if necessary
		if (this.plugin.settingsManager.getSliderWidth() / window.innerWidth > CONFIG.SLIDER_HIDE_THRESHOLD)
		{
			new Notice(NOTICES.SLIDER_HIDE_WARNING, 5000);
			const slider = this.plugin.uiManager.getSliderElement();
			await this.plugin.settingsManager.saveSettings({
				...this.plugin.settingsManager.settings,
				sliderWidth: this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth
			});
			if (slider) slider.style.width = this.plugin.settingsManager.DEFAULT_SETTINGS.sliderWidth + 'px';
		}

		// Update the note width
		this.plugin.noteWidthManager.updateNoteWidthEditorStyle(this.plugin.settingsManager.getWidthPercentage());
	};

	/**
	 * Handles the active leaf change event.
	 * Updates the note width based on the active leaf.
	 */
	private handleActiveLeafChange = async (leaf: WorkspaceLeaf): Promise<void> =>
	{
		// Enable/Disable our statusbar elements(wrapper)
		if (isActiveLeafMarkdown(this.app))
		{
			this.plugin.statusBarManager.showStatusBarItem();
		} else
		{
			this.plugin.statusBarManager.hideStatusBarItem();
		}

		if (!leaf) return;
		this.handleActiveLeafChangeDebounced();
	};

	/**
	 * Debounced logic for handling the active leaf change.
	 */
	private handleActiveLeafChangeDebouncedLogic = async (): Promise<void> =>
	{
		await this.plugin.noteWidthManager.refreshNoteWidth(this.isUserInputTriggered);
	};

	/**
	 * Debounced method for handling the active leaf change.
	 * This helps ensure that rapid changes in the active leaf don't trigger rapid updates, 
	 * but instead are aggregated over a short period (300ms in this case) before being processed.
	 */
	private handleActiveLeafChangeDebounced = debounce(this.handleActiveLeafChangeDebouncedLogic, 300);

	/**
	 * Handles changes to the sidebar.
	 */
	private handleSidebarChange(): void
	{
		this.plugin.noteWidthManager.updateNoteWidthEditorStyle(this.plugin.settingsManager.getWidthPercentage());
	}

	/**
	 * Configures the events for the slider element.
	 * @param slider - The slider HTML element.
	 * @param sliderValueText - The text display associated with the slider.
	 */
	public handleTextInputEvent(slider: HTMLInputElement, sliderValueText: HTMLElement): void
	{
		// If the input is below "0" set to "0", if above "100" set to "100"
		sliderValueText.addEventListener("change", () =>
		{
			const minValue = 0;
			const maxValue = 100;
			const enteredValue = parseInt((sliderValueText as HTMLInputElement).value);

			if (isNaN(enteredValue) || enteredValue < minValue)
			{
				(sliderValueText as HTMLInputElement).value = (sliderValueText as HTMLInputElement).min;
			} else if (enteredValue > maxValue)
			{
				(sliderValueText as HTMLInputElement).value = (sliderValueText as HTMLInputElement).max;
			}
		});

		// Restrict the user input to the range between 0 and 100 and limit to 3 digits
		sliderValueText.addEventListener("input", async () =>
		{
			let enteredValue = parseInt((sliderValueText as HTMLInputElement).value);
			const minValue = 0;
			const maxValue = 100;

			if (isNaN(enteredValue) || enteredValue < minValue)
			{
				enteredValue = minValue;
			} else if (enteredValue > maxValue)
			{
				enteredValue = maxValue;
			}

			const clampedValue = Math.min(Math.max(enteredValue, minValue), maxValue);
			slider.value = clampedValue.toString();



			await this.plugin.settingsManager.saveSettings({
				...this.plugin.settingsManager.settings,
				widthPercentage: clampedValue,
			});

			this.plugin.noteWidthManager.updateNoteWidthEditorStyle(clampedValue);

			if (this.plugin.settingsManager.getEnableSaveWidthIndividually())
			{
				this.isUserInputTriggered = true;
				if (this.updateTimeout) clearTimeout(this.updateTimeout);
				this.updateTimeout = window.setTimeout(async () =>
				{
					await this.plugin.noteWidthManager.refreshNoteWidth(this.isUserInputTriggered);
				}, 250);
			}

			// Limit to 3 digits
			(sliderValueText as HTMLInputElement).value = (sliderValueText as HTMLInputElement).value.substring(0, 3);
		});

		// Add event listener to the slider
		slider.addEventListener("input", async () =>
		{
			const value = parseInt(slider.value);

			await this.plugin.settingsManager.saveSettings({
				...this.plugin.settingsManager.settings,
				widthPercentage: value,
			});

			this.plugin.noteWidthManager.updateNoteWidthEditorStyle(value);

			if (this.plugin.settingsManager.getEnableSaveWidthIndividually() || this.plugin.settingsManager.getEnableYAMLWidth())
			{
				this.isUserInputTriggered = true;
				if (this.updateTimeout) clearTimeout(this.updateTimeout);
				this.updateTimeout = window.setTimeout(async () =>
				{
					await this.plugin.noteWidthManager.refreshNoteWidth(this.isUserInputTriggered);
				}, 250);
			}

			if (sliderValueText instanceof HTMLInputElement)
			{
				sliderValueText.value = value.toString();
			} else if (sliderValueText instanceof HTMLSpanElement)
			{
				sliderValueText.textContent = value.toString();
			}
		});
	}

	/**
	 * Configures the events for text span.
	 * @param slider - The slider HTML element.
	 * @param sliderValueText - The text display associated with the slider.
	 */
	public handleTextSpanEvent(slider: HTMLInputElement, sliderValueText: HTMLElement): void
	{
		slider.addEventListener("input", async () =>
		{
			const value = parseInt(slider.value);
			await this.plugin.settingsManager.saveSettings({
				...this.plugin.settingsManager.settings,
				widthPercentage: value,
			});

			this.plugin.noteWidthManager.updateNoteWidthEditorStyle(value);

			if (this.plugin.settingsManager.getEnableSaveWidthIndividually() || this.plugin.settingsManager.getEnableYAMLWidth())
			{
				this.isUserInputTriggered = true;
				if (this.updateTimeout) clearTimeout(this.updateTimeout);
				this.updateTimeout = window.setTimeout(async () =>
				{
					await this.plugin.noteWidthManager.refreshNoteWidth(this.isUserInputTriggered);
				}, 250);
			}

			sliderValueText.textContent = value.toString();
		});
	}

}
