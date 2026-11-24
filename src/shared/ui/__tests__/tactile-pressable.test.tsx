import { fireEvent, screen } from "@testing-library/react-native";
import { useState } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { describe, expect, it } from "vitest";
import { Button } from "@/shared/ui/button";
import { TactilePressable } from "@/shared/ui/tactile-pressable";
import { Text } from "@/shared/ui/text";
import { mockHaptics } from "@/test/mocks/adapters/mock-haptics";
import { renderWithProviders } from "@/test/render";

function TactileHarness({ testID, label }: { readonly testID: string; readonly label: string }) {
  const [, setRenderTick] = useState(0);
  return (
    <TactilePressable
      testID={testID}
      accessibilityRole="button"
      onPressIn={() => setRenderTick((n) => n + 1)}
      onPressOut={() => setRenderTick((n) => n + 1)}
    >
      <Text>{label}</Text>
    </TactilePressable>
  );
}

function extractBoxShadow(styleProp: unknown): string | undefined {
  const flat = StyleSheet.flatten(styleProp as ViewStyle) as
    | (ViewStyle & { boxShadow?: string })
    | undefined;
  return flat?.boxShadow;
}

function extractTranslate(styleProp: unknown): { x: number; y: number } {
  const flat = StyleSheet.flatten(styleProp as ViewStyle);
  const transform = Array.isArray(flat?.transform) ? flat.transform : [];
  let x = 0;
  let y = 0;
  for (const entry of transform) {
    if (entry && typeof entry === "object") {
      if ("translateX" in entry && typeof entry.translateX === "number") {
        x = entry.translateX;
      }
      if ("translateY" in entry && typeof entry.translateY === "number") {
        y = entry.translateY;
      }
    }
  }
  return { x, y };
}

