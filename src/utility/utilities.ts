import { App, FileSystemAdapter, MarkdownView } from "obsidian";
import * as path from "path";
import CustomNoteWidth from "src/main";
import { DOM_IDENTIFIERS } from "src/utility/constants";

/**
 * Retrieves the absolute path to the vault.
 * @param app - The Obsidian app instance.
 * @returns The absolute vault path.
 */
export function getAbsoluteVaultPath(app: App): string
{
	let adapter = app.vault.adapter;
	if (adapter instanceof FileSystemAdapter)
	{
		return adapter.getBasePath();
	}
	return "";
}

/**
 * Retrieves the absolute path to the plugin directory.
 * @param app - The Obsidian app instance.
 * @returns The absolute plugin directory path.
 */
export function getAbsolutePluginPath(app: App, plugin: CustomNoteWidth): string
{
	return path.join(getAbsoluteVaultPath(app), plugin.manifest.dir as string);
}

/**
 * Retrieves the absolute path to the database file within the plugin directory.
 * @param app - The Obsidian app instance.
 * @param filename - The database filename.
 * @returns The absolute path to the database file.
 */
export function getDatabasePath(app: App, plugin: CustomNoteWidth, filename: string): string
{
	return path.join(getAbsolutePluginPath(app, plugin), filename);
}

/**
 * Checks if the provided value is a record.
 * @param value - Value to check.
 * @returns True if the value is a record, false otherwise.
 */
export function isRecord(value: unknown): value is Record<string, unknown>
{
	if (typeof value === "object" && value !== null)
	{
		const valueAsRecord = value as Record<string, unknown>;
		for (const key in valueAsRecord)
		{
			if (typeof key !== "string" || typeof valueAsRecord[key] === "function" || valueAsRecord[key] === undefined)
			{
				return false;
			}
		}
		return true;
	}
	return false;
}

/**
 * Retrieves the current window's dimensions.
 * @returns An object containing the window's width and height.
 */
export function getCurrentWindowState(): { width: number; height: number; }
{
	return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Compares two window states to determine if the window has been resized.
 * @param previousState - The previous window state.
 * @param currentState - The current window state.
 * @returns True if the window dimensions have changed, false otherwise.
 */
export function hasResized(previousState: { width: number; height: number; }, currentState: { width: number; height: number; }): boolean
{
	return previousState.width !== currentState.width || previousState.height !== currentState.height;
}

/**
 * Checks if the active leaf in the Obsidian app is a markdown view.
 * @param app - The Obsidian app instance.
 * @returns True if the active leaf is a markdown view, false otherwise.
 */
export function isActiveLeafMarkdown(app: App): boolean
{
	const activeView = app.workspace.getActiveViewOfType(MarkdownView);
	return !!activeView;
}

/**
 * Retrieves the active markdown view in the Obsidian app.
 * @param app - The Obsidian app instance.
 * @returns The active markdown view or null if none.
 */
export function getActiveMarkdownView(app: App): MarkdownView | null
{
	return app.workspace.getActiveViewOfType(MarkdownView);
}

/**
 * Retrieves the active editor's DOM element in a specific mode (either preview or source).
 * @param app - The Obsidian app instance.
 * @param mode - The desired mode ("preview" or "source").
 * @returns The editor's DOM element or null if not found.
 */
export function getActiveEditorDiv(app: App, mode: string): Element | null
{
	const activeView = getActiveMarkdownView(app);
	if (activeView)
	{
		if (mode === "preview")
		{
			return activeView.containerEl.querySelector(classSelector(DOM_IDENTIFIERS.MARKDOWN_PREVIEW_VIEW));
		} else if (mode === "source")
		{
			return activeView.containerEl.querySelector(classSelector(DOM_IDENTIFIERS.CM_SCROLLER));
		}
	}
	return null;
}

/**
 * Retrieves the mode of the active markdown view.
 * @returns The mode ("preview" or "source") or null if no active markdown view.
 */
export function getEditorMode(): string | null
{
	const view = getActiveMarkdownView(this.app);
	if (view) return view.getMode();
	return null;
}

/**
 * Calculates and returns the width of a note based on the width percentage and editor div dimensions.
 * @param widthPercentage - The width percentage.
 * @param editorDiv - The editor's DOM element.
 * @returns The calculated note width or null if unable to calculate.
 */
export async function calculateNoteWidth(widthPercentage: number, editorDiv: Element): Promise<number | null>
{
	const charWidth = await getCharWidth();
	if (charWidth)
	{
		const noteWidth = charWidth * (1 + (widthPercentage / 100) * (editorDiv.clientWidth / charWidth - 1));
		return noteWidth;
	} else
	{
		return null;
	}
}

/**
 * Calculates and returns the width of a single character in the editor.
 * @returns The character width or null if unable to calculate.
 */
export async function getCharWidth(): Promise<number | null>
{
	const editorDiv = document.querySelector(classSelector(DOM_IDENTIFIERS.MARKDOWN_PREVIEW_VIEW)) || document.querySelector(classSelector(DOM_IDENTIFIERS.CM_SCROLLER));
	if (!editorDiv)
	{
		console.error("Editor not found!", new Error().stack);
		return null;
	}
	const editorFontFamily = window.getComputedStyle(editorDiv).fontFamily;
	const editorFontSize = window.getComputedStyle(editorDiv).fontSize;
	const canvas = document.createElement("canvas");
	const context = canvas.getContext("2d");
	if (!context)
	{
		console.error("Failed to get canvas context!", new Error().stack);
		return null;
	}
	context.font = `${editorFontSize} ${editorFontFamily}`;
	const metrics = context.measureText("m");
	const charWidth = metrics.width;
	canvas.remove();
	return charWidth;
}

/**
 * Constructs a selector string for a given ID.
 * @param id - The ID to use.
 * @returns A selector string for the ID.
 */
export function idSelector(id: string): string
{
	return `#${id}`;
}

/**
 * Constructs a selector string for a given class name.
 * @param className - The class name to use.
 * @returns A selector string for the class name.
 */
export function classSelector(className: string): string
{
	return `.${className}`;
}

/**
 * Validates a given width value to ensure it's within a specified range.
 *
 * @param {number} width - The width value to be validated.
 * @returns {number} - Returns the validated width value. If the input width is greater than 100, it returns 100. If it's less than 0, it returns 0. If the input is not a number, it returns the defaultWidth.
 */
export function validateWidth(width: number): number
{
	return Math.min(100, Math.max(0, width));
}
