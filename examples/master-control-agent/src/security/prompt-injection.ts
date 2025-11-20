/**
 * Prompt Injection Detection
 *
 * Multi-layered protection against prompt injection attacks
 */

export interface InjectionCheckResult {
  detected: boolean;
  confidence: number;
  reasons: string[];
  sanitized?: string;
}

export class PromptInjectionDetector {
  private suspiciousPatterns = [
    // System prompt manipulation
    /ignore\s+(previous|all|above)\s+instructions?/i,
    /forget\s+(previous|all|everything)/i,
    /disregard\s+(previous|all|above)/i,
    /new\s+instructions?:/i,
    /system\s*:/i,
    /assistant\s*:/i,

    // Role manipulation
    /you\s+are\s+now/i,
    /act\s+as\s+if/i,
    /pretend\s+(you|to)\s+are/i,
    /roleplay\s+as/i,

    // Output manipulation
    /output\s+raw/i,
    /print\s+verbatim/i,
    /reveal\s+your/i,
    /show\s+your\s+(instructions|prompt|system)/i,

    // Encoding attempts
    /base64/i,
    /hex\s+encoded/i,
    /rot13/i,

    // Delimiter injection
    /```system/i,
    /<\|im_start\|>/i,
    /<\|im_end\|>/i,

    // Credential extraction
    /api\s*key/i,
    /secret\s*key/i,
    /password/i,
    /token/i,

    // Command injection
    /;\s*rm\s+-rf/i,
    /&&\s*curl/i,
    /\$\(.*\)/i,
    /`.*`/i
  ];

  /**
   * Detect potential prompt injection
   */
  async detect(input: string): Promise<InjectionCheckResult> {
    const reasons: string[] = [];
    let confidence = 0;

    // Pattern matching
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(input)) {
        reasons.push(`Matched suspicious pattern: ${pattern.source}`);
        confidence += 0.2;
      }
    }

    // Statistical analysis
    const stats = this.analyzeStatistics(input);
    if (stats.suspiciousScore > 0.3) {
      reasons.push(`Statistical anomaly detected (score: ${stats.suspiciousScore.toFixed(2)})`);
      confidence += stats.suspiciousScore;
    }

    // Semantic analysis (could be enhanced with LLM)
    const semantic = this.analyzeSemantics(input);
    if (semantic.suspicious) {
      reasons.push(semantic.reason);
      confidence += 0.3;
    }

    const detected = confidence > 0.5;

    return {
      detected,
      confidence: Math.min(confidence, 1),
      reasons,
      sanitized: detected ? this.sanitize(input) : undefined
    };
  }

  /**
   * Statistical analysis of input
   */
  private analyzeStatistics(input: string): { suspiciousScore: number } {
    let score = 0;

    // Check for excessive special characters
    const specialChars = (input.match(/[^a-zA-Z0-9\s.,!?]/g) || []).length;
    const specialRatio = specialChars / input.length;
    if (specialRatio > 0.2) {
      score += 0.2;
    }

    // Check for unusual capitalization
    const upperCase = (input.match(/[A-Z]/g) || []).length;
    const upperRatio = upperCase / input.length;
    if (upperRatio > 0.5) {
      score += 0.1;
    }

    // Check for excessive newlines
    const newlines = (input.match(/\n/g) || []).length;
    if (newlines > 10) {
      score += 0.2;
    }

    // Check for very long input
    if (input.length > 5000) {
      score += 0.1;
    }

    return { suspiciousScore: score };
  }

  /**
   * Semantic analysis
   */
  private analyzeSemantics(input: string): { suspicious: boolean; reason: string } {
    const lowerInput = input.toLowerCase();

    // Check for instruction override attempts
    if (
      (lowerInput.includes("ignore") || lowerInput.includes("disregard")) &&
      (lowerInput.includes("instruction") || lowerInput.includes("prompt"))
    ) {
      return {
        suspicious: true,
        reason: "Instruction override attempt detected"
      };
    }

    // Check for role manipulation
    if (
      (lowerInput.includes("you are") || lowerInput.includes("act as")) &&
      (lowerInput.includes("not") || lowerInput.includes("now"))
    ) {
      return {
        suspicious: true,
        reason: "Role manipulation attempt detected"
      };
    }

    // Check for system access attempts
    if (
      lowerInput.includes("system") &&
      (lowerInput.includes("access") || lowerInput.includes("admin") || lowerInput.includes("root"))
    ) {
      return {
        suspicious: true,
        reason: "System access attempt detected"
      };
    }

    return { suspicious: false, reason: "" };
  }

  /**
   * Sanitize input by removing suspicious content
   */
  private sanitize(input: string): string {
    let sanitized = input;

    // Remove potential system prompts
    sanitized = sanitized.replace(/```system[\s\S]*?```/gi, "");

    // Remove special delimiters
    sanitized = sanitized.replace(/<\|.*?\|>/g, "");

    // Remove potential command injections
    sanitized = sanitized.replace(/;\s*\w+\s+-\w+/g, "");
    sanitized = sanitized.replace(/&&\s*\w+/g, "");
    sanitized = sanitized.replace(/\$\([^)]*\)/g, "");
    sanitized = sanitized.replace(/`[^`]*`/g, "");

    // Normalize whitespace
    sanitized = sanitized.replace(/\n{3,}/g, "\n\n");

    return sanitized.trim();
  }

  /**
   * Validate that sanitized input is safe
   */
  async validateSanitized(sanitized: string): Promise<boolean> {
    const check = await this.detect(sanitized);
    return !check.detected;
  }
}
