import { type ComponentRef, createElement, forwardRef } from "react";
import { View } from "react-native";

const MockSvgElement = forwardRef<ComponentRef<typeof View>, Record<string, unknown>>(
  (props, ref) => createElement(View, { ...props, ref }),
);
MockSvgElement.displayName = "MockSvgElement";

export const Svg = MockSvgElement;
export const Circle = MockSvgElement;
export const Ellipse = MockSvgElement;
export const G = MockSvgElement;
export const Text = MockSvgElement;
export const TSpan = MockSvgElement;
export const TextPath = MockSvgElement;
export const Path = MockSvgElement;
export const Polygon = MockSvgElement;
export const Polyline = MockSvgElement;
export const Line = MockSvgElement;
export const Rect = MockSvgElement;
export const Use = MockSvgElement;
export const Image = MockSvgElement;
export const Defs = MockSvgElement;
export const LinearGradient = MockSvgElement;
export const RadialGradient = MockSvgElement;
export const Stop = MockSvgElement;
export const ClipPath = MockSvgElement;
export const Pattern = MockSvgElement;
export const Mask = MockSvgElement;

export { MockSvgElement as Symbol };
export default Svg;
