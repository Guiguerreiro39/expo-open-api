export const ROUTES = {
  ROOT: "/",
  AUTH_LOGIN: "/(auth)/login",
  AUTH_REGISTER: "/(auth)/register",
  APP_HOME: "/(app)",
  APP_TASKS: "/(app)/tasks",
  APP_FILES: "/(app)/files",
  APP_SHOWCASE: "/(app)/showcase",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
