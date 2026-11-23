import { CheckSquare, FolderOpen, Palette } from "lucide-react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";

interface PlaceholderProps {
  readonly title: string;
  readonly description: string;
  readonly ticketLabel: string;
  readonly icon: typeof CheckSquare;
}

function RoutePlaceholder({ title, description, ticketLabel, icon }: PlaceholderProps) {
  return (
    <SafeAreaView className="bg-background flex-1" edges={["bottom", "left", "right"]}>
      <View className="flex-1 justify-center px-6 py-8">
        <View className="mx-auto w-full max-w-md">
          <Card>
            <CardHeader>
              <Badge variant="info">{ticketLabel}</Badge>
              <View className="mt-2 flex-row items-center gap-2">
                <Icon as={icon} size={20} className="text-primary" />
                <CardTitle>{title}</CardTitle>
              </View>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Text variant="muted">
                Protected by AppLayoutGuard and wired into Expo Router typed routes.
              </Text>
            </CardContent>
          </Card>
        </View>
      </View>
    </SafeAreaView>
  );
}

export function TasksPlaceholderScreen() {
  return (
    <RoutePlaceholder
      title="Tasks"
      description="Real-time SSE task list, optimistic mutations, and offline MMKV query cache."
      ticketLabel="Ticket #28 Slot"
      icon={CheckSquare}
    />
  );
}

export function FilesPlaceholderScreen() {
  return (
    <RoutePlaceholder
      title="Files"
      description="Direct multipart and presigned S3 upload pipeline with native sharing."
      ticketLabel="Ticket #29 Slot"
      icon={FolderOpen}
    />
  );
}

export function ShowcasePlaceholderScreen() {
  return (
    <RoutePlaceholder
      title="Component Showcase"
      description="React Native Reusables catalog, forms, and runtime theme preset switcher."
      ticketLabel="Ticket #30 Slot"
      icon={Palette}
    />
  );
}
