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

export const CheckSquare = MockIconBase;
export const FolderOpen = MockIconBase;
export const Home = MockIconBase;
export const Lock = MockIconBase;
export const LogIn = MockIconBase;
export const LogOut = MockIconBase;
export const Moon = MockIconBase;
export const Palette = MockIconBase;
export const ShieldAlert = MockIconBase;
export const Sparkles = MockIconBase;
export const Sun = MockIconBase;
export const UserPlus = MockIconBase;
export const ArrowRight = MockIconBase;
export const ArrowLeft = MockIconBase;
export const Compass = MockIconBase;
export const Shield = MockIconBase;
export const Radio = MockIconBase;
export const Plus = MockIconBase;
export const Trash2 = MockIconBase;
export const Check = MockIconBase;
export const Circle = MockIconBase;
export const WifiOff = MockIconBase;
export const RefreshCw = MockIconBase;
export const AlertCircle = MockIconBase;
export const ListTodo = MockIconBase;

export default lucideProxy;
