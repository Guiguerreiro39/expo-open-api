import { Palette, Sparkles } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_INFO } from "@/shared/config/app-info";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";
import { useTheme } from "@/shared/ui/theme-provider";
import { ThemeSwitcher } from "@/shared/ui/theme-switcher";

export function HomeScreen() {
  const { presetDefinition, colorScheme, resolvedColorScheme } = useTheme();
  const modeLabel =
    colorScheme === "system"
      ? `System (${resolvedColorScheme === "dark" ? "Dark" : "Light"})`
      : resolvedColorScheme === "dark"
        ? "Dark Mode"
        : "Light Mode";

  return (
    <SafeAreaView className="bg-background flex-1" edges={["left", "right"]}>
      <ScrollView contentContainerClassName="px-6 py-8" showsVerticalScrollIndicator={false}>
        <View className="mx-auto w-full max-w-md gap-8">
          <View className="gap-4">
            <Badge variant="secondary">
              <View className="flex-row items-center gap-1.5">
                <Icon as={Sparkles} size={14} className="text-on-secondary-container" />
                <Text variant="caption" className="text-on-secondary-container">
                  {presetDefinition.label}
                </Text>
              </View>
            </Badge>
            <Text variant="h2">{APP_INFO.name}</Text>
            <Text variant="lead">{APP_INFO.stackSummary}</Text>
          </View>

          <Card>
            <CardHeader className="gap-2 p-6">
              <View className="flex-row items-center gap-2.5">
                <Icon as={Palette} size={18} className="text-primary shrink-0" />
                <CardTitle className="min-w-0 flex-1">Runtime Theme Presets</CardTitle>
              </View>
              <CardDescription>{presetDefinition.description}</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <ThemeSwitcher />
            </CardContent>
            <CardFooter
              testID="home-theme-card-footer"
              className="flex-wrap items-center justify-between gap-3 px-6 pb-6"
            >
              <Badge variant="info">{modeLabel}</Badge>
              <Text variant="caption" className="shrink">
                Synced across navigation & overlays
              </Text>
            </CardFooter>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
