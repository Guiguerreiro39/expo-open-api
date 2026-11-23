import { afterAll, afterEach, beforeAll } from "vitest";
import { clearCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import { MockEventSource } from "./mock-event-source";
import { MockXMLHttpRequest } from "./mock-xml-http-request";
import { resetMockExpoRouter } from "./mocks/adapters/mock-expo-router-state";
import { resetMockSplashScreen } from "./mocks/adapters/mock-expo-splash-screen";
import { mockHaptics } from "./mocks/adapters/mock-haptics";
import { resetMockSecureStore } from "./mocks/adapters/mock-secure-store";
import { resetMockSystemUI } from "./mocks/adapters/mock-system-ui";
import { server } from "./msw-server";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  Object.defineProperty(globalThis, "EventSource", {
    writable: true,
    configurable: true,
    value: MockEventSource,
  });
});

afterEach(() => {
  const rntl = require("@testing-library/react-native") as { cleanup: () => void };
  rntl.cleanup();
  clearCachedBearerToken();
  server.resetHandlers();
  MockEventSource.reset();
  MockXMLHttpRequest.reset();
  mockHaptics.reset();
  resetMockSystemUI();
  resetMockSecureStore();
  resetMockSplashScreen();
  resetMockExpoRouter();
});

afterAll(() => {
  server.close();
});
