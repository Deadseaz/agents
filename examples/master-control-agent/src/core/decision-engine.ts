/**
 * Decision Engine
 *
 * Uses LLM to analyze commands and make intelligent decisions
 */

import { generateText, generateObject } from "ai";
import { z } from "zod";

const DecisionSchema = z.object({
  category: z.enum([
    "cloudflare",
    "docker",
    "subagent",
    "mcp",
    "domain",
    "knowledge",
    "system",
    "general"
  ]),
  action: z.string(),
  params: z.record(z.any()).optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  requiresApproval: z.boolean(),
  estimatedDuration: z.number(), // milliseconds
  risks: z.array(z.string()).optional()
});

export type Decision = z.infer<typeof DecisionSchema>;

export interface DecisionContext {
  context: any;
  capabilities: string[];
}

export class DecisionEngine {
  constructor(private model: any) {}

  /**
   * Analyze a command and determine the best course of action
   */
  async analyze(command: string, context: DecisionContext): Promise<Decision> {
    const systemPrompt = `You are the decision engine for a Master Control Agent.
Your role is to analyze user commands and determine:
1. What category of operation this is
2. What specific action should be taken
3. What parameters are needed
4. How confident you are in this decision
5. Whether it requires human approval
6. Estimated time to complete
7. Any potential risks

Available capabilities:
${context.capabilities.join('\n')}

Current system context:
${JSON.stringify(context.context, null, 2)}

Respond with structured decision data.`;

    const { object } = await generateObject({
      model: this.model,
      schema: DecisionSchema,
      system: systemPrompt,
      prompt: `Analyze this command: "${command}"`,
      temperature: 0.3 // Lower temperature for more deterministic decisions
    });

    return object;
  }

  /**
   * Validate if a decision can be executed safely
   */
  async validate(decision: Decision, context: DecisionContext): Promise<{
    valid: boolean;
    reasons?: string[];
  }> {
    // Check if capability exists
    if (!context.capabilities.includes(`${decision.category}_operations`)) {
      return {
        valid: false,
        reasons: [`Capability not available: ${decision.category}`]
      };
    }

    // Check for high-risk operations
    if (decision.risks && decision.risks.length > 0) {
      const highRisk = decision.risks.some(r =>
        r.toLowerCase().includes("delete") ||
        r.toLowerCase().includes("destroy") ||
        r.toLowerCase().includes("remove")
      );

      if (highRisk && !decision.requiresApproval) {
        return {
          valid: false,
          reasons: ["High-risk operation requires approval"]
        };
      }
    }

    // Additional validation logic can be added here

    return { valid: true };
  }

  /**
   * Generate execution plan for complex operations
   */
  async plan(command: string, context: DecisionContext): Promise<Decision[]> {
    const systemPrompt = `You are creating an execution plan for a complex operation.
Break down the command into a series of steps, each with its own decision.
Consider dependencies and ordering.

Available capabilities:
${context.capabilities.join('\n')}

Respond with an array of decision objects.`;

    const { text } = await generateText({
      model: this.model,
      system: systemPrompt,
      prompt: `Create execution plan for: "${command}"`,
      temperature: 0.3
    });

    // Parse the response into Decision objects
    try {
      const steps = JSON.parse(text);
      return steps.map((step: any) => DecisionSchema.parse(step));
    } catch (error) {
      // Fallback to single-step decision
      return [await this.analyze(command, context)];
    }
  }

  /**
   * Learn from execution results
   */
  async learn(command: string, decision: Decision, result: any, success: boolean): Promise<void> {
    // This would store execution history for future decision improvements
    // Implementation would use the knowledge base
    const learningData = {
      command,
      decision,
      result,
      success,
      timestamp: Date.now()
    };

    // Store for future reference
    // await this.knowledgeBase.store('execution_history', learningData);
  }

  /**
   * Suggest optimizations based on past executions
   */
  async suggest(command: string, context: DecisionContext): Promise<string[]> {
    const systemPrompt = `Based on the command and context, suggest optimizations
or alternative approaches that might be more efficient or safer.`;

    const { text } = await generateText({
      model: this.model,
      system: systemPrompt,
      prompt: `Command: "${command}"\nContext: ${JSON.stringify(context.context)}`,
      temperature: 0.5,
      maxTokens: 500
    });

    return text.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim().substring(1).trim());
  }
}
