import { App } from "obsidian";
import { YAML_FRONTMATTER_REGEX } from "src/utility/constants";
import { getActiveMarkdownView } from "src/utility/utilities";
import ProgressBarModal from "src/modals/progressBarModal";

/**
 * Processor for handling and updating YAML front matter in notes.
 */
export default class YamlFrontMatterProcessor
{
	/**
	 * Constructs a new YamlFrontMatterProcessor instance.
	 * @param app - The Obsidian application instance.
	 * @param plugin - Reference to the CustomNoteWidth plugin.
	 */
	constructor(private app: App) { }

	/**
 * Replaces a specified YAML key in all notes with a new key.
 * @param oldKey - The original key to be replaced.
 * @param newKey - The new key to replace the original with.
 */
	public async replaceYamlKeyInAllNotes(oldKey: string, newKey: string, progressBarModal: ProgressBarModal): Promise<void>
	{
		const files = this.app.vault.getMarkdownFiles();
		const incrementValue = 100 / files.length;

		for (const file of files)
		{
			if (progressBarModal.isCancelled)
			{
				break;
			}

			await this.app.fileManager.processFrontMatter(file, (frontMatter) =>
			{
				if (oldKey in frontMatter)
				{
					frontMatter[newKey] = frontMatter[oldKey];
					delete frontMatter[oldKey];
				}
			});

			// Update the progress bar after processing each note
			progressBarModal.incrementProgress(incrementValue);
		}
	}

	/**
	 * Update the specified YAML key's value in all Markdown files within the vault.
	 * @async
	 * @param {string} yamlKey - The key in the YAML front matter to update.
	 * @param {number} newValue - The new value to set for the specified YAML key.
	 * @param {ProgressBarModal} progressBarModal - The progress bar modal to indicate the progress of the operation.
	 * @returns {Promise<void>} - Resolves when all files have been processed.
	 * @throws Will throw an error if the operation fails.
	 */
	public async updateAllYamlValues(yamlKey: string, newValue: number, progressBarModal: ProgressBarModal): Promise<void> 
	{
		const files = this.app.vault.getMarkdownFiles();
		const incrementValue = 100 / files.length;

		for (const file of files) 
		{
			if (progressBarModal.isCancelled) 
			{
				break;
			}

			await this.app.fileManager.processFrontMatter(file, (frontMatter) =>
			{
				if (yamlKey in frontMatter)
				{
					frontMatter[yamlKey] = newValue;
				}
			});

			progressBarModal.incrementProgress(incrementValue);
		}
	}

	/**
	 * Retrieves the content of the active note.
	 * @private
	 * @returns {string | null} The content of the active note or null if not available.
	 */
	private getActiveNoteContent(): string | null
	{
		const activeView = getActiveMarkdownView(this.app);
		return activeView?.editor.getValue() || null;
	}

	/**
	 * Extracts the YAML front matter from the active note.
	 * @public
	 * @returns {string | null} The extracted YAML front matter or null if not found.
	 */
	public extractYamlFromNote(): string | null
	{
		const content = this.getActiveNoteContent();
		if (!content) return null;
		const frontMatterMatch = content.match(YAML_FRONTMATTER_REGEX);
		return frontMatterMatch && frontMatterMatch[1];
	}

	/**
	 * Checks if the active note contains a YAML front matter.
	 * @public
	 * @returns {boolean} True if the active note contains a YAML front matter, otherwise false.
	 */
	public hasYamlFrontMatter(): boolean
	{
		return Boolean(this.extractYamlFromNote());
	}

	/**
	 * Retrieves the value of a given YAML key from the active note.
	 * @public
	 * @param {string} key - The key to retrieve its value from the YAML front matter.
	 * @returns {any} The value of the specified key or null if not found.
	 */
	public async getYamlValue(key: string): Promise<any>
	{
		const activeView = getActiveMarkdownView(this.app);
		if (!activeView || !activeView.file) return null;

		let value = null;

		await this.app.fileManager.processFrontMatter(activeView.file, (frontMatter) =>
		{
			value = frontMatter[key];
		});

		return value;
	}

	/**
	 * Sets a value for a given YAML key in the active note's front matter.
	 * @public
	 * @param {string} key - The key to set its value.
	 * @param {any} value - The value to set for the specified key.
	 */
	public async setYamlValue(key: string, value: any): Promise<void>
	{
		const activeView = getActiveMarkdownView(this.app);
		if (!activeView || !activeView.file) return;

		await this.app.fileManager.processFrontMatter(activeView.file, (frontMatter) =>
		{
			frontMatter[key] = value;
		});
	}

	/**
	 * Removes a specified key from the YAML front matter of the active note.
	 * @public
	 * @param {string} key - The key to remove from the YAML front matter.
	 */
	public async removeYamlKey(key: string): Promise<void>
	{
		const activeView = getActiveMarkdownView(this.app);
		if (!activeView || !activeView.file) return;

		await this.app.fileManager.processFrontMatter(activeView.file, (frontMatter) =>
		{
			delete frontMatter[key];
		});
	}

	/**
	 * Checks if the active note's YAML front matter contains a specified key.
	 * @public
	 * @param {string} key - The key to check for its existence.
	 * @returns {boolean} True if the key exists, otherwise false.
	 */
	public async hasYamlKey(key: string): Promise<boolean>
	{
		const activeView = getActiveMarkdownView(this.app);
		if (!activeView || !activeView.file) return false;

		let exists = false;

		await this.app.fileManager.processFrontMatter(activeView.file, (frontMatter) =>
		{
			exists = key in frontMatter;
		});

		return exists;
	}

	/**
	 * Checks if a specified key is the only key in the active note's YAML front matter.
	 * @public
	 * @param {string} key - The key to check.
	 * @returns {boolean} True if the key is the only one in the YAML front matter, otherwise false.
	 */
	public async isOnlyYamlKey(key: string): Promise<boolean>
	{
		const activeView = getActiveMarkdownView(this.app);
		if (!activeView || !activeView.file) return false;

		let isOnly = false;

		await this.app.fileManager.processFrontMatter(activeView.file, (frontMatter) =>
		{
			isOnly = Object.keys(frontMatter).length === 1 && frontMatter[key] !== undefined;
		});

		return isOnly;
	}

	/**
	 * Removes the entire YAML front matter from the active note.
	 * @public
	 */
	public async removeYamlFrontMatter(): Promise<void>
	{
		const activeView = getActiveMarkdownView(this.app);
		if (!activeView || !activeView.file) return;

		await this.app.fileManager.processFrontMatter(activeView.file, (frontMatter) =>
		{
			for (const key of Object.keys(frontMatter))
			{
				delete frontMatter[key];
			}
		});
	}

}
