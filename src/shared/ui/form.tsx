import { type AnyFieldApi, createFormHook, createFormHookContexts } from "@tanstack/react-form";
import * as React from "react";
import { type AccessibilityState, View, type ViewProps } from "react-native";
import { cn } from "@/shared/lib/utils";
import { useObservability } from "@/shared/observability/observability-context";
import { recordErrorOrDefect } from "@/shared/observability/port";
import { Label, type LabelProps } from "@/shared/ui/label";
import { Text, type TextProps } from "@/shared/ui/text";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

const { useAppForm: baseUseAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {},
  formComponents: {},
});

export { withForm };

const originalHandleSubmitByForm = new WeakMap<
  object,
  (submitMeta?: unknown) => Promise<unknown>
>();

export const useAppForm: typeof baseUseAppForm = ((opts?: Record<string, unknown>) => {
  const observability = useObservability();
  const observabilityRef = React.useRef(observability);
  observabilityRef.current = observability;
  const isSubmittingRef = React.useRef(false);
  const userOnSubmit = (
    opts as { onSubmit?: (params: unknown) => Promise<void> | void } | undefined
  )?.onSubmit;

  const wrappedOptions = React.useMemo(() => {
    if (!opts) return opts;
    return {
      ...opts,
      onSubmit: userOnSubmit
        ? async (params: unknown) => {
            if (isSubmittingRef.current) return;
            isSubmittingRef.current = true;
            try {
              await userOnSubmit(params);
            } catch (error) {
              recordErrorOrDefect(observabilityRef.current, error, {
                source: "useAppForm.onSubmit",
              });
              throw error;
            } finally {
              isSubmittingRef.current = false;
            }
          }
        : undefined,
    };
  }, [opts, userOnSubmit]);

  const form = baseUseAppForm(wrappedOptions as never);

  let originalHandleSubmit = originalHandleSubmitByForm.get(form);
  if (!originalHandleSubmit) {
    originalHandleSubmit = form.handleSubmit as unknown as (
      submitMeta?: unknown,
    ) => Promise<unknown>;
    originalHandleSubmitByForm.set(form, originalHandleSubmit);
  }

  const stableHandleSubmit = React.useCallback(
    async (submitMeta?: unknown) => {
      if (isSubmittingRef.current || form.state.isSubmitting) {
        return;
      }
      try {
        return await originalHandleSubmit.call(form, submitMeta);
      } catch (error) {
        // Already captured in wrappedOptions.onSubmit (deduplicated by recordErrorOrDefect).
        // Catch here so button handlers (`onPress={() => void form.handleSubmit()}`) never
        // trigger unhandled Promise rejections while TanStack Form keeps isSubmitSuccessful=false.
        recordErrorOrDefect(observabilityRef.current, error, {
          source: "useAppForm.onSubmit",
        });
      }
    },
    [form, originalHandleSubmit],
  );

  form.handleSubmit = stableHandleSubmit as unknown as typeof form.handleSubmit;

  return form;
}) as unknown as typeof baseUseAppForm;

interface FormFieldContextValue {
  name: string;
  isInvalid: boolean;
  errors: string[];
  clearSubmitError: () => void;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

export interface FormFieldProps {
  field: AnyFieldApi;
  children: React.ReactNode;
}

function normalizeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as { message: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
  }
  return String(error ?? "");
}

export function FormField({ field, children }: FormFieldProps) {
  const rawErrors = field.state.meta.errors ?? [];
  const errors = rawErrors.map(normalizeError).filter(Boolean);
  const isInvalid = errors.length > 0;

  const clearSubmitError = React.useCallback(() => {
    if (field.state.meta.errorMap?.onSubmit) {
      field.setMeta((prev) => ({
        ...prev,
        errorMap: {
          ...prev.errorMap,
          onSubmit: undefined,
        },
      }));
    }
  }, [field]);

  const value = React.useMemo<FormFieldContextValue>(
    () => ({
      name: field.name,
      isInvalid,
      errors,
      clearSubmitError,
    }),
    [field.name, isInvalid, errors, clearSubmitError],
  );

  return <FormFieldContext.Provider value={value}>{children}</FormFieldContext.Provider>;
}

interface FormItemContextValue {
  id: string;
  descriptionId: string;
  messageId: string;
  isInvalid: boolean;
  errors: string[];
  clearSubmitError?: () => void;
}

const FormItemContext = React.createContext<FormItemContextValue | null>(null);

