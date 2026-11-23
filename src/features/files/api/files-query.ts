import {
  type InfiniteData,
  type UseInfiniteQueryOptions,
  type UseMutationOptions,
  type UseQueryOptions,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Schema } from "effect";
import { useMemo } from "react";
import {
  defineContract,
  getNextCursorParam,
  useEffectMutation,
  useEffectQuery,
} from "@/shared/api/contracts";
import { deleteApiV1FilesId, getApiV1Files } from "@/shared/api/generated/endpoints";
import type { GetApiV1Files200 } from "@/shared/api/generated/models/getApiV1Files200";
import type { GetApiV1FilesParams } from "@/shared/api/generated/models/getApiV1FilesParams";
import { GetApiV1Files200Response } from "@/shared/api/generated/schemas";
import { FILES_QUERY_KEYS } from "@/shared/api/query-keys";
import { useObservability } from "@/shared/observability/observability-context";

export const filesQueryKeys = FILES_QUERY_KEYS;

export function useFilesQuery(
  params?: GetApiV1FilesParams,
  options?: Omit<UseQueryOptions<GetApiV1Files200>, "queryKey" | "queryFn">,
) {
  const observability = useObservability();
  const descriptor = useMemo(
    () =>
      defineContract({
        operation: "GetApiV1Files",
        path: "/api/v1/files",
        dataSchema: GetApiV1Files200Response,
        observability,
      }),
    [observability],
  );

  return useEffectQuery(
    {
      queryKey: filesQueryKeys.list(params as Record<string, unknown> | undefined),
      queryFn: () => getApiV1Files(params),
      ...options,
    },
    descriptor,
  );
}

export function useFilesInfiniteQuery(
  params?: Omit<GetApiV1FilesParams, "cursor">,
  options?: Omit<
    UseInfiniteQueryOptions<
      GetApiV1Files200,
      Error,
      InfiniteData<GetApiV1Files200>,
      readonly unknown[],
      string | undefined
    >,
    "queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
  >,
) {
  return useInfiniteQuery({
    queryKey: [
      ...filesQueryKeys.lists(),
      "infinite",
      (params ?? {}) as Record<string, unknown>,
    ] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getApiV1Files({
        ...params,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => getNextCursorParam(lastPage),
    ...options,
  });
}

export function useDeleteFileMutation(options?: UseMutationOptions<void, unknown, string>) {
  const queryClient = useQueryClient();
  const observability = useObservability();
  const descriptor = useMemo(
    () =>
      defineContract({
        operation: "DeleteApiV1FilesId",
        path: "/api/v1/files/:id",
        dataSchema: Schema.Void,
        observability,
      }),
    [observability],
  );

  return useEffectMutation(
    {
      mutationKey: [...filesQueryKeys.mutations(), "delete"],
      mutationFn: (id: string) => deleteApiV1FilesId(id),
      ...options,
      onSuccess: (data, variables, onMutateResult, context) => {
        void queryClient.invalidateQueries({ queryKey: filesQueryKeys.all });
        options?.onSuccess?.(data, variables, onMutateResult, context);
      },
    },
    descriptor,
  );
}
