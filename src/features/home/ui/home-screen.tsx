import { Moon, Palette, Sparkles, Sun } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_INFO } from "@/shared/config/app-info";
import { THEME_PRESET_IDS, THEME_PRESETS } from "@/shared/lib/theme/presets";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
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

export function HomeScreen() {
  const { preset, presetDefinition, setPreset, resolvedColorScheme, toggleColorScheme } =
    useTheme();

  return (
    <SafeAreaView className="bg-background flex-1">
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="mx-auto w-full max-w-md gap-6">
          <View className="gap-3">
            <Badge variant="secondary">
              <View className="flex-row items-center gap-1.5">
                <Icon as={Sparkles} size={14} className="text-on-secondary-container" />
                <Text variant="caption" className="text-on-secondary-container">
                  {presetDefinition.label}
                </Text>
              </View>
            </Badge>
            <Text variant="h2">{APP_INFO.name}</Text>
            <Text variant="lead">Expo SDK 52 · Expo Router v4 · Feature-Sliced Design</Text>
          </View>

          <Card>
            <CardHeader>
              <View className="flex-row items-center gap-2">
                <Icon as={Palette} size={18} className="text-primary" />
                <CardTitle>Runtime Theme Presets</CardTitle>
              </View>
              <CardDescription>{presetDefinition.description}</CardDescription>
            </CardHeader>
            <CardContent className="gap-2.5">
              {THEME_PRESET_IDS.map((presetId) => {
                const option = THEME_PRESETS[presetId];
                const isActive = presetId === preset;
                return (
                  <Button
                    key={presetId}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onPress={() => setPreset(presetId)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </CardContent>
            <CardFooter className="justify-between">
              <Badge variant="info">
                {resolvedColorScheme === "dark" ? "Dark Mode" : "Light Mode"}
              </Badge>
              <Button variant="secondary" size="sm" onPress={toggleColorScheme}>
                <Icon
                  as={resolvedColorScheme === "dark" ? Sun : Moon}
                  size={16}
                  className="text-on-secondary-container"
                />
                <Text>{resolvedColorScheme === "dark" ? "Switch to Light" : "Switch to Dark"}</Text>
              </Button>
            </CardFooter>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
