import type { QueryClient, QueryFunction } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";

export const BEARER_TOKEN_STORAGE_KEY = "expo_open_api_bearer_token";

export interface SessionData {
  readonly user?: {
    readonly id: string;
    readonly name?: string;
    readonly email?: string;
    readonly role?: string | null;
    readonly image?: string | null;
    readonly [key: string]: unknown;
  } | null;
  readonly session?: {
    readonly id?: string;
    readonly userId?: string;
    readonly token?: string;
    readonly expiresAt?: string | Date;
    readonly [key: string]: unknown;
  } | null;
}

export interface AuthSessionQueryOptions {
  readonly queryKey: readonly ["auth", "session"];
  readonly queryFn?: QueryFunction<SessionData | null, readonly ["auth", "session"]> | symbol;
  readonly staleTime?: number | "static" | ((...args: never[]) => unknown);
  readonly gcTime?: number;
}

export type UnauthorizedListener = () => void;

export const defaultSessionQueryFn = async (): Promise<SessionData | null> => null;

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

export const AuthBootstrapContext = createContext<boolean>(false);

export function useIsAuthBootstrapping(): boolean {
  return useContext(AuthBootstrapContext);
}
