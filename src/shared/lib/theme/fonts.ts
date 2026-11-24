import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono/400Regular";
import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono/700Bold";
import { Quicksand_400Regular } from "@expo-google-fonts/quicksand/400Regular";
import { Quicksand_500Medium } from "@expo-google-fonts/quicksand/500Medium";
import { Quicksand_600SemiBold } from "@expo-google-fonts/quicksand/600SemiBold";
import { Quicksand_700Bold } from "@expo-google-fonts/quicksand/700Bold";
import * as Font from "expo-font";

export const APP_FONT_ASSETS = {
  "Quicksand-Regular": Quicksand_400Regular,
  "Quicksand-Medium": Quicksand_500Medium,
  "Quicksand-SemiBold": Quicksand_600SemiBold,
  "Quicksand-Bold": Quicksand_700Bold,
  "JetBrainsMono-Regular": JetBrainsMono_400Regular,
  "JetBrainsMono-Bold": JetBrainsMono_700Bold,
} as const satisfies Record<string, Font.FontSource>;

export async function loadAppFonts(): Promise<void> {
  await Font.loadAsync(APP_FONT_ASSETS);
}
