import { createElement, forwardRef } from "react";
import { View } from "react-native";

const MockIconBase = forwardRef<View, Record<string, unknown>>((props, ref) =>
  createElement(View, { ...props, ref }),
);
MockIconBase.displayName = "MockLucideIcon";

const lucideProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "__esModule") return true;
      if (typeof prop !== "string") return undefined;
      return MockIconBase;
    },
  },
);

export const AlertCircle = MockIconBase;
export const AlertTriangle = MockIconBase;
export const ArrowLeft = MockIconBase;
export const ArrowRight = MockIconBase;
export const Bell = MockIconBase;
export const Check = MockIconBase;
export const CheckCircle2 = MockIconBase;
export const CheckSquare = MockIconBase;
export const ChevronDown = MockIconBase;
export const ChevronRight = MockIconBase;
export const ChevronUp = MockIconBase;
export const Circle = MockIconBase;
export const Compass = MockIconBase;
export const FolderOpen = MockIconBase;
export const Home = MockIconBase;
export const Info = MockIconBase;
export const Layers = MockIconBase;
export const Lock = MockIconBase;
export const LogIn = MockIconBase;
export const LogOut = MockIconBase;
export const Monitor = MockIconBase;
export const Moon = MockIconBase;
export const MoreVertical = MockIconBase;
export const Palette = MockIconBase;
export const Shield = MockIconBase;
export const ShieldAlert = MockIconBase;
export const SlidersHorizontal = MockIconBase;
export const Sparkles = MockIconBase;
export const Sun = MockIconBase;
export const Type = MockIconBase;
export const UserPlus = MockIconBase;
export const X = MockIconBase;

export default lucideProxy;
