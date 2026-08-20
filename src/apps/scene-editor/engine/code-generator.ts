import type { Editor } from "@/components/editor/editor";
import {
  ShapeType,
  type RectangleShape,
  type EllipseShape,
  type LineShape,
  type TextShape,
  type PenShape,
  type Shape,
} from "@/components/editor/shapes";

export interface U8g2State {
  drawColor: number;
  font: string;
  fontDirection: number;
}

export interface U8g2Options {
  lang: "c" | "cpp";
  useProgmem: boolean;
}

const u8g2FontMap: Record<string, string> = {
  "4x6": "u8g2_font_4x6_tr",
  "5x7": "u8g2_font_5x7_tr",
  "5x8": "u8g2_font_5x8_tr",
  "6x10": "u8g2_font_6x10_tr",
  "6x12": "u8g2_font_6x12_tr",
  "6x13": "u8g2_font_6x13_tr",
  "6x13B": "u8g2_font_6x13B_tr",
  "6x13O": "u8g2_font_6x13O_tr",
  ProFont10: "u8g2_font_profont10_tr",
  ProFont11: "u8g2_font_profont11_tr",
  ProFont12: "u8g2_font_profont12_tr",
  ProFont15: "u8g2_font_profont15_tr",
  ProFont17: "u8g2_font_profont17_tr",
  ProFont22: "u8g2_font_profont22_tr",
  ProFont29: "u8g2_font_profont29_tr",
  micro: "u8g2_font_micro_tr",
};

/**
 * Escapes a string for use in a C string literal
 */
function escapeCString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(
      /[\x00-\x1f\x7f]/g,
      (c) => "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0"),
    );
}

/**
 * Converts a string into a valid C identifier by replacing invalid characters with underscores
 */
function toCIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
}

/**
 * Code generator class
 */
export class CodeGenerator {
  toU8g2Color(color: number): number {
    return color < 0 ? 2 : color;
  }

  toU8g2Font(font: string): string {
    return u8g2FontMap[font] ?? "u8g2_font_6x10_tr";
  }

  /**
   * Converts a pen shape's points into a packed 1-bpp XBM-compatible bitmap,
   * suitable for use with u8g2.drawXBM().
   */
  toU8g2BitmapCode(pen: PenShape): string[] {
    const { left, top, width, height } = pen;
    const bytesPerRow = Math.ceil(width / 8);
    const bitmap = new Uint8Array(bytesPerRow * height);
    for (const [px, py] of pen.points) {
      const x = px - left;
      const y = py - top;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const byteIndex = y * bytesPerRow + Math.floor(x / 8);
      const bit = x % 8;
      bitmap[byteIndex] |= 1 << bit;
    }
    const bitmapArray = Array.from(bitmap).map(
      (b) => `0x${b.toString(16).padStart(2, "0")}`,
    );
    return bitmapArray;
  }

  generateU8g2SetDrawColor(
    lines: string[],
    state: U8g2State,
    shape: Shape,
    options: U8g2Options,
  ): string[] {
    const { color } = shape;
    if (state.drawColor !== color) {
      if (options.lang === "c") {
        lines.push(`u8g2_SetDrawColor(&u8g2, ${this.toU8g2Color(color)});`);
      } else if (options.lang === "cpp") {
        lines.push(`u8g2.setDrawColor(${this.toU8g2Color(color)});`);
      }
      state.drawColor = color;
    }
    return lines;
  }

  generateU8g2SetFont(
    lines: string[],
    state: U8g2State,
    shape: TextShape,
    options: U8g2Options,
  ): string[] {
    if (state.font !== shape.font) {
      if (options.lang === "c") {
        lines.push(`u8g2_SetFont(&u8g2, ${this.toU8g2Font(shape.font)});`);
      } else if (options.lang === "cpp") {
        lines.push(`u8g2.setFont(${this.toU8g2Font(shape.font)});`);
      }
      state.font = shape.font;
    }
    if (state.fontDirection !== shape.direction) {
      if (options.lang === "c") {
        lines.push(`u8g2_SetFontDirection(&u8g2, ${shape.direction});`);
      } else if (options.lang === "cpp") {
        lines.push(`u8g2.setFontDirection(${shape.direction});`);
      }
      state.fontDirection = shape.direction;
    }
    return lines;
  }

