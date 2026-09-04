import { Editor, Manipulator, Controller } from "./editor";
import {
  LINE_STRATIFY_ANGLE_THRESHOLD,
  Color,
  ControllerPosition,
  Cursor,
} from "./consts";
import {
  type EllipseShape,
  ellipseCenterFromBounds,
  getBoundingRect,
  ShapeType,
  type LineShape,
  type PenShape,
  type Shape,
} from "./shapes";
import * as geometry from "./geometry";
import {
  drawBox,
  drawControlPoint,
  findControlPoint,
  findSegmentControlPoint,
  getControllerPosition,
  inControlPoint,
  reducePath,
} from "./utils";
import { containsPoint } from "./shapes";

/**
 * Controller for moving selections
 */
export class SelectionMoveController extends Controller {
  active(editor: Editor, shape: Shape): boolean {
    return editor.selection.size() > 1;
  }

  mouseIn(
    editor: Editor,
    shape: Shape,
    e: PointerEvent,
    point: number[],
  ): boolean {
    for (let s of editor.selection.get()) {
      if (containsPoint(s, point)) return true;
    }
    return false;
  }

  mouseCursor(
    editor: Editor,
    shape: Shape,
    e: PointerEvent,
    point: number[],
  ): [string, number] {
    return [Cursor.MOVE, 0];
  }

  initialize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.begin();
  }

  update(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    if (this.dxStep === 0 && this.dyStep === 0) return;
    const selections = editor.selection.get();
    editor.actions.move(selections, this.dxStep, this.dyStep, false);
    // const selections = editor.selection.get();
    // for (let s of selections) {
    //   editor.transform.assign(s, "left", s.left + this.dxStep);
    //   editor.transform.assign(s, "top", s.top + this.dyStep);
    //   switch (s.type) {
    //     case ShapeType.LINE: {
    //       const line = s as LineShape;
    //       editor.transform.assign(
    //         line,
    //         "path",
    //         geometry.movePath(line.path, this.dxStep, this.dyStep),
    //       );
    //       break;
    //     }
    //     case ShapeType.PEN: {
    //       const pen = s as PenShape;
    //       editor.transform.assign(
    //         pen,
    //         "points",
    //         geometry.movePath(pen.points, this.dxStep, this.dyStep),
    //       );
    //       break;
    //     }
    //   }
    // }
  }

  finalize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.end();
  }

  draw(editor: Editor, shape: Shape) {
    const r = editor.selection.getBoundingRect();
    drawBox(editor.gc, r, Color.SELECTION);
  }
}

/**
 * Moving controller for box-type shapes
 */
export class BoxMoveController extends Controller {
  mouseCursor(
    editor: Editor,
    shape: Shape,
    e: PointerEvent,
    point: number[],
  ): [string, number] {
    return [Cursor.MOVE, 0];
  }

  active(editor: Editor, shape: Shape) {
    return editor.selection.size() === 1 && editor.selection.isSelected(shape);
  }

  initialize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.begin();
  }

  update(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    if (this.dxStep === 0 && this.dyStep === 0) return;
    editor.transform.assign(shape, "left", shape.left + this.dxStep);
    editor.transform.assign(shape, "top", shape.top + this.dyStep);
  }

  finalize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.end();
  }

  draw(editor: Editor, shape: Shape) {
    let r = getBoundingRect(shape);
    drawBox(editor.gc, r, Color.SELECTION);
  }
}

/**
 * Options for box sizing controller
 */
interface BoxSizeControllerOptions {
  position: string;
  minSize: number;
}

/**
 * Sizing controller for box-type shapes
 */
export class BoxSizeController extends Controller {
  options: BoxSizeControllerOptions;
  initialRect: number[][] = [];

  constructor(
    manipulator: Manipulator,
    options: Partial<BoxSizeControllerOptions>,
  ) {
    super(manipulator);
    this.options = {
      position: ControllerPosition.RIGHT_BOTTOM,
      minSize: 1,
      ...options,
    };
  }

