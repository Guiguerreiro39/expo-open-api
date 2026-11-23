import { Schema } from "effect";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Info,
  Layers,
  MoreVertical,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Type,
} from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  SHOWCASE_CATEGORIES,
  SHOWCASE_PRIORITIES,
  ShowcaseFeedbackSchema,
  type ShowcaseFeedbackValues,
} from "@/features/showcase/model/schemas";
import { getThemeElevation, THEME_PRESETS } from "@/shared/lib/theme/presets";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
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
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useAppForm,
} from "@/shared/ui/form";
import { FormScrollView } from "@/shared/ui/form-scroll-view";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Progress } from "@/shared/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { Skeleton } from "@/shared/ui/skeleton";
import { Slider } from "@/shared/ui/slider";
import { Switch } from "@/shared/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { TactilePressable } from "@/shared/ui/tactile-pressable";
import { Text } from "@/shared/ui/text";
import { Textarea } from "@/shared/ui/textarea";
import { useTheme } from "@/shared/ui/theme-provider";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";
import { useToast } from "@/shared/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

type ShowcaseTab = "tokens" | "primitives" | "overlays" | "form";

export interface ShowcaseScreenProps {
  onSubmitFeedback?: (values: ShowcaseFeedbackValues) => Promise<void> | void;
}

const BRAND_SWATCHES = [
  {
    label: "Primary",
    token: "--primary",
    bgClass: "bg-primary",
    textClass: "text-primary-foreground",
  },
  {
    label: "Primary Container",
    token: "--primary-container",
    bgClass: "bg-primary-container",
    textClass: "text-on-primary-container",
  },
  {
    label: "Secondary",
    token: "--secondary",
    bgClass: "bg-secondary",
    textClass: "text-secondary-foreground",
  },
  {
    label: "Secondary Cont.",
    token: "--secondary-container",
    bgClass: "bg-secondary-container",
    textClass: "text-on-secondary-container",
  },
  {
    label: "Tertiary",
    token: "--tertiary",
    bgClass: "bg-tertiary",
    textClass: "text-tertiary-foreground",
  },
  {
    label: "Surface High",
    token: "--surface-container-high",
    bgClass: "bg-surface-container-high border border-outline-variant",
    textClass: "text-foreground",
  },
] as const;

const STATUS_SWATCHES = [
  {
    label: "Success",
    bgClass: "bg-success-container",
    textClass: "text-on-success-container",
    icon: CheckCircle2,
  },
  {
    label: "Warning",
    bgClass: "bg-warning-container",
    textClass: "text-on-warning-container",
    icon: AlertCircle,
  },
  {
    label: "Info",
    bgClass: "bg-info-container",
    textClass: "text-on-info-container",
    icon: Info,
  },
  {
    label: "Destructive",
    bgClass: "bg-destructive-container",
    textClass: "text-on-destructive-container",
    icon: AlertCircle,
  },
] as const;

