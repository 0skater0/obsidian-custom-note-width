import CustomNoteWidth from "src/main";
import { COMMAND_IDS } from "src/utility/constants";
import { t } from "src/i18n/i18n";
import { isActiveLeafMarkdown } from "src/utility/utilities";
import { WidthValue } from "src/utility/config";

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
	protected constructor(id: string, name: string, modalTitle: string)
	{
		this.id = id;
		this.name = name;
		this.modalTitle = modalTitle;
	}

	/**
	 * Executes the command.
	 * @param wv - The WidthValue argument for the command.
	 */
	abstract execute(wv: WidthValue): void;

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
		super(COMMAND_IDS.CHANGE_DEFAULT_NOTE_WIDTH, t("command.change_default_width.name"), t("command.change_default_width.modal_title"));
		this.plugin = plugin;
	}

	/** @inheritdoc */
	public execute(wv: WidthValue): void
	{
		void this.plugin.noteWidthManager.changeDefaultNoteWidth(wv);
	}

	/** @inheritdoc */
	public canExecute(): boolean
	{
		return true;
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
		super(COMMAND_IDS.CHANGE_ALL_NOTE_WIDTH, t("command.change_all_width.name"), t("command.change_all_width.modal_title"));
		this.plugin = plugin;
	}

	/** @inheritdoc */
	public execute(wv: WidthValue): void
	{
		void this.plugin.noteWidthManager.changeAllNoteWidth(wv);
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
		super(COMMAND_IDS.CHANGE_NOTE_WIDTH, t("command.change_note_width.name"), t("command.change_note_width.modal_title"));
		this.plugin = plugin;
	}

	/** @inheritdoc */
	public execute(wv: WidthValue): void
	{
		void this.plugin.noteWidthManager.changeNoteWidth(wv);
	}

	/** @inheritdoc */
	public canExecute(): boolean
	{
		return isActiveLeafMarkdown(this.plugin.app);
	}
}
