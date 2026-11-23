import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Schema } from "effect";
import { View } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/shared/ui/button";
import {
  applyServerValidationErrors,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useAppForm,
} from "@/shared/ui/form";
import { FormScrollView } from "@/shared/ui/form-scroll-view";
import { Input } from "@/shared/ui/input";
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
                <FormMessage />
              </FormItem>
            </FormField>
          )}
        </form.Field>

        <Button onPress={() => void form.handleSubmit()}>Submit</Button>
      </View>
    </FormScrollView>
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
});
