import { McpAgent } from "./mcp";
import type { TransportType } from "./mcp/types";
import { Agent } from "./index";
import {
  MasterControlKnowledgeBase,
  type KnowledgeEntry,
  type KnowledgeQuery
} from "./master-control-knowledge";
import { MCPHub, type MCPServerInfo } from "./master-control-mcp";
import {
  MasterControlAuth,
  type Permission,
  type AuthToken
} from "./master-control-auth";
import {
  MasterControlSecureComm,
  type SecureMessage,
  type SecureChannel
} from "./master-control-secure-comm";
import {
  MasterControlMonitoring,
  type Metric,
  type Alert,
  type LogEntry
} from "./master-control-monitoring";
import {
  MasterControlConfigManager,
  type ConfigSection,
  type MasterControlConfig
} from "./master-control-config";
import {
  MasterControlErrorHandler,
  type MasterControlError,
  type ErrorCategory,
  type ErrorSeverity
} from "./master-control-errors";
import { callable } from "./index";

/**
 * Security context for Zero Trust operations
 */
export type SecurityContext = {
  /** User identity */
  userId: string;
  /** User roles */
  roles: string[];
  /** Permissions granted */
  permissions: string[];
  /** Request origin */
  origin: string;
  /** Timestamp of request */
  timestamp: number;
};

/**
 * Master Control Agent State
 */
export type MasterControlAgentState = {
  /** Current security level */
  securityLevel: "low" | "medium" | "high" | "critical";
  /** Active MCP servers */
  activeServers: string[];
  /** Last security audit timestamp */
  lastAudit: number;
  /** Configuration settings */
  config: Record<string, unknown>;
};

/**
 * Master Control Agent for coordinating the entire agent system with Zero Trust security
 */
export class MasterControlAgent extends McpAgent<
  Record<string, unknown>,
  MasterControlAgentState
