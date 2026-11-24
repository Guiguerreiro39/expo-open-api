import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-family": [
        {
          font: [
            "sans",
            "sans-medium",
            "sans-semibold",
            "sans-bold",
            "display",
            "mono",
            "mono-bold",
          ],
        },
      ],
      "font-size": [
        {
          text: [
            "display-lg",
            "headline-xl",
            "headline-lg",
            "headline-md",
            "headline-sm",
            "title-md",
            "body-lg",
            "body-md",
            "body-sm",
            "label-lg",
            "label-md",
            "label-sm",
          ],
        },
      ],
      shadow: [{ shadow: ["tactile"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const EXPLICIT_BORDER_WIDTH_TOKEN_REGEX = /^border-(?:0|2|4|8|\[.+\])$/;

/**
 * Resolves preset-aligned border width class overrides so plain `"border"` cannot silently
 * downgrade a 2px preset (e.g. `neo-brutalist`) while explicit widths (`border-0`, `border-4`)
 * remain respected.
 */
export function resolvePresetBorderOverride(
  className: string | undefined,
  presetBorderWidth: number,
  options?: { readonly applyDefault?: boolean },
): string | undefined {
  let lastWidthToken: string | undefined;
  if (className) {
    for (const token of className.trim().split(/\s+/)) {
      if (token === "border" || EXPLICIT_BORDER_WIDTH_TOKEN_REGEX.test(token)) {
        lastWidthToken = token;
      }
    }
  }

  if (lastWidthToken && lastWidthToken !== "border") {
    return undefined;
  }

  if (presetBorderWidth >= 2) {
    return lastWidthToken === "border" || options?.applyDefault ? "border-2" : undefined;
  }

  return options?.applyDefault && !lastWidthToken ? "border" : undefined;
}
