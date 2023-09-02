import { App } from "obsidian";
import * as jsyaml from "js-yaml";
import { YAML_END, YAML_FRONTMATTER_REGEX, YAML_NEWLINE, YAML_START } from "src/utility/constants";
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

			const content = await this.app.vault.read(file);
			const frontMatterMatch = content.match(YAML_FRONTMATTER_REGEX);

			if (frontMatterMatch && frontMatterMatch[1])
			{
				let parsedYaml: Record<string, unknown> = {};

				try
				{
					parsedYaml = jsyaml.load(frontMatterMatch[1]) as Record<string, unknown>;
				} catch (error)
				{
					console.error(`Failed to parse YAML: ${error}`);
				}

				// If the old key exists in the YAML content
				if (oldKey in parsedYaml)
				{
					// Replace the old key with the new key while preserving the value
					parsedYaml[newKey] = parsedYaml[oldKey];
					delete parsedYaml[oldKey];

					// Update the content of the note with the new YAML frontmatter
					const newYamlFrontMatter = YAML_START + jsyaml.dump(parsedYaml).trim() + YAML_END;
					const restOfContent = content.replace(YAML_FRONTMATTER_REGEX, "");
					const updatedContent = newYamlFrontMatter + YAML_NEWLINE + restOfContent.trimStart();
					await this.app.vault.modify(file, updatedContent);
				}
			}

			// Update the progress bar after processing each note
			progressBarModal.incrementProgress(incrementValue);
		}
	}

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

			const content = await this.app.vault.read(file);
			const frontMatterMatch = content.match(YAML_FRONTMATTER_REGEX);

			if (frontMatterMatch && frontMatterMatch[1]) 
			{
				let parsedYaml: Record<string, unknown> = {};

				try 
				{
					parsedYaml = jsyaml.load(frontMatterMatch[1]) as Record<string, unknown>;
				}
				catch (error) 
				{
					console.error(`Failed to parse YAML: ${error}`);
				}

				// If the key exists in the YAML content
				if (yamlKey in parsedYaml) 
				{
					// Update the value of the key
					parsedYaml[yamlKey] = newValue;

					// Update the content of the note with the new YAML frontmatter
					const newYamlFrontMatter = YAML_START + jsyaml.dump(parsedYaml).trim() + YAML_END;
					const restOfContent = content.replace(YAML_FRONTMATTER_REGEX, "");
					await this.app.vault.modify(file, newYamlFrontMatter + YAML_NEWLINE + restOfContent.trim());
				}
			}

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
	public getYamlValue(key: string): any
	{
		const yamlContent = this.extractYamlFromNote();
		if (!yamlContent) return null;
		const parsedYaml = jsyaml.load(yamlContent) as Record<string, unknown>;
		return parsedYaml[key];
	}

	/**
	 * Sets a value for a given YAML key in the active note's front matter.
	 * @public
	 * @param {string} key - The key to set its value.
	 * @param {any} value - The value to set for the specified key.
	 */
	public setYamlValue(key: string, value: any): void
	{
		const content = this.getActiveNoteContent();
		const activeView = getActiveMarkdownView(this.app);
		if (!content || !activeView) return;

		const rawYaml = this.extractYamlFromNote();
		let parsedYaml: Record<string, unknown>;
		if (rawYaml)
		{
			parsedYaml = jsyaml.load(rawYaml) as Record<string, unknown>;
		} else
		{
			parsedYaml = {};
		}
		parsedYaml[key] = value;

		const newYamlFrontMatter = YAML_START + jsyaml.dump(parsedYaml).trim() + YAML_END;
		const restOfContent = content.replace(YAML_FRONTMATTER_REGEX, "");
		const newContent = newYamlFrontMatter + YAML_NEWLINE + restOfContent.trimStart();
		activeView.editor.setValue(newContent);
	}

	/**
	 * Removes a specified key from the YAML front matter of the active note.
	 * @public
	 * @param {string} key - The key to remove from the YAML front matter.
	 */
	public removeYamlKey(key: string): void
	{
		const content = this.getActiveNoteContent();
		const activeView = getActiveMarkdownView(this.app);
		if (!content || !activeView) return;

		const rawYaml = this.extractYamlFromNote();
		let parsedYaml: Record<string, unknown>;
		if (rawYaml)
		{
			parsedYaml = jsyaml.load(rawYaml) as Record<string, unknown>;
		} else
		{
			parsedYaml = {};
		}
		delete parsedYaml[key];

		const newYamlFrontMatter = YAML_START + jsyaml.dump(parsedYaml).trim() + YAML_END;
		const restOfContent = content.replace(YAML_FRONTMATTER_REGEX, "");
		const newContent = newYamlFrontMatter + YAML_NEWLINE + restOfContent.trimStart();
		activeView.editor.setValue(newContent);
	}

	/**
	 * Checks if the active note's YAML front matter contains a specified key.
	 * @public
	 * @param {string} key - The key to check for its existence.
	 * @returns {boolean} True if the key exists, otherwise false.
	 */
	public hasYamlKey(key: string): boolean
	{
		return this.getYamlValue(key) !== undefined;
	}

	/**
	 * Checks if a specified key is the only key in the active note's YAML front matter.
	 * @public
	 * @param {string} key - The key to check.
	 * @returns {boolean} True if the key is the only one in the YAML front matter, otherwise false.
	 */
	public isOnlyYamlKey(key: string): boolean
	{
		const yamlContent = this.extractYamlFromNote();
		if (!yamlContent) return false;

		const parsedYaml = jsyaml.load(yamlContent) as Record<string, unknown>;
		return Object.keys(parsedYaml).length === 1 && parsedYaml[key] !== undefined;
	}

	/**
	 * Removes the entire YAML front matter from the active note.
	 * @public
	 */
	public removeYamlFrontMatter(): void
	{
		const activeView = getActiveMarkdownView(this.app);
		if (!activeView) return;

		const editor = activeView.editor;
		const content = editor.getValue();

		const newYamlFrontMatter = content.replace(YAML_FRONTMATTER_REGEX, '').trim();
		editor.setValue(newYamlFrontMatter);
	}
}
