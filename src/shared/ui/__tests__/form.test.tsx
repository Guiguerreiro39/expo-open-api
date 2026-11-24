import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Schema } from "effect";
import { useState } from "react";
import { Text, View } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  applyServerValidationErrors,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useAppForm,
  useFormItem,
} from "@/shared/ui/form";
import { FormScrollView } from "@/shared/ui/form-scroll-view";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { renderWithProviders } from "@/test/render";

const TitleFieldSchema = Schema.String.pipe(
  Schema.nonEmptyString({ message: () => "Title is required" }),
  Schema.minLength(3, { message: () => "Title must be at least 3 characters" }),
);

function TestFormHarness({
  onSubmit,
  triggerServerError,
}: {
  onSubmit: (values: { title: string }) => Promise<void> | void;
  triggerServerError?: boolean;
}) {
  const form = useAppForm({
    defaultValues: {
      title: "",
    },
    onSubmit: async ({ value }) => {
      if (triggerServerError) {
        applyServerValidationErrors(form, {
          title: "Title already exists on server",
        });
        return;
      }
      await onSubmit(value);
    },
  });

  return (
    <FormScrollView testID="form-scroll-view">
      <View className="gap-4 p-4">
        <form.Field
          name="title"
          validators={{
            onSubmit: Schema.standardSchemaV1(TitleFieldSchema),
            onChange: ({ value }) => (value.length > 0 ? undefined : undefined),
          }}
        >
          {(field) => (
            <FormField field={field}>
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    testID="title-input"
                    accessibilityLabel="Title"
                    placeholder="Enter title"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={(text) => field.handleChange(text)}
                  />
                </FormControl>
                <FormDescription>Provide a descriptive title.</FormDescription>
                <FormMessage testID="title-message" />
              </FormItem>
            </FormField>
          )}
        </form.Field>

        <Button onPress={() => void form.handleSubmit()}>Submit</Button>
      </View>
    </FormScrollView>
  );
}

function StabilityHarness({
  onSubmit,
  onHandleSubmitCaptured,
}: {
  onSubmit: () => void;
  onHandleSubmitCaptured: (fn: unknown) => void;
}) {
  const [tick, setTick] = useState(0);
  const form = useAppForm({
    defaultValues: { title: "stable" },
    onSubmit: async () => {
      onSubmit();
    },
  });
  onHandleSubmitCaptured(form.handleSubmit);

  return (
    <View>
      <Button testID="rerender-btn" onPress={() => setTick((c) => c + 1)}>
        Rerender
      </Button>
      <Button testID="submit-stable-btn" onPress={() => void form.handleSubmit()}>
        Submit Stable
      </Button>
      <Text testID="tick-count">{String(tick)}</Text>
    </View>
  );
}

function FailingSubmitHarness({
  onSubmitSuccessfulChange,
}: {
  onSubmitSuccessfulChange: (value: boolean) => void;
}) {
  const form = useAppForm({
    defaultValues: { title: "Valid Title" },
    onSubmit: async () => {
      throw new Error("Server exploded");
    },
  });

  return (
    <View>
      <form.Subscribe selector={(state) => state.isSubmitSuccessful}>
        {(isSubmitSuccessful) => {
          onSubmitSuccessfulChange(isSubmitSuccessful);
          return (
            <Text testID="submit-successful">{isSubmitSuccessful ? "success" : "not-success"}</Text>
          );
        }}
      </form.Subscribe>
      <Button onPress={() => void form.handleSubmit()}>Submit Boom</Button>
    </View>
  );
}

function AccessibilityControlsHarness() {
  const form = useAppForm({
    defaultValues: {
      agree: true,
      notifications: true,
      priority: { value: "high", label: "High" },
    },
    onSubmit: async () => {},
  });

  return (
    <View>
      <form.Field name="agree">
        {(field) => (
          <FormField field={field}>
            <FormItem>
              <FormControl>
                <Checkbox
                  testID="ctrl-checkbox"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
              </FormControl>
            </FormItem>
          </FormField>
        )}
      </form.Field>

      <form.Field name="notifications">
        {(field) => (
          <FormField field={field}>
            <FormItem>
              <FormControl>
                <Switch
                  testID="ctrl-switch"
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                />
              </FormControl>
            </FormItem>
          </FormField>
        )}
      </form.Field>

      <form.Field name="priority">
        {(field) => (
          <FormField field={field}>
            <FormItem>
              <Select
                value={field.state.value}
                onValueChange={(opt) => {
                  if (opt) field.handleChange(opt);
                }}
              >
                <FormControl>
                  <SelectTrigger testID="ctrl-select-trigger">
                    <SelectValue placeholder="Choose priority" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="high" label="High" />
                  <SelectItem value="low" label="Low" />
                </SelectContent>
              </Select>
            </FormItem>
          </FormField>
        )}
      </form.Field>
    </View>
  );
}

