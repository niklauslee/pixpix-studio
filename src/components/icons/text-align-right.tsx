import * as React from "react";
import type { IconProps } from "./type";

const TextAlignRight = ({ size = 24, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 9 9"
    width={size}
    height={size}
    fill="none"
    {...props}
  >
    <g fill="currentColor">
      <rect x="2" y="1" width="7" height="1"/>
      <rect x="4" y="4" width="5" height="1"/>
      <rect x="0" y="7" width="9" height="1"/>
    </g>
  </svg>
);

export default TextAlignRight;
