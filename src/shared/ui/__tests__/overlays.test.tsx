import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { forwardRef, useImperativeHandle } from "react";
import { Platform, Pressable, type PressableProps, Text } from "react-native";
import { describe, expect, it, vi } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useToast } from "@/shared/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { renderWithProviders } from "@/test/render";

type MeasureCallback = (
  x: number,
  y: number,
  width: number,
  height: number,
  pageX: number,
  pageY: number,
) => void;

interface MeasurableHandle {
  measure: (cb: MeasureCallback) => void;
}

interface MeasurableButtonProps extends PressableProps {
  readonly label: string;
  readonly onMeasure: () => void;
}

const MeasurableButton = forwardRef<MeasurableHandle, MeasurableButtonProps>(
  ({ label, onMeasure, ...props }, ref) => {
    useImperativeHandle(ref, () => ({
      measure(cb: MeasureCallback) {
        onMeasure();
        cb(10, 20, 120, 44, 10, 20);
      },
    }));

    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} {...props}>
        <Text>{label}</Text>
      </Pressable>
    );
  },
);
MeasurableButton.displayName = "MeasurableButton";

function DialogToastAction() {
  const toast = useToast();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notify From Dialog"
      onPress={() => toast.success("Dialog toast fired", "Rendered above overlays")}
    >
      <Text>Notify From Dialog</Text>
    </Pressable>
  );
}

function DialogWithToastTrigger() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Toast Dialog">
          <Text>Open Toast Dialog</Text>
        </Pressable>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog With Toast</DialogTitle>
          <DialogDescription>Trigger a toast from inside a portaled dialog.</DialogDescription>
        </DialogHeader>
        <DialogToastAction />
      </DialogContent>
    </Dialog>
  );
}

