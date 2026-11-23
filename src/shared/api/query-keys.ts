export const AUTH_QUERY_KEYS = {
  all: ["auth"] as const,
  session: () => ["auth", "session"] as const,
  me: () => ["auth", "me"] as const,
};

export const TASKS_QUERY_KEYS = {
  all: ["tasks"] as const,
  lists: () => ["tasks", "list"] as const,
  list: (params?: Record<string, unknown>) => ["tasks", "list", params ?? {}] as const,
  detail: (id: string) => ["tasks", "detail", id] as const,
  mutations: () => ["tasks", "mutation"] as const,
};

export const FILES_QUERY_KEYS = {
  all: ["files"] as const,
  lists: () => ["files", "list"] as const,
  list: (params?: Record<string, unknown>) => ["files", "list", params ?? {}] as const,
  detail: (id: string) => ["files", "detail", id] as const,
  mutations: () => ["files", "mutation"] as const,
};

export const HEALTH_QUERY_KEYS = {
  all: ["health"] as const,
  status: () => ["health", "status"] as const,
  ready: () => ["health", "ready"] as const,
};