function parseShadowOffsets(boxShadow: string | undefined): { x: number; y: number } {
  const match = boxShadow?.match(/^(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px/);
  return {
    x: match ? Number(match[1]) : Number.NaN,
    y: match ? Number(match[2]) : Number.NaN,
  };
}

describe("TactilePressable", () => {
  it("compresses offset shadow smoothly toward zero on press-in without outward overflow and restores on press-out", () => {
    const { observability } = renderWithProviders(
      <TactileHarness testID="tactile-btn" label="Press me" />,
      {
        initialPreset: "neo-brutalist",
        initialColorScheme: "light",
      },
    );

    const button = screen.getByTestId("tactile-btn");
    const restShadow = parseShadowOffsets(extractBoxShadow(button.props.style));
    const restTranslate = extractTranslate(button.props.style);

    expect(restShadow).toEqual({ x: 4, y: 4 });
    expect(restTranslate).toEqual({ x: 0, y: 0 });

    fireEvent(button, "pressIn");

    const pressedButton = screen.getByTestId("tactile-btn");
    const pressedShadow = parseShadowOffsets(extractBoxShadow(pressedButton.props.style));
    const pressedTranslate = extractTranslate(pressedButton.props.style);

    expect(pressedTranslate).toEqual({ x: 4, y: 4 });
    expect(pressedShadow).toEqual({ x: 0, y: 0 });
    // Total visual extent (translate + remaining shadow) never exceeds resting offset (zero outward clipping)
    expect(pressedTranslate.x + pressedShadow.x).toBeLessThanOrEqual(restShadow.x);
    expect(pressedTranslate.y + pressedShadow.y).toBeLessThanOrEqual(restShadow.y);
    expect(mockHaptics.events).toEqual([{ type: "impact", style: "light" }]);

    fireEvent(pressedButton, "pressOut");

    const releasedButton = screen.getByTestId("tactile-btn");
    expect(extractTranslate(releasedButton.props.style)).toEqual({ x: 0, y: 0 });
    expect(parseShadowOffsets(extractBoxShadow(releasedButton.props.style))).toEqual({
      x: 4,
      y: 4,
    });
    observability.assertNoDefects();
  });

  it("compresses warm-tactile shadow toward zero without outward overflow", () => {
    const { observability } = renderWithProviders(
      <TactileHarness testID="warm-btn" label="Warm press" />,
      {
        initialPreset: "warm-tactile",
        initialColorScheme: "dark",
      },
    );

    const button = screen.getByTestId("warm-btn");
    const restShadow = parseShadowOffsets(extractBoxShadow(button.props.style));
    expect(restShadow).toEqual({ x: 4, y: 4 });

    fireEvent(button, "pressIn");

    const pressedButton = screen.getByTestId("warm-btn");
    const pressedShadow = parseShadowOffsets(extractBoxShadow(pressedButton.props.style));
    const pressedTranslate = extractTranslate(pressedButton.props.style);
    expect(pressedTranslate).toEqual({ x: 2, y: 2 });
    expect(pressedShadow).toEqual({ x: 0, y: 0 });
    expect(pressedTranslate.x + pressedShadow.x).toBeLessThanOrEqual(restShadow.x);
    expect(pressedTranslate.y + pressedShadow.y).toBeLessThanOrEqual(restShadow.y);
    observability.assertNoDefects();
  });

  it("prevents caller border classes from downgrading neo-brutalist 2px borders while keeping borderless non-elevated pressables borderless", () => {
    const { observability } = renderWithProviders(
      <>
        <TactilePressable
          testID="elevated-with-border"
          elevated
          className="border-primary bg-card border"
        >
          <Text>Elevated</Text>
        </TactilePressable>
        <TactilePressable
          testID="unselected-with-border"
          elevated={false}
          className="border-outline-variant bg-card border"
        >
          <Text>Unselected</Text>
        </TactilePressable>
        <TactilePressable testID="ghost-pressable" elevated={false} className="bg-transparent">
          <Text>Ghost</Text>
        </TactilePressable>
      </>,
      { initialPreset: "neo-brutalist", initialColorScheme: "light" },
    );

    const elevatedClasses = String(
      screen.getByTestId("elevated-with-border").props.className,
    ).split(/\s+/);
    expect(elevatedClasses).toContain("border-2");
    expect(elevatedClasses).not.toContain("border");

    const unselectedClasses = String(
      screen.getByTestId("unselected-with-border").props.className,
    ).split(/\s+/);
    expect(unselectedClasses).toContain("border-2");
    expect(unselectedClasses).not.toContain("border");

    const ghostClasses = String(screen.getByTestId("ghost-pressable").props.className).split(/\s+/);
    expect(ghostClasses).not.toContain("border");
    expect(ghostClasses).not.toContain("border-2");
    observability.assertNoDefects();
  });

  it("keeps outline Button border width in neo-brutalist when elevated={false}", () => {
    const { observability } = renderWithProviders(
      <Button testID="flat-outline-btn" variant="outline" elevated={false}>
        Flat Outline
      </Button>,
      { initialPreset: "neo-brutalist" },
    );

    const flatOutlineTokens = String(screen.getByTestId("flat-outline-btn").props.className)
      .trim()
      .split(/\s+/);
    expect(flatOutlineTokens).toContain("border-2");
    observability.assertNoDefects();
  });

  it("keeps outline Button border width in warm-tactile and respects explicit caller border-4/border-0 on TactilePressable", () => {
    const { observability } = renderWithProviders(
      <>
        <Button testID="warm-flat-outline" variant="outline" elevated={false}>
          Warm Outline
        </Button>
        <TactilePressable testID="thick-border" className="border-primary border-4">
          <Text>Thick</Text>
        </TactilePressable>
        <TactilePressable testID="zero-border" className="border-0">
          <Text>Zero</Text>
        </TactilePressable>
      </>,
      { initialPreset: "warm-tactile" },
    );

    expect(
      String(screen.getByTestId("warm-flat-outline").props.className).trim().split(/\s+/),
    ).toContain("border");
    expect(String(screen.getByTestId("thick-border").props.className)).toContain("border-4");
    expect(String(screen.getByTestId("zero-border").props.className)).toContain("border-0");
    observability.assertNoDefects();
  });
});
