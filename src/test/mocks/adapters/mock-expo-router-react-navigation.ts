import { createContext, useContext } from "react";

export const HeaderHeightContext = createContext<number | undefined>(undefined);

export function useHeaderHeight(): number {
  const height = useContext(HeaderHeightContext);
  if (height === undefined) {
    throw new Error(
      "Couldn't find the header height. Are you inside a screen in a navigator with a header?",
    );
  }
  return height;
}
