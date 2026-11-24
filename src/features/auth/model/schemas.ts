import { Schema } from "effect";

const DateOrString = Schema.Union(Schema.DateFromSelf, Schema.String);

const RoleSchema = Schema.NullOr(Schema.String).pipe(
  Schema.transform(Schema.String, {
    strict: true,
    decode: (value) => value ?? "viewer",
    encode: (value) => value,
  }),
);

export const AuthUserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  emailVerified: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  role: Schema.optionalWith(RoleSchema, { default: () => "viewer" }),
  image: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  createdAt: Schema.optional(DateOrString),
  updatedAt: Schema.optional(DateOrString),
});

export const AuthSessionDataSchema = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  token: Schema.optional(Schema.String),
  expiresAt: Schema.optional(DateOrString),
  createdAt: Schema.optional(DateOrString),
  updatedAt: Schema.optional(DateOrString),
});

export const AuthEnvelopeSchema = Schema.Struct({
  user: AuthUserSchema,
  session: AuthSessionDataSchema,
});

export type AuthUser = Schema.Schema.Type<typeof AuthUserSchema>;
export type AuthSessionData = Schema.Schema.Type<typeof AuthSessionDataSchema>;
export type AuthEnvelope = Schema.Schema.Type<typeof AuthEnvelopeSchema>;

const EmailFieldSchema = Schema.Trim.pipe(
  Schema.nonEmptyString({ message: () => "Email is required" }),
  Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, {
    message: () => "Please enter a valid email address",
  }),
);

const NameFieldSchema = Schema.Trim.pipe(
  Schema.nonEmptyString({ message: () => "Name is required" }),
  Schema.minLength(2, { message: () => "Name must be at least 2 characters" }),
);

const PasswordFieldSchema = Schema.String.annotations({
  message: () => "Password is required",
}).pipe(
  Schema.filter((value) => value.trim().length > 0, {
    message: () => "Password is required",
  }),
  Schema.minLength(6, { message: () => "Password must be at least 6 characters" }),
);

export const SignInSchema = Schema.Struct({
  email: EmailFieldSchema,
  password: PasswordFieldSchema,
});

export const SignUpSchema = Schema.Struct({
  name: NameFieldSchema,
  email: EmailFieldSchema,
  password: PasswordFieldSchema,
});

export type SignInInput = Schema.Schema.Type<typeof SignInSchema>;
export type SignUpInput = Schema.Schema.Type<typeof SignUpSchema>;

function hasAsciiControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Validates that a redirect target is a strictly relative internal path.
 * Blocks protocol-relative (`//`), scheme URLs (`://`), backslashes (`\`),
 * ASCII control characters (WHATWG URL whitespace-stripping vectors), and
 * non-leading-slash paths to prevent open redirects.
 */
export function sanitizeRedirect(url?: string | string[] | null): string | null {
  const candidate = Array.isArray(url) ? url[0] : url;
  if (!candidate || typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("://") ||
    trimmed.includes("\\") ||
    hasAsciiControlCharacters(trimmed)
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "http://internal.invalid");
    if (parsed.origin !== "http://internal.invalid") {
      return null;
    }
  } catch {
    return null;
  }

  return trimmed;
}
