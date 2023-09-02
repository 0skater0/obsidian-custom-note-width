/**
 * UUID format string used for generating unique identifiers.
 */
export const UUID_FORMAT = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";

/**
 * Regular expression used for detecting and parsing YAML frontmatter sections.
 */
export const YAML_FRONTMATTER_REGEX = new RegExp(/^---\n([\s\S]*?)\n---/);

/**
 * Default width (in percentage) applied to notes.
 */
export const DEFAULT_NOTE_WIDTH = 36;

/**
 * Directory name for Obsidian's configuration and plugins.
 */
export const OBSIDIAN_DIR = ".obsidian";

/**
 * Directory name where Obsidian stores plugins.
 */
export const PLUGINS_DIR = "plugins";

/**
 * Directory name specific to this plugin.
 */
export const PLUGIN_DIR_NAME = "obsidian-custom-note-width";

/**
 * Human-readable name of the plugin.
 */
export const PLUGIN_NAME = "Custom Note Width";

/**
 * Name of the database collection used for storing note widths.
 */
export const DATABASE_COLLECTION_NOTE_WIDTHS = "NoteWidths";

/**
 * Filename of the database used for storing note widths.
 */
export const DATABASE_FILENAME = "noteWidthDatabase.json";

/**
 * Link for donations to support the plugin's development.
 */
export const DONATION_LINK = "https://ko-fi.com/skater_";

/**
 * Disclaimer text displayed when presenting the donation link.
 */
export const DONATION_DISCLAIMER_TEXT = "Disclaimer: Please note that clicking the image will open a link in your browser.";

/**
 * Start delimiter for YAML frontmatter sections.
 */
export const YAML_START = "---\n";

/**
 * End delimiter for YAML frontmatter sections.
 */
export const YAML_END = "\n---";

/**
 * Double newline used as a separator in YAML sections.
 */
export const YAML_NEWLINE = "\n\n";

/**
 * Key used in YAML frontmatter to store the note's unique identifier.
 */
export const NOTE_ID_KEY = "noteID";

/**
 * Text displayed on the cancel button in the plugin's UI.
 */
export const CANCEL_BUTTON_TEXT = "Cancel";

/**
 * Text displayed on the apply button in the plugin's UI.
 */
export const APPLY_BUTTON_TEXT = "Apply";

/**
 * Title for the modal used when updating YAML frontmatter keys in all notes.
 */
export const PROGRESSBAR_MODAL_KEY_TITLE_TEXT = "Changing all YAML-Frontmatter keys...";

/**
 * Title for the modal used when updating the value of all YAML frontmatter keys in all notes.
 */
export const PROGRESSBAR_MODAL_VALUE_TITLE_TEXT = "Changing the value for all YAML-Frontmatter's...";

/**
 * List of priority checks performed to determine the width of a note.
 * @property {string} SAVED_NOTE_WIDTH - Check for a saved note width in the database.
 * @property {string} YAML_NOTE_WIDTH - Check for a width specified in the note's YAML frontmatter.
 */
export const PRIORITYLIST = {
	SAVED_NOTE_WIDTH: "Check for saved note width",
	YAML_NOTE_WIDTH: "Check for YAML-Frontmatter width"
};

/**
 * Definitions of commands provided by the plugin.
 * @property {Object} CHANGE_NOTE_WIDTH - Command to change the width of the open note.
 * @property {string} CHANGE_NOTE_WIDTH.ID - Command identifier.
 * @property {string} CHANGE_NOTE_WIDTH.NAME - Human-readable command name.
 * @property {string} CHANGE_NOTE_WIDTH.MODAL_TITLE - Title for the modal prompt.
 * 
 * @property {Object} CHANGE_DEFAULT_NOTE_WIDTH - Command to change the default note width.
 * @property {string} CHANGE_DEFAULT_NOTE_WIDTH.ID - Command identifier.
 * @property {string} CHANGE_DEFAULT_NOTE_WIDTH.NAME - Human-readable command name.
 * @property {string} CHANGE_DEFAULT_NOTE_WIDTH.MODAL_TITLE - Title for the modal prompt.
 * 
 * @property {Object} CHANGE_ALL_NOTE_WIDTH - Command to change the width for all notes.
 * @property {string} CHANGE_ALL_NOTE_WIDTH.ID - Command identifier.
 * @property {string} CHANGE_ALL_NOTE_WIDTH.NAME - Human-readable command name.
 * @property {string} CHANGE_ALL_NOTE_WIDTH.MODAL_TITLE - Title for the modal prompt.
 */
