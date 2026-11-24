import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { describe, expect, it } from "vitest";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  type SelectOption,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { renderWithProviders } from "@/test/render";

const OPTIONS: SelectOption[] = [
  { value: "bug-report", label: "Bug Report" },
  { value: "feature-request", label: "Feature Request" },
  { value: "design-feedback", label: "Design Feedback" },
  { value: "performance", label: "Performance" },
  { value: "accessibility", label: "Accessibility" },
];

const MEASURABLE_NODE_MOCK = {
  createNodeMock: () => ({
    measure: (cb: (x: number, y: number, w: number, h: number, px: number, py: number) => void) => {
      cb(16, 120, 240, 48, 16, 120);
    },
  }),
};

function SelectHarness({ initialInvalid = false }: { initialInvalid?: boolean }) {
  const [value, setValue] = useState<SelectOption | undefined>(undefined);
  const [invalid, setInvalid] = useState(initialInvalid);

  return (
    <View>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger testID="select-trigger" invalid={invalid}>
          <SelectValue placeholder="Choose category" />
        </SelectTrigger>
        <SelectContent testID="select-content">
          <SelectGroup>
            <SelectLabel>Categories</SelectLabel>
            {OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                testID={`select-item-${option.value}`}
                value={option.value}
                label={option.label}
              />
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Toggle Invalid"
        onPress={() => setInvalid((prev) => !prev)}
      >
        <Text>Toggle Invalid</Text>
      </Pressable>
    </View>
  );
}

describe("Select primitive", () => {
  it("applies border-outline, preset radius, and elevation borderWidth on SelectTrigger and invalid border when invalid", () => {
    const { observability } = renderWithProviders(<SelectHarness />, {
      initialPreset: "neo-brutalist",
      initialColorScheme: "dark",
    });

    const trigger = screen.getByTestId("select-trigger");
    expect(trigger.props.className).toContain("border-outline");
    expect(trigger.props.className).not.toContain("border-outline-variant");
    expect(trigger.props.className).toContain("rounded-sm");
    expect(trigger.props.className).toContain("border-2");
    expect(trigger.props.invalid).toBeUndefined();

    fireEvent.press(screen.getByRole("button", { name: "Toggle Invalid" }));
    const invalidTrigger = screen.getByTestId("select-trigger");
    expect(invalidTrigger.props.className).toContain("border-destructive");
    expect(invalidTrigger.props.invalid).toBeUndefined();

    observability.assertNoDefects();
  });

  it("opens with --scrim backdrop, safe-area insets, scrollable viewport, ItemText labels, flex row alignment, and contrast-safe press state", async () => {
    const { observability } = renderWithProviders(<SelectHarness />, {
      initialPreset: "neo-brutalist",
      initialColorScheme: "dark",
      ...MEASURABLE_NODE_MOCK,
    });

    expect(screen.getByText("Choose category")).toBeTruthy();

    fireEvent.press(screen.getByTestId("select-trigger"));

    const content = await screen.findByTestId("select-content");
    expect(content.props.className).toContain("rounded-sm");
    expect(content.props.className).toContain("border-2");

    const overlay = screen.getByTestId("select-overlay");
    expect(overlay.props.className).toContain("bg-scrim/");
    expect(overlay.props.className).not.toContain("bg-foreground/");
    expect(overlay.props.className).not.toContain("items-center");

    const scrollView = screen.UNSAFE_getByType(ScrollView);
    expect(scrollView.props.className).toContain("max-h-64");

    const featureItem = screen.getByTestId("select-item-feature-request");
    expect(featureItem.props.className).toContain("flex");
    expect(featureItem.props.className).toContain("flex-row");
    expect(featureItem.props.className).toContain("active:bg-surface-container-high");
    expect(featureItem.props.className).not.toContain("active:bg-accent");
    expect(screen.getByText("Feature Request")).toBeTruthy();

    fireEvent.press(featureItem);
    await waitFor(() => {
      expect(screen.queryByTestId("select-content")).toBeNull();
    });
    expect(screen.getByText("Feature Request")).toBeTruthy();

    observability.assertNoDefects();
  });
});