describe("Overlay Primitives (React 18 forwardRef Slot + PortalHost inside ToastProvider)", () => {
  it("opens Popover, DropdownMenu, and Tooltip via asChild measurable buttons with zero React 18 ref warnings", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const popoverMeasure = vi.fn();
    const dropdownMeasure = vi.fn();
    const tooltipMeasure = vi.fn();

    try {
      renderWithProviders(
        <>
          <Popover>
            <PopoverTrigger asChild>
              <MeasurableButton label="Open Popover" onMeasure={popoverMeasure} />
            </PopoverTrigger>
            <PopoverContent>
              <Text>Popover Body Content</Text>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <MeasurableButton label="Open Dropdown" onMeasure={dropdownMeasure} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Text>Dropdown Option A</Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <MeasurableButton label="Open Tooltip" onMeasure={tooltipMeasure} />
            </TooltipTrigger>
            <TooltipContent>
              <Text>Tooltip Hint Content</Text>
            </TooltipContent>
          </Tooltip>
        </>,
      );

      fireEvent.press(screen.getByRole("button", { name: "Open Popover" }));
      expect(await screen.findByText("Popover Body Content")).toBeTruthy();
      expect(popoverMeasure).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByRole("button", { name: "Open Dropdown" }));
      expect(await screen.findByText("Dropdown Option A")).toBeTruthy();
      expect(dropdownMeasure).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByRole("button", { name: "Open Tooltip" }));
      expect(await screen.findByText("Tooltip Hint Content")).toBeTruthy();
      expect(tooltipMeasure).toHaveBeenCalledTimes(1);

      const refWarnings = errorSpy.mock.calls.filter((call) =>
        call.some(
          (arg) =>
            typeof arg === "string" &&
            (arg.includes("`ref` is not a prop") ||
              arg.includes("Function components cannot be given refs")),
        ),
      );
      expect(refWarnings).toHaveLength(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("allows buttons rendered inside <DialogContent> (PortalHost) to trigger visible toasts via useToast()", async () => {
    renderWithProviders(<DialogWithToastTrigger />);

    fireEvent.press(screen.getByRole("button", { name: "Open Toast Dialog" }));
    expect(await screen.findByText("Dialog With Toast")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Notify From Dialog" }));
    await waitFor(() => {
      expect(screen.getByText("Dialog toast fired")).toBeTruthy();
      expect(screen.getByText("Rendered above overlays")).toBeTruthy();
    });
  });

  it("renders Dialog and AlertDialog with --scrim backdrops, preset geometry on actions, and full width classes", async () => {
    const { observability } = renderWithProviders(
      <>
        <Dialog>
          <DialogTrigger asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Open Scrim Dialog">
              <Text>Open Scrim Dialog</Text>
            </Pressable>
          </DialogTrigger>
          <DialogContent testID="scrim-dialog-content">
            <DialogHeader>
              <DialogTitle>Scrim Dialog</DialogTitle>
              <DialogDescription>Uses mode-invariant scrim backdrop.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="Open Scrim Alert">
              <Text>Open Scrim Alert</Text>
            </Pressable>
          </AlertDialogTrigger>
          <AlertDialogContent testID="scrim-alert-content">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>Action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel testID="scrim-alert-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction testID="scrim-alert-action">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>,
      { initialPreset: "neo-brutalist", initialColorScheme: "dark" },
    );

    fireEvent.press(screen.getByRole("button", { name: "Open Scrim Dialog" }));
    const dialogContent = await screen.findByTestId("scrim-dialog-content");
    expect(dialogContent.props.className).toContain("w-full");
    expect(dialogContent.props.className).toContain("max-w-md");
    expect(dialogContent.props.className).toContain("rounded-sm");
    expect(dialogContent.props.className).toContain("border-2");

    const dialogOverlay = screen.getByTestId("dialog-overlay");
    expect(dialogOverlay.props.className).toContain("bg-scrim/");
    expect(dialogOverlay.props.className).not.toContain("bg-foreground/");

    fireEvent.press(screen.getByRole("button", { name: "Close dialog" }));
    await waitFor(() => {
      expect(screen.queryByTestId("scrim-dialog-content")).toBeNull();
    });

    fireEvent.press(screen.getByRole("button", { name: "Open Scrim Alert" }));
    const alertContent = await screen.findByTestId("scrim-alert-content");
    expect(alertContent.props.className).toContain("w-full");
    expect(alertContent.props.className).toContain("max-w-md");
    expect(alertContent.props.className).toContain("rounded-sm");
    expect(alertContent.props.className).toContain("border-2");

    const alertOverlay = screen.getByTestId("alert-dialog-overlay");
    expect(alertOverlay.props.className).toContain("bg-scrim/");
    expect(alertOverlay.props.className).not.toContain("bg-foreground/");

    const cancelButton = screen.getByTestId("scrim-alert-cancel");
    const actionButton = screen.getByTestId("scrim-alert-action");
    expect(cancelButton.props.className).toContain("rounded-sm");
    expect(cancelButton.props.className).toContain("border-2");
    expect(actionButton.props.className).toContain("rounded-sm");
    expect(actionButton.props.className).toContain("border-2");

    observability.assertNoDefects();
  });

  it("uses viewport-fixed overlays and prevents Web click double-fire on Dialog and AlertDialog triggers", async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });

    try {
      const { observability } = renderWithProviders(
        <>
          <Dialog>
            <DialogTrigger asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Web Dialog Trigger">
                <Text>Web Dialog Trigger</Text>
              </Pressable>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Web Fixed Dialog</DialogTitle>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Web Alert Trigger">
                <Text>Web Alert Trigger</Text>
              </Pressable>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Web Fixed Alert</AlertDialogTitle>
            </AlertDialogContent>
          </AlertDialog>
        </>,
      );

      const dialogTrigger = screen.getByRole("button", { name: "Web Dialog Trigger" });
      const preventDialogClick = vi.fn();
      dialogTrigger.props.onClick?.({ preventDefault: preventDialogClick });
      expect(preventDialogClick).toHaveBeenCalledTimes(1);

      fireEvent.press(dialogTrigger);
      const dialogOverlay = await screen.findByTestId("dialog-overlay");
      const dialogOverlayStyle = Array.isArray(dialogOverlay.props.style)
        ? Object.assign({}, ...dialogOverlay.props.style)
        : dialogOverlay.props.style;
      expect(dialogOverlayStyle.position).toBe("fixed");

      const alertTrigger = screen.getByRole("button", { name: "Web Alert Trigger" });
      const preventAlertClick = vi.fn();
      alertTrigger.props.onClick?.({ preventDefault: preventAlertClick });
      expect(preventAlertClick).toHaveBeenCalledTimes(1);

      fireEvent.press(alertTrigger);
      const alertOverlay = await screen.findByTestId("alert-dialog-overlay");
      const alertOverlayStyle = Array.isArray(alertOverlay.props.style)
        ? Object.assign({}, ...alertOverlay.props.style)
        : alertOverlay.props.style;
      expect(alertOverlayStyle.position).toBe("fixed");

      observability.assertNoDefects();
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS });
    }
  });

  it("renders Popover and DropdownMenu with --scrim backdrops, safe-area positioning without centering wrappers, preset geometry, and contrast-safe menu items", async () => {
    const onCheckboxChange = vi.fn();
    const { observability } = renderWithProviders(
      <>
        <Popover>
          <PopoverTrigger asChild>
            <MeasurableButton label="Open Anchored Popover" onMeasure={() => {}} />
          </PopoverTrigger>
          <PopoverContent testID="anchored-popover-content">
            <Text>Anchored Popover Body</Text>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <MeasurableButton label="Open Anchored Menu" onMeasure={() => {}} />
          </DropdownMenuTrigger>
          <DropdownMenuContent testID="anchored-menu-content">
            <DropdownMenuItem testID="anchored-menu-item">
              <Text>Edit task</Text>
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem
              testID="anchored-menu-checkbox"
              checked={false}
              onCheckedChange={onCheckboxChange}
            >
              <Text>Compact density</Text>
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </>,
      { initialPreset: "neo-brutalist", initialColorScheme: "dark" },
    );

    fireEvent.press(screen.getByRole("button", { name: "Open Anchored Popover" }));
    const popoverContent = await screen.findByTestId("anchored-popover-content");
    expect(popoverContent.props.className).toContain("rounded-sm");
    expect(popoverContent.props.className).toContain("border-2");

    const popoverOverlay = screen.getByTestId("popover-overlay");
    expect(popoverOverlay.props.className).toContain("bg-scrim/");
    expect(popoverOverlay.props.className).not.toContain("bg-foreground/");
    expect(popoverOverlay.props.className).not.toContain("items-center");

    fireEvent.press(screen.getByRole("button", { name: "Open Anchored Menu" }));
    const menuContent = await screen.findByTestId("anchored-menu-content");
    expect(menuContent.props.className).toContain("rounded-sm");
    expect(menuContent.props.className).toContain("border-2");

    const menuOverlay = screen.getByTestId("dropdown-menu-overlay");
    expect(menuOverlay.props.className).toContain("bg-scrim/");
    expect(menuOverlay.props.className).not.toContain("bg-foreground/");
    expect(menuOverlay.props.className).not.toContain("items-center");

    const menuItem = screen.getByTestId("anchored-menu-item");
    expect(menuItem.props.className).toContain("flex");
    expect(menuItem.props.className).toContain("flex-row");
    expect(menuItem.props.className).toContain("active:bg-surface-container-high");
    expect(menuItem.props.className).not.toContain("active:bg-accent");

    const checkboxItem = screen.getByTestId("anchored-menu-checkbox");
    expect(checkboxItem.props.className).toContain("flex");
    expect(checkboxItem.props.className).toContain("flex-row");
    expect(checkboxItem.props.className).toContain("active:bg-surface-container-high");
    expect(checkboxItem.props.className).not.toContain("active:bg-accent");

    fireEvent.press(checkboxItem);
    expect(onCheckboxChange).toHaveBeenCalledWith(true);

    observability.assertNoDefects();
  });

  it("renders Tooltip dismiss overlay on native", async () => {
    const { observability } = renderWithProviders(
      <Tooltip>
        <TooltipTrigger asChild>
          <MeasurableButton label="Native Tooltip Trigger" onMeasure={() => {}} />
        </TooltipTrigger>
        <TooltipContent testID="native-tooltip-content">
          <Text>Native hint</Text>
        </TooltipContent>
      </Tooltip>,
    );

    fireEvent.press(screen.getByRole("button", { name: "Native Tooltip Trigger" }));
    expect(await screen.findByTestId("native-tooltip-content")).toBeTruthy();
    expect(screen.getByTestId("tooltip-overlay")).toBeTruthy();
    observability.assertNoDefects();
  });

  it("omits blocking Tooltip overlay on Web and guards Popover and DropdownMenu triggers against Web click double-fire", async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });

    try {
      const onWebCheckboxChange = vi.fn();
      const { observability } = renderWithProviders(
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <MeasurableButton label="Web Tooltip Trigger" onMeasure={() => {}} />
            </TooltipTrigger>
            <TooltipContent testID="web-tooltip-content">
              <Text>Web hint</Text>
            </TooltipContent>
          </Tooltip>

          <Popover>
            <PopoverTrigger asChild>
              <MeasurableButton label="Web Popover Trigger" onMeasure={() => {}} />
            </PopoverTrigger>
            <PopoverContent>
              <Text>Web Popover</Text>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <MeasurableButton label="Web Dropdown Trigger" onMeasure={() => {}} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <Text>Web Action</Text>
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem
                testID="web-menu-checkbox"
                checked={false}
                onCheckedChange={onWebCheckboxChange}
              >
                <Text>Web Toggle</Text>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>,
        { initialPreset: "neo-brutalist", initialColorScheme: "dark" },
      );

      fireEvent.press(screen.getByRole("button", { name: "Web Tooltip Trigger" }));
      const tooltipContent = await screen.findByTestId("web-tooltip-content");
      expect(tooltipContent.props.className).toContain("rounded-sm");
      expect(tooltipContent.props.className).toContain("border-2");
      expect(screen.queryByTestId("tooltip-overlay")).toBeNull();

      const popoverTrigger = screen.getByRole("button", { name: "Web Popover Trigger" });
      const preventPopoverClick = vi.fn();
      popoverTrigger.props.onClick?.({ preventDefault: preventPopoverClick });
      expect(preventPopoverClick).toHaveBeenCalledTimes(1);

      const dropdownTrigger = screen.getByRole("button", { name: "Web Dropdown Trigger" });
      const preventDropdownClick = vi.fn();
      dropdownTrigger.props.onClick?.({ preventDefault: preventDropdownClick });
      expect(preventDropdownClick).toHaveBeenCalledTimes(1);

      fireEvent.press(dropdownTrigger);
      const webCheckbox = await screen.findByTestId("web-menu-checkbox");
      fireEvent.press(webCheckbox);
      fireEvent.press(webCheckbox);
      expect(onWebCheckboxChange).toHaveBeenCalledTimes(1);

      observability.assertNoDefects();
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS });
    }
  });
});