export const COMMANDS = {
	CHANGE_NOTE_WIDTH: {
		ID: "change-note-width",
		NAME: "Change the width of the open note",
		MODAL_TITLE: "Enter the width for the open note (%)"
	},
	CHANGE_DEFAULT_NOTE_WIDTH: {
		ID: "change-default-note-width",
		NAME: "Change the default note width",
		MODAL_TITLE: "Enter the default note width (%)"
	},
	CHANGE_ALL_NOTE_WIDTH: {
		ID: "change-all-note-width",
		NAME: "Change the width for all notes",
		MODAL_TITLE: "Enter the width for all notes (%)"
	}
};

/**
 * Notices and warnings displayed to users.
 * @property {string} SLIDER_HIDE_WARNING - Warning message when the slider UI element is too large.
 */
export const NOTICES = {
	SLIDER_HIDE_WARNING: "Slider too large!"
};

/**
 * Identifiers for various DOM elements used in the plugin's UI.
 * @property {string} DUMMY - Identifier for a dummy element.
 * @property {string} SLIDER - Identifier for the width adjustment slider.
 * @property {string} SLIDER_VALUE - Identifier for displaying the current slider value.
 * @property {string} WRAPPER - Identifier for the note width wrapper element.
 * @property {string} STATUSBAR_ELEMENT - Identifier for the plugin's status bar UI element.
 * @property {string} DONATION_BUTTON - Identifier for the donation button.
 * @property {string} STATUSBAR - Identifier for Obsidian's status bar.
 * @property {string} CUSTOM_NOTE_WIDTH - Identifier for the custom note width element.
 * @property {string} MARKDOWN_PREVIEW_VIEW - Identifier for the markdown preview view.
 * @property {string} CM_SCROLLER - Identifier for the code mirror scroller.
 * @property {string} PROGRESS_BAR_CONTAINER - Identifier for the progress bar container.
 * @property {string} MODAL_CLOSE_BUTTON - Identifier for the modal's close button.
 * @property {string} NWM_CONTAINER - Identifier for the note width manager container.
 * @property {string} NWM_INPUT_CONTAINER - Identifier for the note width manager input container.
 * @property {string} NWM_BUTTON_CONTAINER - Identifier for the note width manager button container.
 * @property {string} PRIORITY_LIST_ITEM - Identifier for a priority list item.
 * @property {string} PRIORITY_NUMBER - Identifier for displaying priority numbers.
 */
export const DOM_IDENTIFIERS = {
	DUMMY: "dummy",
	SLIDER: "custom-note-width-slider",
	SLIDER_VALUE: "custom-note-width-slider-value",
	WRAPPER: "custom-note-width-wrapper",
	STATUSBAR_ELEMENT: "plugin-custom-note-width",
	DONATION_BUTTON: "custom-note-width-donation-button",
	STATUSBAR: "status-bar",
	CUSTOM_NOTE_WIDTH: "custom-note-width",
	MARKDOWN_PREVIEW_VIEW: "markdown-preview-view",
	CM_SCROLLER: "cm-scroller",
	PROGRESS_BAR_CONTAINER: "progress-bar-container",
	PROGRESS_OUTER: "progress-bar-outer",
	PROGRESS_INNER: "progress-bar-inner",
	MODAL_CLOSE_BUTTON: "modal-close-button",
	NWM_CONTAINER: "nwm-container",
	NWM_INPUT_CONTAINER: "nwm-input-container",
	NWM_BUTTON_CONTAINER: "nwm-button-container",
	PRIORITY_LIST_ITEM: "priority-list-item",
	PRIORITY_NUMBER: "priority-number"
};

