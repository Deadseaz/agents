/**
 * Error severity levels
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Error categories
 */
export type ErrorCategory =
  | "authentication"
  | "authorization"
  | "configuration"
  | "network"
  | "storage"
  | "security"
  | "mcp"
  | "knowledge"
  | "communication"
  | "monitoring"
  | "system"
  | "unknown";

/**
 * Custom error interface
 */
export interface MasterControlError extends Error {
  /** Error code */
  code: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Stack trace */
  stackTrace?: string;
  /** Whether error has been handled */
  handled: boolean;
}

/**
 * Error log entry
 */
export type ErrorLogEntry = {
  /** Unique identifier for the error */
  id: string;
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Stack trace */
  stackTrace?: string;
  /** Whether error has been handled */
  handled: boolean;
  /** User ID associated with error (if applicable) */
  userId?: string;
  /** Session ID associated with error (if applicable) */
  sessionId?: string;
};

/**
 * Error handler configuration
 */
export type ErrorHandlerConfig = {
  /** Whether to log errors */
  logErrors: boolean;
  /** Minimum severity level to log */
  minLogSeverity: ErrorSeverity;
  /** Whether to send error notifications */
  sendNotifications: boolean;
  /** Notification recipients */
  notificationRecipients: string[];
  /** Whether to automatically retry failed operations */
  autoRetry: boolean;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Whether to capture stack traces */
  captureStackTraces: boolean;
};

/**
 * Error statistics
 */
export type ErrorStatistics = {
  /** Total errors */
  totalErrors: number;
  /** Errors by category */
  errorsByCategory: Record<ErrorCategory, number>;
  /** Errors by severity */
  errorsBySeverity: Record<ErrorSeverity, number>;
  /** Most common errors */
  commonErrors: { code: string; count: number }[];
  /** Error rate (errors per minute) */
  errorRate: number;
};

/**
 * Master Control Error Handler
 */
export class MasterControlErrorHandler {
  /** Error log entries */
  private errorLog: ErrorLogEntry[] = [];

  /** Maximum number of error log entries to keep */
  private maxLogEntries = 1000;

  /** Error handler configuration */
  private config: ErrorHandlerConfig = {
    logErrors: true,
    minLogSeverity: "medium",
    sendNotifications: false,
    notificationRecipients: [],
    autoRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
    captureStackTraces: true
  };

