import { callable } from "./index";

/**
 * Metric types
 */
export type MetricType = "counter" | "gauge" | "histogram" | "summary";

/**
 * Alert severity levels
 */
export type AlertSeverity = "info" | "warning" | "error" | "critical";

/**
 * Metric definition
 */
export type Metric = {
  /** Unique identifier for the metric */
  id: string;
  /** Name of the metric */
  name: string;
  /** Description of the metric */
  description: string;
  /** Type of the metric */
  type: MetricType;
  /** Current value of the metric */
  value: number;
  /** Labels for the metric */
  labels: Record<string, string>;
  /** Timestamp of last update */
  lastUpdated: number;
};

/**
 * Alert definition
 */
export type Alert = {
  /** Unique identifier for the alert */
  id: string;
  /** Name of the alert */
  name: string;
  /** Description of the alert */
  description: string;
  /** Severity level */
  severity: AlertSeverity;
  /** Whether the alert is active */
  active: boolean;
  /** Timestamp when alert was triggered */
  triggeredAt: number;
  /** Timestamp when alert was resolved */
  resolvedAt?: number;
  /** Labels for the alert */
  labels: Record<string, string>;
};

/**
 * Log entry
 */
export type LogEntry = {
  /** Unique identifier for the log entry */
  id: string;
  /** Log message */
  message: string;
  /** Log level */
  level: "debug" | "info" | "warn" | "error" | "fatal";
  /** Timestamp of the log entry */
  timestamp: number;
  /** Labels for the log entry */
  labels: Record<string, string>;
  /** Additional context data */
  context?: Record<string, unknown>;
};

/**
 * Monitoring and Observability system for Master Control Agent
 */
export class MasterControlMonitoring {
  /** In-memory storage for metrics */
  private metrics: Map<string, Metric> = new Map();

  /** In-memory storage for alerts */
  private alerts: Map<string, Alert> = new Map();

  /** In-memory storage for logs */
  private logs: LogEntry[] = [];

  /** Maximum number of logs to keep in memory */
  private maxLogs: number = 1000;

  /** Alert rules */
  private alertRules: Map<
    string,
    {
      metricId: string;
      threshold: number;
      operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
      severity: AlertSeverity;
      duration?: number; // Duration in milliseconds for which threshold must be exceeded
    }
  > = new Map();

  /**
   * Initialize the monitoring system
   */
  constructor() {
    // Initialize default metrics
    this.initializeDefaultMetrics();
  }

  /**
   * Initialize default metrics
   */
  private initializeDefaultMetrics(): void {
    // Create default metrics
    const defaultMetrics: Metric[] = [
      {
        id: "system_uptime",
        name: "System Uptime",
        description: "Total uptime of the system in seconds",
        type: "gauge",
        value: 0,
        labels: { system: "master-control" },
        lastUpdated: Date.now()
      },
      {
        id: "active_connections",
        name: "Active Connections",
        description: "Number of currently active connections",
        type: "gauge",
        value: 0,
        labels: { system: "master-control" },
        lastUpdated: Date.now()
      },
      {
        id: "requests_total",
        name: "Total Requests",
        description: "Total number of requests processed",
        type: "counter",
        value: 0,
        labels: { system: "master-control" },
        lastUpdated: Date.now()
      },
      {
        id: "errors_total",
        name: "Total Errors",
        description: "Total number of errors encountered",
        type: "counter",
        value: 0,
        labels: { system: "master-control" },
        lastUpdated: Date.now()
      },
      {
        id: "request_duration_seconds",
        name: "Request Duration",
        description: "Duration of requests in seconds",
        type: "histogram",
        value: 0,
        labels: { system: "master-control" },
        lastUpdated: Date.now()
      }
    ];

    for (const metric of defaultMetrics) {
      this.metrics.set(metric.id, metric);
    }

    // Start uptime counter
    this.startUptimeCounter();
  }

