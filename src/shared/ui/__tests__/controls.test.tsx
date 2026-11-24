import { fireEvent, screen } from "@testing-library/react-native";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Platform, ScrollView } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { THEME_PRESETS } from "@/shared/lib/theme/presets";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { Icon } from "@/shared/ui/icon";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Skeleton } from "@/shared/ui/skeleton";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Text, TextClassContext } from "@/shared/ui/text";
import { CANONICAL_PRESETS, computeContrastRatio } from "@/test/design-token-verifier";
import { renderWithProviders } from "@/test/render";

function classTokens(value: unknown): string[] {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function ToggleControlsHarness({
  onSwitchChange,
  onCheckboxChange,
}: {
  readonly onSwitchChange: (next: boolean) => void;
  readonly onCheckboxChange: (next: boolean) => void;
}) {
  const [swOn, setSwOn] = useState(false);
  const [chkOn, setChkOn] = useState(false);

  return (
    <>
      <Switch
        testID="toggle-switch"
        checked={swOn}
        onCheckedChange={(next) => {
          setSwOn(next);
          onSwitchChange(next);
        }}
      />
      <Checkbox
        testID="toggle-checkbox"
        checked={chkOn}
        onCheckedChange={(next) => {
          setChkOn(next);
          onCheckboxChange(next);
        }}
      />
    </>
  );
}

describe("Core primitives preset geometry", () => {
  it("applies neo-brutalist sharp radii and constant 2px borders across Card, Button, Badge, Alert, and Accordion", () => {
    const { observability } = renderWithProviders(
      <>
        <Card testID="card" className="border">
          <CardContent>
            <Text>Card body</Text>
          </CardContent>
        </Card>
        <Button testID="btn" variant="outline">
          Action
        </Button>
        <Badge testID="badge" variant="secondary">
          New
        </Badge>
        <Alert testID="alert" variant="info">
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>Preset geometry applies here.</AlertDescription>
        </Alert>
        <Accordion type="single" collapsible value="item-1" onValueChange={() => {}}>
          <AccordionItem testID="accordion-item" value="item-1">
            <AccordionTrigger>
              <Text>Section 1</Text>
            </AccordionTrigger>
            <AccordionContent testID="accordion-content">
              <Text>Expanded content</Text>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </>,
      { initialPreset: "neo-brutalist", initialColorScheme: "light" },
    );

    for (const id of ["card", "btn", "badge", "alert", "accordion-item"]) {
      const tokens = classTokens(screen.getByTestId(id).props.className);
      expect(tokens, `${id} should use neo-brutalist rounded-sm`).toContain("rounded-sm");
      expect(tokens, `${id} should use neo-brutalist border-2`).toContain("border-2");
      expect(tokens, `${id} should not downgrade to 1px border`).not.toContain("border");
    }

    expect(classTokens(screen.getByTestId("accordion-content").props.className)).toContain(
      "border-t-2",
    );
    observability.assertNoDefects();
  });

  it("applies editorial-slate structured radii and 1px borders across core primitives", () => {
    const { observability } = renderWithProviders(
      <>
        <Card testID="card">
          <CardContent>
            <Text>Card body</Text>
          </CardContent>
        </Card>
        <Button testID="btn" variant="default">
          Action
        </Button>
        <Badge testID="badge" variant="outline">
          Draft
        </Badge>
        <Alert testID="alert">
          <AlertTitle>Notice</AlertTitle>
        </Alert>
        <Accordion type="single" collapsible value="item-1" onValueChange={() => {}}>
          <AccordionItem testID="accordion-item" value="item-1">
            <AccordionTrigger>
              <Text>Section 1</Text>
            </AccordionTrigger>
            <AccordionContent testID="accordion-content">
              <Text>Content</Text>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </>,
      { initialPreset: "editorial-slate", initialColorScheme: "dark" },
    );

    expect(classTokens(screen.getByTestId("card").props.className)).toContain("rounded-xl");
    expect(classTokens(screen.getByTestId("btn").props.className)).toContain("rounded-lg");
    expect(classTokens(screen.getByTestId("badge").props.className)).toContain("rounded-full");
    expect(classTokens(screen.getByTestId("alert").props.className)).toContain("rounded-lg");
    expect(classTokens(screen.getByTestId("accordion-item").props.className)).toContain(
      "rounded-lg",
    );
    expect(classTokens(screen.getByTestId("alert").props.className)).toContain("border");
    expect(classTokens(screen.getByTestId("alert").props.className)).not.toContain("border-2");
    observability.assertNoDefects();
  });
});

describe("Checkbox, RadioGroup, and Switch controls", () => {
  it("applies border-outline, >= 44x44pt touch targets, preset borders/radii, and high-contrast unchecked Switch thumb", () => {
    const { observability } = renderWithProviders(
      <>
        <Checkbox testID="chk" checked={false} onCheckedChange={() => {}} />
        <RadioGroup testID="rg" value="a" onValueChange={() => {}}>
          <RadioGroupItem testID="radio-a" value="a" />
          <RadioGroupItem testID="radio-b" value="b" />
        </RadioGroup>
        <Switch testID="sw" checked={false} onCheckedChange={() => {}} />
      </>,
      { initialPreset: "neo-brutalist", initialColorScheme: "dark" },
    );

    const chk = screen.getByTestId("chk");
    const radioA = screen.getByTestId("radio-a");
    const radioB = screen.getByTestId("radio-b");
    const sw = screen.getByTestId("sw");

    expect(classTokens(chk.props.className)).toContain("border-outline");
    expect(classTokens(chk.props.className)).toContain("border-2");
    expect(classTokens(radioB.props.className)).toContain("border-outline");
    expect(classTokens(radioB.props.className)).toContain("border-2");
    expect(classTokens(sw.props.className)).toContain("border-outline");
    expect(classTokens(sw.props.className)).toContain("border-2");

    expect(classTokens(radioA.props.className)).toContain("border-primary");
    expect(classTokens(radioA.props.className)).toContain("border-2");

    expect(chk.props.hitSlop).toMatchObject({ top: 10, bottom: 10, left: 10, right: 10 });
    expect(radioA.props.hitSlop).toMatchObject({ top: 10, bottom: 10, left: 10, right: 10 });
    expect(sw.props.hitSlop).toMatchObject({ top: 8, bottom: 8 });

    const thumb = sw.children[0];
    expect(typeof thumb).toBe("object");
    const thumbClasses = classTokens(
      typeof thumb === "object" && thumb !== null ? thumb.props.className : "",
    );
    expect(thumbClasses).toContain("bg-on-surface-variant");
    for (const presetId of CANONICAL_PRESETS) {
      for (const scheme of ["light", "dark"] as const) {
        const palette = THEME_PRESETS[presetId][scheme];
        const ratio = computeContrastRatio(
          palette["--on-surface-variant"],
          palette["--surface-container-high"],
        );
        expect(
          ratio,
          `${presetId}.${scheme} unchecked switch thumb contrast`,
        ).toBeGreaterThanOrEqual(3);
      }
    }

    observability.assertNoDefects();
  });

  it("styles invalid Checkbox, RadioGroupItem, and Switch with border-destructive and strips invalid before forwarding to underlying elements", () => {
    const { observability } = renderWithProviders(
      <>
        <Checkbox testID="chk-invalid" checked={false} invalid onCheckedChange={() => {}} />
        <RadioGroup testID="rg-invalid" value="" invalid onValueChange={() => {}}>
          <RadioGroupItem testID="radio-inherited-invalid" value="a" />
          <RadioGroupItem testID="radio-direct-invalid" value="b" invalid />
        </RadioGroup>
        <Switch testID="sw-invalid" checked={false} invalid onCheckedChange={() => {}} />
      </>,
      { initialPreset: "warm-tactile", initialColorScheme: "light" },
    );

    const chk = screen.getByTestId("chk-invalid");
    const rg = screen.getByTestId("rg-invalid");
    const radioInherited = screen.getByTestId("radio-inherited-invalid");
    const radioDirect = screen.getByTestId("radio-direct-invalid");
    const sw = screen.getByTestId("sw-invalid");

    expect(classTokens(chk.props.className)).toContain("border-destructive");
    expect(classTokens(radioInherited.props.className)).toContain("border-destructive");
    expect(classTokens(radioDirect.props.className)).toContain("border-destructive");
    expect(classTokens(sw.props.className)).toContain("border-destructive");

    expect("invalid" in chk.props).toBe(false);
    expect("invalid" in rg.props).toBe(false);
    expect("invalid" in radioInherited.props).toBe(false);
    expect("invalid" in radioDirect.props).toBe(false);
    expect("invalid" in sw.props).toBe(false);

    observability.assertNoDefects();
  });

  it("allows normal rapid sequential toggles on native for Switch and Checkbox", () => {
    const nativeSwitchSpy = vi.fn();
    const nativeCheckboxSpy = vi.fn();

    const { observability } = renderWithProviders(
      <ToggleControlsHarness
        onSwitchChange={nativeSwitchSpy}
        onCheckboxChange={nativeCheckboxSpy}
      />,
    );

    fireEvent.press(screen.getByTestId("toggle-switch"));
    fireEvent.press(screen.getByTestId("toggle-switch"));
    expect(nativeSwitchSpy.mock.calls).toEqual([[true], [false]]);

    fireEvent.press(screen.getByTestId("toggle-checkbox"));
    fireEvent.press(screen.getByTestId("toggle-checkbox"));
    expect(nativeCheckboxSpy.mock.calls).toEqual([[true], [false]]);

    observability.assertNoDefects();
  });

  it("guards against Web onPress + Radix onClick double-firing on Switch and Checkbox", () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    try {
      const webSwitchSpy = vi.fn();
      const webCheckboxSpy = vi.fn();

      const { observability } = renderWithProviders(
        <ToggleControlsHarness onSwitchChange={webSwitchSpy} onCheckboxChange={webCheckboxSpy} />,
      );

      fireEvent.press(screen.getByTestId("toggle-switch"));
      fireEvent.press(screen.getByTestId("toggle-switch"));
      expect(webSwitchSpy.mock.calls).toEqual([[true]]);

      fireEvent.press(screen.getByTestId("toggle-checkbox"));
      fireEvent.press(screen.getByTestId("toggle-checkbox"));
      expect(webCheckboxSpy.mock.calls).toEqual([[true]]);

      observability.assertNoDefects();
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
    }
  });
});

