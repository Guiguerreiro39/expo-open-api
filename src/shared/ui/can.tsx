import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { AUTH_QUERY_KEYS } from "@/shared/api/query-keys";
import {
  defaultSessionQueryFn,
  getAuthSessionQueryOptions,
  registerQueryClient,
  type SessionData,
} from "@/shared/lib/auth-session-bridge";
import {
  type AppRole,
  hasPermission,
  hasRole,
  type RbacUser,
  type ResourceSubject,
} from "@/shared/lib/rbac";

export interface UseCanOptions {
  readonly role?: AppRole;
  readonly action?: string;
  readonly resource?: string | ResourceSubject | null;
  readonly user?: RbacUser | null;
}

export function useCan({ role, action, resource, user: directUser }: UseCanOptions): boolean {
  const queryClient = useQueryClient();

  useEffect(() => {
    return registerQueryClient(queryClient);
  }, [queryClient]);

  const bridgeOptions = getAuthSessionQueryOptions();
  const cachedSession = queryClient.getQueryData<SessionData | null>(AUTH_QUERY_KEYS.session());

  const { data: sessionData } = useQuery<
    SessionData | null,
    unknown,
    SessionData | null,
    readonly ["auth", "session"]
  >({
    queryKey: AUTH_QUERY_KEYS.session(),
    enabled: directUser === undefined,
    initialData: () => cachedSession ?? null,
    staleTime:
      typeof bridgeOptions?.staleTime === "number" ? bridgeOptions.staleTime : 5 * 60 * 1000,
    queryFn:
      typeof bridgeOptions?.queryFn === "function" ? bridgeOptions.queryFn : defaultSessionQueryFn,
  });

  const currentUser =
    directUser !== undefined
      ? directUser
      : ((sessionData?.user ?? cachedSession?.user ?? null) as RbacUser | null);

  if (role && !hasRole(currentUser, role)) {
    return false;
  }

  if (action && !hasPermission({ user: currentUser, resource, action })) {
    return false;
  }

  return true;
}

export interface CanProps extends UseCanOptions {
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
}

export function Can({ role, action, resource, user, fallback = null, children }: CanProps) {
  const allowed = useCan({ role, action, resource, user });

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
