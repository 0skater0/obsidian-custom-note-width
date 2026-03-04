/**
 * Internationalization module.
 * Detects Obsidian's display language via moment.locale() and provides
 * translated strings. Supported locales: en, de, en-gb.
 * Supports an explicit locale override via setLocaleOverride().
 */

/**
 * Translation dictionary type — flat key-value map.
 */
interface Translations
{
	[key: string]: string;
}

/**
 * Represents a selectable locale option for the settings UI.
 */
interface LocaleOption
{
	value: string;
	label: string;
}

/** Explicit locale override. When set (non-null), t() uses this instead of moment.locale(). */
let localeOverride: string | null = null;

/**
 * Supported locale options for the language dropdown.
 */
export const SUPPORTED_LOCALES: LocaleOption[] = [
	{ value: "auto", label: "Auto" },
	{ value: "en", label: "English" },
	{ value: "de", label: "Deutsch" },
];

/**
 * Sets an explicit locale override. Pass null to revert to auto-detection.
 * @param locale - The locale to use, or null for auto-detection.
 */
export function setLocaleOverride(locale: string | null): void
{
	localeOverride = locale;
}

// ============================
// English (default)
// ============================

const en: Translations = {
	// Buttons
	"button.cancel": "Cancel",
	"button.apply": "Apply",

	// Commands
	"command.change_note_width.name": "Change the width of the open note",
	"command.change_note_width.modal_title": "Enter the width for the open note",
	"command.change_default_width.name": "Change the default note width",
	"command.change_default_width.modal_title": "Enter the default note width",
	"command.change_all_width.name": "Change the width for all notes",
	"command.change_all_width.modal_title": "Enter the width for all notes",

	// Notices
	"notice.slider_too_large": "Slider too large!",

	// Progress modals
	"progress.changing_keys": "Changing all YAML-Frontmatter keys...",
	"progress.changing_values": "Changing the value for all YAML-Frontmatter's...",

	// Donation
	"donation.disclaimer": "Disclaimer: Please note that clicking the image will open a link in your browser.",

	// Settings — Language
	"settings.language.name": "Language",
	"settings.language.desc": "Choose the plugin language. 'Auto' uses Obsidian's language.",

	// Settings — UI
	"settings.enable_slider.name": "Enable slider",
	"settings.enable_slider.desc": "Toggle to enable/disable the slider.",
	"settings.slider_width.name": "Slider width",
	"settings.slider_width.desc": "Change the width of the slider.",
	"settings.enable_text_field.name": "Enable text field",
	"settings.enable_text_field.desc": "Enable to change the width via text field input.",

	// Settings — Width
	"settings.default_width_unit.name": "Default width unit",
	"settings.default_width_unit.desc": "Choose the unit for the default width (%, px, or ch).",
	"settings.default_width.name": "Default width",
	"settings.default_width.desc": "Set the default width ({{unit}}) for notes without a per-note width. Range: {{min}}\u2013{{max}}",

	// Settings — Range
	"settings.unit_range.name": "{{unit}} range",
	"settings.unit_range.desc": "Min and max for {{unit}} unit (absolute bounds: {{min}}\u2013{{max}}).",

	// Settings — Per-Note
	"settings.enable_per_note.name": "Enable per-note width",
	"settings.enable_per_note.desc": "Enable to set individual widths per note via YAML frontmatter.",
	"settings.yaml_key.name": "YAML front matter key",
	"settings.yaml_key.desc": "Specify the YAML front matter key to use for setting the custom width of the editor.",

	// Settings — Code Block
	"settings.enable_code_block.name": "Enable code block width",
	"settings.enable_code_block.desc": "Control the width of code blocks independently from the editor width.",
	"settings.code_block_unit.name": "Code block width unit",
	"settings.code_block_unit.desc": "Choose the unit for code block width (%, px, or ch).",
	"settings.code_block_width.name": "Code block width",
	"settings.code_block_width.desc": "Set the width ({{unit}}) for code blocks. Range: {{min}}\u2013{{max}}",
	"settings.reading_mode.name": "Reading mode",
	"settings.reading_mode.desc": "Apply code block width in reading/preview mode.",
	"settings.source_mode.name": "Source mode",
	"settings.source_mode.desc": "Apply code block width in source/edit mode.",
	"settings.live_preview.name": "Live preview mode",
	"settings.live_preview.desc": "Apply code block width in live preview mode.",

	// Plugin info
	"plugin.loaded": "{{name}} v{{version}} loaded!",
	"plugin.unloaded": "{{name}} v{{version}} unloaded!",
};

// ============================
// German
// ============================

