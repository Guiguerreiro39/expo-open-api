import { parseEnv } from "@/shared/config/env";
import { createCompositeAdapter } from "./composite-adapter";
import { consoleObservabilityAdapter } from "./console-adapter";
import { createDatadogAdapter, type DatadogMobileSdk } from "./datadog-adapter";
import { noopObservabilityAdapter } from "./noop-adapter";
import type { ObservabilityService } from "./port";
import { createSentryAdapter, type SentryMobileSdk } from "./sentry-adapter";
import { createSpyObservability } from "./spy-adapter";

export interface ObservabilityFactoryOptions {
  readonly sentrySdk?: SentryMobileSdk;
  readonly datadogSdk?: DatadogMobileSdk;
}

export function createObservabilityService(
  rawEnv?: Record<string, unknown>,
  options?: ObservabilityFactoryOptions,
): ObservabilityService {
  const env = parseEnv(rawEnv);
  const mode = env.NODE_ENV;

  if (mode === "test") {
    return createSpyObservability();
  }

  const adapters: ObservabilityService[] = [];

  if (env.EXPO_PUBLIC_SENTRY_DSN) {
    adapters.push(
      createSentryAdapter(
        {
          dsn: env.EXPO_PUBLIC_SENTRY_DSN,
          environment: mode,
          release: env.EXPO_PUBLIC_APP_VERSION,
          tracesSampleRate: env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
          apiOrigins: env.EXPO_PUBLIC_API_URL ? [env.EXPO_PUBLIC_API_URL] : [],
        },
        options?.sentrySdk,
      ),
    );
  }

  if (env.EXPO_PUBLIC_DATADOG_CLIENT_TOKEN) {
    adapters.push(
      createDatadogAdapter(
        {
          clientToken: env.EXPO_PUBLIC_DATADOG_CLIENT_TOKEN,
          applicationId: env.EXPO_PUBLIC_DATADOG_APPLICATION_ID,
          site: env.EXPO_PUBLIC_DATADOG_SITE,
          service: env.EXPO_PUBLIC_DATADOG_SERVICE,
          env: mode,
          version: env.EXPO_PUBLIC_APP_VERSION,
          sessionSampleRate: env.EXPO_PUBLIC_DATADOG_SESSION_SAMPLE_RATE,
          apiOrigins: env.EXPO_PUBLIC_API_URL ? [env.EXPO_PUBLIC_API_URL] : [],
        },
        options?.datadogSdk,
      ),
    );
  }

  if (adapters.length === 0) {
    return mode === "development" ? consoleObservabilityAdapter : noopObservabilityAdapter;
  }

  const first = adapters[0];
  if (adapters.length === 1 && first) {
    return first;
  }

  return createCompositeAdapter(adapters);
}