  active(editor: Editor, shape: Shape): boolean {
    return editor.selection.size() === 1 && editor.selection.isSelected(shape);
  }

  mouseIn(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    const p = [e.offsetX, e.offsetY];
    const cp = getControllerPosition(editor.gc, shape, this.options.position);
    return inControlPoint(p, cp);
  }

  mouseCursor(
    editor: Editor,
    shape: Shape,
    e: PointerEvent,
    point: number[],
  ): [string, number] {
    let angle = 0;
    switch (this.options.position) {
      case ControllerPosition.LEFT:
      case ControllerPosition.RIGHT:
        angle += 90;
        break;
      case ControllerPosition.LEFT_TOP:
      case ControllerPosition.RIGHT_BOTTOM:
        angle += 135;
        break;
      case ControllerPosition.RIGHT_TOP:
      case ControllerPosition.LEFT_BOTTOM:
        angle += 45;
        break;
    }
    angle = geometry.normalizeAngle(angle);
    if (angle >= 180) angle -= 180;
    return [Cursor.RESIZE, angle];
  }

  initialize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.begin();
    this.initialRect = getBoundingRect(shape);
  }

  update(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    if (this.dxStep === 0 && this.dyStep === 0) return;
    const r = geometry.copyRect(this.initialRect);
    // `r`'s corners are inclusive of the last pixel (see getBoundingRect()),
    // so geometry.width/height(r) reads one less than the actual size; the
    // min-size checks below compare against `min - 1` and clamp back to it
    // so the actual (width/height) ends up exactly `min`, not `min + 1`.
    const min = this.options.minSize;
    switch (this.options.position) {
      case ControllerPosition.TOP:
        r[0][1] += this.dy;
        if (geometry.height(r) < min - 1) r[0][1] = r[1][1] - (min - 1);
        break;
      case ControllerPosition.BOTTOM:
        r[1][1] += this.dy;
        if (geometry.height(r) < min - 1) r[1][1] = r[0][1] + (min - 1);
        break;
      case ControllerPosition.LEFT:
        r[0][0] += this.dx;
        if (geometry.width(r) < min - 1) r[0][0] = r[1][0] - (min - 1);
        break;
      case ControllerPosition.RIGHT:
        r[1][0] += this.dx;
        if (geometry.width(r) < min - 1) r[1][0] = r[0][0] + (min - 1);
        break;
      case ControllerPosition.LEFT_TOP:
        r[0][0] += this.dx;
        r[0][1] += this.dy;
        if (geometry.width(r) < min - 1) r[0][0] = r[1][0] - (min - 1);
        if (geometry.height(r) < min - 1) r[0][1] = r[1][1] - (min - 1);
        break;
      case ControllerPosition.RIGHT_TOP:
        r[1][0] += this.dx;
        r[0][1] += this.dy;
        if (geometry.width(r) < min - 1) r[1][0] = r[0][0] + (min - 1);
        if (geometry.height(r) < min - 1) r[0][1] = r[1][1] - (min - 1);
        break;
      case ControllerPosition.LEFT_BOTTOM:
        r[0][0] += this.dx;
        r[1][1] += this.dy;
        if (geometry.width(r) < min - 1) r[0][0] = r[1][0] - (min - 1);
        if (geometry.height(r) < min - 1) r[1][1] = r[0][1] + (min - 1);
        break;
      case ControllerPosition.RIGHT_BOTTOM:
        r[1][0] += this.dx;
        r[1][1] += this.dy;
        if (geometry.width(r) < min - 1) r[1][0] = r[0][0] + (min - 1);
        if (geometry.height(r) < min - 1) r[1][1] = r[0][1] + (min - 1);
        break;
    }
    const nr = geometry.normalizeRect(r);
    editor.transform.assign(shape, "left", nr[0][0]);
    editor.transform.assign(shape, "top", nr[0][1]);
    editor.transform.assign(shape, "width", geometry.width(nr) + 1);
    editor.transform.assign(shape, "height", geometry.height(nr) + 1);
  }

  finalize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.end();
  }

  draw(editor: Editor, shape: Shape) {
    const gc = editor.gc;
    const cp = getControllerPosition(gc, shape, this.options.position);
    drawControlPoint(gc, cp[0], cp[1]);
  }
}