  generateU8g2Rectangle(
    editor: Editor,
    state: U8g2State,
    shape: RectangleShape,
    options: U8g2Options,
  ): string[] {
    const lines: string[] = [];
    lines.push(`// ${shape.name}`);
    const { left, top, width, height, color } = shape;
    this.generateU8g2SetDrawColor(lines, state, shape, options);
    if (shape.fill) {
      if (options.lang === "c") {
        lines.push(
          `u8g2_DrawBox(&u8g2, ${left}, ${top}, ${width}, ${height});`,
        );
      } else if (options.lang === "cpp") {
        lines.push(`u8g2.drawBox(${left}, ${top}, ${width}, ${height});`);
      }
    } else {
      if (options.lang === "c") {
        lines.push(
          `u8g2_DrawFrame(&u8g2, ${left}, ${top}, ${width}, ${height});`,
        );
      } else if (options.lang === "cpp") {
        lines.push(`u8g2.drawFrame(${left}, ${top}, ${width}, ${height});`);
      }
    }
    return lines;
  }

  generateU8g2Ellipse(
    editor: Editor,
    state: U8g2State,
    shape: EllipseShape,
    options: U8g2Options,
  ): string[] {
    const lines: string[] = [];
    lines.push(`// ${shape.name}`);
    const { x: cx, y: cy, rx, ry } = shape;
    this.generateU8g2SetDrawColor(lines, state, shape, options);
    if (shape.fill) {
      if (options.lang === "c") {
        lines.push(
          `u8g2_DrawFilledEllipse(&u8g2, ${cx}, ${cy}, ${rx}, ${ry});`,
        );
      } else if (options.lang === "cpp") {
        lines.push(`u8g2.drawFilledEllipse(${cx}, ${cy}, ${rx}, ${ry});`);
      }
    } else {
      if (options.lang === "c") {
        lines.push(`u8g2_DrawEllipse(&u8g2, ${cx}, ${cy}, ${rx}, ${ry});`);
      } else if (options.lang === "cpp") {
        lines.push(`u8g2.drawEllipse(${cx}, ${cy}, ${rx}, ${ry});`);
      }
    }
    return lines;
  }

  generateU8g2Line(
    editor: Editor,
    state: U8g2State,
    shape: LineShape,
    options: U8g2Options,
  ): string[] {
    const lines: string[] = [];
    lines.push(`// ${shape.name}`);
    const { color } = shape;
    this.generateU8g2SetDrawColor(lines, state, shape, options);
    if (shape.path.length > 1) {
      for (let i = 0; i < shape.path.length - 1; i++) {
        const [x1, y1] = shape.path[i];
        const [x2, y2] = shape.path[i + 1];
        if (options.lang === "c") {
          lines.push(`u8g2_DrawLine(&u8g2, ${x1}, ${y1}, ${x2}, ${y2});`);
        } else if (options.lang === "cpp") {
          lines.push(`u8g2.drawLine(${x1}, ${y1}, ${x2}, ${y2});`);
        }
      }
      if (shape.closed) {
        const [x1, y1] = shape.path[shape.path.length - 1];
        const [x2, y2] = shape.path[0];
        if (options.lang === "c") {
          lines.push(`u8g2_DrawLine(&u8g2, ${x1}, ${y1}, ${x2}, ${y2});`);
        } else if (options.lang === "cpp") {
          lines.push(`u8g2.drawLine(${x1}, ${y1}, ${x2}, ${y2});`);
        }
      }
    }
    return lines;
  }

  generateU8g2Text(
    editor: Editor,
    state: U8g2State,
    shape: TextShape,
    options: U8g2Options,
  ): string[] {
    const lines: string[] = [];
    lines.push(`// ${shape.name}`);
    const { left, top, width, height, direction, text } = shape;
    const metric = editor.gc.metricText(text);
    // +1 compensates for the difference between this app's baseline metric
    // and u8g2's own baseline reference row
    const baseline = metric.baseline + 1;
    const right = left + width;
    const bottom = top + height;
    let x: number;
    let y: number;
    switch (direction) {
      case 1:
        x = right - baseline;
        y = top;
        break;
      case 2:
        x = right;
        y = bottom - baseline;
        break;
      case 3:
        x = left + baseline;
        y = bottom;
        break;
      default:
        x = left;
        y = top + baseline;
    }
    this.generateU8g2SetDrawColor(lines, state, shape, options);
    this.generateU8g2SetFont(lines, state, shape, options);
    if (options.lang === "c") {
      lines.push(`u8g2_DrawStr(&u8g2, ${x}, ${y}, "${escapeCString(text)}");`);
    } else if (options.lang === "cpp") {
      lines.push(`u8g2.drawStr(${x}, ${y}, "${escapeCString(text)}");`);
    }
    return lines;
  }

