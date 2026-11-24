import { useNetInfo } from "@react-native-community/netinfo";
import { Schema } from "effect";
import {
  AlertCircle,
  Check,
  Circle,
  ListTodo,
  Plus,
  ShieldAlert,
  Trash2,
  WifiOff,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { FlatList, type ListRenderItemInfo, Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useTaskLiveQuery,
  useToggleTaskMutation,
} from "@/features/tasks/api/tasks";
import {
  CreateTaskFormSchema,
  filterTasks,
  type TaskFilterStatus,
  type TaskItem,
} from "@/features/tasks/model/tasks";
import { decodeApiError } from "@/shared/api/contracts";
import {
  DEFAULT_THEME_PRESET,
  getThemeElevation,
  resolveThemeColor,
} from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Can } from "@/shared/ui/can";
import { Card, CardContent } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { LiveQueryBadge } from "@/shared/ui/live-query-badge";
import { Skeleton } from "@/shared/ui/skeleton";
import { TactilePressable } from "@/shared/ui/tactile-pressable";
import { Text } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";
import { useToast } from "@/shared/ui/toast";

const FILTER_OPTIONS: ReadonlyArray<{ readonly value: TaskFilterStatus; readonly label: string }> =
  [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
  ];

const SKELETON_KEYS = ["task-skeleton-1", "task-skeleton-2", "task-skeleton-3"] as const;

interface MutationFeedback {
  readonly title: string;
  readonly message: string;
  readonly isForbidden: boolean;
}

interface TaskRowProps {
  readonly task: TaskItem;
  readonly onToggle: (task: TaskItem) => void;
  readonly onRequestDelete: (task: TaskItem) => void;
}

function TaskRow({ task, onToggle, onRequestDelete }: TaskRowProps) {
  const isOptimistic = task.id.startsWith("optimistic-");

  return (
    <Card className={cn("mb-3", isOptimistic && "opacity-75")}>
      <CardContent className="flex-row items-center gap-2 py-3">
        <Can
          action="task:update"
          resource={task}
          fallback={
            <View className="min-h-11 min-w-11 shrink-0 items-center justify-center">
              <View
                className={cn(
                  "h-7 w-7 items-center justify-center rounded-full border",
                  task.done
                    ? "border-primary bg-primary-container"
                    : "border-outline-variant bg-surface-container-low",
                )}
              >
                <Icon
                  as={task.done ? Check : Circle}
                  size={15}
                  className={task.done ? "text-on-primary-container" : "text-on-surface-variant"}
                />
              </View>
            </View>
          }
        >
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`Toggle task ${task.name}`}
            accessibilityState={{ checked: task.done }}
            hitSlop={4}
            onPress={() => onToggle(task)}
            className="min-h-11 min-w-11 shrink-0 items-center justify-center"
          >
            <View
              className={cn(
                "h-7 w-7 items-center justify-center rounded-full border",
                task.done
                  ? "border-primary bg-primary"
                  : "border-outline bg-surface-container-lowest",
              )}
            >
              {task.done ? (
                <Icon as={Check} size={15} className="text-primary-foreground" />
              ) : (
                <Icon as={Circle} size={15} className="text-on-surface-variant" />
              )}
            </View>
          </Pressable>
        </Can>

        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            className={cn(
              "text-body-md shrink font-semibold",
              task.done ? "text-on-surface-variant line-through" : "text-foreground",
            )}
          >
            {task.name}
          </Text>
          <Text variant="caption">{task.done ? "Completed" : "Active"}</Text>
        </View>

        <Can action="task:delete" resource={task}>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            accessibilityLabel={`Delete task ${task.name}`}
            onPress={() => onRequestDelete(task)}
          >
            <Icon as={Trash2} size={18} className="text-destructive" />
          </Button>
        </Can>
      </CardContent>
    </Card>
  );
}

