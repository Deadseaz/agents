/**
 * Subagent Deployer
 *
 * Manages deployment and lifecycle of subagents
 */

import type { DurableObjectState } from "@cloudflare/workers-types";
import type { SubagentInfo, Task } from "../core/master-agent";

export interface SubagentConfig {
  type: "worker" | "specialist" | "integration" | "monitor";
  name: string;
  domain?: string;
  resources?: {
    memory: number;
    cpu: number;
    timeout: number;
  };
}

export class SubagentDeployer {
  private activeSubagents: Map<string, SubagentInfo> = new Map();

  constructor(
    private ctx: DurableObjectState,
    private config: any
  ) {}

  /**
   * Load subagents from storage
   */
  async load(): Promise<void> {
    const stored = await this.ctx.storage.get<SubagentInfo[]>('subagents');
    if (stored) {
      for (const subagent of stored) {
        this.activeSubagents.set(subagent.id, subagent);
      }
    }
  }

  /**
   * Create a new subagent
   */
  async create(config: SubagentConfig): Promise<SubagentInfo> {
    const subagent: SubagentInfo = {
      id: crypto.randomUUID(),
      type: config.type,
      name: config.name,
      status: 'active',
      deployedAt: Date.now(),
      lastHeartbeat: Date.now()
    };

    this.activeSubagents.set(subagent.id, subagent);
    await this.persist();

    return subagent;
  }

  /**
   * Allocate subagent for task
   */
  async allocate(task: Task): Promise<SubagentInfo> {
    // Find available subagent or create new one
    for (const subagent of this.activeSubagents.values()) {
      if (subagent.status === 'idle') {
        subagent.status = 'active';
        subagent.currentTask = task.id;
        await this.persist();
        return subagent;
      }
    }

    // Create new subagent if under limit
    if (this.activeSubagents.size < this.config.maxSubagents) {
      return this.create({
        type: 'worker',
        name: `worker-${Date.now()}`
      });
    }

    throw new Error('No available subagents and at capacity');
  }

  /**
   * Release subagent
   */
  async release(subagentId: string): Promise<void> {
    const subagent = this.activeSubagents.get(subagentId);
    if (subagent) {
      subagent.status = 'idle';
      subagent.currentTask = undefined;
      await this.persist();
    }
  }

  /**
   * Remove subagent
   */
  async remove(subagentId: string): Promise<void> {
    this.activeSubagents.delete(subagentId);
    await this.persist();
  }

  /**
   * List all subagents
   */
  async list(): Promise<SubagentInfo[]> {
    return Array.from(this.activeSubagents.values());
  }

  /**
   * Health check all subagents
   */
  async healthCheck(): Promise<void> {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    for (const [id, subagent] of this.activeSubagents.entries()) {
      // Mark as error if no heartbeat for 5 minutes
      if (now - subagent.lastHeartbeat > timeout) {
        subagent.status = 'error';
      }
    }

    await this.persist();
  }

  /**
   * Update heartbeat
   */
  async heartbeat(subagentId: string): Promise<void> {
    const subagent = this.activeSubagents.get(subagentId);
    if (subagent) {
      subagent.lastHeartbeat = Date.now();
      if (subagent.status === 'error') {
        subagent.status = 'active';
      }
      await this.persist();
    }
  }

  /**
   * Handle subagent commands
   */
  async handleCommand(decision: any): Promise<any> {
    const { action, params } = decision;

    switch (action) {
      case 'create':
        return this.create(params);

      case 'list':
        return this.list();

      case 'remove':
        await this.remove(params.id);
        return { success: true };

      case 'health':
        await this.healthCheck();
        return { success: true };

      default:
        throw new Error(`Unknown subagent command: ${action}`);
    }
  }

  /**
   * Persist subagents to storage
   */
  private async persist(): Promise<void> {
    const subagents = Array.from(this.activeSubagents.values());
    await this.ctx.storage.put('subagents', subagents);
  }
}
