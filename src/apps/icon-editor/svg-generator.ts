/**
 * Generates standalone SVG and React (TypeScript) component output — always
 * `currentColor` fill, `viewBox` matching the icon's own box, no background.
 * SVG is inherently a single-image format so `generateIconSVG` takes one icon;
 * the React side additionally has `generateReactBundle`, which emits the whole
 * set as a set of files (one component per icon plus a shared `type.ts` and an
 * `index.ts` barrel) for `@/lib/zip` to pack.
 */

import { sanitizeIdentifier, type Box, type Icon } from "./icon";
import type { ZipEntry } from "@/lib/zip";

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
function componentName(icon: Icon): string {
  const pascal = sanitizeIdentifier(icon.name)
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  return /^[A-Za-z]/.test(pascal) ? pascal : `Icon${pascal}`;
}

/**
 * kebab-case file base name for one icon, e.g. "Arrow Up" -> "arrow-up",
 * matching the naming in `src/components/icons/`. Not `sanitizeIdentifier`,
 * which targets C identifiers and turns every separator into `_`.
 */
function fileBaseName(icon: Icon): string {
  const kebab = icon.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!kebab) return "icon";
  return /^[0-9]/.test(kebab) ? `icon-${kebab}` : kebab;
}

/** TypeScript React component source for one icon; `size` sets width & height. */
function generateReactComponent(box: Box, icon: Icon, name: string) {
  const rects = iconRects(box, icon)
    .map((rect) => `      ${rect}`)
    .join("\n");
  return `import * as React from "react";
import type { IconProps } from "./type";

const ${name} = ({ size = 24, ...props }: IconProps) => (
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

/** The shared props type every generated component imports. */
function generateIconTypes(): string {
  return `import { type SVGProps } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}
`;
}

/** Append `2`, `3`, … until the candidate is unused; records what it returns. */
function unique(used: Set<string>, candidate: string, separator = ""): string {
  let name = candidate;
  let suffix = 2;
  while (used.has(name)) name = `${candidate}${separator}${suffix++}`;
  used.add(name);
  return name;
}

/**
 * The whole set as React source files: one `.tsx` per icon, the shared
 * `type.ts`, and an `index.ts` barrel. Names are de-duplicated because two
 * distinct icon names can normalize to the same file/component name
 * ("arrow up" and "arrow-up" both become "arrow-up"/"ArrowUp").
 */
export function generateReactBundle(box: Box, icons: Icon[]): ZipEntry[] {
  const usedFiles = new Set<string>();
  const usedComponents = new Set<string>();
  const usedExports = new Set<string>();
  const files: ZipEntry[] = [];
  const exports: string[] = [];

  for (const icon of icons) {
    const base = unique(usedFiles, fileBaseName(icon), "-");
    const component = unique(usedComponents, componentName(icon));
    files.push({
      name: `${base}.tsx`,
      content: generateReactComponent(box, icon, component),
    });
    const exported = unique(
      usedExports,
      component.endsWith("Icon") ? component : `${component}Icon`,
    );
    exports.push(`export { default as ${exported} } from "./${base}";`);
  }

  files.push({ name: "type.ts", content: generateIconTypes() });
  exports.push(`export type { IconProps } from "./type";`);
  files.push({ name: "index.ts", content: `${exports.join("\n")}\n` });
  return files;
}
