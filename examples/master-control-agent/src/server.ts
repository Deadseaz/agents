/**
 * Master Control Agent - Server Entry Point
 *
 * Routes requests to the Master Control Agent Durable Object
 */

import { routePartykitRequest, getServerByName } from "partyserver";
import MasterControlAgent from "./core/master-agent";

export { MasterControlAgent };

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Health check endpoint
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({
          status: "healthy",
          timestamp: new Date().toISOString(),
          version: "1.0.0"
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      // API endpoints
      if (url.pathname.startsWith("/api/")) {
        return handleAPI(request, env);
      }

      // Route to Durable Object via PartyServer
      return routePartykitRequest(request, env);

    } catch (error: any) {
      console.error("Request handling error:", error);
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: error.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};

/**
 * Handle API requests
 */
async function handleAPI(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/", "");

  // Get agent instance
  const agentId = url.searchParams.get("agent") || "default";
  const id = env.MasterControlAgent.idFromName(agentId);
  const agent = env.MasterControlAgent.get(id);

  switch (path) {
    case "status":
      return handleStatus(agent);

    case "command":
      return handleCommand(request, agent);

    case "query":
      return handleQuery(request, agent);

    case "logs":
      return handleLogs(agent);

    case "metrics":
      return handleMetrics(agent);

    default:
      return new Response(JSON.stringify({ error: "Unknown API endpoint" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
  }
}

/**
 * Get agent status
 */
async function handleStatus(agent: DurableObjectStub): Promise<Response> {
  try {
    const response = await agent.fetch("http://agent/api/status");
    return response;
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Execute command
 */
async function handleCommand(request: Request, agent: DurableObjectStub): Promise<Response> {
  try {
    const body = await request.json();

    if (!body.command) {
      return new Response(JSON.stringify({ error: "Command is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const response = await agent.fetch("http://agent/api/command", {
      method: "POST",
      body: JSON.stringify(body)
    });

    return response;

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Query knowledge base
 */
async function handleQuery(request: Request, agent: DurableObjectStub): Promise<Response> {
  try {
    const body = await request.json();

    if (!body.query) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const response = await agent.fetch("http://agent/api/query", {
      method: "POST",
      body: JSON.stringify(body)
    });

    return response;

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Get audit logs
 */
async function handleLogs(agent: DurableObjectStub): Promise<Response> {
  try {
    const response = await agent.fetch("http://agent/api/logs");
    return response;
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Get metrics
 */
async function handleMetrics(agent: DurableObjectStub): Promise<Response> {
  try {
    const response = await agent.fetch("http://agent/api/metrics");
    return response;
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Environment bindings interface
 */
export interface Env {
  // Durable Objects
  MasterControlAgent: DurableObjectNamespace;
  WorkerSubagent: DurableObjectNamespace;
  SpecialistSubagent: DurableObjectNamespace;
  MCPServerInstance: DurableObjectNamespace;

  // Storage
  KV: KVNamespace;
  R2: R2Bucket;
  DB: D1Database;

  // AI & Vectorize
  AI: any;
  VECTORIZE: VectorizeIndex;

  // Queues & Analytics
  QUEUE: Queue;
  ANALYTICS: AnalyticsEngineDataset;

  // Configuration
  ENVIRONMENT: string;
  LOG_LEVEL: string;

  // Secrets (set via wrangler secret)
  CLOUDFLARE_API_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  DOCKER_HOST?: string;
  TAILSCALE_KEY?: string;
  ZAPIER_API_KEY?: string;
  N8N_API_KEY?: string;
}

// Type stubs for Cloudflare bindings
interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectId {}

interface DurableObjectStub {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

interface KVNamespace {
  get(key: string, type?: string): Promise<any>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: any): Promise<any>;
}

interface R2Object {
  key: string;
  body: ReadableStream;
  text(): Promise<string>;
  json(): Promise<any>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  all(): Promise<D1Result>;
  first(): Promise<any>;
}

interface D1Result {
  results: any[];
  success: boolean;
  meta: any;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface VectorizeIndex {
  insert(vectors: any[]): Promise<any>;
  upsert(vectors: any[]): Promise<any>;
  query(vector: number[], options?: any): Promise<any>;
  deleteByIds(ids: string[]): Promise<any>;
}

interface Queue {
  send(message: any): Promise<void>;
  sendBatch(messages: any[]): Promise<void>;
}

interface AnalyticsEngineDataset {
  writeDataPoint(data: any): void;
}