/**
 * Generates a loaded message for the plugin with the given version.
 * @param {string} version - The version of the plugin.
 * @returns {string} The formatted loaded message.
 */
export function getLoadedMessage(version: string): string
{
	return `${PLUGIN_NAME} v${version} loaded!`;
}

/**
 * Generates an unloaded message for the plugin with the given version.
 * @param {string} version - The version of the plugin.
 * @returns {string} The formatted unloaded message.
 */
export function getUnloadedMessage(version: string): string
{
	return `${PLUGIN_NAME} v${version} unloaded!`;
}

// ============================
//#region  KOFI SVG
// ============================

export const KOFI_SVG =
	'<?xml version="1.0" encoding="UTF-8"?><svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 185.71 29.2"><defs><style>.cls-1{fill:none;isolation:isolate;}</style></defs><image id="image0" class="cls-1" width="1081" height="170" transform="scale(.17)" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABDcAAACoCAYAAAD0MgVSAAAACXBIWXMAAEBwAABAcAH66ZoqAAAgAElEQVR4nO3dCXhU5b0/8G9s8Vb0NrFSLFYhAUWoLFFUCGoJm0vFELRXZCkE69pWCXpv69JKEPd7reDSulUTBK21lbBotSIkirIomrBU1AoBtQqiJq1gW/81/+c3J4czM8zMed8575k5Z+b7eZ55koGzz2HIfPN7f28BFLVXzKsCMAdAofsa7aqbBfY5Ao11vew3qOsqvyIJ1vWy36CuG3M9eG9kZb9BXJfvG7FPeW84eG/EPuW94eC9EfuU94aD94bzrdZ94WW/Xo7X6/phuzfy7T3D6/oZus78jOLw595oBlBdMG9+g87WXQ+lvWJeEYB6AMPUN8v/UNJelz9sxOIbh4P3hoPvG7FPeW84eG/EPuW94eC9EfuU94aD94bzLcONWAw3HAw3YvEzisPfe2NWwbz5NaoLpzyU9op5pQAa1Ko1YtZUX5T/ocQ+5Q8bsfjG4eC94eD7RuxT3hsO3huxT3lvOHhvxD7lveHgveF8y3AjFsMNB8ONWPyM4vD/3pAqjvKCefNb3RbcL+lurWEoaQQbRERERERERESeDZRcon3KpFK3DSUMN9orHpFg42EGG0RERERERESURUoBxz7hRnvFI6UdwQYRERERERERUbZJ4UV9+5RJRUrhRnvFI8UdQ1GIiIiIiIiIiIKiR6q8Ir5yo55DUYiIiIiIiIgogAa2T5k0J9Fh7Q032iseqekYy0JEREREREREFETT26dMKk8YbnQMR5nJl42IiIiIiIiIAq42/vDsyo19/oKIiIiIiIiIKIB6tE+ZVB0TbrRXPCLlHMP4ahERERERERFRSMSGGwCq+MoRERERERERUYhI9cbePEPCjal89YiIiIiIiIgoZPZWb8RPBUtEREREREREFAYyNWwxww0iIiIiIiIiCrNKMNwgIiIiIiIiohBjuEFEREREREREoRaZ/ZXhBhERERERERGFlvTdYLhBRERERERERGHGcIOIiIiIiIiIQq2U4QYRERERERERhVkRww0iIiIiIiIiCjWGG0REREREREQUagw3iIiIiIiIiCjUGG4QERERERERUagx3CAiIiIiIiKiUGO4QURERERERESh9tUgH3zLnl2o/+A1NLVtR8vnuxTWaM/A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"/></svg>';

// ============================
//#endregion
// ============================
