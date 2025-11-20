/**
 * Audit Logger
 *
 * Comprehensive logging system with structured logs and audit trail
 */

import type { DurableObjectState } from "@cloudflare/workers-types";

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: number;
  source: string;
  userId?: string;
  traceId?: string;
}

export class AuditLogger {
  private logBuffer: LogEntry[] = [];
  private flushInterval: number = 5000; // 5 seconds

  constructor(
    private ctx: DurableObjectState,
    private env: any
  ) {
    // Auto-flush logs periodically
    this.startAutoFlush();
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log("debug", message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log("info", message, data);
  }

  /**
   * Log warning
   */
  warn(message: string, data?: any): void {
    this.log("warn", message, data);
  }

  /**
   * Log error
   */
  error(message: string, data?: any): void {
    this.log("error", message, data);
  }

  /**
   * Log critical error
   */
  critical(message: string, data?: any): void {
    this.log("critical", message, data);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      level,
      message,
      data,
      timestamp: Date.now(),
      source: "master-control-agent",
      traceId: this.getTraceId()
    };

    // Add to buffer
    this.logBuffer.push(entry);

    // Console log for immediate visibility
    const logFn = level === "error" || level === "critical" ? console.error : console.log;
    logFn(`[${level.toUpperCase()}] ${message}`, data || "");

    // Flush if buffer is getting large
    if (this.logBuffer.length >= 100) {
      this.flush();
    }

    // For critical logs, flush immediately
    if (level === "critical") {
      this.flush();
    }
  }

  /**
   * Flush log buffer to storage
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Store in SQLite
      for (const entry of entries) {
        await this.ctx.storage.sql.exec(
          `INSERT INTO audit_logs (id, level, message, data, timestamp, source, trace_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          entry.id,
          entry.level,
          entry.message,
          JSON.stringify(entry.data),
          entry.timestamp,
          entry.source,
          entry.traceId || null
        );
      }

      // Also send to Analytics Engine if available
      if (this.env.ANALYTICS) {
        for (const entry of entries) {
          this.env.ANALYTICS.writeDataPoint({
            blobs: [
              entry.level,
              entry.message,
              entry.source
            ],
            doubles: [entry.timestamp],
            indexes: [entry.level]
          });
        }
      }

      // Write critical logs to R2 for long-term storage
      const criticalEntries = entries.filter(e => e.level === "critical" || e.level === "error");
      if (criticalEntries.length > 0 && this.env.R2) {
        const key = `logs/critical-${Date.now()}.json`;
        await this.env.R2.put(key, JSON.stringify(criticalEntries, null, 2));
      }

    } catch (error) {
      console.error("Failed to flush logs:", error);
    }
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    // Note: In Durable Objects, you'd use alarms for periodic tasks
    // For now, this is a placeholder
  }

  /**
   * Get recent logs
   */
  async getRecent(limit: number = 100, level?: LogLevel): Promise<LogEntry[]> {
    let query = `SELECT * FROM audit_logs`;
    const params: any[] = [];

    if (level) {
      query += ` WHERE level = ?`;
      params.push(level);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const results = await this.ctx.storage.sql.exec(query, ...params);

    return results.toArray().map((row: any) => ({
      id: row.id,
      level: row.level,
      message: row.message,
      data: JSON.parse(row.data || "{}"),
      timestamp: row.timestamp,
      source: row.source,
      traceId: row.trace_id
    }));
  }

  /**
   * Search logs
   */
  async search(query: string, limit: number = 100): Promise<LogEntry[]> {
    const results = await this.ctx.storage.sql.exec(
      `SELECT * FROM audit_logs
       WHERE message LIKE ? OR data LIKE ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      `%${query}%`,
      `%${query}%`,
      limit
    );

    return results.toArray().map((row: any) => ({
      id: row.id,
      level: row.level,
      message: row.message,
      data: JSON.parse(row.data || "{}"),
      timestamp: row.timestamp,
      source: row.source,
      traceId: row.trace_id
    }));
  }

  /**
   * Get logs by trace ID
   */
  async getByTrace(traceId: string): Promise<LogEntry[]> {
    const results = await this.ctx.storage.sql.exec(
      `SELECT * FROM audit_logs
       WHERE trace_id = ?
       ORDER BY timestamp ASC`,
      traceId
    );

    return results.toArray().map((row: any) => ({
      id: row.id,
      level: row.level,
      message: row.message,
      data: JSON.parse(row.data || "{}"),
      timestamp: row.timestamp,
      source: row.source,
      traceId: row.trace_id
    }));
  }

  /**
   * Get log statistics
   */
  async getStats(): Promise<any> {
    const results = await this.ctx.storage.sql.exec(
      `SELECT
         level,
         COUNT(*) as count,
         MIN(timestamp) as first_log,
         MAX(timestamp) as last_log
       FROM audit_logs
       GROUP BY level`
    );

    const stats: any = {
      total: 0,
      byLevel: {}
    };

    for (const row of results.toArray()) {
      stats.total += row.count;
      stats.byLevel[row.level] = {
        count: row.count,
        firstLog: new Date(row.first_log).toISOString(),
        lastLog: new Date(row.last_log).toISOString()
      };
    }

    return stats;
  }

  /**
   * Cleanup old logs (older than retention period)
   */
  async cleanup(retentionDays: number = 30): Promise<number> {
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    // Archive to R2 before deleting
    if (this.env.R2) {
      const oldLogs = await this.ctx.storage.sql.exec(
        `SELECT * FROM audit_logs WHERE timestamp < ?`,
        cutoff
      );

      if (oldLogs.toArray().length > 0) {
        const key = `logs/archive-${new Date().toISOString()}.json`;
        await this.env.R2.put(key, JSON.stringify(oldLogs.toArray(), null, 2));
      }
    }

    // Delete old logs
    const result = await this.ctx.storage.sql.exec(
      `DELETE FROM audit_logs WHERE timestamp < ?`,
      cutoff
    );

    return result.rowsWritten;
  }

  /**
   * Get current trace ID from context
   */
  private getTraceId(): string | undefined {
    // In production, this would extract trace ID from AsyncLocalStorage or headers
    return undefined;
  }

  /**
   * Initialize audit log tables
   */
  static async initialize(ctx: DurableObjectState): Promise<void> {
    await ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        timestamp INTEGER NOT NULL,
        source TEXT NOT NULL,
        trace_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_level ON audit_logs(level);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_trace_id ON audit_logs(trace_id);
    `);
  }
}
