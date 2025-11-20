/**
 * Task Queue System
 *
 * Persistent FIFO queue with priority support, retry logic, and dead letter queue
 */

import type { DurableObjectState } from "@cloudflare/workers-types";
import { nanoid } from "nanoid";

export interface Task {
  id: string;
  type: string;
  description: string;
  priority: number; // 1-10, higher = more important
  payload: any;
  status: "pending" | "in_progress" | "completed" | "failed";
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
  dependencies?: string[]; // IDs of tasks that must complete first
}

export class TaskQueue {
  constructor(private ctx: DurableObjectState) {}

  /**
   * Enqueue a new task
   */
  async enqueue(taskData: Omit<Task, "id" | "status" | "createdAt" | "retryCount">): Promise<Task> {
    const task: Task = {
      ...taskData,
      id: nanoid(),
      status: "pending",
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: taskData.maxRetries || 3
    };

    // Store in SQLite queue table
    await this.ctx.storage.sql.exec(
      `INSERT INTO cf_agents_queues (id, type, priority, payload, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      task.id,
      task.type,
      task.priority,
      JSON.stringify(task),
      task.status,
      task.createdAt
    );

    return task;
  }

  /**
   * Get pending tasks (ordered by priority then created time)
   */
  async getPending(limit: number = 10): Promise<Task[]> {
    const results = await this.ctx.storage.sql.exec(
      `SELECT payload FROM cf_agents_queues
       WHERE status = 'pending'
       ORDER BY priority DESC, created_at ASC
       LIMIT ?`,
      limit
    );

    return results.toArray().map((row: any) => JSON.parse(row.payload));
  }

  /**
   * Get task by ID
   */
  async getTask(id: string): Promise<Task | null> {
    const result = await this.ctx.storage.sql.exec(
      `SELECT payload FROM cf_agents_queues WHERE id = ?`,
      id
    );

    const rows = result.toArray();
    return rows.length > 0 ? JSON.parse(rows[0].payload) : null;
  }

  /**
   * Get recent tasks
   */
  async getRecent(limit: number = 50): Promise<Task[]> {
    const results = await this.ctx.storage.sql.exec(
      `SELECT payload FROM cf_agents_queues
       ORDER BY created_at DESC
       LIMIT ?`,
      limit
    );

    return results.toArray().map((row: any) => JSON.parse(row.payload));
  }

  /**
   * Update task status
   */
  async updateStatus(id: string, status: Task["status"], data?: Partial<Task>): Promise<void> {
    const task = await this.getTask(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    task.status = status;
    if (status === "in_progress" && !task.startedAt) {
      task.startedAt = Date.now();
    } else if ((status === "completed" || status === "failed") && !task.completedAt) {
      task.completedAt = Date.now();
    }

    if (data) {
      Object.assign(task, data);
    }

    await this.ctx.storage.sql.exec(
      `UPDATE cf_agents_queues SET payload = ?, status = ? WHERE id = ?`,
      JSON.stringify(task),
      status,
      id
    );
  }

  /**
   * Mark task as completed
   */
  async complete(id: string, result: any): Promise<void> {
    await this.updateStatus(id, "completed", { result });
  }

  /**
   * Mark task as failed
   */
  async fail(id: string, error: string): Promise<void> {
    const task = await this.getTask(id);
    if (!task) return;

    // Check if we should retry
    if (task.retryCount < task.maxRetries) {
      task.retryCount++;
      task.status = "pending";
      task.error = error;

      await this.ctx.storage.sql.exec(
        `UPDATE cf_agents_queues SET payload = ?, status = 'pending' WHERE id = ?`,
        JSON.stringify(task),
        id
      );
    } else {
      // Move to dead letter queue
      await this.updateStatus(id, "failed", { error });
      await this.moveToDLQ(task, error);
    }
  }

  /**
   * Move failed task to dead letter queue
   */
  private async moveToDLQ(task: Task, error: string): Promise<void> {
    const dlqEntry = {
      taskId: task.id,
      task,
      error,
      timestamp: Date.now()
    };

    await this.ctx.storage.put(`dlq:${task.id}`, dlqEntry);
  }

  /**
   * Get dead letter queue entries
   */
  async getDLQ(limit: number = 100): Promise<any[]> {
    const entries = await this.ctx.storage.list({ prefix: "dlq:", limit });
    return Array.from(entries.values());
  }

  /**
   * Check if task dependencies are satisfied
   */
  async areDependenciesSatisfied(task: Task): Promise<boolean> {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    for (const depId of task.dependencies) {
      const depTask = await this.getTask(depId);
      if (!depTask || depTask.status !== "completed") {
        return false;
      }
    }

    return true;
  }

  /**
   * Cleanup old completed tasks (older than 7 days)
   */
  async cleanup(daysToKeep: number = 7): Promise<number> {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    const result = await this.ctx.storage.sql.exec(
      `DELETE FROM cf_agents_queues
       WHERE status IN ('completed', 'failed')
       AND created_at < ?`,
      cutoff
    );

    return result.rowsWritten;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<any> {
    const results = await this.ctx.storage.sql.exec(
      `SELECT
         status,
         COUNT(*) as count,
         AVG(CASE WHEN completed_at IS NOT NULL
           THEN completed_at - created_at
           ELSE NULL END) as avg_duration
       FROM cf_agents_queues
       GROUP BY status`
    );

    const stats: any = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      avgDuration: 0
    };

    for (const row of results.toArray()) {
      stats[row.status] = row.count;
      if (row.avg_duration) {
        stats.avgDuration = row.avg_duration;
      }
    }

    return stats;
  }

  /**
   * Initialize queue tables
   */
  static async initialize(ctx: DurableObjectState): Promise<void> {
    await ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS cf_agents_queues (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        priority INTEGER NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_status_priority
        ON cf_agents_queues(status, priority DESC, created_at ASC);

      CREATE INDEX IF NOT EXISTS idx_created_at
        ON cf_agents_queues(created_at);
    `);
  }
}
