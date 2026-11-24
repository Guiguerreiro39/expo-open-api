import { useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import { type Href, Link, useLocalSearchParams, useRouter } from "expo-router";
import { Eye, EyeOff, Lock, LogIn, ShieldAlert } from "lucide-react-native";
import { type ComponentRef, useRef, useState } from "react";
import { Pressable, type TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signInWithEmail } from "@/features/auth/api/session";
import { SignInSchema, sanitizeRedirect } from "@/features/auth/model/schemas";
import { decodeApiError } from "@/shared/api/contracts";
import { APP_INFO } from "@/shared/config/app-info";
import { ROUTES } from "@/shared/config/routes";
import { useObservability } from "@/shared/observability/observability-context";
import { recordErrorOrDefect } from "@/shared/observability/port";
import { useCredentialStore } from "@/shared/storage/credential-store-context";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/alert";
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
import {
  applyServerValidationErrors,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useAppForm,
} from "@/shared/ui/form";
import { FormScrollView } from "@/shared/ui/form-scroll-view";
import { Icon } from "@/shared/ui/icon";
import { Input } from "@/shared/ui/input";
import { Text } from "@/shared/ui/text";

const emailValidator = Schema.standardSchemaV1(SignInSchema.fields.email);
const passwordValidator = Schema.standardSchemaV1(SignInSchema.fields.password);

export function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();
  const queryClient = useQueryClient();
  const credentialStore = useCredentialStore();
  const observability = useObservability();

  const passwordInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setBannerError(null);
      setIsForbidden(false);

      try {
        await signInWithEmail(
          { email: value.email.trim(), password: value.password },
          {
            credentialStore,
            queryClient,
            observability,
          },
        );

        const target = sanitizeRedirect(params.redirect) ?? ROUTES.APP_HOME;
        router.replace(target as Href);
      } catch (error) {
        const decoded = decodeApiError(error);
        recordErrorOrDefect(observability, decoded, {
          source: "LoginScreen.onSubmit",
        });
        if (decoded._tag === "ForbiddenError") {
          setIsForbidden(true);
          setBannerError(decoded.message);
          return;
        }

        if (decoded._tag === "ValidationError") {
          const serverFieldErrors: Record<string, string> = {};
          for (const issue of decoded.issues) {
            const key = issue.path?.[0];
            if ((key === "email" || key === "password") && issue.message) {
              serverFieldErrors[key] = issue.message;
            }
          }
          if (Object.keys(serverFieldErrors).length > 0) {
            applyServerValidationErrors(form, serverFieldErrors);
            return;
          }
        }

        setBannerError(decoded.message || "Unable to sign in. Please try again.");
      }
    },
  });

  const safeRedirect = sanitizeRedirect(params.redirect);
  const registerHref: Href = safeRedirect
    ? ({ pathname: ROUTES.AUTH_REGISTER, params: { redirect: safeRedirect } } as Href)
    : (ROUTES.AUTH_REGISTER as Href);

  return (
    <SafeAreaView className="bg-background flex-1">
      <FormScrollView contentContainerClassName="px-6 pt-8 pb-10">
        <View className="mx-auto w-full max-w-md gap-6">
          <View className="gap-2">
            <Badge variant="secondary">
              <View className="flex-row items-center gap-1.5">
                <Icon as={Lock} size={14} className="text-on-secondary-container" />
                <Text variant="caption" className="text-on-secondary-container">
                  Better Auth · SecureStore
                </Text>
              </View>
            </Badge>
            <Text variant="h2">Welcome back</Text>
            <Text variant="lead">Sign in to continue to {APP_INFO.name}</Text>
          </View>

          <Card>
            <CardHeader>
              <CardTitle>Account Credentials</CardTitle>
              <CardDescription>Enter your account email and password.</CardDescription>
            </CardHeader>

            <CardContent className="gap-3">
              {bannerError ? (
                <Alert variant={isForbidden ? "warning" : "destructive"}>
                  <View className="flex-row items-start gap-2.5">
                    <Icon
                      as={ShieldAlert}
                      size={18}
                      className={
                        isForbidden
                          ? "text-on-warning-container mt-0.5 shrink-0"
                          : "text-on-destructive-container mt-0.5 shrink-0"
                      }
                    />
                    <View className="min-w-0 flex-1 gap-0.5">
                      {isForbidden ? <AlertTitle>Access denied</AlertTitle> : null}
                      <AlertDescription>{bannerError}</AlertDescription>
                    </View>
                  </View>
                </Alert>
              ) : null}

              <form.Field
                name="email"
                validators={{
                  onBlur: emailValidator,
                  onSubmit: emailValidator,
                }}
              >
                {(field) => (
                  <FormField field={field}>
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          accessibilityLabel="Email"
                          autoCapitalize="none"
                          autoComplete="email"
                          keyboardType="email-address"
                          returnKeyType="next"
                          submitBehavior="submit"
                          placeholder="you@example.com"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChangeText={(text) => field.handleChange(text)}
                          onSubmitEditing={() => passwordInputRef.current?.focus()}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </FormField>
                )}
              </form.Field>

              <form.Field
                name="password"
                validators={{
                  onBlur: passwordValidator,
                  onSubmit: passwordValidator,
                }}
              >
                {(field) => (
                  <FormField field={field}>
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <View className="relative justify-center">
                        <FormControl>
                          <Input
                            ref={passwordInputRef}
                            accessibilityLabel="Password"
                            autoCapitalize="none"
                            autoComplete="password"
                            returnKeyType="done"
                            secureTextEntry={!showPassword}
                            placeholder="Enter your password"
                            className="pr-12"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChangeText={(text) => field.handleChange(text)}
                            onSubmitEditing={() => void form.handleSubmit()}
                          />
                        </FormControl>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                          hitSlop={4}
                          onPress={() => setShowPassword((prev) => !prev)}
                          className="absolute right-1 min-h-11 min-w-11 items-center justify-center rounded-lg"
                        >
                          <Icon
                            as={showPassword ? EyeOff : Eye}
                            size={18}
                            className="text-on-surface-variant"
                          />
                        </Pressable>
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
                    <Icon as={LogIn} size={18} className="text-primary-foreground" />
                    <Text>{isSubmitting ? "Signing In..." : "Sign In"}</Text>
                  </Button>
                )}
              </form.Subscribe>
            </CardContent>

            <CardFooter className="flex-wrap justify-center gap-x-1 gap-y-1">
              <Text variant="muted">New here?</Text>
              <Link href={registerHref} asChild>
                <Button variant="link" size="sm">
                  Create an account
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </View>
      </FormScrollView>
    </SafeAreaView>
  );
}
