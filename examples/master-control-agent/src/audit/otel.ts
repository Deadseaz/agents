/**
 * OpenTelemetry Integration
 *
 * Distributed tracing and observability
 */

export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, any>;
  events: SpanEvent[];
  status: "ok" | "error";
  errorMessage?: string;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
}

export class OTELTracer {
  private activeSpans: Map<string, Span> = new Map();
  private traceId: string;

  constructor(
    private ctx: any,
    private env?: any
  ) {
    this.traceId = this.generateTraceId();
  }

  /**
   * Start a new span
   */
  startSpan(name: string, attributes?: Record<string, any>): Span {
    const span: Span = {
      name,
      traceId: this.traceId,
      spanId: this.generateSpanId(),
      startTime: Date.now(),
      attributes: attributes || {},
      events: [],
      status: "ok"
    };

    this.activeSpans.set(span.spanId, span);

    return span;
  }

  /**
   * End a span
   */
  endSpan(span: Span): void {
    span.endTime = Date.now();
    this.activeSpans.delete(span.spanId);

    // Export span to observability backend
    this.exportSpan(span);
  }

  /**
   * Add event to span
   */
  addEvent(span: Span, event: SpanEvent): void {
    span.events.push(event);
  }

  /**
   * Set span status
   */
  setStatus(span: Span, status: "ok" | "error", errorMessage?: string): void {
    span.status = status;
    if (errorMessage) {
      span.errorMessage = errorMessage;
    }
  }

  /**
   * Add attribute to span
   */
  setAttribute(span: Span, key: string, value: any): void {
    span.attributes[key] = value;
  }

  /**
   * Export span to observability backend
   */
  private async exportSpan(span: Span): Promise<void> {
    // In production, this would export to:
    // - Cloudflare Workers Analytics Engine
    // - External OTEL collector
    // - Datadog, Honeycomb, etc.

    const spanData = {
      name: span.name,
      trace_id: span.traceId,
      span_id: span.spanId,
      parent_span_id: span.parentSpanId,
      start_time: span.startTime,
      end_time: span.endTime,
      duration: span.endTime ? span.endTime - span.startTime : 0,
      attributes: span.attributes,
      events: span.events,
      status: span.status,
      error_message: span.errorMessage
    };

    // Log to console for development
    console.log("[OTEL Span]", JSON.stringify(spanData));

    // Send to Analytics Engine if available
    if (this.env?.ANALYTICS) {
      try {
        this.env.ANALYTICS.writeDataPoint({
          blobs: [
            span.name,
            span.traceId,
            span.spanId,
            span.status
          ],
          doubles: [
            span.startTime,
            span.endTime || 0,
            (span.endTime || 0) - span.startTime
          ],
          indexes: [span.status, span.name]
        });
      } catch (error) {
        console.error("Failed to write span to Analytics Engine:", error);
      }
    }
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return crypto.randomUUID().replace(/-/g, "");
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return crypto.randomUUID().substring(0, 16).replace(/-/g, "");
  }

  /**
   * Get current trace ID
   */
  getTraceId(): string {
    return this.traceId;
  }

  /**
   * Create child tracer with same trace ID
   */
  createChildTracer(): OTELTracer {
    const child = new OTELTracer(this.ctx, this.env);
    child.traceId = this.traceId;
    return child;
  }
}

/**
 * Helper to wrap async functions with tracing
 */
export function traced<T extends (...args: any[]) => Promise<any>>(
  tracer: OTELTracer,
  name: string,
  fn: T
): T {
  return (async (...args: any[]) => {
    const span = tracer.startSpan(name);
    try {
      const result = await fn(...args);
      tracer.setStatus(span, "ok");
      return result;
    } catch (error: any) {
      tracer.setStatus(span, "error", error.message);
      throw error;
    } finally {
      tracer.endSpan(span);
    }
  }) as T;
}
