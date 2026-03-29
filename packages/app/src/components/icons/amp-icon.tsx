import Svg, { Path } from "react-native-svg";

interface AmpIconProps {
  size?: number;
  color?: string;
}

export function AmpIcon({ size = 16, color = "currentColor" }: AmpIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="m9.686 6.949 2.907.775-1.98-7.404-3.353.903 1.194 4.49a1.94 1.94 0 0 0 1.232 1.236Z"
      />
      <Path
        fill={color}
        d="m4.771 22 6.34-6.327 2.307 8.62 3.352-.903L13.432 10.87.912 7.533 0 10.906l8.61 2.3-6.31 6.317L4.77 22Z"
      />
      <Path
        fill={color}
        d="m13.254 11.707.778 2.917a1.937 1.937 0 0 0 1.23 1.234l4.511 1.199.89-3.37-7.409-1.98Z"
      />
      <Path
        fill={color}
        d="m15.916 2.484-2.883 2.88a2.063 2.063 0 0 0-.512 1.193l-.046 1.825 1.69.06-.022-.001c.463 0 .898-.181 1.225-.507L18.35 4.95l-2.434-2.467Z"
      />
    </Svg>
  );
}
