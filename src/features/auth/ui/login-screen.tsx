import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Either, ParseResult, Schema } from "effect";
import { type Href, Link, useLocalSearchParams, useRouter } from "expo-router";
import { Lock, LogIn, ShieldAlert } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signInWithEmail } from "@/features/auth/api/session";
import { SignInSchema, sanitizeRedirect } from "@/features/auth/model/schemas";
import { decodeApiError } from "@/shared/api/contracts";
import { APP_INFO } from "@/shared/config/app-info";
import { ROUTES } from "@/shared/config/routes";
import { useObservability } from "@/shared/observability/observability-context";
import { useCredentialStore } from "@/shared/storage/credential-store-context";
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
import { Input } from "@/shared/ui/input";
import { Text } from "@/shared/ui/text";

interface LoginFieldErrors {
  email?: string;
  password?: string;
}

function validateSignInFields(values: { email: string; password: string }): LoginFieldErrors {
  const decoded = Schema.decodeUnknownEither(SignInSchema, { errors: "all" })(values);
  if (Either.isRight(decoded)) {
    return {};
  }

  const fieldErrors: LoginFieldErrors = {};
  for (const issue of ParseResult.ArrayFormatter.formatErrorSync(decoded.left)) {
    const key = issue.path[0];
    if (key === "email" && !fieldErrors.email) {
      fieldErrors.email = issue.message;
    } else if (key === "password" && !fieldErrors.password) {
      fieldErrors.password = issue.message;
    }
  }
  return fieldErrors;
}

export function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();
  const queryClient = useQueryClient();
  const credentialStore = useCredentialStore();
  const observability = useObservability();

  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setBannerError(null);
      setIsForbidden(false);

      const clientErrors = validateSignInFields(value);
      if (Object.keys(clientErrors).length > 0) {
        setFieldErrors(clientErrors);
        return;
      }
      setFieldErrors({});

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
        if (decoded._tag === "ForbiddenError") {
          setIsForbidden(true);
          setBannerError(`Access denied: ${decoded.message}`);
          return;
        }

        if (decoded._tag === "ValidationError") {
          const serverFieldErrors: LoginFieldErrors = {};
          for (const issue of decoded.issues) {
            const key = issue.path?.[0];
            if (key === "email" && issue.message) {
              serverFieldErrors.email = issue.message;
            } else if (key === "password" && issue.message) {
              serverFieldErrors.password = issue.message;
            }
          }
          if (Object.keys(serverFieldErrors).length > 0) {
            setFieldErrors(serverFieldErrors);
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
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

              <CardContent className="gap-4">
                {bannerError ? (
                  <View
                    accessibilityRole="alert"
                    className={
                      isForbidden
                        ? "border-warning bg-warning-container flex-row items-start gap-2 rounded-xl border p-3"
                        : "border-destructive bg-destructive-container flex-row items-start gap-2 rounded-xl border p-3"
                    }
                  >
                    <Icon
                      as={ShieldAlert}
                      size={18}
                      className={
                        isForbidden
                          ? "text-on-warning-container mt-0.5"
                          : "text-on-destructive-container mt-0.5"
                      }
                    />
                    <Text
                      variant="muted"
                      className={
                        isForbidden
                          ? "text-on-warning-container flex-1 font-medium"
                          : "text-on-destructive-container flex-1 font-medium"
                      }
                    >
                      {bannerError}
                    </Text>
                  </View>
                ) : null}

                <form.Field name="email">
                  {(field) => (
                    <View className="gap-1.5">
                      <Text variant="label">Email</Text>
                      <Input
                        accessibilityLabel="Email"
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        placeholder="you@example.com"
                        value={field.state.value}
                        invalid={Boolean(fieldErrors.email)}
                        onChangeText={(text) => {
                          field.handleChange(text);
                          if (fieldErrors.email) {
                            setFieldErrors((prev) => ({ ...prev, email: undefined }));
                          }
                        }}
                      />
                      {fieldErrors.email ? (
                        <Text
                          accessibilityRole="alert"
                          variant="caption"
                          className="text-destructive"
                        >
                          {fieldErrors.email}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </form.Field>

                <form.Field name="password">
                  {(field) => (
                    <View className="gap-1.5">
                      <Text variant="label">Password</Text>
                      <Input
                        accessibilityLabel="Password"
                        autoCapitalize="none"
                        autoComplete="password"
                        secureTextEntry
                        placeholder="Enter your password"
                        value={field.state.value}
                        invalid={Boolean(fieldErrors.password)}
                        onChangeText={(text) => {
                          field.handleChange(text);
                          if (fieldErrors.password) {
                            setFieldErrors((prev) => ({ ...prev, password: undefined }));
                          }
                        }}
                      />
                      {fieldErrors.password ? (
                        <Text
                          accessibilityRole="alert"
                          variant="caption"
                          className="text-destructive"
                        >
                          {fieldErrors.password}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </form.Field>

                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(isSubmitting) => (
                    <Button
                      disabled={isSubmitting}
                      onPress={() => void form.handleSubmit()}
                      className="mt-2"
                    >
                      <Icon as={LogIn} size={18} className="text-primary-foreground" />
                      <Text>{isSubmitting ? "Signing In..." : "Sign In"}</Text>
                    </Button>
                  )}
                </form.Subscribe>
              </CardContent>

              <CardFooter className="justify-center">
                <Text variant="muted">New here?</Text>
                <Link href={registerHref} asChild>
                  <Button variant="link" size="sm">
                    Create an account
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