describe("Label, Tabs, Skeleton, and Icon primitives", () => {
  it("applies caller layout classes (flex-1, shrink) to Label root wrapper instead of trapping them inside self-start", () => {
    const { observability } = renderWithProviders(
      <>
        <Label testID="wrapping-label" className="text-destructive flex-1 shrink">
          A very long checkbox agreement label that must wrap cleanly across lines
        </Label>
        <Label testID="default-label">Short Label</Label>
      </>,
    );

    const findRootContainer = (node: { parent: unknown } | null) => {
      let current = node?.parent as {
        parent?: unknown;
        type?: unknown;
        props?: { className?: string };
      } | null;
      while (current) {
        if (
          typeof current.props?.className === "string" &&
          !current.props.className.includes("text-label-lg")
        ) {
          return current;
        }
        current = (current.parent as typeof current) ?? null;
      }
      return null;
    };

    const wrappingText = screen.getByTestId("wrapping-label");
    const wrappingRoot = findRootContainer(wrappingText);
    expect(wrappingRoot).toBeTruthy();

    const rootClasses = classTokens(wrappingRoot?.props?.className);
    const textClasses = classTokens(wrappingText.props.className);

    expect(rootClasses).toContain("flex-1");
    expect(rootClasses).toContain("shrink");
    expect(rootClasses).toContain("min-w-0");
    expect(rootClasses).not.toContain("self-start");
    expect(textClasses).toContain("text-destructive");
    expect(textClasses).not.toContain("flex-1");

    const defaultRoot = findRootContainer(screen.getByTestId("default-label"));
    expect(classTokens(defaultRoot?.props?.className)).toContain("self-start");
    observability.assertNoDefects();
  });

  it("renders horizontally scrollable single-line TabsList with preset geometry and non-wrapping triggers", () => {
    const onValueChange = vi.fn();
    const { observability, UNSAFE_getByType } = renderWithProviders(
      <Tabs value="tokens" onValueChange={onValueChange}>
        <TabsList testID="tabs-list">
          <TabsTrigger testID="tab-tokens" value="tokens">
            <Text>Tokens</Text>
          </TabsTrigger>
          <TabsTrigger testID="tab-primitives" value="primitives">
            <Text>Primitives</Text>
          </TabsTrigger>
          <TabsTrigger testID="tab-overlays" value="overlays">
            <Text>Overlays</Text>
          </TabsTrigger>
          <TabsTrigger testID="tab-form" value="form">
            <Text>Form Demo</Text>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tokens">
          <Text>Tokens panel</Text>
        </TabsContent>
        <TabsContent value="form">
          <Text>Form panel</Text>
        </TabsContent>
      </Tabs>,
      { initialPreset: "neo-brutalist", initialColorScheme: "light" },
    );

    const scrollView = UNSAFE_getByType(ScrollView);
    expect(scrollView.props.horizontal).toBe(true);
    expect(scrollView.props.showsHorizontalScrollIndicator).toBe(false);

    const listContainerClasses = classTokens(scrollView.props.className);
    expect(listContainerClasses).toContain("border-2");
    expect(listContainerClasses).toContain("rounded-sm");

    const trigger = screen.getByTestId("tab-form");
    const triggerClasses = classTokens(trigger.props.className);
    expect(triggerClasses).toContain("shrink-0");
    expect(triggerClasses).toContain("rounded-sm");

    const triggerLabel = screen.getByText("Form Demo");
    expect(triggerLabel.props.numberOfLines).toBe(1);

    fireEvent.press(trigger);
    expect(onValueChange).toHaveBeenCalledWith("form");
    observability.assertNoDefects();
  });

  it("cancels Skeleton animation cleanly on unmount and respects animate={false}", () => {
    const { observability, unmount } = renderWithProviders(
      <>
        <Skeleton testID="animated-skeleton" className="h-6 w-32" />
        <Skeleton testID="static-skeleton" animate={false} className="h-6 w-24" />
      </>,
      { initialPreset: "neo-brutalist", initialColorScheme: "light" },
    );

    expect(classTokens(screen.getByTestId("animated-skeleton").props.className)).toContain(
      "rounded-sm",
    );
    expect(screen.getByTestId("static-skeleton")).toBeTruthy();

    expect(() => unmount()).not.toThrow();
    observability.assertNoDefects();
  });

  it("inherits color from TextClassContext in Icon without overriding caller className", () => {
    const { observability } = renderWithProviders(
      <>
        <TextClassContext.Provider value="text-body-md text-center text-primary-foreground font-bold">
          <Icon as={Check} testID="inherited-icon" />
          <Icon as={Check} testID="override-icon" className="text-destructive" />
        </TextClassContext.Provider>
        <Icon as={Check} testID="default-icon" />
      </>,
    );

    const inheritedClasses = classTokens(screen.getByTestId("inherited-icon").props.className);
    expect(inheritedClasses).toContain("text-primary-foreground");
    expect(inheritedClasses).not.toContain("text-foreground");
    expect(inheritedClasses).not.toContain("text-body-md");
    expect(inheritedClasses).not.toContain("font-bold");

    const overrideClasses = classTokens(screen.getByTestId("override-icon").props.className);
    expect(overrideClasses).toContain("text-destructive");
    expect(overrideClasses).not.toContain("text-primary-foreground");

    const defaultClasses = classTokens(screen.getByTestId("default-icon").props.className);
    expect(defaultClasses).toContain("text-foreground");

    observability.assertNoDefects();
  });
});
