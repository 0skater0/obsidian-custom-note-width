import { Plugin } from "obsidian";
import CustomNoteWidthSettingTab from "src/settings/settingsTab";
import CommandsManager from "src/commands/commandsManager";
import SettingsManager from "src/settings/settingsManager";
import NoteWidthManager from "src/note/noteWidthManager";
import EventHandler from "src/event/eventHandler";
import StatusBarManager from "src/statusbar/statusBarManager";
import WrapperManager from "src/statusbar/wrapperManager";
import UIElementCreator from "src/ui/uiElementCreator";
import { getLoadedMessage, getUnloadedMessage } from "src/utility/constants";
import UIManager from "./ui/uiManager";
import YamlFrontMatterProcessor from "src/note/yamlFrontMatterProcessor";
import DiagnosticsLog from "src/diagnostics/diagnosticsLog";
import DiagnosticsManager from "src/diagnostics/diagnosticsManager";

/**
 * The main plugin class for CustomNoteWidth.
 * Handles the initialization and management of various components related to adjusting the note width in Obsidian.
 */
export default class CustomNoteWidth extends Plugin
{
	settingsManager!: SettingsManager;
	noteWidthManager!: NoteWidthManager;
	eventHandler!: EventHandler;
	wrapperManager!: WrapperManager;
	statusBarManager!: StatusBarManager;
	uiElementCreator!: UIElementCreator;
	commandsManager!: CommandsManager;
	settingsTab!: CustomNoteWidthSettingTab;
	uiManager!: UIManager;
	yamlFrontMatterProcessor!: YamlFrontMatterProcessor;
	diagnosticsLog!: DiagnosticsLog;
	diagnostics!: DiagnosticsManager;
	/** Pending startup re-apply frame, cancelled on unload (0 = none). */
	private startupRaf: number = 0;
	/** Set in onunload so a late onLayoutReady/rAF callback cannot re-apply after destroy. */
	private unloaded: boolean = false;

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

		// Create the diagnostics log early so every manager can record into it
		this.diagnosticsLog = new DiagnosticsLog();

		// Create the settings tab for "Custom Note Width" in Obsidian settings
		this.settingsTab = new CustomNoteWidthSettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);

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

		// Create ui manager (must be available before UIElementCreator calls into it)
		this.uiManager = new UIManager(this);

		// Create ui creator
		this.uiElementCreator = new UIElementCreator(this);

		// Create the diagnostics report builder (reads settings + DOM on demand)
		this.diagnostics = new DiagnosticsManager(this.app, this, this.diagnosticsLog);

		// Capture uncaught errors / rejections that point at this plugin, so the
		// diagnostics report carries them. registerDomEvent removes these on unload.
		this.registerDomEvent(window, "error", (evt: ErrorEvent) =>
		{
			const errorName = evt.error instanceof Error ? evt.error.name : "Error";
			const stack = evt.error instanceof Error ? evt.error.stack : undefined;
			this.diagnostics.captureError("error", errorName, evt.message, stack, evt.filename);
		});
		this.registerDomEvent(window, "unhandledrejection", (evt: PromiseRejectionEvent) =>
		{
			const reason: unknown = evt.reason;
			let errorName = "UnhandledRejection";
			let message = "non-error rejection";
			let stack: string | undefined;
			if (reason instanceof Error)
			{
				errorName = reason.name;
				message = reason.message;
				stack = reason.stack;
			}
			else if (typeof reason === "string")
			{
				message = reason;
			}
			this.diagnostics.captureError("unhandledrejection", errorName, message, stack);
		});

		// Create the commands
		this.commandsManager = new CommandsManager(this);

		// Register the event handlers
		this.eventHandler.registerEventHandlers();

		// Apply the resolved per-note width for the active leaf once the layout
		// is ready. Resolving (instead of forcing the global default) fixes the
		// in-place-update glitch: after disabling and re-enabling the plugin with
		// a note open, `active-leaf-change` does not fire again, so the note used
		// to show the default width until reopened. `onLayoutReady` runs almost
		// immediately when the layout already exists (the re-enable case) and
		// after layout on a cold start.
		this.app.workspace.onLayoutReady(() =>
		{
			if (this.unloaded) return;
			this.noteWidthManager.applyWidthForLeaf();
			this.startupRaf = window.requestAnimationFrame(() =>
			{
				this.startupRaf = 0;
				if (this.unloaded) return;
				this.noteWidthManager.applyWidthForLeaf();
			});
		});

		// Plugin loaded
		console.debug(getLoadedMessage(this.manifest.version));
	}

	/**
	 * This function is called when the plugin is unloaded.
	 * It handles the cleanup of various components.
	 * Event handlers registered via `plugin.registerEvent()` are removed
	 * automatically by Obsidian; no manual deregistration needed.
	 */
	onunload(): void
	{
		// Guard + cancel a pending startup re-apply so a fast enable/disable cannot
		// re-apply the inline width after the manager has been destroyed.
		this.unloaded = true;
		if (this.startupRaf)
		{
			window.cancelAnimationFrame(this.startupRaf);
			this.startupRaf = 0;
		}

		this.wrapperManager.removeWrapper();
		this.noteWidthManager.destroy();

		// Plugin unloaded
		console.debug(getUnloadedMessage(this.manifest.version));
	}
}
