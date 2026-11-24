import type { ErrorInfo } from "react";
import type { BreadcrumbEntry, DefectContext, ObservabilityService, TelemetryUser } from "./port";

export interface SentryScopeLike {
  setTag(key: string, value: string): void;
  setExtras(extras: Record<string, unknown>): void;
}

export interface SentryMobileSdk {
  init?: (options: Record<string, unknown>) => void;
  withScope?: (callback: (scope: SentryScopeLike) => void) => void;
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
  addBreadcrumb?: (breadcrumb: Record<string, unknown>) => void;
  setUser?: (user: { id: string; email?: string; username?: string } | null) => void;
}

export interface SentryAdapterConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  apiOrigins?: Array<string | RegExp>;
}

const noopSentrySdk: SentryMobileSdk = {
  captureException: () => {},
};

export class SentryObservabilityAdapter implements ObservabilityService {
  private readonly sdk: SentryMobileSdk;

  constructor(config: SentryAdapterConfig, sdk: SentryMobileSdk = noopSentrySdk) {
    this.sdk = sdk;

    if (config.dsn && typeof this.sdk.init === "function") {
      try {
        this.sdk.init({
          dsn: config.dsn,
          environment: config.environment,
          release: config.release,
          tracesSampleRate: config.tracesSampleRate ?? 0.2,
          tracePropagationTargets: ["localhost", /^\//, ...(config.apiOrigins ?? [])],
        });
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[SentryObservabilityAdapter] Failed to initialize Sentry:", err);
        }
      }
    }
  }

  captureDefect(error: unknown, context?: DefectContext): void {
    if (typeof this.sdk.withScope === "function") {
      this.sdk.withScope((scope) => {
        if (context?.requestId) {
          scope.setTag("request_id", context.requestId);
        }
        if (context?.traceId) {
          scope.setTag("trace_id", context.traceId);
        }
        if (context?.source) {
          scope.setTag("defect_source", context.source);
        }
        if (context?.status !== undefined) {
          scope.setTag("status_code", String(context.status));
        }
        if (context?.extra) {
          scope.setExtras(context.extra);
        }
        this.sdk.captureException(error);
      });
    } else {
      this.sdk.captureException(error);
    }
  }

  captureReactError(
    error: unknown,
    errorInfo?: ErrorInfo | { componentStack?: string | null },
  ): void {
    this.sdk.captureException(error, {
      extra: {
        componentStack: errorInfo?.componentStack,
      },
    });
  }

  recordBreadcrumb(entry: BreadcrumbEntry): void {
    if (typeof this.sdk.addBreadcrumb === "function") {
      this.sdk.addBreadcrumb({
        category: entry.category,
        message: entry.message,
        level: entry.level,
        data: entry.data,
      });
    }
  }

  setUserContext(user: TelemetryUser | null): void {
    if (typeof this.sdk.setUser === "function") {
      if (!user) {
        this.sdk.setUser(null);
      } else {
        this.sdk.setUser({
          id: user.id,
          email: user.email ?? undefined,
          username: typeof user.name === "string" ? user.name : undefined,
        });
      }
    }
  }

  clearUserContext(): void {
    if (typeof this.sdk.setUser === "function") {
      this.sdk.setUser(null);
    }
  }

  setUser(user: TelemetryUser | null): void {
    this.setUserContext(user);
  }
}

export function createSentryAdapter(
  config: SentryAdapterConfig,
  sdk?: SentryMobileSdk,
): SentryObservabilityAdapter {
  return new SentryObservabilityAdapter(config, sdk);
}
