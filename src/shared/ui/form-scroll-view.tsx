import { type ComponentRef, forwardRef } from "react";
import {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from "react-native";
import { cn } from "@/shared/lib/utils";

export interface FormScrollViewProps extends ScrollViewProps {
  className?: string;
  contentContainerClassName?: string;
  containerClassName?: string;
  keyboardVerticalOffset?: number;
  avoidingBehavior?: KeyboardAvoidingViewProps["behavior"];
}

export const FormScrollView = forwardRef<ComponentRef<typeof ScrollView>, FormScrollViewProps>(
  (
    {
      className,
      contentContainerClassName,
      containerClassName,
      keyboardShouldPersistTaps = "handled",
      keyboardDismissMode = "on-drag",
      keyboardVerticalOffset = 0,
      avoidingBehavior,
      children,
      ...props
    },
    ref,
  ) => (
    <KeyboardAvoidingView
      behavior={avoidingBehavior ?? (Platform.OS === "ios" ? "padding" : "height")}
      keyboardVerticalOffset={keyboardVerticalOffset}
      className={cn("flex-1", containerClassName)}
    >
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        className={cn("flex-1", className)}
        contentContainerClassName={cn("flex-grow", contentContainerClassName)}
        {...props}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  ),
);

FormScrollView.displayName = "FormScrollView";
