import { Schema } from "effect";

export const SHOWCASE_CATEGORIES = [
  { value: "feature", label: "Feature Request" },
  { value: "bug", label: "Bug Report" },
  { value: "design", label: "Design Polish" },
  { value: "performance", label: "Performance" },
] as const;

export const SHOWCASE_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const ShowcaseCategorySchema = Schema.Literal("feature", "bug", "design", "performance");
export const ShowcasePrioritySchema = Schema.Literal("low", "medium", "high", "critical");

export const ShowcaseFeedbackSchema = Schema.Struct({
  title: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "Title is required" }),
    Schema.minLength(3, { message: () => "Title must be at least 3 characters" }),
  ),
  category: ShowcaseCategorySchema,
  priority: ShowcasePrioritySchema,
  description: Schema.String.pipe(
    Schema.minLength(10, { message: () => "Description must be at least 10 characters" }),
  ),
  agreeTerms: Schema.Boolean.pipe(
    Schema.filter((val) => val === true, {
      message: () => "You must agree to the feedback policy",
    }),
  ),
});

export type ShowcaseFeedbackValues = typeof ShowcaseFeedbackSchema.Type;
