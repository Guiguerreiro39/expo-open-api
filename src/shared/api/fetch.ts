import { resolveApiUrl } from "@/shared/config/env";
import { getCachedBearerToken, resetAuthSessionCache } from "@/shared/lib/auth-session-bridge";

export interface CustomFetchOptions extends RequestInit {
  responseType?: "json" | "blob" | "text";
}

export interface HonoErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: unknown;
    issues?: Array<{
      code?: string;
      path?: Array<string | number>;
      message?: string;
    }>;
  };
  message?: string;
}

export class FetchError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly details?: unknown;
  readonly data?: HonoErrorEnvelope;

  constructor(options: {
    status: number;
    message: string;
    code?: string;
    requestId?: string;
    traceId?: string;
    details?: unknown;
    data?: HonoErrorEnvelope;
  }) {
    super(options.message);
    this.name = "FetchError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.traceId = options.traceId;
    this.details = options.details;
    this.data = options.data;
  }
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }
  try {
    // Lazy fallback for React Native Hermes runtimes without global Web Crypto
    const expoCrypto = require("expo-crypto") as {
      getRandomBytes?: (count: number) => Uint8Array;
    };
    if (typeof expoCrypto.getRandomBytes === "function") {
      return expoCrypto.getRandomBytes(length);
    }
  } catch {
    // Fall back to Math.random only if neither Web Crypto nor expo-crypto is available
  }
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

function randomHex(bytes: number): string {
  const buf = getRandomBytes(bytes);
  let hex = "";
  for (const b of buf) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex === "0".repeat(bytes * 2) ? randomHex(bytes) : hex;
}

function generateRequestId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `req_${globalThis.crypto.randomUUID()}`;
  }
  try {
    const expoCrypto = require("expo-crypto") as {
      randomUUID?: () => string;
    };
    if (typeof expoCrypto.randomUUID === "function") {
      return `req_${expoCrypto.randomUUID()}`;
    }
  } catch {
    // Fall back to randomHex
  }
  return `req_${randomHex(16)}`;
}

export function createW3CTraceparent(): { traceparent: string; traceId: string; spanId: string } {
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  return {
    traceId,
    spanId,
    traceparent: `00-${traceId}-${spanId}-01`,
  };
}

export async function customFetch<T>(url: string, options: CustomFetchOptions = {}): Promise<T> {
  const fullUrl = resolveApiUrl(url);
  const headers = new Headers(options.headers);

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const cachedToken = getCachedBearerToken();
  if (cachedToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${cachedToken}`);
  }

  const outboundRequestId = headers.get("X-Request-Id") ?? generateRequestId();
  headers.set("X-Request-Id", outboundRequestId);

  let traceId: string | undefined;
  const existingTraceparent = headers.get("traceparent");
  if (existingTraceparent) {
    const parts = existingTraceparent.split("-");
    traceId = parts[1];
  } else {
    const generated = createW3CTraceparent();
    headers.set("traceparent", generated.traceparent);
    traceId = generated.traceId;
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: HonoErrorEnvelope | undefined;
    try {
      errorData = (await response.json()) as HonoErrorEnvelope;
    } catch {
      errorData = { message: response.statusText || `HTTP error ${response.status}` };
    }

    const requestId =
      errorData?.error?.requestId ?? response.headers.get("X-Request-Id") ?? outboundRequestId;
    const code = errorData?.error?.code;
    const message =
      errorData?.error?.message ||
      errorData?.message ||
      response.statusText ||
      `HTTP error ${response.status}`;

    if (response.status === 401) {
      resetAuthSessionCache();
    }

    throw new FetchError({
      status: response.status,
      code,
      message,
      requestId,
      traceId,
      details: errorData?.error?.details,
      data: errorData,
    });
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentDisposition = response.headers.get("content-disposition") ?? "";
  if (options.responseType === "blob" || contentDisposition.includes("attachment")) {
    return (await response.blob()) as unknown as T;
  }

  if (options.responseType === "text") {
    return (await response.text()) as unknown as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    return response.json() as Promise<T>;
  }

  return (await response.blob()) as unknown as T;
}
