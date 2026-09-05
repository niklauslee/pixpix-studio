import * as React from "react";
import type { IconProps } from "./type";

const Pipette = ({ size = 24, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 9 9"
    width={size}
    height={size}
    fill="none"
    {...props}
  >
    <g fill="currentColor">
      <rect x="4" y="0" width="1" height="1"/>
      <rect x="3" y="1" width="1" height="1"/>
      <rect x="5" y="1" width="1" height="1"/>
      <rect x="3" y="2" width="1" height="1"/>
      <rect x="5" y="2" width="1" height="1"/>
      <rect x="2" y="3" width="1" height="1"/>
      <rect x="6" y="3" width="1" height="1"/>
      <rect x="2" y="4" width="5" height="1"/>
      <rect x="3" y="5" width="1" height="1"/>
      <rect x="5" y="5" width="1" height="1"/>
      <rect x="3" y="6" width="1" height="1"/>
      <rect x="5" y="6" width="1" height="1"/>
      <rect x="3" y="7" width="1" height="1"/>
      <rect x="5" y="7" width="1" height="1"/>
      <rect x="4" y="8" width="1" height="1"/>
    </g>
  </svg>
);

export default Pipette;