  generateU8g2Pen(
    editor: Editor,
    state: U8g2State,
    shape: PenShape,
    options: U8g2Options,
  ): string[] {
    const lines: string[] = [];
    lines.push(`// ${shape.name}`);
    const { left, top, width, height, color } = shape;
    this.generateU8g2SetDrawColor(lines, state, shape, options);
    const bitmapArray = this.toU8g2BitmapCode(shape);
    if (options.lang === "c") {
      lines.push(
        `u8g2_DrawXBM(&u8g2, ${left}, ${top}, ${width}, ${height}, ${toCIdentifier(shape.name)}_bits);`,
      );
    } else if (options.lang === "cpp") {
      if (options.useProgmem) {
        lines.push(
          `u8g2.drawXBMP(${left}, ${top}, ${width}, ${height}, ${toCIdentifier(shape.name)}_bits);`,
        );
      } else {
        lines.push(
          `u8g2.drawXBM(${left}, ${top}, ${width}, ${height}, ${toCIdentifier(shape.name)}_bits);`,
        );
      }
    }

    return lines;
  }

  /**
   * Generates U8g2 code
   */
  generateU8g2(editor: Editor, options: U8g2Options): string {
    const state: U8g2State = {
      drawColor: 1,
      font: "u8g2_font_ncenB14_tr",
      fontDirection: 0,
    };
    const lines: string[] = [];
    lines.push("// [BEGIN] generated by Pixpix");
    const shapes = editor.store.shapes;
    // generate predefines for each shape
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      if (shape.type === ShapeType.PEN) {
        const bitmapArray = this.toU8g2BitmapCode(shape as PenShape);
        if (options.lang === "c") {
          lines.push(
            `static const uint8_t ${toCIdentifier(shape.name)}_bits[] = {${bitmapArray.join(",")}};`,
          );
        } else if (options.lang === "cpp") {
          lines.push(
            `static const unsigned char ${toCIdentifier(shape.name)}_bits[]${options.lang === "cpp" && options.useProgmem ? " U8X8_PROGMEM" : ""} = {${bitmapArray.join(",")}};`,
          );
        }
      }
    }
    // generate initial code for C lang
    if (options.lang === "c") {
      lines.push("u8g2_ClearBuffer(&u8g2);");
      lines.push("u8g2_SetBitmapMode(&u8g2, 1);");
      lines.push("u8g2_SetFontMode(&u8g2, 1);");
    } else if (options.lang === "cpp") {
      lines.push("u8g2.clearBuffer();");
      lines.push("u8g2.setBitmapMode(1);");
      lines.push("u8g2.setFontMode(1);");
    }
    // generate code for each shape
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      switch (shape.type) {
        case ShapeType.RECTANGLE:
          lines.push(
            ...this.generateU8g2Rectangle(
              editor,
              state,
              shape as RectangleShape,
              options,
            ),
          );
          break;
        case ShapeType.ELLIPSE:
          lines.push(
            ...this.generateU8g2Ellipse(
              editor,
              state,
              shape as EllipseShape,
              options,
            ),
          );
          break;
        case ShapeType.LINE:
          lines.push(
            ...this.generateU8g2Line(
              editor,
              state,
              shape as LineShape,
              options,
            ),
          );
          break;
        case ShapeType.TEXT:
          lines.push(
            ...this.generateU8g2Text(
              editor,
              state,
              shape as TextShape,
              options,
            ),
          );
          break;
        case ShapeType.PEN:
          lines.push(
            ...this.generateU8g2Pen(editor, state, shape as PenShape, options),
          );
          break;
        default:
          console.warn(`Unknown shape type: ${shape.type}`);
      }
    }
    // generate flush
    if (options.lang === "c") {
      lines.push("u8g2_SendBuffer(&u8g2);");
    } else if (options.lang === "cpp") {
      lines.push("u8g2.sendBuffer();");
    }
    lines.push("// [END] generated by Pixpix");
    return lines.join("\n");
  }

  /**
   * Generates XBM code
   */
  generateXBM(editor: Editor): string {
    const lines: string[] = [];
    lines.push("// [BEGIN] generated by Pixpix");
    lines.push(`#define bitmap_width ${editor.gc.width}`);
    lines.push(`#define bitmap_height ${editor.gc.height}`);
    const buffer = editor.gc.buffer;
    const bitmapArray = Array.from(buffer).map(
      (b) => `0x${b.toString(16).padStart(2, "0")}`,
    );
    lines.push(
      `static const unsigned char bitmap[] = {${bitmapArray.join(",")}};`,
    );
    lines.push("// [END] generated by Pixpix");
    return lines.join("\n");
  }
}
