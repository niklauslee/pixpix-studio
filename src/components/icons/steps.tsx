import * as React from "react";
import type { IconProps } from "./type";

const Steps = ({ size = 24, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 9 9"
    width={size}
    height={size}
    fill="none"
    {...props}
  >
    <g fill="currentColor">
      <rect x="1" y="1" width="1" height="1"/>
      <rect x="3" y="1" width="1" height="1"/>
      <rect x="1" y="2" width="3" height="1"/>
      <rect x="2" y="3" width="1" height="1"/>
      <rect x="1" y="4" width="2" height="1"/>
      <rect x="4" y="4" width="1" height="1"/>
      <rect x="6" y="4" width="1" height="1"/>
      <rect x="4" y="5" width="3" height="1"/>
      <rect x="5" y="6" width="1" height="1"/>
      <rect x="5" y="7" width="2" height="1"/>
    </g>
  </svg>
);

export default Steps;
