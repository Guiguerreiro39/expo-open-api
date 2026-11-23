import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { CreateTaskFormSchema, filterTasks, type TaskItem } from "@/features/tasks/model/tasks";

const SAMPLE_TASKS: ReadonlyArray<TaskItem> = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Write SSE parser",
    done: false,
    userId: "user-1",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Wire MMKV cache",
    done: true,
    userId: "user-1",
    createdAt: "2026-03-01T10:05:00.000Z",
    updatedAt: "2026-03-01T10:05:00.000Z",
  },
];

describe("Tasks domain model", () => {
  it("validates create-task form values with Effect Schema", () => {
    const valid = Schema.decodeUnknownEither(CreateTaskFormSchema)({ name: "Ship mobile tasks" });
    expect(valid._tag).toBe("Right");
    if (valid._tag === "Right") {
      expect(valid.right).toEqual({ name: "Ship mobile tasks", done: false });
    }

    const empty = Schema.decodeUnknownEither(CreateTaskFormSchema)({ name: "   " });
    expect(empty._tag).toBe("Left");

    const tooLong = Schema.decodeUnknownEither(CreateTaskFormSchema)({ name: "a".repeat(501) });
    expect(tooLong._tag).toBe("Left");
  });

  it("filters tasks by all, active, and completed statuses", () => {
    expect(filterTasks(SAMPLE_TASKS, "all").map((t) => t.id)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
    expect(filterTasks(SAMPLE_TASKS, "active").map((t) => t.id)).toEqual([
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(filterTasks(SAMPLE_TASKS, "completed").map((t) => t.id)).toEqual([
      "22222222-2222-4222-8222-222222222222",
    ]);
  });
});