const de: Translations = {
	// Buttons
	"button.cancel": "Abbrechen",
	"button.apply": "Anwenden",

	// Commands
	"command.change_note_width.name": "Breite der ge\u00F6ffneten Notiz \u00E4ndern",
	"command.change_note_width.modal_title": "Breite f\u00FCr die ge\u00F6ffnete Notiz eingeben",
	"command.change_default_width.name": "Standard-Notizbreite \u00E4ndern",
	"command.change_default_width.modal_title": "Standard-Notizbreite eingeben",
	"command.change_all_width.name": "Breite f\u00FCr alle Notizen \u00E4ndern",
	"command.change_all_width.modal_title": "Breite f\u00FCr alle Notizen eingeben",

	// Notices
	"notice.slider_too_large": "Schieberegler zu gro\u00DF!",

	// Progress modals
	"progress.changing_keys": "YAML-Frontmatter-Schl\u00FCssel werden ge\u00E4ndert\u2026",
	"progress.changing_values": "YAML-Frontmatter-Werte werden ge\u00E4ndert\u2026",

	// Donation
	"donation.disclaimer": "Hinweis: Durch Klicken auf das Bild wird ein Link in Ihrem Browser ge\u00F6ffnet.",

	// Settings — Language
	"settings.language.name": "Sprache",
	"settings.language.desc": "Sprache des Plugins w\u00E4hlen. \u201EAuto\u201C \u00FCbernimmt die Obsidian-Sprache.",

	// Settings — UI
	"settings.enable_slider.name": "Schieberegler aktivieren",
	"settings.enable_slider.desc": "Schieberegler ein-/ausschalten.",
	"settings.slider_width.name": "Schieberegler-Breite",
	"settings.slider_width.desc": "Breite des Schiebereglers \u00E4ndern.",
	"settings.enable_text_field.name": "Textfeld aktivieren",
	"settings.enable_text_field.desc": "Breite per Textfeld-Eingabe \u00E4ndern.",

	// Settings — Width
	"settings.default_width_unit.name": "Standard-Breiteneinheit",
	"settings.default_width_unit.desc": "Einheit f\u00FCr die Standardbreite w\u00E4hlen (%, px oder ch).",
	"settings.default_width.name": "Standardbreite",
	"settings.default_width.desc": "Standardbreite ({{unit}}) f\u00FCr Notizen ohne individuelle Breite festlegen. Bereich: {{min}}\u2013{{max}}",

	// Settings — Range
	"settings.unit_range.name": "{{unit}}-Bereich",
	"settings.unit_range.desc": "Min und Max f\u00FCr die Einheit {{unit}} (absolute Grenzen: {{min}}\u2013{{max}}).",

	// Settings — Per-Note
	"settings.enable_per_note.name": "Individuelle Notizbreite",
	"settings.enable_per_note.desc": "Individuelle Breite pro Notiz per YAML-Frontmatter setzen.",
	"settings.yaml_key.name": "YAML-Frontmatter-Schl\u00FCssel",
	"settings.yaml_key.desc": "YAML-Frontmatter-Schl\u00FCssel f\u00FCr die individuelle Breite festlegen.",

	// Settings — Code Block
	"settings.enable_code_block.name": "Codeblock-Breite aktivieren",
	"settings.enable_code_block.desc": "Breite von Codebl\u00F6cken unabh\u00E4ngig von der Editorbreite steuern.",
	"settings.code_block_unit.name": "Codeblock-Breiteneinheit",
	"settings.code_block_unit.desc": "Einheit f\u00FCr die Codeblock-Breite w\u00E4hlen (%, px oder ch).",
	"settings.code_block_width.name": "Codeblock-Breite",
	"settings.code_block_width.desc": "Breite ({{unit}}) f\u00FCr Codebl\u00F6cke festlegen. Bereich: {{min}}\u2013{{max}}",
	"settings.reading_mode.name": "Lesemodus",
	"settings.reading_mode.desc": "Codeblock-Breite im Lese-/Vorschaumodus anwenden.",
	"settings.source_mode.name": "Quellmodus",
	"settings.source_mode.desc": "Codeblock-Breite im Quell-/Bearbeitungsmodus anwenden.",
	"settings.live_preview.name": "Live-Vorschau",
	"settings.live_preview.desc": "Codeblock-Breite im Live-Vorschaumodus anwenden.",

	// Plugin info
	"plugin.loaded": "{{name}} v{{version}} geladen!",
	"plugin.unloaded": "{{name}} v{{version}} entladen!",
};

// ============================
// Locale registry
// ============================

const translations: Record<string, Translations> = {
	en,
	de,
	"en-gb": en, // en-GB uses English translations
};

/**
 * Resolves a locale string to a supported translation dictionary key.
 * Tries exact match first, then language prefix, then falls back to 'en'.
 * @param locale - The raw locale string (e.g. "de", "en-gb", "de-at").
 * @returns The resolved locale key.
 */
function resolveLocale(locale: string): string
{
	const lower = locale.toLowerCase();

	// Exact match
	if (translations[lower])
	{
		return lower;
	}

	// Language prefix (e.g. "de-at" → "de")
	const prefix = lower.split("-")[0];
	if (translations[prefix])
	{
		return prefix;
	}

	return "en";
}

/**
 * Returns a translated string for the given key, using Obsidian's display language.
 * Supports parameter interpolation with {{param}} placeholders.
 * Falls back to English if the current locale has no translation for the key.
 * @param key - The translation key (e.g. "settings.enable_slider.name").
 * @param params - Optional parameters to interpolate into the string.
 * @returns The translated string.
 */
export function t(key: string, params?: Record<string, string | number>): string
{
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const rawLocale = localeOverride ?? (window as any).moment?.locale?.() ?? "en";
	const locale = resolveLocale(rawLocale);
	const dict = translations[locale];
	let text = dict[key] ?? en[key] ?? key;

	if (params)
	{
		for (const [param, value] of Object.entries(params))
		{
			text = text.split(`{{${param}}}`).join(String(value));
		}
	}

	return text;
}
