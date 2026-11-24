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
