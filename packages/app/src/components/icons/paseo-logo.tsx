import Svg, { Path, Rect } from "react-native-svg";

interface SuperAgentLogoProps {
  size?: number;
  color?: string;
}

// World of Water capital S on red background
export function SuperAgentLogo({ size = 64 }: SuperAgentLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Rect width="512" height="512" rx="80" ry="80" fill="#CC1100" />
      <Path
        transform="translate(163.88,376.60) scale(0.335000,-0.335000)"
        d="M36 0C83 -9 142 -12 193 -12C336 -12 522 18 522 204C522 268 495 311 453 343C393 389 308 413 244 441C199 461 166 482 166 516C166 573 236 594 343 594C387 594 430 590 474 581V700C429 709 384 712 338 712C195 712 -1 682 -1 496C-1 432 26 389 68 357C128 311 213 287 277 259C322 239 355 218 355 184C355 127 285 106 178 106C134 106 91 110 47 119V0Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}
