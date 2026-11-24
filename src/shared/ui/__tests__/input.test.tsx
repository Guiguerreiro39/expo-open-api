import { fireEvent, screen } from "@testing-library/react-native";
import { Platform, StyleSheet } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { renderWithProviders } from "@/test/render";

describe("Input and Textarea zero-jump styling and preset geometry", () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("keeps Input className stable across focus/blur without explicit lineHeight and forwards handlers", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();

    renderWithProviders(
      <Input
        testID="email-input"
        placeholder="you@example.com"
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const input = screen.getByTestId("email-input");
    const initialClassName = String(input.props.className ?? "");

    expect(initialClassName).not.toContain("text-body-md");
    expect(initialClassName).toContain("border-outline");
    expect(initialClassName).toContain("focus:border-primary");
    expect(initialClassName).toContain("outline-none");
    expect(input.props.textAlignVertical).toBe("center");

    fireEvent(input, "focus", { nativeEvent: {} });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("email-input").props.className).toBe(initialClassName);

    fireEvent(input, "blur", { nativeEvent: {} });
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("email-input").props.className).toBe(initialClassName);
  });

  it("applies includeFontPadding: false on Android single-line Input while preserving caller style", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    renderWithProviders(<Input testID="android-input" style={{ marginTop: 8 }} />);
    const androidStyle = StyleSheet.flatten(screen.getByTestId("android-input").props.style);
    expect(androidStyle).toMatchObject({ includeFontPadding: false, marginTop: 8 });
  });

  it("suppresses browser focus outline on Web Input while preserving caller style", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });

    renderWithProviders(<Input testID="web-input" style={{ marginTop: 4 }} />);
    const webStyle = StyleSheet.flatten(screen.getByTestId("web-input").props.style) as Record<
      string,
      unknown
    >;
    expect(webStyle).toMatchObject({ outlineStyle: "none", marginTop: 4 });
  });

  it("applies neo-brutalist preset radius, 2px elevation borderWidth, and destructive invalid borders on Input", () => {
    renderWithProviders(<Input testID="neo-input" invalid />, {
      initialPreset: "neo-brutalist",
    });

    const neoInput = screen.getByTestId("neo-input");
    const neoClasses = String(neoInput.props.className ?? "");
    expect(neoClasses).toContain("rounded-sm");
    expect(neoClasses).toContain("border-2");
    expect(neoClasses).toContain("border-destructive");
    expect(neoClasses).toContain("focus:border-destructive");
  });

  it("applies editorial-slate preset radius and 1px borderWidth on Input", () => {
    renderWithProviders(<Input testID="slate-input" />, {
      initialPreset: "editorial-slate",
    });

    const slateClasses = String(screen.getByTestId("slate-input").props.className ?? "");
    expect(slateClasses).toContain("rounded-lg");
    expect(slateClasses).toMatch(/\bborder\b/);
    expect(slateClasses).not.toContain("border-2");
  });

  it("keeps Textarea className stable across focus/blur, suppresses Web outline, and applies preset geometry", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();

    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });

    renderWithProviders(
      <Textarea
        testID="notes-textarea"
        onFocus={onFocus}
        onBlur={onBlur}
        style={{ minHeight: 120 }}
      />,
      { initialPreset: "neo-brutalist" },
    );

    const textarea = screen.getByTestId("notes-textarea");
    const initialClassName = String(textarea.props.className ?? "");

    expect(initialClassName).toContain("rounded-sm");
    expect(initialClassName).toContain("border-2");
    expect(initialClassName).toContain("border-outline");
    expect(initialClassName).toContain("focus:border-primary");
    expect(initialClassName).toContain("outline-none");

    const flattenedStyle = StyleSheet.flatten(textarea.props.style) as Record<string, unknown>;
    expect(flattenedStyle).toMatchObject({ outlineStyle: "none", minHeight: 120 });

    fireEvent(textarea, "focus", { nativeEvent: {} });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("notes-textarea").props.className).toBe(initialClassName);

    fireEvent(textarea, "blur", { nativeEvent: {} });
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("notes-textarea").props.className).toBe(initialClassName);
  });

  it("prevents caller border utility from downgrading neo-brutalist border-2 while preserving explicit border width overrides", () => {
    renderWithProviders(
      <>
        <Input testID="neo-in-plain" className="border" />
        <Textarea testID="neo-ta-plain" className="border" />
        <Input testID="neo-in-thick" className="border-4" />
        <Textarea testID="neo-ta-none" className="border-0" />
      </>,
      { initialPreset: "neo-brutalist" },
    );

    expect(String(screen.getByTestId("neo-in-plain").props.className)).toContain("border-2");
    expect(String(screen.getByTestId("neo-ta-plain").props.className)).toContain("border-2");
    expect(String(screen.getByTestId("neo-in-thick").props.className)).toContain("border-4");
    expect(String(screen.getByTestId("neo-ta-none").props.className)).toContain("border-0");
  });
});
