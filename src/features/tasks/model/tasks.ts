import { Schema } from "effect";

export interface TaskItem {
  readonly id: string;
  readonly name: string;
  readonly done: boolean;
  readonly userId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly [key: string]: unknown;
}

export type TaskFilterStatus = "all" | "active" | "completed";

export const CreateTaskFormSchema = Schema.Struct({
  name: Schema.Trim.pipe(
    Schema.minLength(1, { message: () => "Task title is required" }),
    Schema.maxLength(500, { message: () => "Task title must be at most 500 characters" }),
  ),
  done: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});

export type CreateTaskFormValues = typeof CreateTaskFormSchema.Type;

export function filterTasks(tasks: ReadonlyArray<TaskItem>, filter: TaskFilterStatus): TaskItem[] {
  switch (filter) {
    case "completed":
      return tasks.filter((task) => task.done);
    case "active":
      return tasks.filter((task) => !task.done);
    default:
      return [...tasks];
  }
}
