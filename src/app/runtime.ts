import { Layer, ManagedRuntime } from "effect";
import { createContext, useContext } from "react";
import { createObservabilityService } from "@/shared/observability/factory";
import { ObservabilityPort, type ObservabilityService } from "@/shared/observability/port";

export type AppRuntime<R = ObservabilityPort, E = never> = ManagedRuntime.ManagedRuntime<R, E>;

export interface AppRuntimeOptions {
  readonly observability?: ObservabilityService;
}

/**
 * Creates an isolated Effect ManagedRuntime instance without global side effects.
 * Supports per-app-mount isolation and per-test Layer injection.
 */
export function createAppRuntime<R = never, E = never>(
  deps: Layer.Layer<R, E, never> = Layer.empty as unknown as Layer.Layer<R, E, never>,
  options?: AppRuntimeOptions,
): ManagedRuntime.ManagedRuntime<R | ObservabilityPort, E> {
  const obsService = options?.observability ?? createObservabilityService();
  const obsLayer = Layer.succeed(ObservabilityPort, obsService);
  const combinedLayer = Layer.merge(obsLayer, deps);
  return ManagedRuntime.make(combinedLayer as Layer.Layer<R | ObservabilityPort, E, never>);
}

export const AppRuntimeContext = createContext<AppRuntime | null>(null);

export function useAppRuntime(): AppRuntime {
  const runtime = useContext(AppRuntimeContext);
  if (!runtime) {
    throw new Error("useAppRuntime must be used within an AppRuntimeContext.Provider");
  }
  return runtime;
}

export function useOptionalAppRuntime(): AppRuntime | null {
  return useContext(AppRuntimeContext);
}