/**
 * Moving controller for ellipse shape — keeps the center (x, y) in sync with
 * the bounding box (left, top).
 */
export class EllipseMoveController extends BoxMoveController {
  update(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    if (this.dxStep === 0 && this.dyStep === 0) return;
    const s = shape as EllipseShape;
    editor.transform.assign(shape, "left", shape.left + this.dxStep);
    editor.transform.assign(shape, "top", shape.top + this.dyStep);
    editor.transform.assign(s, "x", s.x + this.dxStep);
    editor.transform.assign(s, "y", s.y + this.dyStep);
  }
}

/**
 * Sizing controller for ellipse shape — moves only the dragged side of the
 * bounding box (the opposite side stays fixed, like `BoxSizeController`),
 * then re-fits the ellipse (center x/y, rx/ry) to the resulting box.
 * Movement is quantized to 2px steps so the box width/height (always odd,
 * per `ellipseBoundsFromCenter`) stay odd, which keeps rx/ry exact integers
 * with no rounding drift.
 */
export class EllipseSizeController extends BoxSizeController {
  update(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    if (this.dxStep === 0 && this.dyStep === 0) return;
    const r = geometry.copyRect(this.initialRect);
    const minRadius = Math.max(Math.floor((this.options.minSize - 1) / 2), 0);
    const min = minRadius * 2;
    const qdx = Math.round(this.dx / 2) * 2;
    const qdy = Math.round(this.dy / 2) * 2;
    switch (this.options.position) {
      case ControllerPosition.TOP:
        r[0][1] += qdy;
        if (geometry.height(r) < min) r[0][1] = r[1][1] - min;
        break;
      case ControllerPosition.BOTTOM:
        r[1][1] += qdy;
        if (geometry.height(r) < min) r[1][1] = r[0][1] + min;
        break;
      case ControllerPosition.LEFT:
        r[0][0] += qdx;
        if (geometry.width(r) < min) r[0][0] = r[1][0] - min;
        break;
      case ControllerPosition.RIGHT:
        r[1][0] += qdx;
        if (geometry.width(r) < min) r[1][0] = r[0][0] + min;
        break;
      case ControllerPosition.LEFT_TOP:
        r[0][0] += qdx;
        r[0][1] += qdy;
        if (geometry.width(r) < min) r[0][0] = r[1][0] - min;
        if (geometry.height(r) < min) r[0][1] = r[1][1] - min;
        break;
      case ControllerPosition.RIGHT_TOP:
        r[1][0] += qdx;
        r[0][1] += qdy;
        if (geometry.width(r) < min) r[1][0] = r[0][0] + min;
        if (geometry.height(r) < min) r[0][1] = r[1][1] - min;
        break;
      case ControllerPosition.LEFT_BOTTOM:
        r[0][0] += qdx;
        r[1][1] += qdy;
        if (geometry.width(r) < min) r[0][0] = r[1][0] - min;
        if (geometry.height(r) < min) r[1][1] = r[0][1] + min;
        break;
      case ControllerPosition.RIGHT_BOTTOM:
        r[1][0] += qdx;
        r[1][1] += qdy;
        if (geometry.width(r) < min) r[1][0] = r[0][0] + min;
        if (geometry.height(r) < min) r[1][1] = r[0][1] + min;
        break;
    }
    const nr = geometry.normalizeRect(r);
    const width = geometry.width(nr) + 1;
    const height = geometry.height(nr) + 1;
    const c = ellipseCenterFromBounds(nr[0][0], nr[0][1], width, height);
    editor.transform.assign(shape, "left", nr[0][0]);
    editor.transform.assign(shape, "top", nr[0][1]);
    editor.transform.assign(shape, "width", width);
    editor.transform.assign(shape, "height", height);
    editor.transform.assign(shape, "x", c.x);
    editor.transform.assign(shape, "y", c.y);
    editor.transform.assign(shape, "rx", c.rx);
    editor.transform.assign(shape, "ry", c.ry);
  }
}

