import { type ComponentRef, createElement, forwardRef } from "react";
import { View } from "react-native";

const MockIconBase = forwardRef<ComponentRef<typeof View>, Record<string, unknown>>((props, ref) =>
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
export const Camera = MockIconBase;
export const Check = MockIconBase;
export const CheckCircle2 = MockIconBase;
export const CheckSquare = MockIconBase;
export const ChevronDown = MockIconBase;
export const ChevronRight = MockIconBase;
export const ChevronUp = MockIconBase;
export const Circle = MockIconBase;
export const Clock = MockIconBase;
export const Compass = MockIconBase;
export const Download = MockIconBase;
export const ExternalLink = MockIconBase;
export const Eye = MockIconBase;
export const EyeOff = MockIconBase;
export const FileText = MockIconBase;
export const FolderOpen = MockIconBase;
export const Home = MockIconBase;
export const Image = MockIconBase;
export const Info = MockIconBase;
export const Layers = MockIconBase;
export const ListTodo = MockIconBase;
export const Lock = MockIconBase;
export const LogIn = MockIconBase;
export const LogOut = MockIconBase;
export const Monitor = MockIconBase;
export const Moon = MockIconBase;
export const MoreVertical = MockIconBase;
export const Palette = MockIconBase;
export const Paperclip = MockIconBase;
export const Plus = MockIconBase;
export const Radio = MockIconBase;
export const RefreshCw = MockIconBase;
export const Share2 = MockIconBase;
export const Shield = MockIconBase;
export const ShieldAlert = MockIconBase;
export const SlidersHorizontal = MockIconBase;
export const Sparkles = MockIconBase;
export const Sun = MockIconBase;
export const Trash2 = MockIconBase;
export const Type = MockIconBase;
export const Upload = MockIconBase;
export const UserPlus = MockIconBase;
export const WifiOff = MockIconBase;
export const X = MockIconBase;

export default lucideProxy;
