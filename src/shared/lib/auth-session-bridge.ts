import type { QueryClient, UseQueryOptions } from "@tanstack/react-query";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";

export interface SessionData {
  user?: {
    id: string;
    name?: string;
    email?: string;
    role?: string | null;
    image?: string | null;
    [key: string]: unknown;
  } | null;
  session?: {
    id?: string;
    token?: string;
    expiresAt?: string;
    [key: string]: unknown;
  } | null;
}

export type AuthSessionQueryOptions = UseQueryOptions<
  SessionData | null,
  unknown,
  SessionData | null,
  readonly ["auth", "session"]
>;

export type UnauthorizedListener = () => void;

let cachedBearerToken: string | null = null;
let sessionQueryOptions: AuthSessionQueryOptions | null = null;
const activeQueryClients = new Set<QueryClient>();
const unauthorizedListeners = new Set<UnauthorizedListener>();

export function getCachedBearerToken(): string | null {
  return cachedBearerToken;
}

export function setCachedBearerToken(token: string | null): void {
  cachedBearerToken = token && token.trim().length > 0 ? token : null;
}

export function clearCachedBearerToken(): void {
  cachedBearerToken = null;
}

export function registerAuthSessionQueryOptions(options: AuthSessionQueryOptions | null): void {
  sessionQueryOptions = options;
}

export function getAuthSessionQueryOptions(): AuthSessionQueryOptions | null {
  return sessionQueryOptions;
}

export function registerQueryClient(client: QueryClient): () => void {
  activeQueryClients.add(client);
  return () => {
    activeQueryClients.delete(client);
  };
}

export function onAuthUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function resetAuthSessionCache(): void {
  cachedBearerToken = null;

  for (const client of activeQueryClients) {
    client.setQueryData(AUTH_QUERY_KEYS.session(), null);
  }

  for (const listener of unauthorizedListeners) {
    try {
      listener();
    } catch {
      // Isolate listener errors during session reset
    }
  }
}
