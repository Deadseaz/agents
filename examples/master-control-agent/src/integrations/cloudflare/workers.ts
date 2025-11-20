/**
 * Cloudflare Workers Integration
 *
 * Deploy and manage Cloudflare Workers
 */

import type { WorkerConfig, WorkerDeployResult } from "./types";

export interface CloudflareAPIConfig {
  accountId: string;
  apiToken: string;
}

export class WorkersManager {
  private baseUrl: string;

  constructor(private config: CloudflareAPIConfig) {
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}`;
  }

  /**
   * Deploy a Worker
   */
  async deploy(workerConfig: WorkerConfig): Promise<WorkerDeployResult> {
    try {
      // Upload worker script
      const response = await fetch(
        `${this.baseUrl}/workers/scripts/${workerConfig.name}`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${this.config.apiToken}`,
            "Content-Type": "application/javascript"
          },
          body: workerConfig.script
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          errors: error.errors?.map((e: any) => e.message) || ["Deployment failed"]
        };
      }

      const result = await response.json();

      // Configure routes if provided
      if (workerConfig.routes && workerConfig.routes.length > 0) {
        await this.configureRoutes(workerConfig.name, workerConfig.routes);
      }

      return {
        success: true,
        workerUrl: `https://${workerConfig.name}.${this.config.accountId}.workers.dev`
      };

    } catch (error) {
      return {
        success: false,
        errors: [String(error)]
      };
    }
  }

  /**
   * Configure worker routes
   */
  private async configureRoutes(workerName: string, routes: string[]): Promise<void> {
    for (const pattern of routes) {
      await fetch(`${this.baseUrl}/workers/routes`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.config.apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pattern,
          script: workerName
        })
      });
    }
  }

  /**
   * List all workers
   */
  async list(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/workers/scripts`, {
        headers: {
          "Authorization": `Bearer ${this.config.apiToken}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to list workers");
      }

      const data = await response.json();
      return data.result || [];

    } catch (error) {
      console.error("Error listing workers:", error);
      return [];
    }
  }

  /**
   * Delete a worker
   */
  async delete(name: string): Promise<void> {
    await fetch(`${this.baseUrl}/workers/scripts/${name}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${this.config.apiToken}`
      }
    });
  }

  /**
   * Get worker logs
   */
  async getLogs(name: string, limit: number = 100): Promise<any[]> {
    try {
      // Use Logpush or Tail Workers for logs
      const response = await fetch(
        `${this.baseUrl}/workers/scripts/${name}/tail`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${this.config.apiToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get logs");
      }

      const data = await response.json();
      return data.result?.logs || [];

    } catch (error) {
      console.error("Error getting logs:", error);
      return [];
    }
  }

  /**
   * Get worker analytics
   */
  async getAnalytics(name: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/workers/scripts/${name}/analytics`,
        {
          headers: {
            "Authorization": `Bearer ${this.config.apiToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get analytics");
      }

      return await response.json();

    } catch (error) {
      console.error("Error getting analytics:", error);
      return {};
    }
  }
}
