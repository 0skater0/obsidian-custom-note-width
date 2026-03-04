import { App } from "obsidian";
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
	 */
	constructor(private app: App) { }

	/**
	 * Replaces a specified YAML key in all notes with a new key.
	 * @param oldKey - The original key to be replaced.
	 * @param newKey - The new key to replace the original with.
	 * @param progressBarModal - The progress bar modal to indicate progress.
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
	public async updateAllYamlValues(yamlKey: string, newValue: number | string, progressBarModal: ProgressBarModal): Promise<void>
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
	 * Sets a value for a given YAML key in the active note's front matter.
	 * @param key - The key to set its value.
	 * @param value - The value to set for the specified key.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public async setYamlValue(key: string, value: any): Promise<void>
	{
		const activeView = getActiveMarkdownView(this.app);
		if (!activeView || !activeView.file) return;

		await this.app.fileManager.processFrontMatter(activeView.file, (frontMatter) =>
		{
			frontMatter[key] = value;
		});
	}
}
