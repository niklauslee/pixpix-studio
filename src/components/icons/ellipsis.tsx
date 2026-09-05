import * as React from "react";
import type { IconProps } from "./type";

const Ellipsis = ({ size = 24, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 9 9"
    width={size}
    height={size}
    fill="none"
    {...props}
  >
    <g fill="currentColor">
      <rect x="1" y="4" width="1" height="1"/>
      <rect x="4" y="4" width="1" height="1"/>
      <rect x="7" y="4" width="1" height="1"/>
    </g>
  </svg>
);

export default Ellipsis;
