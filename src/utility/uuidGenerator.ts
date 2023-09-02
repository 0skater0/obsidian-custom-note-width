import LokiDatabase from "src/utility/lokiDatabase";
import { UUID_FORMAT } from "src/utility/constants";

/**
 * Class responsible for generating unique UUIDs.
 */
export default class UUIDGenerator
{

	/**
	 * Generates a UUID version 4.
	 * @returns A UUID string.
	 */
	private static generateUUIDV4(): string
	{
		return UUID_FORMAT.replace(/[xy]/g, function (c)
		{
			let r = Math.random() * 16 | 0,
				v = c === "x" ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}

	/**
	 * Generates a unique UUID ensuring it's not already stored in the provided database.
	 * @param database - The LokiDatabase instance to check for existing UUIDs.
	 * @returns A unique UUID string.
	 */
	public static getUniqueUUID(database: LokiDatabase): string
	{
		let generatedUUID = this.generateUUIDV4();
		while (database.noteExists(generatedUUID))
		{
			generatedUUID = this.generateUUIDV4();
		}
		return generatedUUID;
	}

}
