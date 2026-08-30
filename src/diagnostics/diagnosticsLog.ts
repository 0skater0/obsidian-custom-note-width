/**
 * In-memory diagnostics state: a bounded ring buffer of plugin log messages
 * plus a small set of runtime counters. Everything here is anonymous (no note
 * contents, file names or paths) and lives only for the current session; it is
 * read by the diagnostics report and never persisted on its own.
 */

/** Max length kept for any single log message after sanitising. */
const MAX_MESSAGE_LENGTH = 160;

/**
 * Removes anything path-like or file-name-like from a free-text log message so no
 * vault location or note name can ever reach the report. Applied to every entry
 * written to the ring buffer, regardless of source. Order matters: broad path
 * shapes are collapsed first, then quoted tokens, slash-bearing tokens and
 * file-name-like tokens. The result is capped to a short prefix.
 * @param text - The raw message.
 * @returns The sanitised, length-capped message.
 */
export function sanitizeText(text: string): string
{
	let out = text;
	// URLs (app://, file://, http(s)://)
	out = out.replace(/(?:app|file|https?):\/\/\S+/gi, "<path>");
	// UNC paths (\\server\share\...)
	out = out.replace(/\\\\[^\s"'<>]+/g, "<path>");
	// Windows drive paths (C:\... or C:/...)
	out = out.replace(/[A-Za-z]:[\\/][^\s"'<>]*/g, "<path>");
	// Quoted tokens (may hold a name or path)
	out = out.replace(/"[^"]*"/g, "<path>").replace(/'[^']*'/g, "<path>");
	// Any token containing a slash (POSIX paths, vault-relative paths like Folder/Note.md)
	out = out.replace(/\S*\/\S*/g, "<path>");
	// File-name-like tokens: word chars ending in a real extension (letter-led, 2-8 chars)
	out = out.replace(/[\w-]+\.[A-Za-z][A-Za-z0-9]{1,7}(?![\w])/g, "<path>");
	if (out.length > MAX_MESSAGE_LENGTH)
	{
		out = out.slice(0, MAX_MESSAGE_LENGTH);
	}
	return out;
}

/** Severity of a ring-buffer entry. `debug` is used for the width apply path. */
export type LogLevel = "debug" | "warn" | "error";

/** A single ring-buffer entry. */
export interface LogEntry
{
	/** ISO-8601 UTC timestamp. */
	time: string;
	level: LogLevel;
	message: string;
}

/** Why the last width apply stopped early, or null when it completed. */
export type ApplyAbortReason = "no-view" | "no-editor-element" | "no-char-width" | null;

/** Result of the most recent width apply attempt. */
export interface ApplyResult
{
	completed: boolean;
	abortReason: ApplyAbortReason;
}

/** Snapshot of the runtime counters, embedded in the diagnostics report. */
export interface RuntimeCounters
{
	events: { activeLeafChange: number; layoutChange: number; resize: number };
	applyCalls: number;
	lastApply: ApplyResult | null;
	consistencyChecks: number;
	consistencyMismatches: number;
}

/**
 * Event kinds the plugin counts. Mirrors the workspace events the
 * EventHandler subscribes to.
 */
export type CountedEvent = "activeLeafChange" | "layoutChange" | "resize";

export default class DiagnosticsLog
{
	/** Keep the last N messages; older ones are dropped. */
	private static readonly MAX_ENTRIES = 50;

	private entries: LogEntry[] = [];
	private counters: RuntimeCounters = {
		events: { activeLeafChange: 0, layoutChange: 0, resize: 0 },
		applyCalls: 0,
		lastApply: null,
		consistencyChecks: 0,
		consistencyMismatches: 0,
	};

	/** Signature of the last logged consistency mismatch, to avoid flooding the buffer. */
	private lastMismatchSignature: string | null = null;

	/**
	 * Appends a message to the ring buffer, trimming the oldest entries once
	 * the cap is reached.
	 * @param level - Severity of the message.
	 * @param message - Human-readable, path-free message.
	 */
	public log(level: LogLevel, message: string): void
	{
		this.entries.push({ time: new Date().toISOString(), level, message: sanitizeText(message) });
		if (this.entries.length > DiagnosticsLog.MAX_ENTRIES)
		{
			this.entries.splice(0, this.entries.length - DiagnosticsLog.MAX_ENTRIES);
		}
	}

	/** Increments the counter for a workspace event. */
	public recordEvent(kind: CountedEvent): void
	{
		this.counters.events[kind]++;
	}

	/**
	 * Records the outcome of a width apply. Successful applies only bump the
	 * counter; aborts additionally get a debug entry so the reason survives in
	 * the report without flooding the buffer on every event.
	 * @param result - The apply outcome.
	 */
	public recordApply(result: ApplyResult): void
	{
		this.counters.applyCalls++;
		this.counters.lastApply = result;
		if (!result.completed && result.abortReason)
		{
			this.log("debug", `width apply aborted: ${result.abortReason}`);
		}
	}

	/**
	 * Records a consistency check between the width the plugin set and the width
	 * actually computed on the sizer. A new mismatch is logged once (as warn);
	 * repeated identical mismatches only bump the counter.
	 * @param mismatch - Whether the computed width diverged from the set value.
	 * @param setWidth - The width the plugin applied (computed --file-line-width).
	 * @param actualWidth - The width actually in effect (computed max-width).
	 */
	public recordConsistency(mismatch: boolean, setWidth: string, actualWidth: string): void
	{
		this.counters.consistencyChecks++;
		if (!mismatch)
		{
			this.lastMismatchSignature = null;
			return;
		}
		this.counters.consistencyMismatches++;
		const signature = `${setWidth}|${actualWidth}`;
		if (signature !== this.lastMismatchSignature)
		{
			this.lastMismatchSignature = signature;
			this.log("warn", `width mismatch: set ${setWidth}, computed max-width ${actualWidth} (a theme or snippet is likely overriding it)`);
		}
	}

	/** Returns a copy of the current ring-buffer entries. */
	public getEntries(): LogEntry[]
	{
		return [...this.entries];
	}

	/** Returns a deep copy of the current runtime counters. */
	public getCounters(): RuntimeCounters
	{
		return {
			events: { ...this.counters.events },
			applyCalls: this.counters.applyCalls,
			lastApply: this.counters.lastApply ? { ...this.counters.lastApply } : null,
			consistencyChecks: this.counters.consistencyChecks,
			consistencyMismatches: this.counters.consistencyMismatches,
		};
	}
}