function ErrorsObserver({ onCapture }: { onCapture: (errors: string[]) => void }) {
  const { errors } = useFormItem();
  onCapture(errors);
  return null;
}

function MemoErrorsHarness({ onCapture }: { onCapture: (errors: string[]) => void }) {
  const form = useAppForm({
    defaultValues: { title: "" },
    onSubmit: async () => {},
  });

  return (
    <form.Field name="title">
      {(field) => (
        <FormField field={field}>
          <FormItem>
            <FormControl>
              <Input
                testID="memo-input"
                value={field.state.value}
                onChangeText={(text) => field.handleChange(text)}
              />
            </FormControl>
            <ErrorsObserver onCapture={onCapture} />
          </FormItem>
        </FormField>
      )}
    </form.Field>
  );
}

function BlurRecoveryHarness({
  onSubmit,
}: {
  readonly onSubmit: (value: { title: string }) => void;
}) {
  const form = useAppForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value }) => {
      onSubmit(value);
    },
  });

  return (
    <View>
      <form.Field
        name="title"
        validators={{
          onBlur: Schema.standardSchemaV1(TitleFieldSchema),
          onSubmit: Schema.standardSchemaV1(TitleFieldSchema),
        }}
      >
        {(field) => (
          <FormField field={field}>
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  testID="blur-title-input"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChangeText={(text) => field.handleChange(text)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        )}
      </form.Field>
      <Button onPress={() => void form.handleSubmit()}>Submit Blur Form</Button>
    </View>
  );
}