> {
  server: any = {};

  /** Knowledge base instance */
  private knowledgeBase: MasterControlKnowledgeBase =
    new MasterControlKnowledgeBase();

  /** MCP Hub instance */
  private mcpHub: MCPHub = new MCPHub();

  /** Authentication system */
  private auth: MasterControlAuth = new MasterControlAuth();

  /** Secure communication system */
  private secureComm: MasterControlSecureComm = new MasterControlSecureComm();

  /** Monitoring and observability system */
  private monitoring: MasterControlMonitoring = new MasterControlMonitoring();

  /** Configuration management system */
  private configManager: MasterControlConfigManager =
    new MasterControlConfigManager();

  /** Error handling system */
  private errorHandler: MasterControlErrorHandler =
    new MasterControlErrorHandler();

  /**
   * Initialize the Master Control Agent
   */
  async init(): Promise<void> {
    try {
      // Initialize with default state if not already set
      if (!this.state) {
        this.setState({
          securityLevel: "high",
          activeServers: [],
          lastAudit: Date.now(),
          config: {}
        });
      }

      // Set up observability to use the monitoring system
      this.observability = {
        emit: (event: any) => {
          // Log the event through the monitoring system
          this.monitoring.log({
            level: "info",
            message: event.displayMessage,
            labels: {
              eventType: event.type,
              eventId: event.id
            },
            context: event.payload
          });
        }
      };

      // Initialize knowledge base with default entries
      await this.initializeKnowledgeBase();

      // Initialize MCP hub with default servers
      await this.initializeMcpHub();

      // Record initialization metric
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "agent_init" }
      });
    } catch (error: any) {
      const masterError = this.errorHandler.createError(
        error.message || "Failed to initialize Master Control Agent",
        "AGENT_INIT_FAILED",
        "system",
        "critical"
      );

      await this.errorHandler.handleError(masterError);
      throw masterError;
    }
  }

  /**
   * Initialize the knowledge base with default entries
   */
  private async initializeKnowledgeBase(): Promise<void> {
    try {
      // Add default knowledge base entries
      await this.knowledgeBase.addEntry({
        title: "Master Control Agent Overview",
        content:
          "The Master Control Agent is the central coordinator for the entire agent system, implementing Zero Trust security principles and managing all connected MCP servers.",
        tags: ["system", "overview", "security"],
        metadata: {
          version: "1.0",
          type: "documentation"
        }
      });

      await this.knowledgeBase.addEntry({
        title: "Zero Trust Security Model",
        content:
          "The Master Control Agent implements a Zero Trust security model where every request must be authenticated and authorized, regardless of origin. All communications are encrypted and all access is logged.",
        tags: ["security", "authentication", "authorization"],
        metadata: {
          version: "1.0",
          type: "documentation"
        }
      });

      await this.knowledgeBase.addEntry({
        title: "MCP Server Management",
        content:
          "The Master Control Agent can register, monitor, and manage multiple MCP servers. Each server must be authenticated before it can participate in the system.",
        tags: ["mcp", "servers", "management"],
        metadata: {
          version: "1.0",
          type: "documentation"
        }
      });
    } catch (error: any) {
      const masterError = this.errorHandler.createError(
        error.message || "Failed to initialize knowledge base",
        "KNOWLEDGE_BASE_INIT_FAILED",
        "knowledge",
        "high"
      );

      await this.errorHandler.handleError(masterError);
      throw masterError;
    }
  }

  /**
   * Initialize the MCP hub with default servers
   */
  private async initializeMcpHub(): Promise<void> {
    try {
      // Register default MCP servers from the environment configuration
      // In a real implementation, these would come from configuration
      const defaultServers = [
        {
          serverId: "context7",
          name: "Context7 Documentation Server",
          url: "npx -y @upstash/context7-mcp",
          capabilities: ["documentation", "code-examples"]
        },
        {
          serverId: "filesystem",
          name: "Filesystem Server",
          url: "npx -y @modelcontextprotocol/server-filesystem",
          capabilities: ["file-access", "directory-listing"]
        },
        {
          serverId: "sequentialthinking",
          name: "Sequential Thinking Server",
          url: "npx -y @modelcontextprotocol/server-sequential-thinking",
          capabilities: ["problem-solving", "reasoning"]
        }
      ];

      for (const server of defaultServers) {
        await this.mcpHub.registerServer(server);
      }
    } catch (error: any) {
      const masterError = this.errorHandler.createError(
        error.message || "Failed to initialize MCP hub",
        "MCP_HUB_INIT_FAILED",
        "mcp",
        "high"
      );

      await this.errorHandler.handleError(masterError);
      throw masterError;
    }
  }

  /**
   * Validate security context for Zero Trust operations
   */
  private validateSecurityContext(context: SecurityContext): boolean {
    try {
      // Check if request is too old (prevent replay attacks)
      if (Date.now() - context.timestamp > 300000) {
        // 5 minutes
        return false;
      }

      // Check required permissions based on security level
      const requiredPermissions = this.getRequiredPermissions();
      return requiredPermissions.every((permission) =>
        context.permissions.includes(permission)
      );
    } catch (error: any) {
      const masterError = this.errorHandler.createError(
        error.message || "Failed to validate security context",
        "SECURITY_CONTEXT_VALIDATION_FAILED",
        "security",
        "high"
      );

      this.errorHandler.handleError(masterError);
      return false;
    }
  }

  /**
   * Get required permissions based on current security level
   */
  private getRequiredPermissions(): string[] {
    try {
      switch (this.state?.securityLevel) {
        case "critical":
          return ["admin", "security", "master-control"];
        case "high":
          return ["admin", "master-control"];
        case "medium":
          return ["user", "master-control"];
        case "low":
        default:
          return ["master-control"];
      }
    } catch (error: any) {
      const masterError = this.errorHandler.createError(
        error.message || "Failed to get required permissions",
        "PERMISSIONS_RETRIEVAL_FAILED",
        "authorization",
        "medium"
      );

      this.errorHandler.handleError(masterError);
      return ["master-control"]; // Default fallback
    }
  }

  /**
   * Authenticate a user with username and password
   */
  @callable({ description: "Authenticate a user with username and password" })
  private async authenticate(
    username: string,
    password: string
  ): Promise<AuthenticationResult> {
    return this.auth.authenticate(username, password);
  }

  /**
   * Validate an authentication token
   */
  @callable({ description: "Validate an authentication token" })
  private async validateToken(token: string): Promise<AuthenticationResult> {
    return this.auth.validateToken(token);
  }

  /**
   * Register a new MCP server with the Master Control Agent
   */
  @callable({
    description: "Register a new MCP server with the Master Control Agent"
  })
  async registerMcpServer(params: {
    serverId: string;
    serverName: string;
    serverUrl: string;
    token: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Record registration attempt
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "register_mcp_server" }
      });

      // Validate token
      const tokenValidation = await this.auth.validateToken({
        token: params.token
      });
      if (!tokenValidation.success) {
        await this.monitoring.incrementCounter({
          metricId: "errors_total",
          incrementBy: 1,
          labels: { operation: "register_mcp_server_auth_failure" }
        });

        return {
          success: false,
          message: "Invalid or expired token"
        };
      }

      // Check permissions
      if (!tokenValidation.permissions?.includes("mcp-management")) {
        await this.monitoring.incrementCounter({
          metricId: "errors_total",
          incrementBy: 1,
          labels: { operation: "register_mcp_server_permission_failure" }
        });

        return {
          success: false,
          message: "Insufficient permissions to register MCP servers"
        };
      }

      // Register server with MCP hub
      const result = await this.mcpHub.registerServer({
        serverId: params.serverId,
        name: params.serverName,
        url: params.serverUrl
      });

      if (!result.success) {
        await this.monitoring.incrementCounter({
          metricId: "errors_total",
          incrementBy: 1,
          labels: { operation: "register_mcp_server_failure" }
        });

        return result;
      }

      // Add server to active servers list
      const currentState = this.state || {
        securityLevel: "high",
        activeServers: [],
        lastAudit: Date.now(),
        config: {}
      };

      if (!currentState.activeServers.includes(params.serverId)) {
        currentState.activeServers.push(params.serverId);
        this.setState(currentState);
      }

      // Record successful registration
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "register_mcp_server_success" }
      });

      this.observability?.emit({
        type: "mcp:client:connect",
        id: this.generateId(),
        displayMessage: `Registered MCP server: ${params.serverName}`,
        payload: {
          url: params.serverUrl,
          transport: "registration",
          state: "registered",
          serverId: params.serverId,
          serverName: params.serverName
        },
        timestamp: Date.now()
      });

      return {
        success: true,
        message: `Successfully registered MCP server: ${params.serverName}`
      };
    } catch (error: any) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "register_mcp_server_error" }
      });

      const masterError = this.errorHandler.createError(
        error.message || "MCP server registration failed",
        "MCP_SERVER_REGISTRATION_FAILED",
        "mcp",
        "high",
        { serverId: params.serverId, serverName: params.serverName }
      );

      await this.errorHandler.handleError(masterError);

      return {
        success: false,
        message: "Failed to register MCP server"
      };
    }
  }

  /**
   * Connect to an MCP server
   */
  @callable({ description: "Connect to an MCP server" })
  private async connectToMCP(serverId: string): Promise<MCPConnectionResult> {
    return this.mcpHub.connectToMCP(serverId);
  }

  /**
   * Disconnect from an MCP server
   */
  @callable({ description: "Disconnect from an MCP server" })
  private async disconnectFromMCP(
    serverId: string
  ): Promise<MCPDisconnectionResult> {
    return this.mcpHub.disconnectFromMCP(serverId);
  }

  /**
   * List all registered MCP servers
   */
  @callable({ description: "List all registered MCP servers" })
  private async listMCPServers(): Promise<MCPListResult> {
    return this.mcpHub.listMCPServers();
  }

  /**
   * Update security level of the Master Control Agent
   */
  @callable({
    description: "Update security level of the Master Control Agent"
  })
  async updateSecurityLevel(params: {
    level: "low" | "medium" | "high" | "critical";
    token: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Record security level update attempt
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "update_security_level" }
      });

      // Validate token
      const tokenValidation = await this.auth.validateToken({
        token: params.token
      });
      if (!tokenValidation.success) {
        await this.monitoring.incrementCounter({
          metricId: "errors_total",
          incrementBy: 1,
          labels: { operation: "update_security_level_auth_failure" }
        });

        return {
          success: false,
          message: "Invalid or expired token"
        };
      }

      // Check permissions
      if (!tokenValidation.permissions?.includes("security")) {
        await this.monitoring.incrementCounter({
          metricId: "errors_total",
          incrementBy: 1,
          labels: { operation: "update_security_level_permission_failure" }
        });

        return {
          success: false,
          message: "Insufficient permissions to update security level"
        };
      }

      // Update security level
      const currentState = this.state || {
        securityLevel: "high",
        activeServers: [],
        lastAudit: Date.now(),
        config: {}
      };

      currentState.securityLevel = params.level;
      currentState.lastAudit = Date.now();
      this.setState(currentState);

      // Record successful update
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "update_security_level_success" }
      });

      this.observability?.emit({
        type: "mcp:client:connect",
        id: this.generateId(),
        displayMessage: `Security level updated to: ${params.level}`,
        payload: {
          url: "security-update",
          transport: "internal",
          state: "updated",
          level: params.level
        },
        timestamp: Date.now()
      });

      return {
        success: true,
        message: `Security level updated to: ${params.level}`
      };
    } catch (error: any) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "update_security_level_error" }
      });

      const masterError = this.errorHandler.createError(
        error.message || "Failed to update security level",
        "SECURITY_LEVEL_UPDATE_FAILED",
        "security",
        "high",
        { level: params.level }
      );

      await this.errorHandler.handleError(masterError);

      return {
        success: false,
        message: "Failed to update security level"
      };
    }
  }

  /**
   * Execute a command on an MCP server
   */
  @callable({
    description: "Execute a command on an MCP server",
    streaming: true
  })
  private async executeMCPCommand(
    serverId: string,
    command: string,
    args: unknown[]
  ): Promise<MCPCommandResult> {
    return this.mcpHub.executeMCPCommand(serverId, command, args);
  }

  /**
   * Get current system status
   */
  @callable({ description: "Get current system status" })
  private async getSystemStatus(): Promise<SystemStatus> {
    return this.monitoring.getSystemStatus();
  }

  /**
   * Perform a security audit
   */
  @callable({ description: "Perform a security audit" })
  private async performSecurityAudit(): Promise<SecurityAuditResult> {
    return this.monitoring.performSecurityAudit();
  }

  /**
   * Add a new entry to the knowledge base
   */
  @callable({
    description: "Add a new entry to the knowledge base"
  })
  private async addKnowledgeEntry(
    entry: KnowledgeEntry
  ): Promise<KnowledgeBaseResult> {
    return this.knowledgeBase.addEntry(entry);
  }

  /**
   * Search the knowledge base
   */
  @callable({
    description: "Search the knowledge base"
  })
  private async searchKnowledgeBase(
    query: string
  ): Promise<KnowledgeBaseSearchResult> {
    return this.knowledgeBase.search(query);
  }

  /**
   * Get knowledge base statistics
   */
  @callable({
    description: "Get knowledge base statistics"
  })
  private async getKnowledgeBaseStats(): Promise<KnowledgeBaseStats> {
    return this.knowledgeBase.getStats();
  }

  /**
   * Create a secure communication channel
   */
  @callable({
    description: "Create a secure communication channel"
  })
  private async createSecureChannel(
    participant1: string,
    participant2: string
  ): Promise<SecureChannelResult> {
    // Validate token
    const tokenValidation = await this.auth.validateToken({
      token: params.token
    });
    if (!tokenValidation.success) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "create_secure_channel_auth_failure" }
      });

      return {
        success: false,
        message: "Invalid or expired token"
      };
    }

    // Check permissions
    if (!tokenValidation.permissions?.includes("master-control")) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "create_secure_channel_permission_failure" }
      });

      return {
        success: false,
        message: "Insufficient permissions to create secure channels"
      };
    }

    // Create secure channel
    const result = await this.secureComm.createChannel({
      participants: params.participants,
      encryptionAlgorithm: params.encryptionAlgorithm,
      integrityAlgorithm: params.integrityAlgorithm,
      creator: tokenValidation.userId || "unknown"
    });

    // Record result
    if (result.success) {
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "create_secure_channel_success" }
      });
    } else {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "create_secure_channel_failure" }
      });
    }

    this.observability?.emit({
      type: "mcp:client:connect",
      id: this.generateId(),
      displayMessage: `Secure channel created for participants: ${params.participants.join(", ")}`,
      payload: {
        url: "secure-communication",
        transport: "internal",
        state: result.success ? "created" : "error",
        participants: params.participants
      },
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Close a secure communication channel
   */
  @callable({
    description: "Close a secure communication channel"
  })
  private async closeSecureChannel(
    channelId: string
  ): Promise<SecureChannelResult> {
    // Validate token
    const tokenValidation = await this.auth.validateToken({
      token: params.token
    });
    if (!tokenValidation.success) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "close_secure_channel_auth_failure" }
      });

      return {
        success: false,
        message: "Invalid or expired token"
      };
    }

    // Check permissions
    if (!tokenValidation.permissions?.includes("master-control")) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "close_secure_channel_permission_failure" }
      });

      return {
        success: false,
        message: "Insufficient permissions to close secure channels"
      };
    }

    // Close secure channel
    const result = await this.secureComm.closeChannel({
      channelId: params.channelId,
      closer: tokenValidation.userId || "unknown"
    });

    // Record result
    if (result.success) {
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "close_secure_channel_success" }
      });
    } else {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "close_secure_channel_failure" }
      });
    }

    this.observability?.emit({
      type: "mcp:client:connect",
      id: this.generateId(),
      displayMessage: `Secure channel closed: ${params.channelId}`,
      payload: {
        url: "secure-communication",
        transport: "internal",
        state: result.success ? "closed" : "error",
        channelId: params.channelId
      },
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Send a secure message
   */
  @callable({
    description: "Send a secure message"
  })
  private async sendSecureMessage(
    channelId: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<SecureMessageResult> {
    // Validate token
    const tokenValidation = await this.auth.validateToken({
      token: params.token
    });
    if (!tokenValidation.success) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "send_secure_message_auth_failure" }
      });

      return {
        success: false,
        message: "Invalid or expired token"
      };
    }

    // Check permissions
    if (!tokenValidation.permissions?.includes("master-control")) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "send_secure_message_permission_failure" }
      });

      return {
        success: false,
        message: "Insufficient permissions to send secure messages"
      };
    }

    // Send secure message
    const result = await this.secureComm.sendMessage({
      channelId: params.channelId,
      payload: params.payload,
      sender: tokenValidation.userId || "unknown",
      signMessage: params.signMessage
    });

    // Record result
    if (result.success) {
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "send_secure_message_success" }
      });
    } else {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "send_secure_message_failure" }
      });
    }

    this.observability?.emit({
      type: "mcp:client:connect",
      id: this.generateId(),
      displayMessage: `Secure message sent in channel: ${params.channelId}`,
      payload: {
        url: "secure-communication",
        transport: "internal",
        state: result.success ? "sent" : "error",
        channelId: params.channelId
      },
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Receive a secure message
   */
  @callable({
    description: "Receive a secure message"
  })
  private async receiveSecureMessage(
    channelId: string
  ): Promise<SecureMessageResult> {
    // Validate token
    const tokenValidation = await this.auth.validateToken({
      token: params.token
    });
    if (!tokenValidation.success) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "receive_secure_message_auth_failure" }
      });

      return {
        success: false,
        message: "Invalid or expired token"
      };
    }

    // Check permissions
    if (!tokenValidation.permissions?.includes("master-control")) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "receive_secure_message_permission_failure" }
      });

      return {
        success: false,
        message: "Insufficient permissions to receive secure messages"
      };
    }

    // Receive secure message
    const result = await this.secureComm.receiveMessage({
      messageId: params.messageId,
      channelId: params.channelId,
      recipient: tokenValidation.userId || "unknown"
    });

    // Record result
    if (result.success) {
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "receive_secure_message_success" }
      });
    } else {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "receive_secure_message_failure" }
      });
    }

    this.observability?.emit({
      type: "mcp:client:connect",
      id: this.generateId(),
      displayMessage: `Secure message received in channel: ${params.channelId}`,
      payload: {
        url: "secure-communication",
        transport: "internal",
        state: result.success ? "received" : "error",
        channelId: params.channelId
      },
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Get channel information
   */
  @callable({
    description: "Get channel information"
  })
  private async getChannelInfo(channelId: string): Promise<SecureChannelInfo> {
    // Validate token
    const tokenValidation = await this.auth.validateToken({
      token: params.token
    });
    if (!tokenValidation.success) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "get_channel_info_auth_failure" }
      });

      return {
        success: false,
        message: "Invalid or expired token"
      };
    }

    // Check permissions
    if (!tokenValidation.permissions?.includes("master-control")) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "get_channel_info_permission_failure" }
      });

      return {
        success: false,
        message: "Insufficient permissions to get channel information"
      };
    }

    // Get channel information
    const result = await this.secureComm.getChannelInfo({
      channelId: params.channelId,
      requester: tokenValidation.userId || "unknown"
    });

    // Record result
    if (result.success) {
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "get_channel_info_success" }
      });
    } else {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "get_channel_info_failure" }
      });
    }

    this.observability?.emit({
      type: "mcp:client:connect",
      id: this.generateId(),
      displayMessage: `Channel information retrieved: ${params.channelId}`,
      payload: {
        url: "secure-communication",
        transport: "internal",
        state: result.success ? "retrieved" : "error",
        channelId: params.channelId
      },
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * List active channels for a participant
   */
  @callable({
    description: "List active channels for a participant"
  })
  private async listActiveChannels(
    participant: string
  ): Promise<SecureChannelListResult> {
    // Validate token
    const tokenValidation = await this.auth.validateToken({
      token: params.token
    });
    if (!tokenValidation.success) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "list_active_channels_auth_failure" }
      });

      return {
        success: false,
        message: "Invalid or expired token"
      };
    }

    // Check permissions
    if (!tokenValidation.permissions?.includes("master-control")) {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "list_active_channels_permission_failure" }
      });

      return {
        success: false,
        message: "Insufficient permissions to list secure channels"
      };
    }

    // List secure channels
    const result = await this.secureComm.listActiveChannels(
      tokenValidation.userId || "unknown"
    );

    // Record result
    if (result.success) {
      await this.monitoring.incrementCounter({
        metricId: "requests_total",
        incrementBy: 1,
        labels: { operation: "list_active_channels_success" }
      });
    } else {
      await this.monitoring.incrementCounter({
        metricId: "errors_total",
        incrementBy: 1,
        labels: { operation: "list_active_channels_failure" }
      });
    }

    this.observability?.emit({
      type: "mcp:client:connect",
      id: this.generateId(),
      displayMessage: "Secure channels listed",
      payload: {
        url: "secure-communication",
        transport: "internal",
        state: result.success ? "listed" : "error"
      },
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Record a metric value
   */
  @callable({ description: "Record a metric value" })
  private async recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<MonitoringResult> {
    return this.monitoring.recordMetric(name, value, tags);
  }

  /**
   * Get a metric value
   */
  @callable({ description: "Get a metric value" })
  private async getMetric(
    name: string,
    tags?: Record<string, string>
  ): Promise<MetricResult> {
    return this.monitoring.getMetric(name, tags);
  }

  /**
   * List all metrics
   */
  @callable({ description: "List all metrics" })
  private async listMetrics(): Promise<MetricListResult> {
    return this.monitoring.listMetrics();
  }

  /**
   * Get recent logs
   */
  @callable({ description: "Get recent logs" })
  private async getLogs(limit?: number, level?: string): Promise<LogResult> {
    return this.monitoring.getLogs(limit, level);
  }

  /**
   * Get system health status
   */
  @callable({ description: "Get system health status" })
  private async getHealthStatus(): Promise<HealthCheckResult> {
    return this.monitoring.getHealthStatus();
  }

  /**
   * Get configuration value
   */
  @callable({ description: "Get configuration value" })
  private async getConfig(key: string): Promise<ConfigValueResult> {
    return this.config.get(key);
  }

  /**
   * Set configuration value
   */
  @callable({ description: "Set configuration value" })
  private async setConfig(key: string, value: unknown): Promise<ConfigResult> {
    return this.config.set(key, value);
  }

  /**
   * Get entire configuration section
   */
  @callable({ description: "Get entire configuration section" })
  private async getConfigSection(
    section: string
  ): Promise<ConfigSectionResult> {
    return this.config.getSection(section);
  }

  /**
   * Set entire configuration section
   */
  @callable({ description: "Set entire configuration section" })
  private async setConfigSection(
    section: string,
    values: Record<string, unknown>
  ): Promise<ConfigResult> {
    return this.config.setSection(section, values);
  }

  /**
   * Get entire configuration
   */
  @callable({ description: "Get entire configuration" })
  private async getAllConfig(): Promise<ConfigAllResult> {
    return this.config.getAll();
  }

  /**
   * Update configuration from object
   */
  @callable({ description: "Update configuration from object" })
  private async updateConfig(
    updates: Record<string, unknown>
  ): Promise<ConfigResult> {
    return this.config.update(updates);
  }

  /**
   * Reset configuration to defaults
   */
  @callable({ description: "Reset configuration to defaults" })
  private async resetConfig(): Promise<ConfigResult> {
    return this.config.reset();
  }

  /**
   * Validate configuration
   */
  @callable({ description: "Validate configuration" })
  private async validateConfig(): Promise<ConfigValidationResult> {
    return this.config.validate();
  }

  /**
   * Get configuration metadata
   */
  @callable({ description: "Get configuration metadata" })
  private async getConfigMetadata(key: string): Promise<ConfigMetadataResult> {
    return this.config.getMetadata(key);
  }

  /**
   * Export configuration to JSON
   */
  @callable({ description: "Export configuration to JSON" })
  private async exportConfig(): Promise<ConfigExportResult> {
    return this.config.export();
  }

  /**
   * Import configuration from JSON
   */
  @callable({ description: "Import configuration from JSON" })
  private async importConfig(json: string): Promise<ConfigResult> {
    return this.config.import(json);
  }

  /**
   * Get recent errors
   */
  @callable({ description: "Get recent errors" })
  private async getErrors(limit?: number): Promise<ErrorLogResult> {
    return this.errorHandler.getErrors(limit);
  }

  /**
   * Get error statistics
   */
  @callable({ description: "Get error statistics" })
  private async getErrorStats(): Promise<ErrorStatsResult> {
    return this.errorHandler.getStats();
  }

  /**
   * Clear error log
   */
  @callable({ description: "Clear error log" })
  private async clearErrors(): Promise<ErrorClearResult> {
    return this.errorHandler.clear();
  }

  /**
   * Generate a unique ID (simplified version without nanoid)
   */
  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