  /**
   * Start uptime counter
   */
  private startUptimeCounter(): void {
    setInterval(() => {
      const uptimeMetric = this.metrics.get("system_uptime");
      if (uptimeMetric) {
        uptimeMetric.value += 1;
        uptimeMetric.lastUpdated = Date.now();
        this.metrics.set("system_uptime", uptimeMetric);
      }
    }, 1000);
  }

  /**
   * Record a metric value
   */
  @callable({ description: "Record a metric value" })
  async recordMetric(params: {
    metricId: string;
    value: number;
    labels?: Record<string, string>;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const metric = this.metrics.get(params.metricId);
      if (!metric) {
        return {
          success: false,
          message: "Metric not found"
        };
      }

      // Update metric value
      metric.value = params.value;
      metric.lastUpdated = Date.now();

      if (params.labels) {
        metric.labels = { ...metric.labels, ...params.labels };
      }

      this.metrics.set(params.metricId, metric);

      // Check alert rules
      this.checkAlertRules(params.metricId, params.value);

      return {
        success: true,
        message: "Metric recorded successfully"
      };
    } catch (error) {
      console.error("Metric recording error:", error);
      return {
        success: false,
        message: "Failed to record metric: Internal error"
      };
    }
  }

  /**
   * Increment a counter metric
   */
  @callable({ description: "Increment a counter metric" })
  async incrementCounter(params: {
    metricId: string;
    incrementBy?: number;
    labels?: Record<string, string>;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const metric = this.metrics.get(params.metricId);
      if (!metric) {
        return {
          success: false,
          message: "Metric not found"
        };
      }

      if (metric.type !== "counter") {
        return {
          success: false,
          message: "Metric is not a counter"
        };
      }

      // Increment metric value
      metric.value += params.incrementBy || 1;
      metric.lastUpdated = Date.now();

      if (params.labels) {
        metric.labels = { ...metric.labels, ...params.labels };
      }

      this.metrics.set(params.metricId, metric);

      // Check alert rules
      this.checkAlertRules(params.metricId, metric.value);

      return {
        success: true,
        message: "Counter incremented successfully"
      };
    } catch (error) {
      console.error("Counter increment error:", error);
      return {
        success: false,
        message: "Failed to increment counter: Internal error"
      };
    }
  }

  /**
   * Get a metric value
   */
  @callable({ description: "Get a metric value" })
  async getMetric(params: { metricId: string }): Promise<{
    success: boolean;
    message: string;
    metric?: Metric;
  }> {
    try {
      const metric = this.metrics.get(params.metricId);
      if (!metric) {
        return {
          success: false,
          message: "Metric not found"
        };
      }

      return {
        success: true,
        message: "Metric retrieved successfully",
        metric
      };
    } catch (error) {
      console.error("Metric retrieval error:", error);
      return {
        success: false,
        message: "Failed to retrieve metric: Internal error"
      };
    }
  }

  /**
   * List all metrics
   */
  @callable({ description: "List all metrics" })
  async listMetrics(): Promise<{
    success: boolean;
    message: string;
    metrics?: Metric[];
  }> {
    try {
      const metrics = Array.from(this.metrics.values());

      return {
        success: true,
        message: "Metrics retrieved successfully",
        metrics
      };
    } catch (error) {
      console.error("Metrics listing error:", error);
      return {
        success: false,
        message: "Failed to retrieve metrics: Internal error"
      };
    }
  }

  /**
   * Create an alert rule
   */
  @callable({ description: "Create an alert rule" })
  async createAlertRule(params: {
    ruleId: string;
    metricId: string;
    threshold: number;
    operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
    severity: AlertSeverity;
    duration?: number;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // Check if metric exists
      if (!this.metrics.has(params.metricId)) {
        return {
          success: false,
          message: "Metric not found"
        };
      }

      // Store alert rule
      this.alertRules.set(params.ruleId, {
        metricId: params.metricId,
        threshold: params.threshold,
        operator: params.operator,
        severity: params.severity,
        duration: params.duration
      });

      return {
        success: true,
        message: "Alert rule created successfully"
      };
    } catch (error) {
      console.error("Alert rule creation error:", error);
      return {
        success: false,
        message: "Failed to create alert rule: Internal error"
      };
    }
  }

