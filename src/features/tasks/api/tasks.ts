import { useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import {
  defineContract,
  type UseEffectQueryResult,
  useEffectMutation,
  useEffectQuery,
} from "@/shared/api/contracts";
import {
  deleteApiV1TasksId,
  getGetApiV1TasksLiveUrl,
  getGetApiV1TasksQueryKey,
  getGetApiV1TasksQueryOptions,
  patchApiV1TasksId,
  postApiV1Tasks,
} from "@/shared/api/generated/endpoints";
import type {
  GetApiV1Tasks200,
  GetApiV1TasksParams,
  PostApiV1Tasks201,
  PostApiV1TasksBody,
} from "@/shared/api/generated/models";
import {
  GetApiV1Tasks200Response,
  PatchApiV1TasksId200Response,
  PostApiV1Tasks201Response,
} from "@/shared/api/generated/schemas";
import { AUTH_QUERY_KEYS, TASKS_QUERY_KEYS } from "@/shared/api/query-keys";
import type { SessionData } from "@/shared/lib/auth-session-bridge";
import { type UseLiveQueryResult, useLiveQuery } from "@/shared/lib/hooks/use-live-query";
import { useObservability } from "@/shared/observability/observability-context";

export const listTasksContract = defineContract({
  operation: "GetApiV1Tasks",
  path: "/api/v1/tasks",
  dataSchema: GetApiV1Tasks200Response,
});

export const createTaskContract = defineContract({
  operation: "PostApiV1Tasks",
  path: "/api/v1/tasks",
  dataSchema: PostApiV1Tasks201Response,
});

export const updateTaskContract = defineContract({
  operation: "PatchApiV1TasksId",
  path: "/api/v1/tasks/:id",
  dataSchema: PatchApiV1TasksId200Response,
});

export const deleteTaskContract = defineContract({
  operation: "DeleteApiV1TasksId",
  path: "/api/v1/tasks/:id",
  dataSchema: Schema.Void,
});

export type TaskListResponse = Schema.Schema.Type<typeof GetApiV1Tasks200Response>;

const TASKS_ROOT_QUERY_KEY = ["/api/v1/tasks"] as const;

function generateOptimisticTaskId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `optimistic-${globalThis.crypto.randomUUID()}`;
  }
  return `optimistic-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function useTasksQuery(
  params?: GetApiV1TasksParams,
): UseEffectQueryResult<TaskListResponse, unknown> {
  const observability = useObservability();
  return useEffectQuery(getGetApiV1TasksQueryOptions(params), {
    ...listTasksContract,
    observability,
  });
}

export function useTaskLiveQuery(
  params?: GetApiV1TasksParams,
): UseLiveQueryResult<TaskListResponse, unknown> {
  const observability = useObservability();
  return useLiveQuery({
    queryOptions: getGetApiV1TasksQueryOptions(params),
    descriptor: {
      ...listTasksContract,
      observability,
    },
    liveUrl: getGetApiV1TasksLiveUrl(params),
    mutationKey: TASKS_QUERY_KEYS.mutations(),
  });
}

export function useCreateTaskMutation(params?: GetApiV1TasksParams) {
  const queryClient = useQueryClient();
  const observability = useObservability();

  return useEffectMutation(
    {
      mutationKey: [...TASKS_QUERY_KEYS.mutations(), "create"],
      mutationFn: (data: PostApiV1TasksBody) => postApiV1Tasks(data),
      onMutate: async (newBody) => {
        await queryClient.cancelQueries({ queryKey: TASKS_ROOT_QUERY_KEY });
        await queryClient.cancelQueries({ queryKey: getGetApiV1TasksQueryKey(params) });

        const previousQueries = queryClient.getQueriesData<GetApiV1Tasks200>({
          queryKey: TASKS_ROOT_QUERY_KEY,
        });

        const sessionData = queryClient.getQueryData<SessionData | null>(AUTH_QUERY_KEYS.session());
        const currentUserId = sessionData?.user?.id ?? "local-user";
        const now = new Date().toISOString();

        const optimisticTask = {
          id: generateOptimisticTaskId(),
          name: newBody.name,
          done: Boolean(newBody.done),
          userId: currentUserId,
          createdAt: now,
          updatedAt: now,
        };

        queryClient.setQueriesData<GetApiV1Tasks200>({ queryKey: TASKS_ROOT_QUERY_KEY }, (old) => {
          if (!old) {
            return {
              data: [optimisticTask],
              meta: { nextCursor: null, hasMore: false },
            };
          }
          return {
            ...old,
            data: [optimisticTask, ...old.data],
          };
        });

        return { previousQueries, optimisticId: optimisticTask.id };
      },
      onError: (_err, _variables, context) => {
        if (context?.previousQueries) {
          for (const [qKey, data] of context.previousQueries) {
            queryClient.setQueryData(qKey, data);
          }
        }
      },
      onSuccess: (serverTask: PostApiV1Tasks201, _variables, context) => {
        if (context?.optimisticId) {
          queryClient.setQueriesData<GetApiV1Tasks200>(
            { queryKey: TASKS_ROOT_QUERY_KEY },
            (old) => {
              if (!old) return old;
              return {
                ...old,
                data: old.data.map((item) =>
                  item.id === context.optimisticId ? serverTask : item,
                ),
              };
            },
          );
        }
      },
    },
    {
      ...createTaskContract,
      observability,
    },
  );
}

export function useToggleTaskMutation() {
  const queryClient = useQueryClient();
  const observability = useObservability();

  return useEffectMutation(
    {
      mutationKey: [...TASKS_QUERY_KEYS.mutations(), "toggle"],
      mutationFn: ({ id, done }: { id: string; done: boolean }) => patchApiV1TasksId(id, { done }),
      onMutate: async ({ id, done }) => {
        await queryClient.cancelQueries({ queryKey: TASKS_ROOT_QUERY_KEY });

        const previousQueries = queryClient.getQueriesData<GetApiV1Tasks200>({
          queryKey: TASKS_ROOT_QUERY_KEY,
        });

        queryClient.setQueriesData<GetApiV1Tasks200>({ queryKey: TASKS_ROOT_QUERY_KEY }, (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((item) =>
              item.id === id ? { ...item, done, updatedAt: new Date().toISOString() } : item,
            ),
          };
        });

        return { previousQueries };
      },
      onError: (_err, _variables, context) => {
        if (context?.previousQueries) {
          for (const [qKey, data] of context.previousQueries) {
            queryClient.setQueryData(qKey, data);
          }
        }
      },
      onSuccess: (serverTask) => {
        queryClient.setQueriesData<GetApiV1Tasks200>({ queryKey: TASKS_ROOT_QUERY_KEY }, (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((item) => (item.id === serverTask.id ? serverTask : item)),
          };
        });
      },
    },
    {
      ...updateTaskContract,
      observability,
    },
  );
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  const observability = useObservability();

  return useEffectMutation(
    {
      mutationKey: [...TASKS_QUERY_KEYS.mutations(), "delete"],
      mutationFn: ({ id }: { id: string }) => deleteApiV1TasksId(id),
      onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey: TASKS_ROOT_QUERY_KEY });

        const previousQueries = queryClient.getQueriesData<GetApiV1Tasks200>({
          queryKey: TASKS_ROOT_QUERY_KEY,
        });

        queryClient.setQueriesData<GetApiV1Tasks200>({ queryKey: TASKS_ROOT_QUERY_KEY }, (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter((item) => item.id !== id),
          };
        });

        return { previousQueries };
      },
      onError: (_err, _variables, context) => {
        if (context?.previousQueries) {
          for (const [qKey, data] of context.previousQueries) {
            queryClient.setQueryData(qKey, data);
          }
        }
      },
    },
    {
      ...deleteTaskContract,
      observability,
    },
  );
}
