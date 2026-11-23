import type { ErrorInfo } from "react";
import type { BreadcrumbEntry, DefectContext, ObservabilityService, TelemetryUser } from "./port";

export interface DatadogMobileSdk {
  initialize?: (config: Record<string, unknown>) => void;
  addError?: (
    message: string,
    source: string,
    stacktrace: string,
    context?: Record<string, unknown>,
  ) => void;
  addAction?: (name: string, context?: Record<string, unknown>) => void;
  log?: (
    message: string,
    context?: Record<string, unknown>,
    level?: "debug" | "info" | "warn" | "error",
  ) => void;
  setUser?: (user: { id: string; email?: string; name?: string }) => void;
  clearUser?: () => void;
}

export interface DatadogAdapterConfig {
  clientToken?: string;
  applicationId?: string;
  site?: string;
  service?: string;
  env?: string;
  version?: string;
  sessionSampleRate?: number;
  apiOrigins?: Array<string | RegExp>;
}

const noopDatadogSdk: DatadogMobileSdk = {};

export class DatadogObservabilityAdapter implements ObservabilityService {
  private readonly sdk: DatadogMobileSdk;

  constructor(config: DatadogAdapterConfig, sdk: DatadogMobileSdk = noopDatadogSdk) {
    this.sdk = sdk;

    if (config.clientToken && typeof this.sdk.initialize === "function") {
      try {
        this.sdk.initialize({
          clientToken: config.clientToken,
          applicationId: config.applicationId,
          site: config.site ?? "datadoghq.com",
          service: config.service ?? "expo-open-api-mobile",
          env: config.env ?? "development",
          version: config.version ?? "0.1.0",
          sessionSampleRate: config.sessionSampleRate ?? 100,
          firstPartyHosts: config.apiOrigins ?? [],
        });
      } catch (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[DatadogObservabilityAdapter] Failed to initialize Datadog:", err);
        }
      }
    }
  }

  captureDefect(error: unknown, context?: DefectContext): void {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    const stack = error instanceof Error ? (error.stack ?? "") : "";

    if (typeof this.sdk.addError === "function") {
      this.sdk.addError(
        message,
        context?.source ?? "source",
        stack,
        context as Record<string, unknown>,
      );
    }

    if (typeof this.sdk.log === "function") {
      this.sdk.log(message, context as Record<string, unknown>, "error");
    }
  }

  captureReactError(
    error: unknown,
    errorInfo?: ErrorInfo | { componentStack?: string | null },
  ): void {
    const message = error instanceof Error ? error.message : "React render error";
    const stack = error instanceof Error ? (error.stack ?? "") : "";
    const ctx = {
      source: "react_boundary",
      componentStack: errorInfo?.componentStack,
    };

    if (typeof this.sdk.addError === "function") {
      this.sdk.addError(message, "react", stack, ctx);
    }

    if (typeof this.sdk.log === "function") {
      this.sdk.log(message, ctx, "error");
    }
  }

  recordBreadcrumb(entry: BreadcrumbEntry): void {
    const payload = {
      category: entry.category,
      ...(entry.data ?? {}),
    };

    if (typeof this.sdk.addAction === "function") {
      this.sdk.addAction(entry.message, payload);
    }

    if (typeof this.sdk.log === "function") {
      const ddStatus: "debug" | "info" | "warn" | "error" =
        entry.level === "warning" ? "warn" : (entry.level ?? "info");
      this.sdk.log(entry.message, payload, ddStatus);
    }
  }

  setUserContext(user: TelemetryUser | null): void {
    if (!user) {
      this.clearUserContext();
      return;
    }

    if (typeof this.sdk.setUser === "function") {
      this.sdk.setUser({
        id: user.id,
        email: user.email ?? undefined,
        name: typeof user.name === "string" ? user.name : undefined,
      });
    }
  }

  clearUserContext(): void {
    if (typeof this.sdk.clearUser === "function") {
      this.sdk.clearUser();
    }
  }

  setUser(user: TelemetryUser | null): void {
    this.setUserContext(user);
  }
}

export function createDatadogAdapter(
  config: DatadogAdapterConfig,
  sdk?: DatadogMobileSdk,
): DatadogObservabilityAdapter {
  return new DatadogObservabilityAdapter(config, sdk);
}
