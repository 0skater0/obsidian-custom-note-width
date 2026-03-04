import { App, MarkdownView } from "obsidian";
import { DOM_IDENTIFIERS } from "src/utility/constants";
import { WidthUnit, WidthValue, UnitConfig, UNIT_CONFIGS } from "src/utility/config";

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
 * Constructs a selector string for a given class name.
 * @param className - The class name to use.
 * @returns A selector string for the class name.
 */
export function classSelector(className: string): string
{
	return `.${className}`;
}

/**
 * Retrieves the editor's DOM element for a specific view in a given mode.
 * Unlike getActiveEditorDiv, this works with any MarkdownView, not just the active one.
 * @param view - The MarkdownView to get the editor div for.
 * @param mode - The desired mode ("preview" or "source").
 * @returns The editor's DOM element or null if not found.
 */
export function getEditorDivForView(view: MarkdownView, mode: string): Element | null
{
	if (mode === "preview")
	{
		return view.containerEl.querySelector(classSelector(DOM_IDENTIFIERS.MARKDOWN_PREVIEW_VIEW));
	} else if (mode === "source")
	{
		return view.containerEl.querySelector(classSelector(DOM_IDENTIFIERS.CM_SCROLLER));
	}
	return null;
}

/**
 * Synchronously calculates and returns the width of a single character in the editor.
 * Identical to getCharWidth but with a synchronous signature.
 * @returns The character width or null if unable to calculate.
 */
export function getCharWidthSync(): number | null
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
 * Validates a given width value to ensure it's within the allowed range for its unit.
 * @param width - The width value to be validated.
 * @param unit - The width unit (defaults to '%' for backwards compatibility).
 * @param unitConfig - Optional custom unit config. Falls back to UNIT_CONFIGS defaults.
 * @returns The clamped width value.
 */
export function validateWidth(width: number, unit: WidthUnit = '%', unitConfig?: UnitConfig): number
{
	const config = unitConfig ?? UNIT_CONFIGS[unit];
	return Math.min(config.max, Math.max(config.min, width));
}

/**
 * Validates a WidthValue, clamping its value to the allowed range for its unit.
 * @param wv - The WidthValue to validate.
 * @param unitConfig - Optional custom unit config. Falls back to UNIT_CONFIGS defaults.
 * @returns A new WidthValue with the clamped value.
 */
export function validateWidthValue(wv: WidthValue, unitConfig?: UnitConfig): WidthValue
{
	return { value: validateWidth(wv.value, wv.unit, unitConfig), unit: wv.unit };
}
