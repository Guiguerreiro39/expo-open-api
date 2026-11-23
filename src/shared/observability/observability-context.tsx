import { createContext, useContext } from "react";
import { noopObservabilityAdapter } from "@/shared/observability/noop-adapter";
import type { ObservabilityService } from "@/shared/observability/port";

export const ObservabilityContext = createContext<ObservabilityService | null>(null);

export function useObservability(): ObservabilityService {
  const service = useContext(ObservabilityContext);
  return service ?? noopObservabilityAdapter;
}
