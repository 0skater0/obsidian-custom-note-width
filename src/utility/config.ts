import { getCharWidthSync } from "src/utility/utilities";

/**
 * Supported width unit types.
 */
export type WidthUnit = '%' | 'px' | 'ch';

/**
 * A width value with its associated unit.
 */
export interface WidthValue
{
	value: number;
	unit: WidthUnit;
}

/**
 * Configuration for a specific width unit.
 */
export interface UnitConfig
{
	min: number;
	max: number;
	step: number;
	defaultValue: number;
	label: string;
	maxInputLength: number;
}

/**
 * Default per-unit slider/input configurations.
 * Used as fallback when no custom ranges are configured.
 */
export const UNIT_CONFIGS: Record<WidthUnit, UnitConfig> = {
	'%': { min: 0, max: 100, step: 1, defaultValue: 50, label: '%', maxInputLength: 3 },
	'px': { min: 100, max: 4000, step: 10, defaultValue: 800, label: 'px', maxInputLength: 4 },
	'ch': { min: 10, max: 200, step: 1, defaultValue: 80, label: 'ch', maxInputLength: 3 },
};

/**
 * Absolute bounds for user-customizable ranges.
 * Users can adjust min/max within these limits.
 */
export const UNIT_ABSOLUTE_BOUNDS: Record<WidthUnit, { min: number; max: number }> = {
	'%': { min: 0, max: 100 },
	'px': { min: 1, max: 99999 },
	'ch': { min: 1, max: 9999 },
};

/**
 * Custom range per unit (user-configurable min and max).
 */
export interface UnitRange
{
	min: number;
	max: number;
}

/**
 * Ordered list of valid units for cycling through.
 */
export const VALID_UNITS: WidthUnit[] = ['%', 'px', 'ch'];

/**
 * Configuration constants for the application.
 */
export const CONFIG = {
	/** Delay in milliseconds for debounce operations. */
	DEBOUNCE_DELAY: 300,

	/** Threshold for hiding the slider. */
	SLIDER_HIDE_THRESHOLD: 0.954,
};

/**
 * Parses a raw YAML frontmatter value into a WidthValue.
 * Numbers are treated as percentages (backwards compatible).
 * Strings like "800px" or "80ch" or "50%" are parsed with their unit.
 * @param raw - The raw value from YAML frontmatter.
 * @param defaultUnit - The unit to use when raw is a plain number.
 * @returns A WidthValue, or null if the value cannot be parsed.
 */
export function parseWidthValue(raw: unknown, defaultUnit: WidthUnit): WidthValue | null
{
	if (raw === undefined || raw === null)
	{
		return null;
	}

	// Plain number → backwards compatible as percentage
	if (typeof raw === 'number' && !isNaN(raw))
	{
		return { value: raw, unit: '%' };
	}

	if (typeof raw === 'string')
	{
		const trimmed = raw.trim();
		const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(px|ch|%)$/);
		if (match)
		{
			const value = parseFloat(match[1]);
			const unit = match[2] as WidthUnit;
			return { value, unit };
		}

		// Try as plain number string → treat as defaultUnit
		const num = parseFloat(trimmed);
		if (!isNaN(num))
		{
			return { value: num, unit: defaultUnit };
		}
	}

	return null;
}

/**
 * Formats a WidthValue for storage in YAML frontmatter.
 * Percentages are stored as plain numbers (backwards compatible).
 * px and ch values are stored as strings like "800px" or "80ch".
 * @param wv - The WidthValue to format.
 * @returns A number (for %) or string (for px/ch) suitable for YAML.
 */
export function formatWidthForYaml(wv: WidthValue): number | string
{
	if (wv.unit === '%')
	{
		return wv.value;
	}
	return `${wv.value}${wv.unit}`;
}

/**
 * Calculates the CSS value string for --file-line-width from a WidthValue.
 * - % mode: Interpolates between charWidth and editorDiv width, outputs px.
 * - px mode: Uses value directly as px.
 * - ch mode: Uses CSS ch unit directly.
 * @param wv - The WidthValue to convert.
 * @param editorDiv - The editor DOM element (needed for % calculation).
 * @returns The CSS value string (e.g. "800px" or "80ch"), or null on error.
 */
export function widthValueToCss(wv: WidthValue, editorDiv: Element): string | null
{
	switch (wv.unit)
	{
		case '%':
		{
			const charWidth = getCharWidthSync();
			if (!charWidth)
			{
				return null;
			}
			const noteWidth = charWidth * (1 + (wv.value / 100) * (editorDiv.clientWidth / charWidth - 1));
			return `${noteWidth}px`;
		}
		case 'px':
			return `${wv.value}px`;
		case 'ch':
			return `${wv.value}ch`;
	}
}