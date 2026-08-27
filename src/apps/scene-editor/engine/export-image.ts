import type { Editor } from "@/components/editor/editor";

/**
 * Renders the editor's framebuffer (no grid/border/margin, unlike the
 * on-screen canvas) as a black/white PNG blob. `scale` upsizes each
 * framebuffer pixel into an `scale`x`scale` block of output pixels.
 */
export function exportPNG(editor: Editor, scale: number = 1): Promise<Blob> {
  const { width, height } = editor.gc;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to create canvas context");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FFFFFF";
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (editor.gc.getPixel(x, y) !== 0) {
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to create PNG blob"));
    }, "image/png");
  });
}

/**
 * Generates SVG markup for the editor's framebuffer (no grid/border/margin).
 * Each row of "on" pixels is run-length encoded into one <rect> per run,
 * instead of one <rect> per pixel.
 */
export function generateSVG(editor: Editor): string {
  const { width, height } = editor.gc;
  const rects: string[] = [];
  for (let y = 0; y < height; y++) {
    let runStart = -1;
    for (let x = 0; x <= width; x++) {
      const on = x < width && editor.gc.getPixel(x, y) !== 0;
      if (on && runStart === -1) {
        runStart = x;
      } else if (!on && runStart !== -1) {
        rects.push(
          `<rect x="${runStart}" y="${y}" width="${x - runStart}" height="1"/>`,
        );
        runStart = -1;
      }
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#000000"/>`,
    `<g fill="#FFFFFF">${rects.join("")}</g>`,
    `</svg>`,
  ].join("");
}
