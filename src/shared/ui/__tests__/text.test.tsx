import { screen } from "@testing-library/react-native";
import { describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Text, TextClassContext } from "@/shared/ui/text";
import { renderWithProviders } from "@/test/render";

describe("Text typography precedence and explicit font weight families", () => {
  it("preserves variant color and scale for muted, caption, lead, and label inside Card", () => {
    renderWithProviders(
      <Card>
        <CardContent>
          <Text testID="card-muted" variant="muted">
            Muted body copy
          </Text>
          <Text testID="card-caption" variant="caption">
            Metadata caption
          </Text>
          <Text testID="card-lead" variant="lead">
            Lead summary
          </Text>
          <Text testID="card-label" variant="label">
            SECTION LABEL
          </Text>
        </CardContent>
      </Card>,
    );

    const mutedClass = String(screen.getByTestId("card-muted").props.className);
    expect(mutedClass).toContain("text-muted-foreground");
    expect(mutedClass).toContain("text-body-sm");
    expect(mutedClass).not.toContain("text-card-foreground");

    const captionClass = String(screen.getByTestId("card-caption").props.className);
    expect(captionClass).toContain("text-on-surface-variant");
    expect(captionClass).toContain("text-label-md");
    expect(captionClass).toContain("font-sans-semibold");
    expect(captionClass).not.toContain("text-card-foreground");

    const leadClass = String(screen.getByTestId("card-lead").props.className);
    expect(leadClass).toContain("text-on-surface-variant");
    expect(leadClass).toContain("text-body-lg");
    expect(leadClass).toContain("font-sans-medium");
    expect(leadClass).not.toContain("text-card-foreground");

    const labelClass = String(screen.getByTestId("card-label").props.className);
    expect(labelClass).toContain("text-label-lg");
    expect(labelClass).toContain("font-sans-bold");
  });

  it("preserves explicit variant styles inside Popover-like and Alert TextClassContext containers", () => {
    renderWithProviders(
      <>
        <TextClassContext.Provider value="text-body-sm text-popover-foreground">
          <Text testID="popover-caption" variant="caption">
            Popover hint
          </Text>
          <Text testID="popover-muted" variant="muted">
            Popover secondary
          </Text>
        </TextClassContext.Provider>
        <Alert variant="destructive">
          <AlertTitle testID="alert-title">Request failed</AlertTitle>
          <AlertDescription testID="alert-desc">Try again shortly</AlertDescription>
          <Text testID="alert-caption" variant="caption">
            Error code 500
          </Text>
        </Alert>
      </>,
    );

    const popoverCaptionClass = String(screen.getByTestId("popover-caption").props.className);
    expect(popoverCaptionClass).toContain("text-on-surface-variant");
    expect(popoverCaptionClass).toContain("text-label-md");
    expect(popoverCaptionClass).not.toContain("text-popover-foreground");

    const popoverMutedClass = String(screen.getByTestId("popover-muted").props.className);
    expect(popoverMutedClass).toContain("text-muted-foreground");
    expect(popoverMutedClass).not.toContain("text-popover-foreground");

    // AlertTitle / AlertDescription (omitted variant) must keep inherited destructive container color
    expect(String(screen.getByTestId("alert-title").props.className)).toContain(
      "text-on-destructive-container",
    );
    expect(String(screen.getByTestId("alert-desc").props.className)).toContain(
      "text-on-destructive-container",
    );

    // Explicit variant="caption" inside Alert preserves caption hierarchy
    const alertCaptionClass = String(screen.getByTestId("alert-caption").props.className);
    expect(alertCaptionClass).toContain("text-on-surface-variant");
    expect(alertCaptionClass).toContain("text-label-md");
  });

  it("still inherits TextClassContext color inside Button and Badge when variant is omitted", () => {
    renderWithProviders(
      <>
        <Button>
          <Text testID="button-text">Save changes</Text>
        </Button>
        <Badge variant="destructive">
          <Text testID="badge-text">Blocked</Text>
        </Badge>
      </>,
    );

    const buttonClass = String(screen.getByTestId("button-text").props.className);
    expect(buttonClass).toContain("text-primary-foreground");
    expect(buttonClass).not.toContain("text-foreground");

    const badgeClass = String(screen.getByTestId("badge-text").props.className);
    expect(badgeClass).toContain("text-on-destructive-container");
    expect(badgeClass).not.toContain("text-foreground");
  });

  it("lets explicit caller className override variant classes and maps explicit weight families", () => {
    renderWithProviders(
      <Card>
        <CardContent>
          <Text testID="override-text" variant="caption" className="text-primary">
            Highlighted caption
          </Text>
          <Text testID="h3-text" variant="h3">
            Heading 3
          </Text>
          <Text testID="mono-text" variant="mono">
            req_12345
          </Text>
        </CardContent>
      </Card>,
    );

    const overrideClass = String(screen.getByTestId("override-text").props.className);
    expect(overrideClass).toContain("text-primary");
    expect(overrideClass).not.toContain("text-on-surface-variant");

    expect(String(screen.getByTestId("h3-text").props.className)).toContain("font-sans-semibold");
    expect(String(screen.getByTestId("mono-text").props.className)).toContain("font-mono");
  });
});
