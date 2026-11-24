import { useNetInfo } from "@react-native-community/netinfo";
import { Schema } from "effect";
import { AlertCircle, Check, Circle, ListTodo, Plus, Trash2, WifiOff } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { FlatList, type ListRenderItemInfo, Pressable, View } from "react-native";
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
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Can } from "@/shared/ui/can";
import { Card, CardContent } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { LiveQueryBadge } from "@/shared/ui/live-query-badge";
import { TactilePressable } from "@/shared/ui/tactile-pressable";
import { Text } from "@/shared/ui/text";

const FILTER_OPTIONS: ReadonlyArray<{ readonly value: TaskFilterStatus; readonly label: string }> =
  [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
  ];

interface TaskRowProps {
  readonly task: TaskItem;
  readonly onToggle: (task: TaskItem) => void;
  readonly onDelete: (task: TaskItem) => void;
}

function TaskRow({ task, onToggle, onDelete }: TaskRowProps) {
  const isOptimistic = task.id.startsWith("optimistic-");

  return (
    <Card className={cn("mb-3", isOptimistic && "opacity-75")}>
      <CardContent className="flex-row items-center gap-3 py-4">
        <Can
          action="task:update"
          resource={task}
          fallback={
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
          }
        >
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`Toggle task ${task.name}`}
            accessibilityState={{ checked: task.done }}
            onPress={() => onToggle(task)}
            className={cn(
              "h-8 w-8 items-center justify-center rounded-full border",
              task.done
                ? "border-primary bg-primary"
                : "border-outline bg-surface-container-lowest",
            )}
          >
            {task.done ? (
              <Icon as={Check} size={16} className="text-primary-foreground" />
            ) : (
              <Icon as={Circle} size={16} className="text-on-surface-variant" />
            )}
          </Pressable>
        </Can>

        <View className="flex-1 gap-0.5">
          <Text
            className={cn(
              "text-body-md font-semibold",
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
            accessibilityLabel={`Delete task ${task.name}`}
            onPress={() => onDelete(task)}
          >
            <Icon as={Trash2} size={18} className="text-destructive" />
          </Button>
        </Can>
      </CardContent>
    </Card>
  );
}

export function TasksScreen() {
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilterStatus>("all");

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

  const filteredTasks = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);

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
    setTitle("");
    createMutation.mutate({
      name: decoded.right.name,
      done: decoded.right.done,
    });
  }, [title, createMutation]);

  const handleToggle = useCallback(
    (task: TaskItem) => {
      toggleMutation.mutate({ id: task.id, done: !task.done });
    },
    [toggleMutation],
  );

  const handleDelete = useCallback(
    (task: TaskItem) => {
      deleteMutation.mutate({ id: task.id });
    },
    [deleteMutation],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<TaskItem>) => (
      <TaskRow task={item} onToggle={handleToggle} onDelete={handleDelete} />
    ),
    [handleToggle, handleDelete],
  );

  const keyExtractor = useCallback((item: TaskItem) => item.id, []);

  return (
    <SafeAreaView className="bg-background flex-1" edges={["top", "left", "right"]}>
      <View className="flex-1 px-5 pt-4">
        {/* Header */}
        <View className="mb-4 flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2.5">
            <View className="border-outline-variant bg-primary-container h-10 w-10 items-center justify-center rounded-xl border">
              <Icon as={ListTodo} size={20} className="text-on-primary-container" />
            </View>
            <View>
              <Text variant="h3">Tasks</Text>
              <Text variant="caption">{`${tasks.length} total`}</Text>
            </View>
          </View>

          <LiveQueryBadge status={liveQuery.liveStatus} lastPingAt={liveQuery.lastPingAt} />
        </View>

        {/* Offline Banner */}
        {isOffline ? (
          <View
            accessibilityRole="alert"
            className="border-warning bg-warning-container mb-4 flex-row items-center gap-2.5 rounded-xl border px-4 py-3"
          >
            <Icon as={WifiOff} size={18} className="text-on-warning-container" />
            <Text className="text-body-sm text-on-warning-container flex-1 font-medium">
              You are offline. Viewing cached tasks until connection returns.
            </Text>
          </View>
        ) : null}

        {/* Query Error Banner */}
        {liveQuery.isError ? (
          <View
            accessibilityRole="alert"
            className="border-destructive bg-destructive-container mb-4 flex-row items-center gap-2.5 rounded-xl border px-4 py-3"
          >
            <Icon as={AlertCircle} size={18} className="text-on-destructive-container" />
            <Text className="text-body-sm text-on-destructive-container flex-1 font-medium">
              Unable to sync tasks right now. Showing last known state.
            </Text>
          </View>
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
                className="flex-1"
              />
              <Button
                accessibilityLabel="Add task"
                onPress={handleCreate}
                disabled={createMutation.isPending}
                size="default"
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
        <View accessibilityRole="tablist" className="mb-4 flex-row gap-2">
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
                  "rounded-full border px-4 py-2",
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
          ListEmptyComponent={
            <Card elevated={false} className="bg-surface-container-low mt-2">
              <CardContent className="items-center gap-2 py-8">
                <Text variant="title">
                  {liveQuery.isPending ? "Loading tasks..." : "No tasks to show"}
                </Text>
                <Text variant="muted" className="text-center">
                  {filter === "all"
                    ? "Create a task above or wait for live updates."
                    : `No ${filter} tasks match this filter.`}
                </Text>
              </CardContent>
            </Card>
          }
        />
      </View>
    </SafeAreaView>
  );
}
