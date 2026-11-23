import { Portal } from "@rn-primitives/portal";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react-native";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, View } from "react-native";
import { DEFAULT_THEME_PRESET, getThemeElevation } from "@/shared/lib/theme/presets";
import { cn } from "@/shared/lib/utils";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";
import { useOptionalTheme } from "@/shared/ui/theme-provider";

export type ToastVariant = "default" | "success" | "destructive" | "warning" | "info";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

export interface ToastRecord extends Required<Pick<ToastInput, "title" | "variant">> {
  id: string;
  description?: string;
}

export interface ToastContextValue {
  toasts: readonly ToastRecord[];
  show: (input: ToastInput) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const DEFAULT_DURATION_MS = 4000;

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_CONTAINER_STYLES: Record<ToastVariant, string> = {
  default: "border-outline-variant bg-card",
  success: "border-success bg-success-container",
  destructive: "border-destructive bg-destructive-container",
  warning: "border-warning bg-warning-container",
  info: "border-info bg-info-container",
};

const TOAST_TEXT_STYLES: Record<ToastVariant, string> = {
  default: "text-card-foreground",
  success: "text-on-success-container",
  destructive: "text-on-destructive-container",
  warning: "text-on-warning-container",
  info: "text-on-info-container",
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const iconClass = TOAST_TEXT_STYLES[variant];
  if (variant === "success") {
    return <Icon as={CheckCircle2} size={18} className={iconClass} />;
  }
  if (variant === "destructive" || variant === "warning") {
    return <Icon as={AlertCircle} size={18} className={iconClass} />;
  }
  return <Icon as={Info} size={18} className={iconClass} />;
}

export interface ToastProviderProps {
  children: ReactNode;
  portalHost?: string;
}

export function ToastProvider({ children, portalHost }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearTimer = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((item) => item.id !== id));
    },
    [clearTimer],
  );

  const dismissAll = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const show = useCallback(
    (input: ToastInput): string => {
      counterRef.current += 1;
      const id = `toast-${counterRef.current}`;
      const record: ToastRecord = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "default",
      };

      setToasts((prev) => [...prev.slice(-2), record]);

      const duration = input.durationMs ?? DEFAULT_DURATION_MS;
      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  const success = useCallback(
    (title: string, description?: string) => show({ title, description, variant: "success" }),
    [show],
  );

  const error = useCallback(
    (title: string, description?: string) => show({ title, description, variant: "destructive" }),
    [show],
  );

  const info = useCallback(
    (title: string, description?: string) => show({ title, description, variant: "info" }),
    [show],
  );

  const warning = useCallback(
    (title: string, description?: string) => show({ title, description, variant: "warning" }),
    [show],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      show,
      success,
      error,
      info,
      warning,
      dismiss,
      dismissAll,
    }),
    [toasts, show, success, error, info, warning, dismiss, dismissAll],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport portalHost={portalHost} />
    </ToastContext.Provider>
  );
}

export function ToastViewport({ portalHost }: { portalHost?: string }) {
  const context = useContext(ToastContext);
  const theme = useOptionalTheme();
  const preset = theme?.preset ?? DEFAULT_THEME_PRESET;
  const resolvedScheme = theme?.resolvedColorScheme ?? "light";
  const elevation = getThemeElevation(preset, resolvedScheme);

  if (!context || context.toasts.length === 0) {
    return null;
  }

  return (
    <Portal name="toast-viewport" hostName={portalHost}>
      <View
        pointerEvents="box-none"
        className="absolute right-4 bottom-6 left-4 z-50 gap-2"
        accessibilityLiveRegion="polite"
      >
        {context.toasts.map((item) => (
          <View
            key={item.id}
            accessibilityRole="alert"
            className={cn(
              "flex-row items-start gap-3 rounded-xl border px-4 py-3",
              TOAST_CONTAINER_STYLES[item.variant],
            )}
            style={{ boxShadow: elevation.boxShadow }}
          >
            <View className="mt-0.5">
              <ToastIcon variant={item.variant} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="label" className={cn("font-bold", TOAST_TEXT_STYLES[item.variant])}>
                {item.title}
              </Text>
              {item.description ? (
                <Text variant="caption" className={TOAST_TEXT_STYLES[item.variant]}>
                  {item.description}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss notification"
              hitSlop={8}
              onPress={() => context.dismiss(item.id)}
              className="p-0.5"
            >
              <Icon as={X} size={16} className={TOAST_TEXT_STYLES[item.variant]} />
            </Pressable>
          </View>
        ))}
      </View>
    </Portal>
  );
}

const NOOP_TOAST: ToastContextValue = {
  toasts: [],
  show: () => "",
  success: () => "",
  error: () => "",
  info: () => "",
  warning: () => "",
  dismiss: () => {},
  dismissAll: () => {},
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  return context ?? NOOP_TOAST;
}