  /**
   * Check alert rules when a metric is updated
   */
  private checkAlertRules(metricId: string, value: number): void {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (rule.metricId === metricId) {
        // Check if condition is met
        let conditionMet = false;

        switch (rule.operator) {
          case ">":
            conditionMet = value > rule.threshold;
            break;
          case "<":
            conditionMet = value < rule.threshold;
            break;
          case ">=":
            conditionMet = value >= rule.threshold;
            break;
          case "<=":
            conditionMet = value <= rule.threshold;
            break;
          case "==":
            conditionMet = value === rule.threshold;
            break;
          case "!=":
            conditionMet = value !== rule.threshold;
            break;
        }

        if (conditionMet) {
          // Trigger alert
          this.triggerAlert(
            ruleId,
            rule.severity,
            `Metric ${metricId} ${rule.operator} ${rule.threshold}`
          );
        }
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(
    ruleId: string,
    severity: AlertSeverity,
    message: string
  ): void {
    const alertId = `alert-${this.generateId()}`;

    const alert: Alert = {
      id: alertId,
      name: `Alert from rule ${ruleId}`,
      description: message,
      severity,
      active: true,
      triggeredAt: Date.now(),
      labels: { ruleId, severity }
    };

    this.alerts.set(alertId, alert);

    // Log the alert
    this.log({
      level: "warn",
      message: `ALERT: ${message}`,
      labels: { alertId, severity }
    });
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
   * Resolve an alert
   */
  @callable({ description: "Resolve an alert" })
  async resolveAlert(params: {
    alertId: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const alert = this.alerts.get(params.alertId);
      if (!alert) {
        return {
          success: false,
          message: "Alert not found"
        };
      }

      // Resolve alert
      alert.active = false;
      alert.resolvedAt = Date.now();
      this.alerts.set(params.alertId, alert);

      return {
        success: true,
        message: "Alert resolved successfully"
      };
    } catch (error) {
      console.error("Alert resolution error:", error);
      return {
        success: false,
        message: "Failed to resolve alert: Internal error"
      };
    }
  }

  /**
   * List active alerts
   */
  @callable({ description: "List active alerts" })
  async listActiveAlerts(): Promise<{
    success: boolean;
    message: string;
    alerts?: Alert[];
  }> {
    try {
      const activeAlerts = Array.from(this.alerts.values()).filter(
        (alert) => alert.active
      );

      return {
        success: true,
        message: "Active alerts retrieved successfully",
        alerts: activeAlerts
      };
    } catch (error) {
      console.error("Active alerts listing error:", error);
      return {
        success: false,
        message: "Failed to retrieve active alerts: Internal error"
      };
    }
  }

  /**
   * List all alerts
   */
  @callable({ description: "List all alerts" })
  async listAllAlerts(): Promise<{
    success: boolean;
    message: string;
    alerts?: Alert[];
  }> {
    try {
      const alerts = Array.from(this.alerts.values());

      return {
        success: true,
        message: "Alerts retrieved successfully",
        alerts
      };
    } catch (error) {
      console.error("Alerts listing error:", error);
      return {
        success: false,
        message: "Failed to retrieve alerts: Internal error"
      };
    }
  }

  /**
   * Log a message
   */
  @callable({ description: "Log a message" })
  async log(params: {
    level: "debug" | "info" | "warn" | "error" | "fatal";
    message: string;
    labels?: Record<string, string>;
    context?: Record<string, unknown>;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const logEntry: LogEntry = {
        id: this.generateId(),
        level: params.level,
        message: params.message,
        timestamp: Date.now(),
        labels: params.labels || {},
        context: params.context
      };

      // Add to logs array
      this.logs.push(logEntry);

      // Trim logs if necessary
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs);
      }

      // Output to console
      const timestamp = new Date(logEntry.timestamp).toISOString();
      console.log(
        `[${timestamp}] [${logEntry.level.toUpperCase()}] ${logEntry.message}`
      );

      return {
        success: true,
        message: "Log entry created successfully"
      };
    } catch (error) {
      console.error("Log entry error:", error);
      return {
        success: false,
        message: "Failed to create log entry: Internal error"
      };
    }
  }

  /**
   * Get recent logs
   */
  @callable({ description: "Get recent logs" })
  async getRecentLogs(params: {
    limit?: number;
    level?: "debug" | "info" | "warn" | "error" | "fatal";
  }): Promise<{
    success: boolean;
    message: string;
    logs?: LogEntry[];
  }> {
    try {
      let filteredLogs = [...this.logs];

      // Filter by level if specified
      if (params.level) {
        filteredLogs = filteredLogs.filter((log) => log.level === params.level);
      }

      // Sort by timestamp descending
      filteredLogs.sort((a, b) => b.timestamp - a.timestamp);

      // Limit results
      const limit = params.limit || 50;
      const recentLogs = filteredLogs.slice(0, limit);

      return {
        success: true,
        message: "Logs retrieved successfully",
        logs: recentLogs
      };
    } catch (error) {
      console.error("Logs retrieval error:", error);
      return {
        success: false,
        message: "Failed to retrieve logs: Internal error"
      };
    }
  }

  /**
   * Get system health status
   */
  @callable({ description: "Get system health status" })
  async getSystemHealth(): Promise<{
    success: boolean;
    message: string;
    health?: {
      status: "healthy" | "degraded" | "unhealthy";
      uptime: number;
      activeAlerts: number;
      errorRate: number;
      lastUpdated: number;
    };
  }> {
    try {
      const uptimeMetric = this.metrics.get("system_uptime");
      const requestsMetric = this.metrics.get("requests_total");
      const errorsMetric = this.metrics.get("errors_total");

      const uptime = uptimeMetric?.value || 0;
      const totalRequests = requestsMetric?.value || 0;
      const totalErrors = errorsMetric?.value || 0;

      const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

      // Determine health status based on active alerts and error rate
      const activeAlerts = Array.from(this.alerts.values()).filter(
        (alert) => alert.active
      );
      const criticalAlerts = activeAlerts.filter(
        (alert) => alert.severity === "critical" || alert.severity === "error"
      );

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";

      if (criticalAlerts.length > 0) {
        status = "unhealthy";
      } else if (activeAlerts.length > 0 || errorRate > 0.05) {
        // 5% error rate threshold
        status = "degraded";
      }

      return {
        success: true,
        message: "System health retrieved successfully",
        health: {
          status,
          uptime,
          activeAlerts: activeAlerts.length,
          errorRate,
          lastUpdated: Date.now()
        }
      };
    } catch (error) {
      console.error("System health check error:", error);
      return {
        success: false,
        message: "Failed to retrieve system health: Internal error"
      };
    }
  }

  /**
   * Get metrics summary
   */
  @callable({ description: "Get metrics summary" })
  async getMetricsSummary(): Promise<{
    success: boolean;
    message: string;
    summary?: {
      totalMetrics: number;
      totalAlerts: number;
      activeAlerts: number;
      totalLogs: number;
      uptime: number;
    };
  }> {
    try {
      const totalMetrics = this.metrics.size;
      const totalAlerts = this.alerts.size;
      const activeAlerts = Array.from(this.alerts.values()).filter(
        (alert) => alert.active
      ).length;
      const totalLogs = this.logs.length;
      const uptimeMetric = this.metrics.get("system_uptime");
      const uptime = uptimeMetric?.value || 0;

      return {
        success: true,
        message: "Metrics summary retrieved successfully",
        summary: {
          totalMetrics,
          totalAlerts,
          activeAlerts,
          totalLogs,
          uptime
        }
      };
    } catch (error) {
      console.error("Metrics summary error:", error);
      return {
        success: false,
        message: "Failed to retrieve metrics summary: Internal error"
      };
    }
  }
}
