import CustomNoteWidth from "src/main";
import { COMMANDS } from "src/utility/constants";
import { isActiveLeafMarkdown } from "src/utility/utilities";

/**
 * Abstract base class for commands.
 */
export abstract class Command
{
	/** The command identifier. */
	id: string;
	/** Display name of the command. */
	name: string;
	/** Title of the modal associated with the command. */
	modalTitle: string;

	/**
	 * Constructs a new Command instance.
	 * @param id - The command identifier.
	 * @param name - Display name of the command.
	 * @param modalTitle - Title of the modal associated with the command.
	 */
	constructor(id: string, name: string, modalTitle: string)
	{
		this.id = id;
		this.name = name;
		this.modalTitle = modalTitle;
	}

	/**
	 * Executes the command.
	 * @param arg - The argument for the command.
	 */
	abstract execute(arg: number): void;

	/**
	 * Determines if the command can be executed.
	 * @returns A boolean indicating if the command can be executed.
	 */
	abstract canExecute(): boolean;
}

/**
 * Command to change the default note width.
 */
export class ChangeDefaultNoteWidthCommand extends Command
{
	/** Reference to the CustomNoteWidth plugin. */
	plugin: CustomNoteWidth;

	/**
	 * Constructs a new ChangeDefaultNoteWidthCommand instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(plugin: CustomNoteWidth)
	{
		super(COMMANDS.CHANGE_DEFAULT_NOTE_WIDTH.ID, COMMANDS.CHANGE_DEFAULT_NOTE_WIDTH.NAME, COMMANDS.CHANGE_DEFAULT_NOTE_WIDTH.MODAL_TITLE);
		this.plugin = plugin;
	}

	/** @inheritdoc */
	public execute(arg: number): void
	{
		this.plugin.noteWidthManager.changeDefaultNoteWidth(arg);
	}

	/** @inheritdoc */
	public canExecute(): boolean
	{
		return this.plugin.settingsManager.getEnableChangeDefaultNoteWidth() && this.plugin.settingsManager.getEnableSaveWidthIndividually();
	}
}

/**
 * Command to change the width of all notes.
 */
export class ChangeAllNoteWidthCommand extends Command
{
	/** Reference to the CustomNoteWidth plugin. */
	plugin: CustomNoteWidth;

	/**
	 * Constructs a new ChangeAllNoteWidthCommand instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(plugin: CustomNoteWidth)
	{
		super(COMMANDS.CHANGE_ALL_NOTE_WIDTH.ID, COMMANDS.CHANGE_ALL_NOTE_WIDTH.NAME, COMMANDS.CHANGE_ALL_NOTE_WIDTH.MODAL_TITLE);
		this.plugin = plugin;
	}

	/** @inheritdoc */
	public execute(arg: number): void
	{
		this.plugin.noteWidthManager.changeAllNoteWidth(arg);
	}

	/** @inheritdoc */
	public canExecute(): boolean
	{
		return true;
	}
}

/**
 * Command to change the width of a single note.
 */
export class ChangeNoteWidthCommand extends Command
{
	/** Reference to the CustomNoteWidth plugin. */
	plugin: CustomNoteWidth;

	/**
	 * Constructs a new ChangeNoteWidthCommand instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(plugin: CustomNoteWidth)
	{
		super(COMMANDS.CHANGE_NOTE_WIDTH.ID, COMMANDS.CHANGE_NOTE_WIDTH.NAME, COMMANDS.CHANGE_NOTE_WIDTH.MODAL_TITLE);
		this.plugin = plugin;
	}

	/** @inheritdoc */
	public execute(arg: number): void
	{
		this.plugin.noteWidthManager.changeNoteWidth(arg);
	}

	/** @inheritdoc */
	public canExecute(): boolean
	{
		return isActiveLeafMarkdown(this.plugin.app);
	}
}
