/**
 * Manages and caches DOM elements for efficient querying.
 */
class DOMElementManager
{
	/** Cache to store queried DOM elements. */
	private cachedElements: Map<string, Element | null> = new Map<string, Element | null>();

	/**
	 * Searches for a DOM element using the provided selector and caches it.
	 * @param selector - CSS selector to query the element.
	 * @param context - Context (root element) in which to perform the query.
	 * @returns The queried DOM element or null if not found.
	 */
	public querySelector(selector: string, context: Document | Element = document): Element | null
	{
		const cacheKey = this.generateCacheKey(selector, context);

		// Check if the element is already in the cache.
		if (this.cachedElements.has(cacheKey))
		{
			return this.cachedElements.get(cacheKey) || null;
		}

		// If the element is not in the cache, find it in the DOM and store it.
		const element = context.querySelector(selector);
		this.cachedElements.set(cacheKey, element);
		return element;
	}

	/**
	 * Invalidates (removes) an element from the cache.
	 * @param selector - CSS selector of the element to invalidate.
	 */
	public invalidateCache(key: string): void
	{
		this.cachedElements.delete(key);
	}

	/**
	 * Clears the entire cache.
	 */
	public clearCache(): void
	{
		this.cachedElements.clear();
	}

	/**
	 * Generates a cache key based on the selector and context.
	 * @param selector - The CSS selector.
	 * @param context - The context in which to perform the query.
	 * @returns The generated cache key.
	 */
	public generateCacheKey(selector: string, context: Document | Element = document): string
	{
		return `${selector}-${context}`;
	}

}

// Exporting an instance of DOMElementManager so it can be used anywhere.
export const domElementManager = new DOMElementManager();
