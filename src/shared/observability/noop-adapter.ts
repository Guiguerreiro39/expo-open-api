import type { ErrorInfo } from "react";
import type { BreadcrumbEntry, DefectContext, ObservabilityService, TelemetryUser } from "./port";

export class NoopObservabilityAdapter implements ObservabilityService {
  captureDefect(_error: unknown, _context?: DefectContext): void {}

  captureReactError(
    _error: unknown,
    _errorInfo?: ErrorInfo | { componentStack?: string | null },
  ): void {}

  recordBreadcrumb(_entry: BreadcrumbEntry): void {}

  setUserContext(_user: TelemetryUser | null): void {}

  clearUserContext(): void {}

  setUser(_user: TelemetryUser | null): void {}
}

export const noopObservabilityAdapter = new NoopObservabilityAdapter();
