/**
 * MCP Hub - Registry and Management
 *
 * Manages deployed MCP servers with OAuth authentication
 */

import type { DurableObjectState } from "@cloudflare/workers-types";

export interface MCPServerConfig {
  name: string;
  url: string;
  transport: "sse" | "stdio" | "http";
  auth?: {
    type: "oauth" | "apikey" | "none";
    credentials?: any;
  };
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

export interface MCPServer {
  id: string;
  config: MCPServerConfig;
  status: "active" | "inactive" | "error";
  deployedAt: number;
  lastHealthCheck: number;
}

export interface MCPHub {
  servers: MCPServerRegistry;
  deploy: (config: MCPServerConfig) => Promise<MCPServer>;
  authenticate: (serverId: string, credentials: any) => Promise<void>;
  callTool: (serverId: string, tool: string, args: any) => Promise<any>;
  getResource: (serverId: string, resource: string) => Promise<any>;
  listCapabilities: (serverId: string) => Promise<any>;
  handleCommand: (decision: any) => Promise<any>;
}

export class MCPServerRegistry implements MCPHub {
  servers: MCPServerRegistry;
  private registeredServers: Map<string, MCPServer> = new Map();

  constructor(private ctx: DurableObjectState) {
    this.servers = this;
  }

  /**
   * Load servers from storage
   */
  async load(): Promise<void> {
    const stored = await this.ctx.storage.get<MCPServer[]>('mcp_servers');
    if (stored) {
      for (const server of stored) {
        this.registeredServers.set(server.id, server);
      }
    }
  }

  /**
   * Deploy a new MCP server
   */
  async deploy(config: MCPServerConfig): Promise<MCPServer> {
    const server: MCPServer = {
      id: crypto.randomUUID(),
      config,
      status: 'active',
      deployedAt: Date.now(),
      lastHealthCheck: Date.now()
    };

    this.registeredServers.set(server.id, server);
    await this.persist();

    return server;
  }

  /**
   * Authenticate with MCP server
   */
  async authenticate(serverId: string, credentials: any): Promise<void> {
    const server = this.registeredServers.get(serverId);
    if (!server) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    // Store credentials securely
    if (!server.config.auth) {
      server.config.auth = { type: 'oauth' };
    }
    server.config.auth.credentials = credentials;

    await this.persist();
  }

  /**
   * Call an MCP tool
   */
  async callTool(serverId: string, tool: string, args: any): Promise<any> {
    const server = this.registeredServers.get(serverId);
    if (!server) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    // Make request to MCP server
    const response = await fetch(`${server.config.url}/tools/${tool}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(server.config.auth?.credentials ? {
          'Authorization': `Bearer ${server.config.auth.credentials.token}`
        } : {})
      },
      body: JSON.stringify(args)
    });

    if (!response.ok) {
      throw new Error(`MCP tool call failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get an MCP resource
   */
  async getResource(serverId: string, resource: string): Promise<any> {
    const server = this.registeredServers.get(serverId);
    if (!server) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    const response = await fetch(`${server.config.url}/resources/${resource}`, {
      headers: {
        ...(server.config.auth?.credentials ? {
          'Authorization': `Bearer ${server.config.auth.credentials.token}`
        } : {})
      }
    });

    if (!response.ok) {
      throw new Error(`MCP resource fetch failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * List server capabilities
   */
  async listCapabilities(serverId: string): Promise<any> {
    const server = this.registeredServers.get(serverId);
    if (!server) {
      throw new Error(`MCP server not found: ${serverId}`);
    }

    const response = await fetch(`${server.config.url}/capabilities`);
    return await response.json();
  }

  /**
   * List all servers
   */
  async list(): Promise<MCPServer[]> {
    return Array.from(this.registeredServers.values());
  }

  /**
   * Get server by ID
   */
  async get(serverId: string): Promise<MCPServer | undefined> {
    return this.registeredServers.get(serverId);
  }

  /**
   * Remove server
   */
  async remove(serverId: string): Promise<void> {
    this.registeredServers.delete(serverId);
    await this.persist();
  }

  /**
   * Health check all servers
   */
  async healthCheck(): Promise<void> {
    for (const [id, server] of this.registeredServers.entries()) {
      try {
        const response = await fetch(`${server.config.url}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });

        server.status = response.ok ? 'active' : 'error';
        server.lastHealthCheck = Date.now();

      } catch (error) {
        server.status = 'error';
        server.lastHealthCheck = Date.now();
      }
    }

    await this.persist();
  }

  /**
   * Handle MCP commands
   */
  async handleCommand(decision: any): Promise<any> {
    const { action, params } = decision;

    switch (action) {
      case 'deploy':
        return this.deploy(params.config);

      case 'list':
        return this.list();

      case 'call_tool':
        return this.callTool(params.serverId, params.tool, params.args);

      case 'get_resource':
        return this.getResource(params.serverId, params.resource);

      case 'capabilities':
        return this.listCapabilities(params.serverId);

      case 'remove':
        await this.remove(params.serverId);
        return { success: true };

      default:
        throw new Error(`Unknown MCP command: ${action}`);
    }
  }

  /**
   * Persist servers to storage
   */
  private async persist(): Promise<void> {
    const servers = Array.from(this.registeredServers.values());
    await this.ctx.storage.put('mcp_servers', servers);
  }
}