/**
 * Moving controller for line shape
 */
export class LineMoveController extends Controller {
  active(editor: Editor, shape: Shape) {
    return editor.selection.size() === 1 && editor.selection.isSelected(shape);
  }

  mouseCursor(
    editor: Editor,
    shape: Shape,
    e: PointerEvent,
    point: number[],
  ): [string, number] {
    return [Cursor.MOVE, 0];
  }

  initialize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.begin();
  }

  update(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    if (this.dxStep === 0 && this.dyStep === 0) return;
    const s = shape as LineShape;
    editor.transform.assign(s, "left", s.left + this.dxStep);
    editor.transform.assign(s, "top", s.top + this.dyStep);
    editor.transform.assign(
      s,
      "path",
      geometry.movePath(s.path, this.dxStep, this.dyStep),
    );
  }

  finalize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.end();
  }

  draw(editor: Editor, shape: Shape) {
    const s = shape as LineShape;
    const r = getBoundingRect(s);
    drawBox(editor.gc, r, Color.SELECTION);
  }
}

/**
 * Moving controller for line's points shape
 */
export class LineMovePointController extends Controller {
  /**
   * current control point
   */
  controlPoint: number = -1;

  active(editor: Editor, shape: Shape): boolean {
    return (
      editor.selection.size() === 1 &&
      editor.selection.isSelected(shape) &&
      shape.type === ShapeType.LINE
    );
  }

  mouseIn(
    editor: Editor,
    shape: Shape,
    e: PointerEvent,
    point: number[],
  ): boolean {
    const p = [e.offsetX, e.offsetY];
    const s = shape as LineShape;
    let cpIndex = findControlPoint(editor.gc, s, p);
    if (cpIndex >= 0) {
      const cp = editor.gc.toCanvasCoord(s.path[cpIndex], true);
      return inControlPoint(p, cp);
    }
    return false;
  }

  mouseCursor(
    editor: Editor,
    shape: Shape,
    e: PointerEvent,
    point: number[],
  ): [string, number] {
    return [Cursor.POINTER, 0];
  }

  initialize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    const p = [e.offsetX, e.offsetY];
    this.controlPoint = findControlPoint(editor.gc, shape as LineShape, p);
    editor.transform.begin();
  }

  update(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    if (this.dxStep === 0 && this.dyStep === 0) return;
    const s = shape as LineShape;
    if (this.controlPoint < 0 || this.controlPoint >= s.path.length) return;
    const newPath = geometry.copyPath(s.path);
    newPath[this.controlPoint] = geometry.move(
      newPath[this.controlPoint],
      this.dxStep,
      this.dyStep,
    );
    const rect = geometry.boundingRect(newPath);
    editor.transform.assign(s, "path", newPath);
    editor.transform.assign(s, "left", rect[0][0]);
    editor.transform.assign(s, "top", rect[0][1]);
    editor.transform.assign(s, "width", geometry.width(rect) + 1);
    editor.transform.assign(s, "height", geometry.height(rect) + 1);
  }

  finalize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    const reducedPath = reducePath(
      (shape as LineShape).path,
      LINE_STRATIFY_ANGLE_THRESHOLD,
    );
    editor.transform.assign(shape, "path", reducedPath);
    editor.transform.end();
  }

  draw(editor: Editor, shape: Shape) {
    const s = shape as LineShape;
    for (let i = 0; i < s.path.length; i++) {
      const cp = editor.gc.toCanvasCoord(s.path[i], true);
      drawControlPoint(editor.gc, cp[0], cp[1], 1);
    }
  }
}

