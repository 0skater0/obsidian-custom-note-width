import Loki from "lokijs";
import { DATABASE_COLLECTION_NOTE_WIDTHS } from "src/utility/constants";

/**
 * Configuration interface for the Loki database.
 */
interface LokiDatabaseConfig
{
	/** Indicates whether the database should be autosaved. */
	autosave?: boolean;
	/** Interval (in milliseconds) for autosave operations. */
	autosaveInterval?: number;
}

/**
 * Represents a note with an ID and width property.
 */
interface Note
{
	/** Unique identifier for the note. */
	id: string;
	/** Width of the note. */
	width: number;
}

/**
 * Class responsible for managing operations on the Loki database.
 */
export default class LokiDatabase
{
	private db: Loki;
	private notesCollection: Loki.Collection;

	/**
	 * Constructs a new LokiDatabase instance.
	 * @param dbPath - Path to the Loki database file.
	 * @param config - Configuration options for the database.
	 */
	constructor(dbPath: string, config: LokiDatabaseConfig = { autosave: true, autosaveInterval: 4000 })
	{
		this.db = new Loki(dbPath, {
			autosave: config.autosave,
			autosaveInterval: config.autosaveInterval
		});
	}

	/**
	 * Initializes the database and collections.
	 */
	public async init(): Promise<void>
	{
		try
		{
			await this.loadDatabase();
			this.getOrCreateCollection(DATABASE_COLLECTION_NOTE_WIDTHS);
		} catch (error)
		{
			console.error(`Error initializing the database: ${error.message}`);
		}
	}

	/**
	 * Adds or updates a note with the given ID and width.
	 * @param note_id - Unique identifier for the note.
	 * @param note_width - Width of the note.
	 */
	public async addNote(note_id: string, note_width: number): Promise<void>
	{
		try
		{
			const existingNote = this.notesCollection.findOne({ id: note_id });
			if (existingNote)
			{
				this.updateNote(existingNote, note_width);
			} else
			{
				this.insertNote({ id: note_id, width: note_width });
			}
		} catch (error)
		{
			console.error(`Error adding note: ${error.message}`);
		}
	}

	/**
	 * Loads the Loki database into memory.
	 * @returns Promise that resolves when the database is loaded.
	 */
	private loadDatabase(): Promise<void>
	{
		return new Promise((resolve, reject) =>
		{
			this.db.loadDatabase({}, (error) =>
			{
				if (error)
				{
					reject(error);
				} else
				{
					resolve();
				}
			});
		});
	}

	/**
	 * Retrieves or creates a collection in the database.
	 * @param collectionName - Name of the collection.
	 */
	private getOrCreateCollection(collectionName: string): void
	{
		const collection = this.db.getCollection(collectionName);
		if (!collection)
		{
			this.notesCollection = this.db.addCollection(collectionName);
		} else
		{
			this.notesCollection = collection;
		}
	}

	/**
	 * Updates the width of an existing note.
	 * @param existingNote - The note to update.
	 * @param note_width - New width value for the note.
	 */
	public updateNote(existingNote: Note, note_width: number): void
	{
		if (existingNote.width !== note_width)
		{
			existingNote.width = note_width;
			this.notesCollection.update(existingNote);
		}
	}

	/**
	 * Inserts a new note into the collection.
	 * @param note - The note to insert.
	 */
	private insertNote(note: Note): void
	{
		this.notesCollection.insert(note);
	}

	/**
	 * Checks if a note with the given ID exists in the database.
	 * @param note_id - Unique identifier for the note.
	 * @returns True if the note exists, otherwise false.
	 */
	public noteExists(note_id: string): boolean
	{
		const note = this.notesCollection.findOne({ id: note_id });
		return note !== null;
	}

	/**
	 * Retrieves the width of a note with the given ID.
	 * @param note_id - Unique identifier for the note.
	 * @returns Width of the note or null if not found.
	 */
	public getNoteWidth(note_id: string): number | null
	{
		const note = this.notesCollection.findOne({ id: note_id });
		return note ? note.width : null;
	}

	/**
	 * Updates the width of all notes in the database.
	 * @param width - New width value for all notes.
	 */
	public async updateAllNotesWidth(width: number): Promise<void>
	{
		try
		{
			const allNotes = this.notesCollection.find();
			for (const note of allNotes)
			{
				note.width = width;
				this.notesCollection.update(note);
			}
		} catch (error)
		{
			console.error(`Error updating width for all notes: ${error.message}`);
		}
	}

	/**
	 * Removes the width of a note with the given ID.
	 * @param note_id - Unique identifier for the note.
	 */
	public removeNoteWidth(note_id: string): void
	{
		const note = this.notesCollection.findOne({ id: note_id });
		if (note)
		{
			this.notesCollection.remove(note);
		}
	}
}
