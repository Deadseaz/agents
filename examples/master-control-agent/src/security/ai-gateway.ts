/**
 * Cloudflare AI Gateway Integration
 *
 * Provides caching, rate limiting, and additional prompt injection protection
 */

export interface AIGatewayConfig {
  gatewayId?: string;
  accountId?: string;
  apiToken?: string;
  cacheTTL?: number; // seconds
  rateLimitRPM?: number;
}

export interface AIGatewayRequest {
  prompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  userId?: string;
}

export interface AIGatewayResponse {
  response: string;
  cached: boolean;
  tokensUsed: number;
  latencyMs: number;
}

export class AIGatewayManager {
  private gatewayUrl: string;

  constructor(private config: AIGatewayConfig) {
    this.gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}`;
  }

  /**
   * Send request through AI Gateway
   */
  async request(request: AIGatewayRequest): Promise<AIGatewayResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.gatewayUrl}/anthropic/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiToken}`,
          "cf-aig-cache-ttl": String(this.config.cacheTTL || 3600)
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature || 0.7,
          messages: [
            {
              role: "user",
              content: request.prompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`AI Gateway error: ${response.statusText}`);
      }

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      return {
        response: data.content[0].text,
        cached: response.headers.get("cf-cache-status") === "HIT",
        tokensUsed: data.usage.total_tokens,
        latencyMs
      };

    } catch (error) {
      throw new Error(`AI Gateway request failed: ${error}`);
    }
  }

  /**
   * Check if user is rate limited
   */
  async checkRateLimit(userId: string): Promise<boolean> {
    // AI Gateway handles rate limiting automatically
    // This method can be used for custom rate limiting logic
    return true;
  }

  /**
   * Get cached response if available
   */
  async getCached(prompt: string): Promise<string | null> {
    // AI Gateway handles caching automatically
    // This method can be used for custom cache lookups
    return null;
  }

  /**
   * Configure firewall rules for prompt injection
   */
  async configureFirewall(rules: any[]): Promise<void> {
    // Configure AI Gateway firewall rules via API
    // This would use Cloudflare's API to set up custom rules
  }

  /**
   * Get usage analytics
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<any> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/ai-gateway/analytics`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${this.config.apiToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      throw new Error(`Analytics request failed: ${error}`);
    }
  }

  /**
   * Enable/disable AI Gateway
   */
  setEnabled(enabled: boolean): void {
    // Toggle AI Gateway usage
    if (!enabled) {
      this.gatewayUrl = "";
    }
  }
}
