/**
 * State Manager
 *
 * Manages agent state with automatic persistence and broadcasting
 */

import type { DurableObjectState } from "@cloudflare/workers-types";
import type { AgentState, MasterAgentConfig, SubagentInfo } from "./master-agent";

export class StateManager {
  private state: AgentState | null = null;

  constructor(private ctx: DurableObjectState) {}

  /**
   * Load state from storage
   */
  async load(): Promise<AgentState> {
    if (this.state) {
      return this.state;
    }

    const stored = await this.ctx.storage.get<AgentState>("agent_state");

    if (stored) {
      this.state = stored;
      return stored;
    }

    // Initialize default state
    this.state = this.createDefaultState();
    await this.persist();

    return this.state;
  }

  /**
   * Get current state
   */
  async getState(): Promise<AgentState> {
    if (!this.state) {
      return await this.load();
    }
    return this.state;
  }

  /**
   * Update state
   */
  async update(updates: Partial<AgentState>): Promise<AgentState> {
    if (!this.state) {
      await this.load();
    }

    this.state = { ...this.state!, ...updates };
    await this.persist();

    return this.state!;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<MasterAgentConfig>): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.config = { ...this.state!.config, ...config };
    await this.persist();
  }

  /**
   * Add subagent
   */
  async addSubagent(subagent: SubagentInfo): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.subagents.push(subagent);
    this.state!.metrics.subagentsActive = this.state!.subagents.filter(
      s => s.status === "active"
    ).length;

    await this.persist();
  }

  /**
   * Update subagent status
   */
  async updateSubagent(id: string, updates: Partial<SubagentInfo>): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    const index = this.state!.subagents.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error(`Subagent not found: ${id}`);
    }

    this.state!.subagents[index] = { ...this.state!.subagents[index], ...updates };
    this.state!.metrics.subagentsActive = this.state!.subagents.filter(
      s => s.status === "active"
    ).length;

    await this.persist();
  }

  /**
   * Remove subagent
   */
  async removeSubagent(id: string): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.subagents = this.state!.subagents.filter(s => s.id !== id);
    this.state!.metrics.subagentsActive = this.state!.subagents.filter(
      s => s.status === "active"
    ).length;

    await this.persist();
  }

  /**
   * Update integration status
   */
  async updateIntegrationStatus(integration: keyof AgentState["integrationStatus"], status: boolean): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.integrationStatus[integration] = status;
    await this.persist();
  }

  /**
   * Update metrics
   */
  async updateMetrics(updates: Partial<AgentState["metrics"]>): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.metrics = { ...this.state!.metrics, ...updates };
    await this.persist();
  }

  /**
   * Increment completed tasks
   */
  async incrementCompleted(): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.metrics.tasksCompleted++;
    await this.persist();
  }

  /**
   * Increment failed tasks
   */
  async incrementFailed(): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.metrics.tasksFailed++;
    await this.persist();
  }

  /**
   * Set active tasks count
   */
  async setActiveTasks(count: number): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.metrics.tasksActive = count;
    await this.persist();
  }

  /**
   * Update knowledge base stats
   */
  async updateKnowledgeStats(updates: Partial<AgentState["knowledgeBase"]>): Promise<void> {
    if (!this.state) {
      await this.load();
    }

    this.state!.knowledgeBase = { ...this.state!.knowledgeBase, ...updates };
    await this.persist();
  }

  /**
   * Persist state to storage
   */
  private async persist(): Promise<void> {
    if (!this.state) return;

    await this.ctx.storage.put("agent_state", this.state);

    // Also store in SQL for querying
    await this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO cf_agents_state (key, value, updated_at)
       VALUES ('agent_state', ?, ?)`,
      JSON.stringify(this.state),
      Date.now()
    );
  }

  /**
   * Create default state
   */
  private createDefaultState(): AgentState {
    return {
      config: {
        byokEnabled: false,
        zeroTrustEnabled: true,
        autonomousMode: true,
        maxConcurrentTasks: 10,
        maxSubagents: 50,
        knowledgeBackupSchedule: "0 * * * *",
        subagentDefaults: {
          memory: 128,
          cpu: 1,
          timeout: 30000
        }
      },
      tasks: [],
      subagents: [],
      integrationStatus: {
        cloudflare: false,
        docker: false,
        mcpHub: false,
        lobechat: false,
        zapier: false,
        n8n: false,
        tailscale: false
      },
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        tasksActive: 0,
        subagentsActive: 0,
        lastHealthCheck: Date.now()
      },
      knowledgeBase: {
        entries: 0,
        lastBackup: 0,
        lastSync: 0
      }
    };
  }

  /**
   * Export state for backup
   */
  async export(): Promise<AgentState> {
    return await this.getState();
  }

  /**
   * Import state from backup
   */
  async import(state: AgentState): Promise<void> {
    this.state = state;
    await this.persist();
  }

  /**
   * Initialize state tables
   */
  static async initialize(ctx: DurableObjectState): Promise<void> {
    await ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS cf_agents_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }
}