export function useFormItem() {
  const itemContext = React.useContext(FormItemContext);
  const fieldContextValue = React.useContext(FormFieldContext);

  const id = itemContext?.id ?? "";
  const descriptionId = itemContext?.descriptionId ?? `${id}-description`;
  const messageId = itemContext?.messageId ?? `${id}-message`;
  const isInvalid = itemContext?.isInvalid ?? fieldContextValue?.isInvalid ?? false;
  const errors = itemContext?.errors ?? fieldContextValue?.errors ?? [];
  const clearSubmitError = itemContext?.clearSubmitError ?? fieldContextValue?.clearSubmitError;

  return {
    id,
    descriptionId,
    messageId,
    isInvalid,
    errors,
    clearSubmitError,
  };
}

export interface FormItemProps extends ViewProps {
  className?: string;
}

export function FormItem({ className, ...props }: FormItemProps) {
  const id = React.useId();
  const fieldContextValue = React.useContext(FormFieldContext);

  const contextValue = React.useMemo<FormItemContextValue>(
    () => ({
      id,
      descriptionId: `${id}-description`,
      messageId: `${id}-message`,
      isInvalid: fieldContextValue?.isInvalid ?? false,
      errors: fieldContextValue?.errors ?? [],
      clearSubmitError: fieldContextValue?.clearSubmitError,
    }),
    [
      id,
      fieldContextValue?.isInvalid,
      fieldContextValue?.errors,
      fieldContextValue?.clearSubmitError,
    ],
  );

  return (
    <FormItemContext.Provider value={contextValue}>
      <View className={cn("gap-1.5", className)} {...props} />
    </FormItemContext.Provider>
  );
}

export function FormLabel({ className, ...props }: LabelProps) {
  const { id, isInvalid } = useFormItem();

  return (
    <Label
      nativeID={`${id}-label`}
      className={cn(isInvalid && "text-destructive", className)}
      {...props}
    />
  );
}

interface FormControlChildProps {
  nativeID?: string;
  invalid?: boolean;
  accessibilityState?: AccessibilityState & { invalid?: boolean };
  onChangeText?: (text: string) => void;
  onValueChange?: (...args: unknown[]) => void;
  onCheckedChange?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

export function FormControl({ children }: { children: React.ReactElement<FormControlChildProps> }) {
  const { id, isInvalid, clearSubmitError } = useFormItem();
  const childProps = children.props;

  const existingState = childProps.accessibilityState;
  const mergedA11yState: AccessibilityState & { invalid: boolean } = {
    ...existingState,
    invalid: isInvalid,
  };

  const nextProps: Partial<FormControlChildProps> = {
    nativeID: childProps.nativeID ?? id,
    invalid: childProps.invalid ?? isInvalid,
    accessibilityState: mergedA11yState,
  };

  if (typeof childProps.onChangeText === "function" && clearSubmitError) {
    const originalOnChangeText = childProps.onChangeText;
    nextProps.onChangeText = (text: string) => {
      clearSubmitError();
      originalOnChangeText(text);
    };
  }

  if (typeof childProps.onValueChange === "function" && clearSubmitError) {
    const originalOnValueChange = childProps.onValueChange;
    nextProps.onValueChange = (...args: unknown[]) => {
      clearSubmitError();
      originalOnValueChange(...args);
    };
  }

  if (typeof childProps.onCheckedChange === "function" && clearSubmitError) {
    const originalOnCheckedChange = childProps.onCheckedChange;
    nextProps.onCheckedChange = (...args: unknown[]) => {
      clearSubmitError();
      originalOnCheckedChange(...args);
    };
  }

  return React.cloneElement(children, nextProps);
}

export function FormDescription({ className, ...props }: TextProps) {
  const { descriptionId } = useFormItem();

  return (
    <Text
      nativeID={descriptionId}
      variant="caption"
      className={cn("text-on-surface-variant", className)}
      {...props}
    />
  );
}

export function FormMessage({ className, children, ...props }: TextProps) {
  const { messageId, isInvalid, errors } = useFormItem();
  const body = children ?? (isInvalid && errors.length > 0 ? errors[0] : null);

  if (!body) {
    return null;
  }

  return (
    <Text
      nativeID={messageId}
      accessibilityRole="alert"
      variant="caption"
      className={cn("text-destructive font-medium", className)}
      {...props}
    >
      {body}
    </Text>
  );
}

export function applyServerValidationErrors(
  form: {
    setFieldMeta: (
      // biome-ignore lint/suspicious/noExplicitAny: Compatible with TanStack Form generic field keys
      name: any,
      // biome-ignore lint/suspicious/noExplicitAny: Compatible with TanStack Form updater signature
      updater: (prev: any) => any,
    ) => void;
  },
  errors: Record<string, string | string[]>,
) {
  for (const [field, error] of Object.entries(errors)) {
    const errorText = Array.isArray(error) ? error[0] : error;
    if (errorText) {
      form.setFieldMeta(field, (prev: { errorMap?: Record<string, unknown> }) => ({
        ...prev,
        errorMap: {
          ...prev?.errorMap,
          onSubmit: errorText,
        },
      }));
    }
  }
}
