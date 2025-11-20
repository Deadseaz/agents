/**
 * Master Control Agent
 *
 * Autonomous agent capable of managing infrastructure, services, and subagents
 * through natural language commands with comprehensive security and audit trail.
 */

import { Agent } from "@cloudflare/agents";
import type { Connection, ConnectionContext } from "@cloudflare/agents";
import { streamText, generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { TaskQueue } from "./task-queue";
import type { StateManager } from "./state-manager";
import type { DecisionEngine } from "./decision-engine";
import type { AIGatewayManager } from "../security/ai-gateway";
import type { ZeroTrustAuth } from "../security/zero-trust";
import type { PromptInjectionDetector } from "../security/prompt-injection";
import type { KnowledgeBase } from "../knowledge-base/primary-storage";
import type { CloudflareIntegration } from "../integrations/cloudflare/types";
import type { DockerIntegration } from "../integrations/docker/client";
import type { MCPHub } from "../integrations/mcp-hub/registry";
import type { SubagentDeployer } from "../subagents/deployer";
import type { AuditLogger } from "../audit/logger";
import type { OTELTracer } from "../audit/otel";

export interface MasterAgentConfig {
  // Security
  byokEnabled: boolean;
  anthropicApiKey?: string;
  zeroTrustEnabled: boolean;
  aiGatewayId?: string;

  // Features
  autonomousMode: boolean;
  maxConcurrentTasks: number;

  // Integrations
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  dockerHost?: string;
  tailscaleKey?: string;

  // Knowledge Base
  knowledgeBackupSchedule: string; // cron expression

  // Subagents
  maxSubagents: number;
  subagentDefaults: {
    memory: number;
    cpu: number;
    timeout: number;
  };
}

export interface Task {
  id: string;
  type: string;
  description: string;
  priority: number;
  payload: any;
  status: "pending" | "in_progress" | "completed" | "failed";
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface SubagentInfo {
  id: string;
  type: "worker" | "specialist" | "integration" | "monitor";
  name: string;
  status: "active" | "idle" | "error";
  currentTask?: string;
  deployedAt: number;
  lastHeartbeat: number;
}

export interface AgentState {
  config: MasterAgentConfig;
  tasks: Task[];
  subagents: SubagentInfo[];
  integrationStatus: {
    cloudflare: boolean;
    docker: boolean;
    mcpHub: boolean;
    lobechat: boolean;
    zapier: boolean;
    n8n: boolean;
    tailscale: boolean;
  };
  metrics: {
    tasksCompleted: number;
    tasksFailedtasksActive: number;
    subagentsActive: number;
    lastHealthCheck: number;
  };
  knowledgeBase: {
    entries: number;
    lastBackup: number;
    lastSync: number;
  };
}

/**
 * Master Control Agent - Main orchestrator
 */
export class MasterControlAgent extends Agent {
  private config!: MasterAgentConfig;
  private taskQueue!: TaskQueue;
  private stateManager!: StateManager;
  private decisionEngine!: DecisionEngine;
  private aiGateway!: AIGatewayManager;
  private zeroTrust!: ZeroTrustAuth;
  private promptDetector!: PromptInjectionDetector;
  private knowledge!: KnowledgeBase;
  private cloudflare!: CloudflareIntegration;
  private docker!: DockerIntegration;
  private mcpHub!: MCPHub;
  private subagentDeployer!: SubagentDeployer;
  private audit!: AuditLogger;
  private tracer!: OTELTracer;

  /**
   * Initialize the Master Control Agent
   */
  async onStart(): Promise<void> {
    await super.onStart();

    // Load configuration
    this.config = await this.loadConfig();

    // Initialize components
    await this.initializeSecurity();
    await this.initializeKnowledgeBase();
    await this.initializeIntegrations();
    await this.initializeSubsystems();
    await this.initializeObservability();

    // Start autonomous loop if enabled
    if (this.config.autonomousMode) {
      this.startAutonomousLoop();
    }

    // Schedule maintenance tasks
    await this.scheduleMaintenanceTasks();

    this.audit.info("Master Control Agent started", { config: this.config });
  }

  /**
   * Handle incoming messages
   */
  async onMessage(connection: Connection, message: string): Promise<void> {
    const span = this.tracer.startSpan("onMessage");

    try {
      // Parse message
      const parsed = JSON.parse(message);

      // Security validation
      const securityCheck = await this.validateSecurity(connection, parsed);
      if (!securityCheck.valid) {
        await connection.send(JSON.stringify({
          type: "error",
          error: securityCheck.reason
        }));
        this.audit.warn("Security validation failed", securityCheck);
        return;
      }

      // Route based on message type
      if (parsed.type === "command") {
        await this.handleCommand(connection, parsed);
      } else if (parsed.type === "query") {
        await this.handleQuery(connection, parsed);
      } else if (parsed.type === "rpc") {
        await this.handleRPC(connection, parsed);
      }

    } catch (error) {
      this.audit.error("Error handling message", { error, message });
      await connection.send(JSON.stringify({
        type: "error",
        error: "Internal error processing message"
      }));
    } finally {
      span.end();
    }
  }

  /**
   * Handle natural language commands
   */
  private async handleCommand(connection: Connection, message: any): Promise<void> {
    const { command, streaming = false } = message;

    // Log command
    this.audit.info("Received command", { command });

    // Detect prompt injection
    const injectionCheck = await this.promptDetector.detect(command);
    if (injectionCheck.detected) {
      await connection.send(JSON.stringify({
        type: "error",
        error: "Potential prompt injection detected",
        details: injectionCheck.reasons
      }));
      return;
    }

    // Create task
    const task = await this.taskQueue.enqueue({
      type: "command",
      description: command,
      priority: 5,
      payload: { command, connectionId: connection.id }
    });

    // Send task acknowledgment
    await connection.send(JSON.stringify({
      type: "task_created",
      taskId: task.id
    }));

    // Execute command (async)
    this.executeCommand(task, connection, streaming);
  }

  /**
   * Execute a command task
   */
  private async executeCommand(task: Task, connection: Connection, streaming: boolean): Promise<void> {
    const span = this.tracer.startSpan("executeCommand", { taskId: task.id });

    try {
      // Update task status
      await this.taskQueue.updateStatus(task.id, "in_progress");

      // Use decision engine to understand command
      const decision = await this.decisionEngine.analyze(task.payload.command, {
        context: await this.getAgentContext(),
        capabilities: await this.listCapabilities()
      });

      this.audit.info("Command analyzed", { taskId: task.id, decision });

      // Route to appropriate handler
      let result: any;

      switch (decision.category) {
        case "cloudflare":
          result = await this.handleCloudflareCommand(decision);
          break;
        case "docker":
          result = await this.handleDockerCommand(decision);
          break;
        case "subagent":
          result = await this.handleSubagentCommand(decision);
          break;
        case "mcp":
          result = await this.handleMCPCommand(decision);
          break;
        case "domain":
          result = await this.handleDomainCommand(decision);
          break;
        case "knowledge":
          result = await this.handleKnowledgeCommand(decision);
          break;
        case "system":
          result = await this.handleSystemCommand(decision);
          break;
        default:
          result = await this.handleGenericCommand(decision, streaming, connection);
      }

      // Update task with result
      await this.taskQueue.complete(task.id, result);

      // Send result to client
      await connection.send(JSON.stringify({
        type: "task_completed",
        taskId: task.id,
        result
      }));

      // Learn from execution
      await this.knowledge.learn({
        command: task.payload.command,
        decision,
        result,
        success: true
      });

    } catch (error: any) {
      this.audit.error("Command execution failed", { taskId: task.id, error });

      // Update task with error
      await this.taskQueue.fail(task.id, error.message);

      // Send error to client
      await connection.send(JSON.stringify({
        type: "task_failed",
        taskId: task.id,
        error: error.message
      }));

      // Learn from failure
      await this.knowledge.learn({
        command: task.payload.command,
        error: error.message,
        success: false
      });

    } finally {
      span.end();
    }
  }

  /**
   * Handle generic commands using LLM
   */
  private async handleGenericCommand(decision: any, streaming: boolean, connection: Connection): Promise<any> {
    const model = this.getAnthropicModel();

    const systemPrompt = `You are the Master Control Agent, an autonomous system manager.
You have access to the following capabilities:
${JSON.stringify(await this.listCapabilities(), null, 2)}

Current system state:
${JSON.stringify(await this.getAgentState(), null, 2)}

Provide actionable responses and execute commands when appropriate.`;

    if (streaming) {
      const stream = streamText({
        model,
        system: systemPrompt,
        prompt: decision.command,
        maxTokens: 4096
      });

      let fullText = "";
      for await (const chunk of stream.textStream) {
        fullText += chunk;
        await connection.send(JSON.stringify({
          type: "stream_chunk",
          content: chunk
        }));
      }

      return { response: fullText };

    } else {
      const { text } = await generateText({
        model,
        system: systemPrompt,
        prompt: decision.command,
        maxTokens: 4096
      });

      return { response: text };
    }
  }

  /**
   * Get Anthropic model instance
   */
  private getAnthropicModel(): any {
    if (this.config.byokEnabled && this.config.anthropicApiKey) {
      return anthropic('claude-3-5-sonnet-20241022', {
        apiKey: this.config.anthropicApiKey
      });
    } else {
      // Use Workers AI binding
      return anthropic('claude-3-5-sonnet-20241022');
    }
  }

  /**
   * Validate security for incoming request
   */
  private async validateSecurity(connection: Connection, message: any): Promise<{ valid: boolean; reason?: string }> {
    // Zero Trust authentication
    if (this.config.zeroTrustEnabled) {
      const authResult = await this.zeroTrust.validate(connection);
      if (!authResult.valid) {
        return { valid: false, reason: "Zero Trust authentication failed" };
      }
    }

    // Rate limiting
    const rateLimitOk = await this.checkRateLimit(connection.id);
    if (!rateLimitOk) {
      return { valid: false, reason: "Rate limit exceeded" };
    }

    // Additional security checks can be added here

    return { valid: true };
  }

  /**
   * Get current agent state
   */
  public async getAgentState(): Promise<AgentState> {
    return this.stateManager.getState();
  }

  /**
   * List all available capabilities
   */
  private async listCapabilities(): Promise<string[]> {
    return [
      // Cloudflare
      "deploy_worker",
      "manage_durable_objects",
      "configure_domains",
      "manage_dns",
      "manage_kv_storage",
      "manage_r2_storage",
      "configure_ai_gateway",

      // Docker
      "manage_containers",
      "pull_push_images",
      "manage_networks",
      "manage_volumes",
      "docker_compose",

      // MCP
      "deploy_mcp_server",
      "call_mcp_tool",
      "access_mcp_resource",

      // Subagents
      "create_subagent",
      "deploy_subagent",
      "manage_subagent",

      // Knowledge
      "query_knowledge_base",
      "add_knowledge",
      "backup_knowledge",

      // System
      "health_check",
      "view_metrics",
      "view_audit_log",
      "configure_system"
    ];
  }

  /**
   * Get context for decision making
   */
  private async getAgentContext(): Promise<any> {
    const state = await this.getAgentState();
    const recentTasks = await this.taskQueue.getRecent(10);
    const activeSubagents = state.subagents.filter(s => s.status === "active");

    return {
      activeTasksCount: state.metrics.tasksActive,
      availableSubagents: activeSubagents.length,
      integrationStatus: state.integrationStatus,
      recentActivity: recentTasks.map(t => ({ type: t.type, status: t.status }))
    };
  }

  /**
   * Cloudflare command handlers
   */
  private async handleCloudflareCommand(decision: any): Promise<any> {
    // Implementation in cloudflare integration module
    return this.cloudflare.handleCommand(decision);
  }

  /**
   * Docker command handlers
   */
  private async handleDockerCommand(decision: any): Promise<any> {
    return this.docker.handleCommand(decision);
  }

  /**
   * Subagent command handlers
   */
  private async handleSubagentCommand(decision: any): Promise<any> {
    return this.subagentDeployer.handleCommand(decision);
  }

  /**
   * MCP command handlers
   */
  private async handleMCPCommand(decision: any): Promise<any> {
    return this.mcpHub.handleCommand(decision);
  }

  /**
   * Domain command handlers
   */
  private async handleDomainCommand(decision: any): Promise<any> {
    return this.cloudflare.domains.handleCommand(decision);
  }

  /**
   * Knowledge base command handlers
   */
  private async handleKnowledgeCommand(decision: any): Promise<any> {
    return this.knowledge.handleCommand(decision);
  }

  /**
   * System command handlers
   */
  private async handleSystemCommand(decision: any): Promise<any> {
    // Handle system-level commands
    switch (decision.action) {
      case "health_check":
        return this.performHealthCheck();
      case "get_metrics":
        return this.getMetrics();
      case "get_audit_log":
        return this.audit.getRecent(decision.params?.limit || 100);
      case "configure":
        return this.updateConfig(decision.params);
      default:
        throw new Error(`Unknown system command: ${decision.action}`);
    }
  }

  /**
   * Handle query requests
   */
  private async handleQuery(connection: Connection, message: any): Promise<void> {
    const { query, context } = message;

    // Query knowledge base
    const results = await this.knowledge.query(query, context);

    await connection.send(JSON.stringify({
      type: "query_result",
      results
    }));
  }

  /**
   * Handle RPC calls
   */
  private async handleRPC(connection: Connection, message: any): Promise<void> {
    // Delegate to parent Agent class RPC handler
    await super.onMessage(connection, JSON.stringify(message));
  }

  /**
   * Initialize security components
   */
  private async initializeSecurity(): Promise<void> {
    // Implementations will be in security modules
    // this.aiGateway = new AIGatewayManager(this.config);
    // this.zeroTrust = new ZeroTrustAuth(this.config);
    // this.promptDetector = new PromptInjectionDetector();
  }

  /**
   * Initialize knowledge base
   */
  private async initializeKnowledgeBase(): Promise<void> {
    // Implementation in knowledge-base module
    // this.knowledge = new KnowledgeBase(this.ctx);
  }

  /**
   * Initialize integrations
   */
  private async initializeIntegrations(): Promise<void> {
    // Implementations in integration modules
    // this.cloudflare = new CloudflareIntegration(this.config);
    // this.docker = new DockerIntegration(this.config);
    // this.mcpHub = new MCPHub(this.ctx);
  }

  /**
   * Initialize subsystems
   */
  private async initializeSubsystems(): Promise<void> {
    // this.taskQueue = new TaskQueue(this.ctx);
    // this.stateManager = new StateManager(this.ctx);
    // this.decisionEngine = new DecisionEngine(this.getAnthropicModel());
    // this.subagentDeployer = new SubagentDeployer(this.ctx, this.config);
  }

  /**
   * Initialize observability
   */
  private async initializeObservability(): Promise<void> {
    // this.audit = new AuditLogger(this.ctx);
    // this.tracer = new OTELTracer(this.ctx);
  }

  /**
   * Load configuration from storage
   */
  private async loadConfig(): Promise<MasterAgentConfig> {
    // Load from Durable Object storage or use defaults
    const stored = await this.ctx.storage.get<MasterAgentConfig>("config");

    return stored || {
      byokEnabled: false,
      zeroTrustEnabled: true,
      autonomousMode: true,
      maxConcurrentTasks: 10,
      maxSubagents: 50,
      knowledgeBackupSchedule: "0 * * * *", // Hourly
      subagentDefaults: {
        memory: 128,
        cpu: 1,
        timeout: 30000
      }
    };
  }

  /**
   * Update configuration
   */
  private async updateConfig(updates: Partial<MasterAgentConfig>): Promise<MasterAgentConfig> {
    this.config = { ...this.config, ...updates };
    await this.ctx.storage.put("config", this.config);
    this.audit.info("Configuration updated", { updates });
    return this.config;
  }

  /**
   * Start autonomous task processing loop
   */
  private startAutonomousLoop(): void {
    this.schedule("autonomous-loop", {
      cron: "* * * * *", // Every minute
      handler: async () => {
        await this.processAutonomousTasks();
      }
    });
  }

  /**
   * Process tasks autonomously
   */
  private async processAutonomousTasks(): Promise<void> {
    const span = this.tracer.startSpan("autonomousLoop");

    try {
      // Get pending tasks
      const pendingTasks = await this.taskQueue.getPending(this.config.maxConcurrentTasks);

      // Process each task
      for (const task of pendingTasks) {
        // Check if we can process this task
        const canProcess = await this.canProcessTask(task);
        if (!canProcess) {
          continue;
        }

        // Allocate resources
        const resources = await this.allocateResources(task);

        // Execute
        await this.executeTask(task, resources);
      }

      // Health check
      await this.performHealthCheck();

    } catch (error) {
      this.audit.error("Autonomous loop error", { error });
    } finally {
      span.end();
    }
  }

  /**
   * Check if task can be processed
   */
  private async canProcessTask(task: Task): Promise<boolean> {
    const state = await this.getAgentState();

    // Check active task limit
    if (state.metrics.tasksActive >= this.config.maxConcurrentTasks) {
      return false;
    }

    // Check dependencies
    // (Implementation would check if required services are available)

    return true;
  }

  /**
   * Allocate resources for task
   */
  private async allocateResources(task: Task): Promise<any> {
    // Determine if we need a subagent
    const needsSubagent = task.type === "complex" || task.priority > 7;

    if (needsSubagent) {
      return {
        subagent: await this.subagentDeployer.allocate(task)
      };
    }

    return { direct: true };
  }

  /**
   * Execute a task
   */
  private async executeTask(task: Task, resources: any): Promise<void> {
    // Task execution logic
    // This would be implemented based on task type
  }

  /**
   * Schedule maintenance tasks
   */
  private async scheduleMaintenanceTasks(): Promise<void> {
    // Knowledge base backup
    this.schedule("kb-backup", {
      cron: this.config.knowledgeBackupSchedule,
      handler: async () => {
        await this.knowledge.backup();
      }
    });

    // Health checks
    this.schedule("health-check", {
      cron: "*/5 * * * *", // Every 5 minutes
      handler: async () => {
        await this.performHealthCheck();
      }
    });

    // Cleanup old tasks
    this.schedule("cleanup", {
      cron: "0 0 * * *", // Daily
      handler: async () => {
        await this.taskQueue.cleanup();
      }
    });

    // Subagent health monitoring
    this.schedule("subagent-monitor", {
      cron: "* * * * *", // Every minute
      handler: async () => {
        await this.subagentDeployer.healthCheck();
      }
    });
  }

  /**
   * Perform system health check
   */
  private async performHealthCheck(): Promise<any> {
    const checks = {
      timestamp: Date.now(),
      storage: await this.checkStorageHealth(),
      integrations: await this.checkIntegrationHealth(),
      subagents: await this.checkSubagentHealth(),
      knowledgeBase: await this.checkKnowledgeBaseHealth()
    };

    this.audit.info("Health check completed", checks);

    return checks;
  }

  private async checkStorageHealth(): Promise<boolean> {
    try {
      await this.ctx.storage.get("health-check");
      return true;
    } catch {
      return false;
    }
  }

  private async checkIntegrationHealth(): Promise<any> {
    const state = await this.getAgentState();
    return state.integrationStatus;
  }

  private async checkSubagentHealth(): Promise<any> {
    const state = await this.getAgentState();
    return {
      total: state.subagents.length,
      active: state.subagents.filter(s => s.status === "active").length,
      errors: state.subagents.filter(s => s.status === "error").length
    };
  }

  private async checkKnowledgeBaseHealth(): Promise<any> {
    const state = await this.getAgentState();
    return state.knowledgeBase;
  }

  /**
   * Get metrics
   */
  private async getMetrics(): Promise<any> {
    const state = await this.getAgentState();
    return state.metrics;
  }

  /**
   * Check rate limit
   */
  private async checkRateLimit(connectionId: string): Promise<boolean> {
    // Simple rate limiting implementation
    const key = `rate-limit:${connectionId}`;
    const count = (await this.ctx.storage.get<number>(key)) || 0;

    if (count > 100) { // 100 requests per minute
      return false;
    }

    await this.ctx.storage.put(key, count + 1, { expirationTtl: 60 });
    return true;
  }

  /**
   * Expose RPC methods
   */
  async deployWorker(config: any): Promise<any> {
    return this.cloudflare.workers.deploy(config);
  }

  async createSubagent(config: any): Promise<any> {
    return this.subagentDeployer.create(config);
  }

  async configureDomain(config: any): Promise<any> {
    return this.cloudflare.domains.configure(config);
  }

  async queryKnowledge(query: string): Promise<any> {
    return this.knowledge.query(query);
  }
}

// Export the agent
export default MasterControlAgent;
