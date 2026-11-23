import { afterAll, afterEach, beforeAll } from "vitest";
import { clearCachedBearerToken } from "@/shared/lib/auth-session-bridge";
import { MockEventSource } from "./mock-event-source";
import { MockXMLHttpRequest } from "./mock-xml-http-request";
import { resetMockDocumentPicker } from "./mocks/adapters/mock-expo-document-picker";
import { resetMockExpoFileSystem } from "./mocks/adapters/mock-expo-file-system";
import { resetMockImagePicker } from "./mocks/adapters/mock-expo-image-picker";
import { resetMockExpoRouter } from "./mocks/adapters/mock-expo-router-state";
import { resetMockExpoSharing } from "./mocks/adapters/mock-expo-sharing";
import { resetMockSplashScreen } from "./mocks/adapters/mock-expo-splash-screen";
import { resetMockExpoWebBrowser } from "./mocks/adapters/mock-expo-web-browser";
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
  resetMockExpoFileSystem();
  resetMockDocumentPicker();
  resetMockImagePicker();
  resetMockExpoSharing();
  resetMockExpoWebBrowser();
});

afterAll(() => {
  server.close();
});
