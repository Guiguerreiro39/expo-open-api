import { expoClient } from "@better-auth/expo/client";
import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { Platform } from "react-native";
import { APP_INFO } from "@/shared/config/app-info";
import { resolveApiUrl } from "@/shared/config/env";
import { getCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import { accessControl, accessRoles } from "@/shared/lib/rbac";
import {
  type CredentialStorePort,
  createSecureStoreCredentialStore,
} from "@/shared/storage/credential-store";

export const EXPO_AUTH_STORAGE_PREFIX = "expo_open_api";

export interface MobileAuthClientOptions {
  readonly credentialStore?: CredentialStorePort;
  readonly baseURL?: string;
  readonly scheme?: string;
  readonly storagePrefix?: string;
}

/**
 * Adapts an async `CredentialStorePort` to `@better-auth/expo`'s `ExpoClientStorage`
 * interface (`getItem`, `getItemAsync`, `setItem`, `setItemAsync`) using a local
 * mirror cache for synchronous reads while persisting asynchronously to the port.
 */
function createExpoStorageAdapter(credentialStore: CredentialStorePort) {
  const syncMirror = new Map<string, string>();

  return {
    getItem(key: string): string | null {
      return syncMirror.get(key) ?? null;
    },
    async getItemAsync(key: string): Promise<string | null> {
      const stored = await credentialStore.getItem(key);
      if (stored !== null) {
        syncMirror.set(key, stored);
      } else {
        syncMirror.delete(key);
      }
      return stored;
    },
    setItem(key: string, value: string): void {
      syncMirror.set(key, value);
      void credentialStore.setItem(key, value);
    },
    async setItemAsync(key: string, value: string): Promise<void> {
      syncMirror.set(key, value);
      await credentialStore.setItem(key, value);
    },
  };
}

/**
 * Creates an isolated Better Auth mobile client configured with `@better-auth/expo/client`
 * and `adminClient` RBAC plugins, backed by an injectable `CredentialStorePort`.
 */
export function createMobileAuthClient(options: MobileAuthClientOptions = {}) {
  const credentialStore = options.credentialStore ?? createSecureStoreCredentialStore();
  const baseURL = options.baseURL ?? resolveApiUrl();
  const scheme = options.scheme ?? APP_INFO.scheme;
  const storagePrefix = options.storagePrefix ?? EXPO_AUTH_STORAGE_PREFIX;

  return createAuthClient({
    baseURL,
    fetchOptions: {
      credentials: Platform.OS === "web" ? "include" : "omit",
      auth: {
        type: "Bearer",
        token: () => getCachedBearerToken() ?? "",
      },
    },
    sessionOptions: {
      refetchOnWindowFocus: false,
      refetchInterval: 0,
    },
    plugins: [
      expoClient({
        scheme,
        storagePrefix,
        storage: createExpoStorageAdapter(credentialStore),
      }),
      adminClient({
        ac: accessControl,
        roles: accessRoles,
      }),
    ],
  });
}

export type MobileAuthClient = ReturnType<typeof createMobileAuthClient>;
