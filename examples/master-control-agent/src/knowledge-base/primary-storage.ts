/**
 * Knowledge Base - Primary Storage
 *
 * Persistent storage using Durable Objects SQLite, KV, and R2
 */

import type { DurableObjectState } from "@cloudflare/workers-types";

export interface KnowledgeEntry {
  id: string;
  type: string;
  content: string;
  metadata: any;
  embedding?: number[];
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface QueryResult {
  entries: KnowledgeEntry[];
  total: number;
}

export class KnowledgeBase {
  constructor(
    private ctx: DurableObjectState,
    private env: any // Environment bindings (KV, R2, Vectorize)
  ) {}

  /**
   * Store knowledge entry
   */
  async store(entry: Omit<KnowledgeEntry, "id" | "createdAt" | "updatedAt">): Promise<KnowledgeEntry> {
    const id = crypto.randomUUID();
    const now = Date.now();

    const fullEntry: KnowledgeEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now
    };

    // Store in SQLite for querying
    await this.ctx.storage.sql.exec(
      `INSERT INTO knowledge_base (id, type, content, metadata, created_at, updated_at, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      entry.type,
      entry.content,
      JSON.stringify(entry.metadata),
      now,
      now,
      JSON.stringify(entry.tags)
    );

    // Store embedding in Vectorize if available
    if (entry.embedding && this.env.VECTORIZE) {
      await this.env.VECTORIZE.insert([{
        id,
        values: entry.embedding,
        metadata: { type: entry.type, tags: entry.tags }
      }]);
    }

    // Store full content in KV for fast retrieval
    await this.env.KV.put(`knowledge:${id}`, JSON.stringify(fullEntry));

    return fullEntry;
  }

  /**
   * Query knowledge base
   */
  async query(query: string, context?: any): Promise<QueryResult> {
    // Simple text search in SQLite
    const results = await this.ctx.storage.sql.exec(
      `SELECT * FROM knowledge_base
       WHERE content LIKE ?
       ORDER BY updated_at DESC
       LIMIT 50`,
      `%${query}%`
    );

    const entries: KnowledgeEntry[] = [];
    for (const row of results.toArray()) {
      entries.push({
        id: row.id,
        type: row.type,
        content: row.content,
        metadata: JSON.parse(row.metadata),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tags: JSON.parse(row.tags)
      });
    }

    return {
      entries,
      total: entries.length
    };
  }

  /**
   * Semantic search using vector embeddings
   */
  async semanticSearch(queryEmbedding: number[], topK: number = 10): Promise<KnowledgeEntry[]> {
    if (!this.env.VECTORIZE) {
      console.warn("Vectorize not available, falling back to text search");
      return [];
    }

    // Query Vectorize
    const results = await this.env.VECTORIZE.query(queryEmbedding, {
      topK,
      returnMetadata: true
    });

    // Fetch full entries from KV
    const entries: KnowledgeEntry[] = [];
    for (const match of results.matches) {
      const entry = await this.env.KV.get(`knowledge:${match.id}`, "json");
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Get entry by ID
   */
  async get(id: string): Promise<KnowledgeEntry | null> {
    const entry = await this.env.KV.get(`knowledge:${id}`, "json");
    return entry;
  }

  /**
   * Update entry
   */
  async update(id: string, updates: Partial<KnowledgeEntry>): Promise<void> {
    const entry = await this.get(id);
    if (!entry) {
      throw new Error(`Entry not found: ${id}`);
    }

    const updated = {
      ...entry,
      ...updates,
      updatedAt: Date.now()
    };

    // Update SQLite
    await this.ctx.storage.sql.exec(
      `UPDATE knowledge_base
       SET content = ?, metadata = ?, updated_at = ?, tags = ?
       WHERE id = ?`,
      updated.content,
      JSON.stringify(updated.metadata),
      updated.updatedAt,
      JSON.stringify(updated.tags),
      id
    );

    // Update KV
    await this.env.KV.put(`knowledge:${id}`, JSON.stringify(updated));

    // Update Vectorize if embedding changed
    if (updates.embedding && this.env.VECTORIZE) {
      await this.env.VECTORIZE.upsert([{
        id,
        values: updates.embedding,
        metadata: { type: updated.type, tags: updated.tags }
      }]);
    }
  }

  /**
   * Delete entry
   */
  async delete(id: string): Promise<void> {
    // Delete from SQLite
    await this.ctx.storage.sql.exec(
      `DELETE FROM knowledge_base WHERE id = ?`,
      id
    );

    // Delete from KV
    await this.env.KV.delete(`knowledge:${id}`);

    // Delete from Vectorize
    if (this.env.VECTORIZE) {
      await this.env.VECTORIZE.deleteByIds([id]);
    }
  }

  /**
   * Learn from execution
   */
  async learn(data: any): Promise<void> {
    // Store execution history as knowledge
    await this.store({
      type: "execution_history",
      content: JSON.stringify(data),
      metadata: {
        command: data.command,
        success: data.success,
        timestamp: Date.now()
      },
      tags: ["execution", data.success ? "success" : "failure"]
    });
  }

  /**
   * Backup knowledge base to R2
   */
  async backup(): Promise<void> {
    if (!this.env.R2) {
      console.warn("R2 not available, skipping backup");
      return;
    }

    // Export all entries
    const entries = await this.exportAll();

    // Upload to R2
    const timestamp = new Date().toISOString();
    const key = `backups/knowledge-base-${timestamp}.json`;

    await this.env.R2.put(key, JSON.stringify(entries, null, 2));

    console.log(`Knowledge base backed up to ${key}`);
  }

  /**
   * Export all entries
   */
  async exportAll(): Promise<KnowledgeEntry[]> {
    const results = await this.ctx.storage.sql.exec(
      `SELECT * FROM knowledge_base ORDER BY created_at ASC`
    );

    const entries: KnowledgeEntry[] = [];
    for (const row of results.toArray()) {
      entries.push({
        id: row.id,
        type: row.type,
        content: row.content,
        metadata: JSON.parse(row.metadata),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tags: JSON.parse(row.tags)
      });
    }

    return entries;
  }

  /**
   * Import entries from backup
   */
  async importEntries(entries: KnowledgeEntry[]): Promise<void> {
    for (const entry of entries) {
      await this.store(entry);
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<any> {
    const results = await this.ctx.storage.sql.exec(
      `SELECT
         type,
         COUNT(*) as count,
         AVG(LENGTH(content)) as avg_size
       FROM knowledge_base
       GROUP BY type`
    );

    const stats: any = {
      total: 0,
      byType: {}
    };

    for (const row of results.toArray()) {
      stats.total += row.count;
      stats.byType[row.type] = {
        count: row.count,
        avgSize: row.avg_size
      };
    }

    return stats;
  }

  /**
   * Handle knowledge commands
   */
  async handleCommand(decision: any): Promise<any> {
    switch (decision.action) {
      case "query":
        return this.query(decision.params.query, decision.params.context);

      case "store":
        return this.store(decision.params.entry);

      case "backup":
        await this.backup();
        return { success: true };

      case "stats":
        return this.getStats();

      default:
        throw new Error(`Unknown knowledge command: ${decision.action}`);
    }
  }

  /**
   * Initialize knowledge base tables
   */
  static async initialize(ctx: DurableObjectState): Promise<void> {
    await ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        tags TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_type ON knowledge_base(type);
      CREATE INDEX IF NOT EXISTS idx_created_at ON knowledge_base(created_at);
      CREATE INDEX IF NOT EXISTS idx_updated_at ON knowledge_base(updated_at);
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_base_fts
        USING fts5(content, content=knowledge_base, content_rowid=rowid);
    `);
  }
}
