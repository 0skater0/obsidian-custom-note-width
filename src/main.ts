import { Plugin } from "obsidian";
import CustomNoteWidthSettingTab from "src/settings/settingsTab";
import CommandsManager from "src/commands/commandsManager";
import SettingsManager from "src/settings/settingsManager";
import NoteWidthManager from "src/note/noteWidthManager";
import EventHandler from "src/event/eventHandler";
import StatusBarManager from "src/statusbar/statusBarManager";
import WrapperManager from "src/statusbar/wrapperManager";
import UIElementCreator from "src/ui/uiElementCreator";
import LokiDatabase from "src/utility/lokiDatabase";
import { getDatabasePath } from "src/utility/utilities";
import { DATABASE_FILENAME, getLoadedMessage, getUnloadedMessage } from "src/utility/constants";
import UIManager from "./ui/uiManager";
import YamlFrontMatterProcessor from "src/note/yamlFrontMatterProcessor";

/**
 * The main plugin class for CustomNoteWidth.
 * Handles the initialization and management of various components related to adjusting the note width in Obsidian.
 */
export default class CustomNoteWidth extends Plugin
{
	settingsManager: SettingsManager;
	noteWidthManager: NoteWidthManager;
	eventHandler: EventHandler;
	wrapperManager: WrapperManager;
	statusBarManager: StatusBarManager;
	uiElementCreator: UIElementCreator;
	commandsManager: CommandsManager;
	database: LokiDatabase;
	settingsTab: CustomNoteWidthSettingTab;
	uiManager: UIManager;
	yamlFrontMatterProcessor: YamlFrontMatterProcessor;

	/**
	 * This function is called when the plugin is loaded.
	 * It initializes various managers, handlers, and UI elements.
	 * @returns {Promise<void>} A promise that resolves when the loading process is completed.
	 */
	async onload(): Promise<void>
	{
		// Create settings manager to load settings
		this.settingsManager = new SettingsManager(this);
		await this.settingsManager.loadSettings();

		// Create the settings tab for "Custom Note Width" in Obsidian settings
		this.settingsTab = new CustomNoteWidthSettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);

		// Initialise the Database
		if (this.settingsManager.getEnableSaveWidthIndividually())
		{
			this.database = new LokiDatabase(getDatabasePath(this.app, DATABASE_FILENAME));
			await this.database.init();
		}

		// Create wrapper manager and create a wrapper div element
		this.wrapperManager = new WrapperManager();

		// Creates a yaml frontmatter processor
		this.yamlFrontMatterProcessor = new YamlFrontMatterProcessor(this.app);

		// Create statusbar manager
		this.statusBarManager = new StatusBarManager(this);

		// Create note width manager
		this.noteWidthManager = new NoteWidthManager(this.app, this);

		// Create event handler
		this.eventHandler = new EventHandler(this.app, this);

		// Create ui creator
		this.uiElementCreator = new UIElementCreator(this);

		// Create ui manager
		this.uiManager = new UIManager(this);

		// Create the commands
		this.commandsManager = new CommandsManager(this);

		// Register the event handlers
		this.eventHandler.registerEventHandlers();

		// Apply the editor width at startup
		this.noteWidthManager.updateNoteWidthEditorStyle(this.settingsManager.getWidthPercentage());

		// Plugin loaded
		console.log(getLoadedMessage(this.manifest.version));
	}

	/**
	 * This function is called when the plugin is unloaded.
	 * It handles the cleanup and deregistration of various components.
	 * @returns {Promise<void>} A promise that resolves when the unloading process is completed.
	 */
	async onunload(): Promise<void>
	{
		this.wrapperManager.removeWrapper();
		this.noteWidthManager.removeNoteWidthEditorStyle();
		this.eventHandler.deregisterEventHandlers();

		// Plugin unloaded
		console.log(getUnloadedMessage(this.manifest.version));
	}
}
