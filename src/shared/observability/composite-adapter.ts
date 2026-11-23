import type { ErrorInfo } from "react";
import type { BreadcrumbEntry, DefectContext, ObservabilityService, TelemetryUser } from "./port";

export class CompositeObservabilityAdapter implements ObservabilityService {
  constructor(private readonly adapters: ReadonlyArray<ObservabilityService>) {}

  captureDefect(error: unknown, context?: DefectContext): void {
    for (const adapter of this.adapters) {
      try {
        adapter.captureDefect(error, context);
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[CompositeObservabilityAdapter] Adapter failed during captureDefect:", err);
        }
      }
    }
  }

  captureReactError(
    error: unknown,
    errorInfo?: ErrorInfo | { componentStack?: string | null },
  ): void {
    for (const adapter of this.adapters) {
      try {
        adapter.captureReactError(error, errorInfo);
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "[CompositeObservabilityAdapter] Adapter failed during captureReactError:",
            err,
          );
        }
      }
    }
  }

  recordBreadcrumb(entry: BreadcrumbEntry): void {
    for (const adapter of this.adapters) {
      try {
        adapter.recordBreadcrumb(entry);
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "[CompositeObservabilityAdapter] Adapter failed during recordBreadcrumb:",
            err,
          );
        }
      }
    }
  }

  setUserContext(user: TelemetryUser | null): void {
    for (const adapter of this.adapters) {
      try {
        adapter.setUserContext(user);
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "[CompositeObservabilityAdapter] Adapter failed during setUserContext:",
            err,
          );
        }
      }
    }
  }

  clearUserContext(): void {
    for (const adapter of this.adapters) {
      try {
        adapter.clearUserContext();
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            "[CompositeObservabilityAdapter] Adapter failed during clearUserContext:",
            err,
          );
        }
      }
    }
  }

  setUser(user: TelemetryUser | null): void {
    this.setUserContext(user);
  }
}

export function createCompositeAdapter(
  adapters: ReadonlyArray<ObservabilityService>,
): CompositeObservabilityAdapter {
  return new CompositeObservabilityAdapter(adapters);
}