describe("Mobile TanStack Form Primitives", () => {
  it("validates fields via Effect Schema.standardSchemaV1 and sets accessibility invalid state", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<TestFormHarness onSubmit={onSubmit} />);

    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    const alertMessage = await screen.findByRole("alert");
    expect(alertMessage).toHaveTextContent("Title is required");
    expect(screen.getByTestId("title-input").props.accessibilityState).toMatchObject({
      invalid: true,
    });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId("title-input"), "Valid Title");
    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ title: "Valid Title" });
    });
  });

  it("prevents concurrent double submissions with isSubmittingRef lock", async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    renderWithProviders(<TestFormHarness onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId("title-input"), "Double submit test");

    const submitButton = screen.getByRole("button", { name: "Submit" });
    fireEvent.press(submitButton);
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    resolveSubmit();
  });

  it("captures unexpected submit exceptions as defects in ObservabilityService", async () => {
    const unexpectedError = new Error("Unexpected submit crash");
    const onSubmit = vi.fn(async () => {
      throw unexpectedError;
    });

    const { observability } = renderWithProviders(<TestFormHarness onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId("title-input"), "Boom title");
    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(observability.defects.length).toBe(1);
    });
    expect(observability.defects[0]?.error).toBe(unexpectedError);
  });

  it("maps HTTP 422 server validation errors via applyServerValidationErrors and clears on change", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<TestFormHarness onSubmit={onSubmit} triggerServerError />);

    fireEvent.changeText(screen.getByTestId("title-input"), "Existing Title");
    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("Title already exists on server")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("title-input"), "Updated Title");

    await waitFor(() => {
      expect(screen.queryByText("Title already exists on server")).toBeNull();
    });
  });

  it("configures FormScrollView with keyboardShouldPersistTaps='handled' and keyboardDismissMode='on-drag'", () => {
    renderWithProviders(<TestFormHarness onSubmit={vi.fn()} />);

    const scrollView = screen.getByTestId("form-scroll-view");
    expect(scrollView.props.keyboardShouldPersistTaps).toBe("handled");
    expect(scrollView.props.keyboardDismissMode).toBe("on-drag");
  });

  it("keeps form.handleSubmit identity stable across re-renders without recursive re-wrapping", async () => {
    const handleSubmitRefs: Array<unknown> = [];
    const onSubmit = vi.fn();

    renderWithProviders(
      <StabilityHarness
        onSubmit={onSubmit}
        onHandleSubmitCaptured={(fn) => {
          handleSubmitRefs.push(fn);
        }}
      />,
    );

    for (let i = 0; i < 15; i += 1) {
      fireEvent.press(screen.getByTestId("rerender-btn"));
    }

    expect(handleSubmitRefs.length).toBeGreaterThanOrEqual(10);
    const firstRef = handleSubmitRefs[0];
    for (const ref of handleSubmitRefs) {
      expect(ref).toBe(firstRef);
    }

    fireEvent.press(screen.getByTestId("submit-stable-btn"));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("sets isSubmitSuccessful to false and captures 1 defect when onSubmit throws without unhandled rejection", async () => {
    let observedSubmitSuccessful: boolean | undefined;

    const { observability } = renderWithProviders(
      <FailingSubmitHarness
        onSubmitSuccessfulChange={(value) => {
          observedSubmitSuccessful = value;
        }}
      />,
    );

    fireEvent.press(screen.getByRole("button", { name: "Submit Boom" }));

    await waitFor(() => {
      expect(observability.defects).toHaveLength(1);
    });
    expect(observedSubmitSuccessful).toBe(false);
    expect(screen.getByTestId("submit-successful").props.children).toBe("not-success");
  });

  it("preserves checked and expanded accessibilityState on Checkbox, Switch, and SelectTrigger inside FormControl", async () => {
    renderWithProviders(<AccessibilityControlsHarness />);

    expect(screen.getByTestId("ctrl-checkbox").props.accessibilityState).toMatchObject({
      checked: true,
      invalid: false,
    });
    expect(screen.getByTestId("ctrl-switch").props.accessibilityState).toMatchObject({
      checked: true,
      invalid: false,
    });
    expect(screen.getByTestId("ctrl-select-trigger").props.accessibilityState).toMatchObject({
      expanded: false,
      invalid: false,
    });

    fireEvent.press(screen.getByTestId("ctrl-select-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("ctrl-select-trigger").props.accessibilityState).toMatchObject({
        expanded: true,
        invalid: false,
      });
    });
  });

  it("reserves stable min-h-5 layout height on FormMessage when empty without exposing an alert role", async () => {
    renderWithProviders(<TestFormHarness onSubmit={vi.fn()} />);

    const emptyMessage = screen.getByTestId("title-message", { includeHiddenElements: true });
    expect(String(emptyMessage.props.className ?? "")).toContain("min-h-5");
    expect(emptyMessage.props.accessibilityRole).toBeUndefined();
    expect(emptyMessage.props.accessibilityElementsHidden).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Submit" }));

    const activeMessage = await screen.findByRole("alert");
    expect(activeMessage).toHaveTextContent("Title is required");
    expect(String(activeMessage.props.className ?? "")).toContain("min-h-5");
  });

  it("keeps FormField errors array reference stable across keystrokes when errors have not changed", () => {
    const capturedErrorRefs: Array<string[]> = [];

    renderWithProviders(
      <MemoErrorsHarness onCapture={(errors) => capturedErrorRefs.push(errors)} />,
    );

    fireEvent.changeText(screen.getByTestId("memo-input"), "a");
    fireEvent.changeText(screen.getByTestId("memo-input"), "ab");
    fireEvent.changeText(screen.getByTestId("memo-input"), "abc");

    expect(capturedErrorRefs.length).toBeGreaterThanOrEqual(4);
    const firstErrorsRef = capturedErrorRefs[0];
    for (const ref of capturedErrorRefs) {
      expect(ref).toBe(firstErrorsRef);
    }
  });

  it("clears stale onBlur errors on change and never deadlocks submission when a previously invalid field becomes valid", async () => {
    const onSubmit = vi.fn();

    renderWithProviders(<BlurRecoveryHarness onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId("blur-title-input"), "ab");
    fireEvent(screen.getByTestId("blur-title-input"), "blur");
    expect(await screen.findByText("Title must be at least 3 characters")).toBeTruthy();

    // Fix text without firing blur (simulating keyboardShouldPersistTaps="handled" or keyboard Done)
    fireEvent.changeText(screen.getByTestId("blur-title-input"), "Valid Title");
    fireEvent.press(screen.getByRole("button", { name: "Submit Blur Form" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ title: "Valid Title" });
    });
    expect(screen.queryAllByRole("alert")).toEqual([]);
  });
});
