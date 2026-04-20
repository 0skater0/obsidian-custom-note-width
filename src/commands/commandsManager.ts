import CustomNoteWidth from "src/main";
import NoteWidthModal from "src/modals/noteWidthModal";
import { Command, ChangeNoteWidthCommand, ChangeDefaultNoteWidthCommand, ChangeAllNoteWidthCommand } from "src/commands/command";
import { WidthUnit, WidthValue, VALID_UNITS, UnitConfig, PILLS_PRESET_COUNT } from "src/utility/config";
import { t } from "src/i18n/i18n";

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
		this.registerPillCommands();
	}

	/**
	 * Registers one command per pill preset slot. Commands are always listed
	 * in the Hotkeys settings (so users can bind keys up-front) but only
	 * execute when pills mode is active.
	 */
	private registerPillCommands(): void
	{
		for (let index = 0; index < PILLS_PRESET_COUNT; index++)
		{
			const id = `apply-pill-preset-${index + 1}`;
			this.plugin.addCommand({
				id,
				name: t("command.apply_pill_preset.name", { index: index + 1 }),
				checkCallback: (checking: boolean) =>
				{
					if (this.plugin.settingsManager.getControlMode() !== "pills") return false;
					if (!this.plugin.settingsManager.getEnableSlider()) return false;
					if (checking) return true;
					this.plugin.eventHandler.applyPillPreset(index);
					return true;
				},
			});
		}
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
		if (Object.hasOwn(this.activeCommands, command.id)) return;

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
	 * @param modalTitle - The title of the modal.
	 */
	private commandCallback(commandAction: (wv: WidthValue) => void, modalTitle: string): void
	{
		const defaultUnit = this.plugin.settingsManager.getDefaultWidthUnit();
		const unitConfigs = {} as Record<WidthUnit, UnitConfig>;
		for (const u of VALID_UNITS)
		{
			unitConfigs[u] = this.plugin.settingsManager.getUnitConfig(u);
		}
		new NoteWidthModal(this.plugin.app, (wv) => { commandAction(wv); }, modalTitle, defaultUnit, unitConfigs).open();
	}

}