function TaskListSkeleton() {
  return (
    <View testID="tasks-loading-skeleton" className="gap-3 pt-1">
      {SKELETON_KEYS.map((key) => (
        <Card key={key} elevated={false} className="bg-surface-container-low">
          <CardContent className="flex-row items-center gap-3 py-4">
            <Skeleton className="h-7 w-7 rounded-full" />
            <View className="min-w-0 flex-1 gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </View>
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </View>
  );
}

export function TasksScreen() {
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilterStatus>("all");
  const [taskPendingDelete, setTaskPendingDelete] = useState<TaskItem | null>(null);
  const [mutationFeedback, setMutationFeedback] = useState<MutationFeedback | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const theme = useOptionalTheme();
  const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
  const scheme = theme?.resolvedColorScheme ?? "light";
  const elevation = getThemeElevation(preset, scheme);
  const borderClass = elevation.borderWidth >= 2 ? "border-2" : "border";
  const primaryColor = resolveThemeColor(preset, scheme, "primary");

  const toast = useToast();
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false || netInfo.isInternetReachable === false;

  const liveQuery = useTaskLiveQuery();
  const createMutation = useCreateTaskMutation();
  const toggleMutation = useToggleTaskMutation();
  const deleteMutation = useDeleteTaskMutation();

  const tasks: ReadonlyArray<TaskItem> = useMemo(
    () => (liveQuery.data?.data ?? []) as ReadonlyArray<TaskItem>,
    [liveQuery.data],
  );

  const activeCount = useMemo(() => tasks.filter((task) => !task.done).length, [tasks]);
  const filteredTasks = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

  const handleMutationError = useCallback(
    (actionLabel: string, error: unknown) => {
      const decoded = decodeApiError(error);
      if (decoded._tag === "ForbiddenError") {
        const message = decoded.message || "You do not have permission to perform this action.";
        setMutationFeedback({
          title: "Access denied",
          message,
          isForbidden: true,
        });
        toast.warning("Access denied", message);
        return;
      }

      const message = decoded.message || `Unable to ${actionLabel}. Please try again.`;
      setMutationFeedback({
        title: `Unable to ${actionLabel}`,
        message,
        isForbidden: false,
      });
      toast.error(`Unable to ${actionLabel}`, message);
    },
    [toast],
  );

  const handleCreate = useCallback(() => {
    const decoded = Schema.decodeUnknownEither(CreateTaskFormSchema)({ name: title });
    if (decoded._tag === "Left") {
      setFormError(
        title.trim().length === 0
          ? "Task title is required"
          : "Task title must be at most 500 characters",
      );
      return;
    }

    setFormError(null);
    setMutationFeedback(null);
    setTitle("");
    createMutation.mutate(
      {
        name: decoded.right.name,
        done: decoded.right.done,
      },
      {
        onError: (err) => handleMutationError("create task", err),
      },
    );
  }, [title, createMutation, handleMutationError]);

  const handleToggle = useCallback(
    (task: TaskItem) => {
      setMutationFeedback(null);
      toggleMutation.mutate(
        { id: task.id, done: !task.done },
        {
          onError: (err) => handleMutationError("update task", err),
        },
      );
    },
    [toggleMutation, handleMutationError],
  );

  const handleRequestDelete = useCallback((task: TaskItem) => {
    setTaskPendingDelete(task);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!taskPendingDelete) return;
    const target = taskPendingDelete;
    setTaskPendingDelete(null);
    setMutationFeedback(null);
    deleteMutation.mutate(
      { id: target.id },
      {
        onError: (err) => handleMutationError("delete task", err),
      },
    );
  }, [taskPendingDelete, deleteMutation, handleMutationError]);

  const handleRefresh = useCallback(() => {
    setIsManualRefreshing(true);
    void liveQuery.refetch().finally(() => {
      setIsManualRefreshing(false);
    });
  }, [liveQuery]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TaskItem>) => (
      <TaskRow task={item} onToggle={handleToggle} onRequestDelete={handleRequestDelete} />
    ),
    [handleToggle, handleRequestDelete],
  );

  const keyExtractor = useCallback((item: TaskItem) => item.id, []);

  return (
    <SafeAreaView className="bg-background flex-1" edges={["left", "right"]}>
      <View className="flex-1 px-5 pt-4">
        {/* Compact Status Strip */}
        <View
          testID="tasks-status-strip"
          className="mb-4 flex-row flex-wrap items-center justify-between gap-2"
        >
          <View className="min-w-0 flex-row items-center gap-2">
            <Icon as={ListTodo} size={16} className="text-primary shrink-0" />
            <Text variant="label">
              {`${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`}
            </Text>
            <Text variant="caption">{`· ${activeCount} active`}</Text>
          </View>

          <LiveQueryBadge status={liveQuery.liveStatus} lastPingAt={liveQuery.lastPingAt} />
        </View>

        {/* Offline Banner */}
        {isOffline ? (
          <Alert variant="warning" className="mb-4">
            <View className="flex-row items-start gap-2.5">
              <Icon as={WifiOff} size={18} className="text-on-warning-container mt-0.5 shrink-0" />
              <AlertDescription className="min-w-0 flex-1 font-medium">
                You are offline. Viewing cached tasks until connection returns.
              </AlertDescription>
            </View>
          </Alert>
        ) : null}

        {/* Query Error Banner */}
        {liveQuery.isError ? (
          <Alert variant="destructive" className="mb-4">
            <View className="flex-row items-start gap-2.5">
              <Icon
                as={AlertCircle}
                size={18}
                className="text-on-destructive-container mt-0.5 shrink-0"
              />
              <AlertDescription className="min-w-0 flex-1 font-medium">
                Unable to sync tasks right now. Showing last known state.
              </AlertDescription>
            </View>
          </Alert>
        ) : null}

        {/* Mutation / 403 Error Banner */}
        {mutationFeedback ? (
          <Alert
            variant={mutationFeedback.isForbidden ? "warning" : "destructive"}
            className="mb-4"
          >
            <View className="flex-row items-start gap-2.5">
              <Icon
                as={mutationFeedback.isForbidden ? ShieldAlert : AlertCircle}
                size={18}
                className={cn(
                  "mt-0.5 shrink-0",
                  mutationFeedback.isForbidden
                    ? "text-on-warning-container"
                    : "text-on-destructive-container",
                )}
              />
              <View className="min-w-0 flex-1 gap-0.5">
                <AlertTitle>{mutationFeedback.title}</AlertTitle>
                <AlertDescription>{mutationFeedback.message}</AlertDescription>
              </View>
            </View>
          </Alert>
        ) : null}

        {/* Create Task Form (RBAC Guarded) */}
        <Can action="task:create">
          <View className="mb-4 gap-2">
            <View className="flex-row items-center gap-2">
              <Input
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  if (formError) setFormError(null);
                }}
                onSubmitEditing={handleCreate}
                placeholder="Add a new task..."
                accessibilityLabel="New task title"
                invalid={Boolean(formError)}
                returnKeyType="done"
                className="min-w-0 flex-1"
              />
              <Button
                accessibilityLabel="Add task"
                onPress={handleCreate}
                disabled={createMutation.isPending}
                size="default"
                className="shrink-0"
              >
                <Icon as={Plus} size={18} className="text-primary-foreground" />
                <Text>Add</Text>
              </Button>
            </View>
            {formError ? (
              <Text accessibilityRole="alert" className="text-body-sm text-destructive">
                {formError}
              </Text>
            ) : null}
          </View>
        </Can>

        {/* Filter Pills */}
        <View accessibilityRole="tablist" className="mb-4 flex-row flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const selected = filter === option.value;
            return (
              <TactilePressable
                key={option.value}
                elevated={selected}
                accessibilityRole="tab"
                accessibilityLabel={`Filter tasks: ${option.label}`}
                accessibilityState={{ selected }}
                onPress={() => setFilter(option.value)}
                className={cn(
                  "rounded-full px-4 py-2",
                  borderClass,
                  selected
                    ? "border-primary bg-primary"
                    : "border-outline-variant bg-surface-container-lowest",
                )}
              >
                <Text
                  className={cn(
                    "text-label-md",
                    selected ? "text-primary-foreground" : "text-foreground",
                  )}
                >
                  {option.label}
                </Text>
              </TactilePressable>
            );
          })}
        </View>

        {/* Task List */}
        <FlatList
          data={filteredTasks}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          className="flex-1"
          contentContainerClassName="pb-8"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListEmptyComponent={
            liveQuery.isPending ? (
              <TaskListSkeleton />
            ) : (
              <Card elevated={false} className="bg-surface-container-low mt-2">
                <CardContent className="items-center gap-2 py-8">
                  <Text variant="title">No tasks to show</Text>
                  <Text variant="muted" className="text-center">
                    {filter === "all"
                      ? "Create a task above or wait for live updates."
                      : `No ${filter} tasks match this filter.`}
                  </Text>
                </CardContent>
              </Card>
            )
          }
        />
      </View>

      <AlertDialog
        open={taskPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTaskPendingDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Are you sure you want to delete "${taskPendingDelete?.name ?? ""}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onPress={() => setTaskPendingDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onPress={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}