  /** Error statistics */
  private statistics: ErrorStatistics = {
    totalErrors: 0,
    errorsByCategory: {
      authentication: 0,
      authorization: 0,
      configuration: 0,
      network: 0,
      storage: 0,
      security: 0,
      mcp: 0,
      knowledge: 0,
      communication: 0,
      monitoring: 0,
      system: 0,
      unknown: 0
    },
    errorsBySeverity: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    },
    commonErrors: [],
    errorRate: 0
  };

  /** Last error timestamp for rate calculation */
  private lastErrorTimestamp: number = Date.now();

  /** Error listeners */
  private errorListeners: Array<(error: MasterControlError) => void> = [];

  /**
   * Initialize the error handler
   */
  constructor() {
    // Start error rate calculation interval
    setInterval(() => {
      this.calculateErrorRate();
    }, 60000); // Update error rate every minute
  }

  /**
   * Create a custom error
   */
  createError(
    message: string,
    code: string,
    category: ErrorCategory = "unknown",
    severity: ErrorSeverity = "medium",
    context?: Record<string, unknown>
  ): MasterControlError {
    const error = new Error(message) as MasterControlError;
    error.code = code;
    error.category = category;
    error.severity = severity;
    error.context = context;
    error.timestamp = Date.now();
    error.handled = false;

    if (this.config.captureStackTraces) {
      error.stackTrace = error.stack;
    }

    return error;
  }

  /**
   * Handle an error
   */
  async handleError(
    error: MasterControlError,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      // Mark error as handled
      error.handled = true;

      // Log the error if configured to do so
      if (this.config.logErrors && this.shouldLogError(error)) {
        await this.logError(error, userId, sessionId);
      }

      // Update statistics
      this.updateStatistics(error);

      // Notify listeners
      this.notifyErrorListeners(error);

      // Send notifications if configured to do so
      if (this.config.sendNotifications && this.shouldNotifyError(error)) {
        await this.sendErrorNotification(error, userId, sessionId);
      }
    } catch (handlerError) {
      // If there's an error in the error handler, log it to console
      console.error("Error in error handler:", handlerError);
    }
  }

  /**
   * Log an error
   */
  private async logError(
    error: MasterControlError,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    const logEntry: ErrorLogEntry = {
      id: this.generateId(),
      code: error.code,
      message: error.message,
      category: error.category,
      severity: error.severity,
      context: error.context,
      timestamp: error.timestamp,
      stackTrace: error.stackTrace,
      handled: error.handled,
      userId,
      sessionId
    };

    // Add to error log
    this.errorLog.push(logEntry);

    // Trim log if necessary
    if (this.errorLog.length > this.maxLogEntries) {
      this.errorLog = this.errorLog.slice(-this.maxLogEntries);
    }

    // Output to console
    const timestamp = new Date(error.timestamp).toISOString();
    console.error(
      `[${timestamp}] [${error.severity.toUpperCase()}] [${error.category}] ${error.code}: ${error.message}`
    );

    // Output stack trace if available
    if (error.stackTrace) {
      console.error(error.stackTrace);
    }
  }

  /**
   * Determine if an error should be logged based on severity
   */
  private shouldLogError(error: MasterControlError): boolean {
    const severityLevels: Record<ErrorSeverity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };

    return (
      severityLevels[error.severity] >=
      severityLevels[this.config.minLogSeverity]
    );
  }

  /**
   * Determine if an error should trigger a notification
   */
  private shouldNotifyError(error: MasterControlError): boolean {
    // Notify for high and critical severity errors
    return error.severity === "high" || error.severity === "critical";
  }

  /**
   * Send error notification
   */
  private async sendErrorNotification(
    error: MasterControlError,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    // In a real implementation, this would send notifications via email, Slack, etc.
    // For this example, we'll just log the notification

    console.log(
      `[NOTIFICATION] Error ${error.code} occurred for user ${userId || "unknown"}: ${error.message}`
    );

    // Log notification attempt
    this.logError({
      name: "NotificationError",
      message: `Notification sent for error ${error.code}`,
      code: "NOTIFICATION_SENT",
      category: "system",
      severity: "low",
      timestamp: Date.now(),
      handled: true
    } as any);
  }

  /**
   * Update error statistics
   */
  private updateStatistics(error: MasterControlError): void {
    // Increment total errors
    this.statistics.totalErrors++;

    // Increment category count
    this.statistics.errorsByCategory[error.category]++;

    // Increment severity count
    this.statistics.errorsBySeverity[error.severity]++;

    // Update common errors
    const existingError = this.statistics.commonErrors.find(
      (e) => e.code === error.code
    );
    if (existingError) {
      existingError.count++;
    } else {
      this.statistics.commonErrors.push({ code: error.code, count: 1 });
    }

    // Sort common errors by count (descending)
    this.statistics.commonErrors.sort((a, b) => b.count - a.count);

    // Keep only top 10 common errors
    if (this.statistics.commonErrors.length > 10) {
      this.statistics.commonErrors = this.statistics.commonErrors.slice(0, 10);
    }
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): void {
    const now = Date.now();
    const timeDiff = (now - this.lastErrorTimestamp) / 60000; // Time difference in minutes
    const errorsInPeriod = this.errorLog.filter(
      (entry) => entry.timestamp >= this.lastErrorTimestamp
    ).length;

    this.statistics.errorRate = timeDiff > 0 ? errorsInPeriod / timeDiff : 0;
    this.lastErrorTimestamp = now;
  }

  /**
   * Add an error listener
   */
  addErrorListener(listener: (error: MasterControlError) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * Remove an error listener
   */
  removeErrorListener(listener: (error: MasterControlError) => void): void {
    const index = this.errorListeners.indexOf(listener);
    if (index !== -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * Notify error listeners
   */
  private notifyErrorListeners(error: MasterControlError): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (listenerError) {
        console.error("Error in error listener:", listenerError);
      }
    }
  }

  /**
   * Get recent error log entries
   */
  getRecentErrors(
    limit = 50,
    category?: ErrorCategory,
    severity?: ErrorSeverity
  ): ErrorLogEntry[] {
    let filteredErrors = [...this.errorLog];

    // Filter by category if specified
    if (category) {
      filteredErrors = filteredErrors.filter(
        (error) => error.category === category
      );
    }

    // Filter by severity if specified
    if (severity) {
      filteredErrors = filteredErrors.filter(
        (error) => error.severity === severity
      );
    }

    // Sort by timestamp descending
    filteredErrors.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    return filteredErrors.slice(0, limit);
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): ErrorStatistics {
    return { ...this.statistics };
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error log size
   */
  getErrorLogSize(): number {
    return this.errorLog.length;
  }

  /**
   * Get configuration
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Retry an operation with exponential backoff
   */
  async retryOperation<T>(
    operation: () => Promise<T>,
    retries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: any = null;

    for (let i = 0; i <= retries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // If this is the last retry, re-throw the error
        if (i === retries) {
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, i);
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError;
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Wrap an operation with error handling
   */
  async wrapOperation<T>(
    operation: () => Promise<T>,
    errorContext?: Record<string, unknown>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      // If it's already a MasterControlError, handle it directly
      if (this.isMasterControlError(error)) {
        await this.handleError(error);
        throw error;
      }

      // Otherwise, create a new MasterControlError
      const masterError = this.createError(
        error.message || "Unknown error occurred",
        "UNKNOWN_ERROR",
        "system",
        "medium",
        errorContext
      );

      await this.handleError(masterError);
      throw masterError;
    }
  }

  /**
   * Check if an error is a MasterControlError
   */
  private isMasterControlError(error: any): error is MasterControlError {
    return (
      error &&
      typeof error === "object" &&
      "code" in error &&
      "category" in error &&
      "severity" in error &&
      "timestamp" in error
    );
  }
}
