import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { forwardRef, useImperativeHandle } from "react";
import { Pressable, type PressableProps, Text } from "react-native";
import { describe, expect, it, vi } from "vitest";
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
});