/**
 * Moving controller for adding a line point
 */
export class LineAddPointController extends Controller {
  /**
   * current control point
   */
  controlPoint: number = -1;

  /**
   * current control path
   */
  controlPath: number[][] = [];

  active(editor: Editor, shape: Shape): boolean {
    return (
      editor.selection.size() === 1 &&
      editor.selection.isSelected(shape) &&
      shape.type === ShapeType.LINE
    );
  }

  mouseIn(
    editor: Editor,
    shape: Shape,
    e: PointerEvent,
    point: number[],
  ): boolean {
    const p = [e.offsetX, e.offsetY];
    const s = shape as LineShape;
    const cp = findSegmentControlPoint(editor.gc, s, p);
    return cp >= 0;
  }

  mouseCursor(
    editor: Editor,
    shape: Shape,
    e: PointerEvent,
    point: number[],
  ): [string, number] {
    return [Cursor.POINTER, 0];
  }

  initialize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    const p = [e.offsetX, e.offsetY];
    this.controlPoint = findSegmentControlPoint(
      editor.gc,
      shape as LineShape,
      p,
    );
    this.controlPath = geometry.copyPath((shape as LineShape).path);
    editor.transform.begin();
  }

  update(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    if (this.dxStep === 0 && this.dyStep === 0) return;
    if (this.controlPoint < 0) return;
    const s = shape as LineShape;
    let newPath = geometry.copyPath(this.controlPath);
    newPath.splice(
      this.controlPoint + 1,
      0,
      geometry.quantize(
        geometry.mid(
          newPath[this.controlPoint],
          newPath[this.controlPoint + 1],
        ),
      ),
    );
    newPath[this.controlPoint + 1][0] += this.dx;
    newPath[this.controlPoint + 1][1] += this.dy;
    const rect = geometry.boundingRect(newPath);
    editor.transform.assign(s, "path", newPath);
    editor.transform.assign(s, "left", rect[0][0]);
    editor.transform.assign(s, "top", rect[0][1]);
    editor.transform.assign(s, "width", geometry.width(rect) + 1);
    editor.transform.assign(s, "height", geometry.height(rect) + 1);
  }

  finalize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.end();
  }

  draw(editor: Editor, shape: Shape) {
    const s = shape as LineShape;
    if (s.path.length > 1) {
      for (let i = 0; i < s.path.length - 1; i++) {
        const p1 = editor.gc.toCanvasCoord(s.path[i], true);
        const p2 = editor.gc.toCanvasCoord(s.path[i + 1], true);
        const mid = geometry.mid(p1, p2);
        drawControlPoint(editor.gc, mid[0], mid[1], 4);
      }
    }
  }
}

/**
 * Moving controller for pen shape
 */
export class PenMoveController extends Controller {
  active(editor: Editor, shape: Shape) {
    return editor.selection.size() === 1 && editor.selection.isSelected(shape);
  }

  mouseCursor(
    editor: Editor,
    shape: Shape,
    e: PointerEvent,
    point: number[],
  ): [string, number] {
    return [Cursor.MOVE, 0];
  }

  initialize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.begin();
  }

  update(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    if (this.dxStep === 0 && this.dyStep === 0) return;
    const s = shape as PenShape;
    editor.transform.assign(s, "left", s.left + this.dxStep);
    editor.transform.assign(s, "top", s.top + this.dyStep);
    editor.transform.assign(
      s,
      "points",
      geometry.movePath(s.points, this.dxStep, this.dyStep),
    );
  }

  finalize(editor: Editor, shape: Shape, e: PointerEvent, point: number[]) {
    editor.transform.end();
  }

  draw(editor: Editor, shape: Shape) {
    const s = shape as LineShape;
    const r = getBoundingRect(s);
    drawBox(editor.gc, r, Color.SELECTION);
  }
}
