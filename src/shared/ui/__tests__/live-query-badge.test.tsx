import { describe, expect, it } from "vitest";
import type { LiveConnectionStatus } from "@/shared/lib/hooks/use-live-query";
import { LiveQueryBadge } from "@/shared/ui/live-query-badge";
import { renderWithProviders } from "@/test/render";

describe("LiveQueryBadge", () => {
  const cases: ReadonlyArray<readonly [LiveConnectionStatus, string]> = [
    ["connected", "Live Connected"],
    ["connecting", "Connecting..."],
    ["reconnecting", "Reconnecting..."],
    ["error", "Disconnected"],
    ["idle", "Idle"],
  ];

  it.each(cases)("renders %s status as %s", (status, expectedLabel) => {
    const { getByText } = renderWithProviders(
      <LiveQueryBadge status={status} lastPingAt={1735000000000} />,
    );
    expect(getByText(expectedLabel)).toBeTruthy();
  });
});
