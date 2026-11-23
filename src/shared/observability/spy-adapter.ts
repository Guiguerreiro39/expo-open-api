import type { ErrorInfo } from "react";
import type { BreadcrumbEntry, DefectContext, ObservabilityService, TelemetryUser } from "./port";

export interface CapturedDefect {
  readonly error: unknown;
  readonly context?: DefectContext;
}

export interface CapturedReactError {
  readonly error: unknown;
  readonly errorInfo?: ErrorInfo | { componentStack?: string | null };
}

export class SpyObservabilityAdapter implements ObservabilityService {
  defects: CapturedDefect[] = [];
  reactErrors: CapturedReactError[] = [];
  breadcrumbs: BreadcrumbEntry[] = [];
  userHistory: Array<TelemetryUser | null> = [];
  currentUser: TelemetryUser | null = null;

  captureDefect(error: unknown, context?: DefectContext): void {
    this.defects.push({ error, context });
  }

  captureReactError(
    error: unknown,
    errorInfo?: ErrorInfo | { componentStack?: string | null },
  ): void {
    this.reactErrors.push({ error, errorInfo });
  }

  recordBreadcrumb(entry: BreadcrumbEntry): void {
    this.breadcrumbs.push(entry);
  }

  setUserContext(user: TelemetryUser | null): void {
    this.currentUser = user;
    this.userHistory.push(user);
  }

  clearUserContext(): void {
    this.currentUser = null;
    this.userHistory.push(null);
  }

  setUser(user: TelemetryUser | null): void {
    this.setUserContext(user);
  }

  assertNoDefects(): void {
    if (this.defects.length > 0 || this.reactErrors.length > 0) {
      const parts: string[] = [];
      if (this.defects.length > 0) {
        const summaries = this.defects.map((d) =>
          d.error instanceof Error ? d.error.message : JSON.stringify(d.error),
        );
        parts.push(`${this.defects.length} unexpected defect(s): ${summaries.join("; ")}`);
      }
      if (this.reactErrors.length > 0) {
        const summaries = this.reactErrors.map((r) =>
          r.error instanceof Error ? r.error.message : JSON.stringify(r.error),
        );
        parts.push(`${this.reactErrors.length} React render error(s): ${summaries.join("; ")}`);
      }
      throw new Error(`Expected zero defects, but captured ${parts.join(" and ")}`);
    }
  }

  reset(): void {
    this.defects = [];
    this.reactErrors = [];
    this.breadcrumbs = [];
    this.userHistory = [];
    this.currentUser = null;
  }
}

export function createSpyObservability(): SpyObservabilityAdapter {
  return new SpyObservabilityAdapter();
}
