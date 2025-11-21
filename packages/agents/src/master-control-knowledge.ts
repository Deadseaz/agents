import { callable } from "./index";

/**
 * Knowledge base entry structure
 */
export type KnowledgeEntry = {
  /** Unique identifier for the entry */
  id: string;
  /** Title of the entry */
  title: string;
  /** Content of the entry */
  content: string;
  /** Tags associated with the entry */
  tags: string[];
  /** Timestamp when the entry was created */
  createdAt: number;
  /** Timestamp when the entry was last updated */
  updatedAt: number;
  /** Metadata associated with the entry */
  metadata: Record<string, unknown>;
};

/**
 * Knowledge base query parameters
 */
export type KnowledgeQuery = {
  /** Search terms */
  query?: string;
  /** Tags to filter by */
  tags?: string[];
  /** Maximum number of results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
};

/**
 * Persistent knowledge base for the Master Control Agent
 */
export class MasterControlKnowledgeBase {
  /** In-memory storage for knowledge entries (in a real implementation, this would use durable storage) */
  private entries: Map<string, KnowledgeEntry> = new Map();

  /** Index for fast tag lookups */
  private tagIndex: Map<string, Set<string>> = new Map();

  /**
   * Generate a unique ID (simplified version without nanoid)
   */
  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Add a new entry to the knowledge base
   */
  @callable({ description: "Add a new entry to the knowledge base" })
  async addEntry(params: {
    title: string;
    content: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string; entryId?: string }> {
    try {
      const entryId = this.generateId();
      const now = Date.now();

      const entry: KnowledgeEntry = {
        id: entryId,
        title: params.title,
        content: params.content,
        tags: params.tags || [],
        createdAt: now,
        updatedAt: now,
        metadata: params.metadata || {}
      };

      // Store the entry
      this.entries.set(entryId, entry);

      // Update tag index
      for (const tag of entry.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(entryId);
      }

      return {
        success: true,
        message: "Entry added successfully",
        entryId
      };
    } catch (error) {
      console.error("Error adding knowledge entry:", error);
      return {
        success: false,
        message: "Failed to add entry to knowledge base"
      };
    }
  }

  /**
   * Update an existing entry in the knowledge base
   */
  @callable({ description: "Update an existing entry in the knowledge base" })
  async updateEntry(params: {
    entryId: string;
    title?: string;
    content?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const entry = this.entries.get(params.entryId);
      if (!entry) {
        return {
          success: false,
          message: "Entry not found"
        };
      }

      // Remove old tags from index
      for (const tag of entry.tags) {
        const tagSet = this.tagIndex.get(tag);
        if (tagSet) {
          tagSet.delete(params.entryId);
          if (tagSet.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }

      // Update entry fields
      if (params.title !== undefined) entry.title = params.title;
      if (params.content !== undefined) entry.content = params.content;
      if (params.tags !== undefined) entry.tags = params.tags;
      if (params.metadata !== undefined) entry.metadata = params.metadata;
      entry.updatedAt = Date.now();

      // Store updated entry
      this.entries.set(params.entryId, entry);

      // Update tag index with new tags
      for (const tag of entry.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(params.entryId);
      }

      return {
        success: true,
        message: "Entry updated successfully"
      };
    } catch (error) {
      console.error("Error updating knowledge entry:", error);
      return {
        success: false,
        message: "Failed to update entry in knowledge base"
      };
    }
  }

  /**
   * Delete an entry from the knowledge base
   */
  @callable({ description: "Delete an entry from the knowledge base" })
  async deleteEntry(params: {
    entryId: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const entry = this.entries.get(params.entryId);
      if (!entry) {
        return {
          success: false,
          message: "Entry not found"
        };
      }

      // Remove tags from index
      for (const tag of entry.tags) {
        const tagSet = this.tagIndex.get(tag);
        if (tagSet) {
          tagSet.delete(params.entryId);
          if (tagSet.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }

      // Delete the entry
      this.entries.delete(params.entryId);

      return {
        success: true,
        message: "Entry deleted successfully"
      };
    } catch (error) {
      console.error("Error deleting knowledge entry:", error);
      return {
        success: false,
        message: "Failed to delete entry from knowledge base"
      };
    }
  }

  /**
   * Search the knowledge base
   */
  @callable({ description: "Search the knowledge base" })
  async searchEntries(params: KnowledgeQuery): Promise<{
    success: boolean;
    message: string;
    entries?: KnowledgeEntry[];
    total?: number;
  }> {
    try {
      let filteredEntries: KnowledgeEntry[] = [];

      // If tags are specified, filter by tags first
      if (params.tags && params.tags.length > 0) {
        const entryIds = new Set<string>();
        for (const tag of params.tags) {
          const tagEntries = this.tagIndex.get(tag);
          if (tagEntries) {
            for (const entryId of tagEntries) {
              entryIds.add(entryId);
            }
          }
        }

        // Get entries that match all specified tags
        for (const entryId of entryIds) {
          const entry = this.entries.get(entryId);
          if (entry && params.tags.every((tag) => entry.tags.includes(tag))) {
            filteredEntries.push(entry);
          }
        }
      } else {
        // If no tags specified, get all entries
        filteredEntries = Array.from(this.entries.values());
      }

      // If query is specified, filter by search terms
      if (params.query) {
        const query = params.query.toLowerCase();
        filteredEntries = filteredEntries.filter(
          (entry) =>
            entry.title.toLowerCase().includes(query) ||
            entry.content.toLowerCase().includes(query)
        );
      }

      // Sort by most recently updated
      filteredEntries.sort((a, b) => b.updatedAt - a.updatedAt);

      // Apply pagination
      const limit = params.limit || 10;
      const offset = params.offset || 0;
      const paginatedEntries = filteredEntries.slice(offset, offset + limit);

      return {
        success: true,
        message: "Search completed successfully",
        entries: paginatedEntries,
        total: filteredEntries.length
      };
    } catch (error) {
      console.error("Error searching knowledge base:", error);
      return {
        success: false,
        message: "Failed to search knowledge base"
      };
    }
  }

  /**
   * Get a specific entry by ID
   */
  @callable({ description: "Get a specific entry by ID" })
  async getEntry(params: { entryId: string }): Promise<{
    success: boolean;
    message: string;
    entry?: KnowledgeEntry;
  }> {
    try {
      const entry = this.entries.get(params.entryId);
      if (!entry) {
        return {
          success: false,
          message: "Entry not found"
        };
      }

      return {
        success: true,
        message: "Entry retrieved successfully",
        entry
      };
    } catch (error) {
      console.error("Error retrieving knowledge entry:", error);
      return {
        success: false,
        message: "Failed to retrieve entry from knowledge base"
      };
    }
  }

  /**
   * Get statistics about the knowledge base
   */
  @callable({ description: "Get statistics about the knowledge base" })
  async getStatistics(): Promise<{
    success: boolean;
    message: string;
    stats?: {
      totalEntries: number;
      totalTags: number;
      mostUsedTags: { tag: string; count: number }[];
    };
  }> {
    try {
      const totalEntries = this.entries.size;
      const totalTags = this.tagIndex.size;

      // Get most used tags
      const tagCounts: { tag: string; count: number }[] = [];
      for (const [tag, entryIds] of this.tagIndex.entries()) {
        tagCounts.push({ tag, count: entryIds.size });
      }

      // Sort by count descending
      tagCounts.sort((a, b) => b.count - a.count);

      // Get top 10 most used tags
      const mostUsedTags = tagCounts.slice(0, 10);

      return {
        success: true,
        message: "Statistics retrieved successfully",
        stats: {
          totalEntries,
          totalTags,
          mostUsedTags
        }
      };
    } catch (error) {
      console.error("Error retrieving knowledge base statistics:", error);
      return {
        success: false,
        message: "Failed to retrieve knowledge base statistics"
      };
    }
  }
}
