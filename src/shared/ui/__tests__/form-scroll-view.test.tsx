import { screen } from "@testing-library/react-native";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import { afterEach, describe, expect, it } from "vitest";
import { FormScrollView } from "@/shared/ui/form-scroll-view";
import { renderWithProviders } from "@/test/render";

describe("FormScrollView cross-platform keyboard avoidance and header offset", () => {
  const originalPlatformOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("uses behavior='padding' on iOS with keyboardShouldPersistTaps='handled' and keyboardDismissMode='on-drag'", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios",
    });

    const { UNSAFE_getByType } = renderWithProviders(
      <FormScrollView testID="scroll-ios">
        <Text>Content</Text>
      </FormScrollView>,
    );

    const avoidingView = UNSAFE_getByType(KeyboardAvoidingView);
    expect(avoidingView.props.behavior).toBe("padding");

    const scrollView = screen.getByTestId("scroll-ios");
    expect(scrollView.props.keyboardShouldPersistTaps).toBe("handled");
    expect(scrollView.props.keyboardDismissMode).toBe("on-drag");
  });

  it("disables KeyboardAvoidingView behavior on Android to prevent double-resizing with adjustResize", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    const { UNSAFE_getByType } = renderWithProviders(
      <FormScrollView testID="scroll-android">
        <Text>Content</Text>
      </FormScrollView>,
    );

    const avoidingView = UNSAFE_getByType(KeyboardAvoidingView);
    expect(avoidingView.props.behavior).toBeUndefined();
  });

  it("disables KeyboardAvoidingView behavior on Web so viewports never shrink", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });

    const { UNSAFE_getByType } = renderWithProviders(
      <FormScrollView testID="scroll-web">
        <Text>Content</Text>
      </FormScrollView>,
    );

    const avoidingView = UNSAFE_getByType(KeyboardAvoidingView);
    expect(avoidingView.props.behavior).toBeUndefined();
  });

  it("defaults keyboardVerticalOffset to 0 outside a navigation header stack without throwing", () => {
    const { UNSAFE_getByType } = renderWithProviders(
      <FormScrollView>
        <Text>Outside Stack</Text>
      </FormScrollView>,
    );

    const avoidingView = UNSAFE_getByType(KeyboardAvoidingView);
    expect(avoidingView.props.keyboardVerticalOffset).toBe(0);
  });

  it("reads dynamic header height from HeaderHeightContext when inside a navigation header stack", () => {
    const { UNSAFE_getByType } = renderWithProviders(
      <HeaderHeightContext.Provider value={96}>
        <FormScrollView>
          <Text>Inside Stack</Text>
        </FormScrollView>
      </HeaderHeightContext.Provider>,
    );

    const avoidingView = UNSAFE_getByType(KeyboardAvoidingView);
    expect(avoidingView.props.keyboardVerticalOffset).toBe(96);
  });

  it("allows explicit keyboardVerticalOffset and avoidingBehavior overrides", () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });

    const { UNSAFE_getByType } = renderWithProviders(
      <HeaderHeightContext.Provider value={96}>
        <FormScrollView avoidingBehavior="height" keyboardVerticalOffset={24}>
          <Text>Custom Override</Text>
        </FormScrollView>
      </HeaderHeightContext.Provider>,
    );

    const avoidingView = UNSAFE_getByType(KeyboardAvoidingView);
    expect(avoidingView.props.behavior).toBe("height");
    expect(avoidingView.props.keyboardVerticalOffset).toBe(24);
  });
});