export function ShowcaseScreen({ onSubmitFeedback }: ShowcaseScreenProps) {
  const { preset, resolvedColorScheme } = useTheme();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<ShowcaseTab>("tokens");
  const [pressCount, setPressCount] = useState(0);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [radioValue, setRadioValue] = useState("tactile");
  const [sliderValue, setSliderValue] = useState(65);
  const [selectedRole, setSelectedRole] = useState({ value: "member", label: "Member" });
  const [lastDropdownAction, setLastDropdownAction] = useState("None");
  const [submittedValues, setSubmittedValues] = useState<ShowcaseFeedbackValues | null>(null);

  const presetDef = THEME_PRESETS[preset];
  const elevation = getThemeElevation(preset, resolvedColorScheme);

  const form = useAppForm({
    defaultValues: {
      title: "",
      category: "feature" as ShowcaseFeedbackValues["category"],
      priority: "medium" as ShowcaseFeedbackValues["priority"],
      description: "",
      agreeTerms: false,
    },
    onSubmit: async ({ value }) => {
      await onSubmitFeedback?.(value);
      setSubmittedValues(value);
      toast.success("Feedback submitted", `"${value.title}" validated via Effect Schema.`);
    },
  });

  return (
    <SafeAreaView className="bg-background flex-1">
      <FormScrollView contentContainerClassName="px-4 py-6 pb-16">
        <View className="mx-auto w-full max-w-2xl gap-6">
          {/* Hero Header */}
          <View className="gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <Badge variant="outline">
                <View className="flex-row items-center gap-1.5">
                  <Icon as={Sparkles} size={13} className="text-primary" />
                  <Text variant="caption" className="text-foreground font-semibold">
                    React Native Reusables
                  </Text>
                </View>
              </Badge>
              <Badge variant="secondary">
                <Text
                  testID="showcase-active-theme"
                  variant="caption"
                  className="text-on-secondary-container font-mono font-semibold"
                >
                  {preset} · {resolvedColorScheme}
                </Text>
              </Badge>
            </View>
            <Text variant="h2">Design System Showcase</Text>
            <Text variant="lead">
              Live theme presets, semantic HSL tokens, tactile physics, Portal-anchored overlays,
              and Effect Schema mobile forms.
            </Text>
          </View>

          <Tabs value={activeTab} onValueChange={(next) => setActiveTab(next as ShowcaseTab)}>
            <TabsList>
              <TabsTrigger value="tokens">
                <Text>Tokens</Text>
              </TabsTrigger>
              <TabsTrigger value="primitives">
                <Text>Primitives</Text>
              </TabsTrigger>
              <TabsTrigger value="overlays">
                <Text>Overlays</Text>
              </TabsTrigger>
              <TabsTrigger value="form">
                <Text>Form Demo</Text>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: TOKENS & THEMING */}
            <TabsContent value="tokens" className="gap-4">
              <Card>
                <CardHeader>
                  <View className="flex-row items-center gap-2">
                    <Icon as={Palette} size={18} className="text-primary" />
                    <CardTitle>Runtime Theme Switcher</CardTitle>
                  </View>
                  <CardDescription>
                    Switches NativeWind CSS variable maps and persists selection to KV storage.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ThemeSwitcher />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Semantic Color Tokens</CardTitle>
                  <CardDescription>
                    Compiled from space-separated HSL channels defined in DESIGN.md.
                  </CardDescription>
                </CardHeader>
                <CardContent className="gap-4">
                  <View className="flex-row flex-wrap gap-2.5">
                    {BRAND_SWATCHES.map((swatch) => (
                      <View
                        key={swatch.token}
                        className={`min-w-36 flex-1 justify-between rounded-xl p-3 ${swatch.bgClass}`}
                      >
                        <Text variant="label" className={swatch.textClass}>
                          {swatch.label}
                        </Text>
                        <Text variant="caption" className={`font-mono ${swatch.textClass}`}>
                          {swatch.token}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Separator />

                  <View className="flex-row flex-wrap gap-2">
                    {STATUS_SWATCHES.map((status) => (
                      <View
                        key={status.label}
                        className={`min-w-32 flex-1 flex-row items-center gap-2 rounded-xl px-3 py-2.5 ${status.bgClass}`}
                      >
                        <Icon as={status.icon} size={15} className={status.textClass} />
                        <Text variant="label" className={status.textClass}>
                          {status.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <View className="flex-row items-center gap-2">
                    <Icon as={Type} size={18} className="text-primary" />
                    <CardTitle>Typography Scale</CardTitle>
                  </View>
                  <CardDescription>
                    Quicksand display & body rhythm paired with JetBrains Mono.
                  </CardDescription>
                </CardHeader>
                <CardContent className="gap-3">
                  <View>
                    <Text variant="caption" className="font-mono">
                      headline-lg
                    </Text>
                    <Text variant="h2">Crafted Mobile UI</Text>
                  </View>
                  <View>
                    <Text variant="caption" className="font-mono">
                      headline-md
                    </Text>
                    <Text variant="h3">Tactile Controls</Text>
                  </View>
                  <View>
                    <Text variant="caption" className="font-mono">
                      body-md
                    </Text>
                    <Text variant="default">
                      High-contrast reading hierarchy with semantic surface containers.
                    </Text>
                  </View>
                  <View className="bg-surface-container rounded-xl p-3">
                    <Text variant="mono">traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-01</Text>
                  </View>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <View className="flex-row items-center gap-2">
                    <Icon as={Layers} size={18} className="text-primary" />
                    <CardTitle>Tactile Elevation Physics</CardTitle>
                  </View>
                  <CardDescription>
                    Zero-blur offset shadows and Reanimated spring depression tuned per preset.
                  </CardDescription>
                </CardHeader>
                <CardContent className="gap-3">
                  <View className="bg-surface-container-low border-outline-variant gap-1 rounded-xl border p-3">
                    <Text variant="caption" className="font-mono">
                      pressTranslate: ({presetDef.pressTranslate.x}px, {presetDef.pressTranslate.y}
                      px)
                    </Text>
                    <Text variant="caption" className="font-mono">
                      boxShadow: {elevation.boxShadow}
                    </Text>
                  </View>
                  <TactilePressable
                    accessibilityRole="button"
                    accessibilityLabel="Test tactile spring press"
                    onPress={() => setPressCount((count) => count + 1)}
                    className="border-primary bg-primary-fixed/40 flex-row items-center justify-between rounded-xl px-4 py-3.5"
                  >
                    <Text variant="label" className="text-foreground">
                      Tap to test tactile spring press
                    </Text>
                    <Badge variant="default">{pressCount}</Badge>
                  </TactilePressable>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: PRIMITIVES CATALOG */}
            <TabsContent value="primitives" className="gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Buttons & Badges</CardTitle>
                  <CardDescription>All tactile button variants and semantic pills.</CardDescription>
                </CardHeader>
                <CardContent className="gap-4">
                  <View className="flex-row flex-wrap gap-2.5">
                    <Button variant="default" size="sm">
                      Primary
                    </Button>
                    <Button variant="secondary" size="sm">
                      Secondary
                    </Button>
                    <Button variant="outline" size="sm">
                      Outline
                    </Button>
                    <Button variant="destructive" size="sm">
                      Destructive
                    </Button>
                    <Button variant="ghost" size="sm">
                      Ghost
                    </Button>
                    <Button variant="link" size="sm">
                      Link
                    </Button>
                  </View>

                  <Separator />

                  <View className="flex-row flex-wrap gap-2">
                    <Badge variant="default">Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="success">Success</Badge>
                    <Badge variant="warning">Warning</Badge>
                    <Badge variant="info">Info</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                  </View>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <View className="flex-row items-center gap-2">
                    <Icon as={SlidersHorizontal} size={18} className="text-primary" />
                    <CardTitle>Selection & Form Controls</CardTitle>
                  </View>
                  <CardDescription>
                    Owned Reusables inputs, switches, checkboxes, radio groups, select, and menus.
                  </CardDescription>
                </CardHeader>
                <CardContent className="gap-4">
                  <View className="gap-1.5">
                    <Label nativeID="demo-input-label">Text Input</Label>
                    <Input
                      aria-labelledby="demo-input-label"
                      placeholder="Semantic NativeWind input"
                    />
                  </View>

                  <View className="gap-1.5">
                    <Label nativeID="demo-textarea-label">Multiline Textarea</Label>
                    <Textarea
                      aria-labelledby="demo-textarea-label"
                      placeholder="Write notes or structured descriptions..."
                    />
                  </View>

                  <View className="flex-row items-center justify-between gap-4">
                    <View className="flex-row items-center gap-2.5">
                      <Switch
                        accessibilityLabel="Enable live sync"
                        checked={switchChecked}
                        onCheckedChange={setSwitchChecked}
                      />
                      <Text variant="default">Live Sync ({switchChecked ? "On" : "Off"})</Text>
                    </View>

                    <View className="flex-row items-center gap-2.5">
                      <Checkbox
                        accessibilityLabel="Persist cache"
                        checked={checkboxChecked}
                        onCheckedChange={setCheckboxChecked}
                      />
                      <Text variant="default">Persist Cache</Text>
                    </View>
                  </View>

                  <View className="gap-2">
                    <Text variant="label">Elevation Mode (RadioGroup)</Text>
                    <RadioGroup value={radioValue} onValueChange={setRadioValue}>
                      <View className="flex-row items-center gap-2.5">
                        <RadioGroupItem value="tactile" aria-labelledby="radio-tactile" />
                        <Label nativeID="radio-tactile" onPress={() => setRadioValue("tactile")}>
                          Tactile Offset Shadow
                        </Label>
                      </View>
                      <View className="flex-row items-center gap-2.5">
                        <RadioGroupItem value="flat" aria-labelledby="radio-flat" />
                        <Label nativeID="radio-flat" onPress={() => setRadioValue("flat")}>
                          Flat Structural Border
                        </Label>
                      </View>
                    </RadioGroup>
                  </View>

                  <View className="gap-2">
                    <Text variant="label">Role Select</Text>
                    <Select
                      value={selectedRole}
                      onValueChange={(option) => {
                        if (option) setSelectedRole(option);
                      }}
                    >
                      <SelectTrigger accessibilityLabel="Role selector">
                        <SelectValue placeholder="Choose a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin" label="Admin" />
                        <SelectItem value="member" label="Member" />
                        <SelectItem value="viewer" label="Viewer" />
                      </SelectContent>
                    </Select>
                  </View>

                  <View className="flex-row items-center justify-between gap-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Icon as={MoreVertical} size={15} className="text-foreground" />
                          <Text>Actions Menu</Text>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onPress={() => setLastDropdownAction("Duplicated")}>
                          <Text>Duplicate Item</Text>
                        </DropdownMenuItem>
                        <DropdownMenuItem onPress={() => setLastDropdownAction("Archived")}>
                          <Text>Archive Item</Text>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Text variant="caption">Last action: {lastDropdownAction}</Text>
                  </View>

                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text variant="label">Slider & Progress</Text>
                      <Text variant="caption" className="font-mono">
                        {sliderValue}%
                      </Text>
                    </View>
                    <Slider
                      accessibilityLabel="Completion slider"
                      value={sliderValue}
                      onValueChange={setSliderValue}
                      min={0}
                      max={100}
                      step={5}
                    />
                    <Progress value={sliderValue} />
                  </View>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Display & Feedback</CardTitle>
                  <CardDescription>Avatars, skeletons, and semantic alert banners.</CardDescription>
                </CardHeader>
                <CardContent className="gap-4">
                  <View className="flex-row items-center gap-3">
                    <Avatar alt="Gui Guerreiro">
                      <AvatarFallback>
                        <Text>GG</Text>
                      </AvatarFallback>
                    </Avatar>
                    <Avatar alt="Starter Kit">
                      <AvatarFallback>
                        <Text>SK</Text>
                      </AvatarFallback>
                    </Avatar>
                    <View className="flex-1 gap-2">
                      <Skeleton className="h-3.5 w-3/4" animate={false} />
                      <Skeleton className="h-3 w-1/2" animate={false} />
                    </View>
                  </View>

                  <Alert variant="info">
                    <AlertTitle>Single-Source Tokens Active</AlertTitle>
                    <AlertDescription>
                      Every component on this screen reads semantic HSL variables with zero
                      hardcoded hex literals.
                    </AlertDescription>
                  </Alert>

                  <Alert variant="success">
                    <AlertTitle>Offline Ready</AlertTitle>
                    <AlertDescription>
                      Theme preferences persist synchronously via the injected KV storage port.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Accordion</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="tactile-physics">
                      <AccordionTrigger>
                        <Text>What powers the tactile press feel?</Text>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Text>
                          TactilePressable pairs Reanimated spring physics with expo-haptics light
                          impact pulses tuned per theme preset.
                        </Text>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="portal-layering">
                      <AccordionTrigger>
                        <Text>How are mobile overlays layered?</Text>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Text>
                          Dialogs, AlertDialogs, Sheets, Selects, Popovers, and Toasts render into a
                          single root PortalHost inside ThemeProvider.
                        </Text>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: OVERLAYS & PORTALS */}
            <TabsContent value="overlays" className="gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Overlays & Portals</CardTitle>
                  <CardDescription>
                    Modal dialogs, confirmation alerts, bottom sheets, popovers, tooltips, and
                    toasts rendered into the root PortalHost.
                  </CardDescription>
                </CardHeader>
                <CardContent className="gap-3">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Open Standard Dialog</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Portal-Anchored Dialog</DialogTitle>
                        <DialogDescription>
                          Inherits live NativeWind theme variables from the root ThemeProvider.
                        </DialogDescription>
                      </DialogHeader>
                      <Text variant="default">
                        Press outside or tap the close button to dismiss cleanly.
                      </Text>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="default" size="sm">
                            Done
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">Open Alert Confirmation</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirm destructive action?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone and illustrates an accessible AlertDialog.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          <Text>Cancel</Text>
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onPress={() =>
                            toast.warning("Confirmed", "AlertDialog confirmation handled.")
                          }
                        >
                          <Text>Confirm</Text>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="secondary">Open Bottom Sheet</Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Bottom Slide Sheet</SheetTitle>
                        <SheetDescription>
                          Built on headless @rn-primitives/dialog with zero native gesture-sheet
                          coupling.
                        </SheetDescription>
                      </SheetHeader>
                      <View className="bg-surface-container rounded-xl p-4">
                        <Text variant="default">
                          Active preset: {presetDef.label} ({resolvedColorScheme})
                        </Text>
                      </View>
                      <SheetFooter>
                        <SheetClose asChild>
                          <Button variant="outline" size="sm">
                            Dismiss
                          </Button>
                        </SheetClose>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>

                  <View className="flex-row gap-2.5">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1">
                          Open Popover
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Text variant="label">Anchored Popover</Text>
                        <Text variant="caption">
                          Renders floating contextual metadata cleanly through PortalHost.
                        </Text>
                      </PopoverContent>
                    </Popover>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1">
                          Show Tooltip
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <Text>Accessible semantic tooltip</Text>
                      </TooltipContent>
                    </Tooltip>
                  </View>

                  <Separator />

                  <View className="gap-2">
                    <View className="flex-row items-center gap-2">
                      <Icon as={Bell} size={16} className="text-primary" />
                      <Text variant="label">Toast Notifications</Text>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() =>
                          toast.success("Synced", "Theme tokens and cache are up to date.")
                        }
                      >
                        Success Toast
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() =>
                          toast.error("Stream paused", "Reconnecting to live SSE endpoint.")
                        }
                      >
                        Error Toast
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => toast.info("Tip", "Switch presets in the Tokens tab.")}
                      >
                        Info Toast
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: EFFECT SCHEMA FORM DEMO */}
            <TabsContent value="form" className="gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Effect Schema Feedback Form</CardTitle>
                  <CardDescription>
                    TanStack Form v1 + Effect Schema.standardSchemaV1 + double-submit lock + toast
                    confirmation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="gap-4">
                  <form.Field
                    name="title"
                    validators={{
                      onBlur: Schema.standardSchemaV1(ShowcaseFeedbackSchema.fields.title),
                      onSubmit: Schema.standardSchemaV1(ShowcaseFeedbackSchema.fields.title),
                    }}
                  >
                    {(field) => (
                      <FormField field={field}>
                        <FormItem>
                          <FormLabel>Feedback Title</FormLabel>
                          <FormControl>
                            <Input
                              accessibilityLabel="Feedback Title"
                              placeholder="e.g. Improve dark contrast"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChangeText={(text) => field.handleChange(text)}
                            />
                          </FormControl>
                          <FormDescription>
                            Concise summary (at least 3 characters).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field
                    name="category"
                    validators={{
                      onSubmit: Schema.standardSchemaV1(ShowcaseFeedbackSchema.fields.category),
                    }}
                  >
                    {(field) => {
                      const activeOption =
                        SHOWCASE_CATEGORIES.find((item) => item.value === field.state.value) ??
                        SHOWCASE_CATEGORIES[0];
                      return (
                        <FormField field={field}>
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select
                              value={activeOption}
                              onValueChange={(option) => {
                                if (option) {
                                  field.handleChange(
                                    option.value as ShowcaseFeedbackValues["category"],
                                  );
                                }
                              }}
                            >
                              <FormControl>
                                <SelectTrigger accessibilityLabel="Feedback Category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {SHOWCASE_CATEGORIES.map((category) => (
                                  <SelectItem
                                    key={category.value}
                                    value={category.value}
                                    label={category.label}
                                  />
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        </FormField>
                      );
                    }}
                  </form.Field>

                  <form.Field
                    name="priority"
                    validators={{
                      onSubmit: Schema.standardSchemaV1(ShowcaseFeedbackSchema.fields.priority),
                    }}
                  >
                    {(field) => (
                      <FormField field={field}>
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <RadioGroup
                            value={field.state.value}
                            onValueChange={(val) =>
                              field.handleChange(val as ShowcaseFeedbackValues["priority"])
                            }
                            className="flex-row flex-wrap gap-3"
                          >
                            {SHOWCASE_PRIORITIES.map((priority) => (
                              <View key={priority.value} className="flex-row items-center gap-2">
                                <RadioGroupItem
                                  value={priority.value}
                                  aria-labelledby={`priority-${priority.value}`}
                                />
                                <Label
                                  nativeID={`priority-${priority.value}`}
                                  onPress={() => field.handleChange(priority.value)}
                                >
                                  {priority.label}
                                </Label>
                              </View>
                            ))}
                          </RadioGroup>
                          <FormMessage />
                        </FormItem>
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field
                    name="description"
                    validators={{
                      onBlur: Schema.standardSchemaV1(ShowcaseFeedbackSchema.fields.description),
                      onSubmit: Schema.standardSchemaV1(ShowcaseFeedbackSchema.fields.description),
                    }}
                  >
                    {(field) => (
                      <FormField field={field}>
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              accessibilityLabel="Description"
                              placeholder="Describe reproduction steps or design notes (min 10 chars)..."
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChangeText={(text) => field.handleChange(text)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field
                    name="agreeTerms"
                    validators={{
                      onSubmit: Schema.standardSchemaV1(ShowcaseFeedbackSchema.fields.agreeTerms),
                    }}
                  >
                    {(field) => (
                      <FormField field={field}>
                        <FormItem>
                          <View className="flex-row items-center gap-3">
                            <FormControl>
                              <Checkbox
                                accessibilityLabel="Agree to feedback policy"
                                checked={field.state.value}
                                onCheckedChange={(checked) => field.handleChange(Boolean(checked))}
                              />
                            </FormControl>
                            <Label
                              onPress={() => field.handleChange(!field.state.value)}
                              className="flex-1"
                            >
                              I agree to share this feedback for design QA
                            </Label>
                          </View>
                          <FormMessage />
                        </FormItem>
                      </FormField>
                    )}
                  </form.Field>

                  <form.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                      <Button
                        disabled={isSubmitting}
                        onPress={() => void form.handleSubmit()}
                        className="mt-1"
                      >
                        {isSubmitting ? "Submitting..." : "Submit Feedback"}
                      </Button>
                    )}
                  </form.Subscribe>

                  {submittedValues ? (
                    <View
                      testID="showcase-submitted-summary"
                      className="border-success bg-success-container gap-1 rounded-xl border p-3.5"
                    >
                      <Text variant="label" className="text-on-success-container font-bold">
                        Last Validated Payload
                      </Text>
                      <Text variant="mono" className="text-on-success-container">
                        {JSON.stringify(submittedValues, null, 2)}
                      </Text>
                    </View>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </View>
      </FormScrollView>
    </SafeAreaView>
  );
}
