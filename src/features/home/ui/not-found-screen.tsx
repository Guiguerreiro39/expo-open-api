import { Link, Stack } from "expo-router";
import { ArrowLeft, Compass } from "lucide-react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/shared/ui/card";
import { Icon } from "@/shared/ui/icon";
import { Text } from "@/shared/ui/text";

export function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <SafeAreaView className="bg-background flex-1" edges={["bottom", "left", "right"]}>
        <View className="flex-1 items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader>
              <View className="flex-row items-center gap-2">
                <Icon as={Compass} size={20} className="text-primary shrink-0" />
                <CardTitle className="min-w-0 flex-1">Screen not found</CardTitle>
              </View>
              <CardDescription>
                This route does not exist. Return to the home workspace to continue.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link href="/" asChild>
                <Button className="w-full">
                  <Icon as={ArrowLeft} size={16} className="text-primary-foreground" />
                  <Text>Go to home screen</Text>
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </View>
      </SafeAreaView>
    </>
  );
}
