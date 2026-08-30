/**
 * Generates standalone SVG and React (TypeScript) component output for a
 * single icon — `currentColor` fill, `viewBox` matching the icon's own box,
 * no background. Unlike `code-generator.ts`'s XBM export (which packs bits
 * for u8g2 and can emit every icon in the set at once), these operate on one
 * icon at a time since SVG is inherently a single-image format.
 */

import { sanitizeIdentifier, type Box, type Icon } from "./icon";

/** Row run-length encoding of an icon's "on" pixels into `<rect>` strings. */
function iconRects(box: Box, icon: Icon): string[] {
  const rects: string[] = [];
  for (let row = 0; row < box.h; row++) {
    let runStart = -1;
    for (let col = 0; col <= box.w; col++) {
      const on = col < box.w && icon.pixels[row * box.w + col];
      if (on && runStart === -1) {
        runStart = col;
      } else if (!on && runStart !== -1) {
        rects.push(
          `<rect x="${runStart}" y="${row}" width="${col - runStart}" height="1"/>`,
        );
        runStart = -1;
      }
    }
  }
  return rects;
}

/** Standalone SVG for one icon: transparent background, currentColor fill. */
export function generateIconSVG(box: Box, icon: Icon): string {
  const rects = iconRects(box, icon).join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.w} ${box.h}" width="${box.w}" height="${box.h}" fill="none">`,
    `<g fill="currentColor">${rects}</g>`,
    `</svg>`,
  ].join("");
}

/** PascalCase component name derived from the icon's name, e.g. "arrow-up" -> "ArrowUp". */
export function componentName(icon: Icon): string {
  const pascal = sanitizeIdentifier(icon.name)
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  return /^[A-Za-z]/.test(pascal) ? pascal : `Icon${pascal}`;
}

/** TypeScript React component source for one icon; `size` sets width & height. */
export function generateReactComponent(box: Box, icon: Icon): string {
  const name = componentName(icon);
  const rects = iconRects(box, icon)
    .map((rect) => `      ${rect}`)
    .join("\n");
  return `import * as React from "react";

export interface ${name}Props extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

const ${name} = ({ size = 24, ...props }: ${name}Props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 ${box.w} ${box.h}"
    width={size}
    height={size}
    fill="none"
    {...props}
  >
    <g fill="currentColor">
${rects}
    </g>
  </svg>
);

export default ${name};
`;
}
