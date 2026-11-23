import { Schema } from "effect";

const NumberCoercible = Schema.Union(Schema.Number, Schema.NumberFromString);

export const ClientEnvSchema = Schema.Struct({
  EXPO_PUBLIC_API_URL: Schema.optionalWith(Schema.String, {
    default: () => "http://localhost:9999",
  }),
  EXPO_PUBLIC_APP_VERSION: Schema.optionalWith(Schema.String, {
    default: () => "0.1.0",
  }),
  EXPO_PUBLIC_SENTRY_DSN: Schema.optional(Schema.String),
  EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: Schema.optionalWith(NumberCoercible, {
    default: () => 0.2,
  }),
  EXPO_PUBLIC_DATADOG_APPLICATION_ID: Schema.optional(Schema.String),
  EXPO_PUBLIC_DATADOG_CLIENT_TOKEN: Schema.optional(Schema.String),
  EXPO_PUBLIC_DATADOG_SITE: Schema.optionalWith(Schema.String, {
    default: () => "datadoghq.com",
  }),
  EXPO_PUBLIC_DATADOG_SERVICE: Schema.optionalWith(Schema.String, {
    default: () => "expo-open-api-mobile",
  }),
  EXPO_PUBLIC_DATADOG_SESSION_SAMPLE_RATE: Schema.optionalWith(NumberCoercible, {
    default: () => 100,
  }),
  NODE_ENV: Schema.optionalWith(Schema.Literal("development", "production", "test"), {
    default: () => "development",
  }),
});

export type ClientEnv = Schema.Schema.Type<typeof ClientEnvSchema>;

let cachedEnv: ClientEnv | null = null;

function readProcessEnv(): Record<string, unknown> {
  if (typeof process !== "undefined" && process.env) {
    return {
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION,
      EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
      EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      EXPO_PUBLIC_DATADOG_APPLICATION_ID: process.env.EXPO_PUBLIC_DATADOG_APPLICATION_ID,
      EXPO_PUBLIC_DATADOG_CLIENT_TOKEN: process.env.EXPO_PUBLIC_DATADOG_CLIENT_TOKEN,
      EXPO_PUBLIC_DATADOG_SITE: process.env.EXPO_PUBLIC_DATADOG_SITE,
      EXPO_PUBLIC_DATADOG_SERVICE: process.env.EXPO_PUBLIC_DATADOG_SERVICE,
      EXPO_PUBLIC_DATADOG_SESSION_SAMPLE_RATE: process.env.EXPO_PUBLIC_DATADOG_SESSION_SAMPLE_RATE,
      NODE_ENV: process.env.NODE_ENV,
    };
  }
  return {};
}

export function parseEnv(rawEnv?: Record<string, unknown>): ClientEnv {
  if (cachedEnv && !rawEnv) {
    return cachedEnv;
  }

  const baseEnv = readProcessEnv();
  const merged: Record<string, unknown> = { ...baseEnv, ...(rawEnv ?? {}) };

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "") {
      delete merged[key];
    }
  }

  const parsed = Schema.decodeUnknownSync(ClientEnvSchema)(merged);
  if (!rawEnv) {
    cachedEnv = parsed;
  }
  return parsed;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}

export function resolveApiUrl(path = "", rawEnv?: Record<string, unknown>): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const env = parseEnv(rawEnv);
  const cleanBase = env.EXPO_PUBLIC_API_URL.replace(/\/+$/, "");

  if (!path) {
    return cleanBase;
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return cleanBase ? `${cleanBase}${cleanPath}` : cleanPath;
}
