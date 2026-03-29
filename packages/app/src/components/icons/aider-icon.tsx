import Svg, { Path } from "react-native-svg";

interface AiderIconProps {
  size?: number;
  color?: string;
}

export function AiderIcon({ size = 16, color = "currentColor" }: AiderIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path
        d="M9 3.75h5.25V4.5H9V3.75Zm-.75.75h6v2.25h-6V4.5Zm6 3h2.25v3h-2.25v-3Zm-6 3h8.25v3h-8.25v-3Zm-1.5 3h1.5v3h-1.5v-3Zm7.5 0h2.25v3h-2.25v-3Zm-6 3h6v3h-6v-3Zm8.25 0H18v3h-1.5v-3Z"
      />
    </Svg>
  );
}
