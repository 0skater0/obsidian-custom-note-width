import CustomNoteWidth from "src/main";
import NoteWidthModal from "src/modals/noteWidthModal";
import { Command, ChangeNoteWidthCommand, ChangeDefaultNoteWidthCommand, ChangeAllNoteWidthCommand } from "src/commands/command";

/**
 * Interface representing the active commands.
 */
interface ActiveCommands
{
	[id: string]: boolean;
}

/**
 * Manages the registration and execution of commands.
 */
export default class CommandsManager
{
	/** Reference to the CustomNoteWidth plugin. */
	plugin: CustomNoteWidth;
	/** Object representing the active state of commands. */
	activeCommands: ActiveCommands = {};
	/** Array containing all the commands. */
	commands: Command[] = [];

	/**
	 * Constructs a new CommandsManager instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(plugin: CustomNoteWidth)
	{
		this.plugin = plugin;
		this.commands.push(new ChangeNoteWidthCommand(plugin));
		this.commands.push(new ChangeDefaultNoteWidthCommand(plugin));
		this.commands.push(new ChangeAllNoteWidthCommand(plugin));

		this.registerCommands();
	}

	/**
	 * Registers all the commands in the commands array.
	 */
	private registerCommands(): void
	{
		for (const command of this.commands)
		{
			this.addCommand(command);
		}
	}

	/**
	 * Adds and activates a command.
	 * @param command - The command to be added and activated.
	 */
	private addCommand(command: Command): void
	{
		if (this.activeCommands.hasOwnProperty(command.id)) return;

		this.activeCommands[command.id] = true;
		const commandCallback = this.commandCallback.bind(this, command.execute.bind(command), command.modalTitle);

		this.plugin.addCommand({
			id: command.id,
			name: command.name,
			callback: () =>
			{
				if (this.activeCommands[command.id])
				{
					commandCallback();
				}
			},
			checkCallback: (checking: boolean) =>
			{
				if (!this.activeCommands[command.id] || (command.canExecute && !command.canExecute()))
				{
					return false;
				}
				if (checking)
				{
					return true;
				}
				commandCallback();
				return true;
			},
		});
	}

	/**
	 * Callback for command execution. Opens the NoteWidthModal and then executes the command action.
	 * @param commandAction - The action to be executed by the command.
	 * @param modalTitel - The title of the modal.
	 */
	private commandCallback(commandAction: (arg: number) => void, modalTitel: string): void
	{
		new NoteWidthModal(this.plugin.app, (number) => { commandAction(number); }, modalTitel).open();
	}

	/**
	 * Disables a command.
	 * @param id - The identifier of the command to be disabled.
	 */
	public disableCommand(id: string): void
	{
		this.activeCommands[id] = false;
	}

	/**
	 * Enables a command.
	 * @param id - The identifier of the command to be enabled.
	 */
	public enableCommand(id: string): void
	{
		if (this.activeCommands.hasOwnProperty(id))
		{
			this.activeCommands[id] = true;
		}
	}
}
