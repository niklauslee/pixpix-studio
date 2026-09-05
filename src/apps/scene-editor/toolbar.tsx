import { useEditorStore } from "@/apps/scene-editor/store/editor-store";
import { Button } from "@/components/ui/button";
import { useKeymapStore } from "@/apps/scene-editor/store/keymap-store";
import {
  BringToFrontIcon,
  CircleIcon,
  CursorIcon,
  DuplicateIcon,
  LineIcon,
  MinusIcon,
  PenIcon,
  PlusIcon,
  RectangleIcon,
  RedoIcon,
  SendToBackIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
} from "@/components/icons";

export function Toolbar() {
  const activeHandler = useEditorStore((state) => state.activeHandler);
  const formattedKeys = useKeymapStore((state) => state.formattedKeys);

  return (
    <div className="w-full flex flex-col justify-start">
      <div className="w-full flex flex-row items-start justify-between px-4 py-3">
        <div className="text-xl flex flex-row items-start justify-center gap-1">
          <Button
            title={`Select ⎯ ${formattedKeys["tool:select"]}`}
            variant={activeHandler === "Select" ? "default" : "outline"}
            size="icon-sm"
            onClick={() => {
              window.app.editor.handlers.setActiveHandler("Select");
            }}
          >
            <CursorIcon />
          </Button>
          <Button
            title={`Rectangle ⎯ ${formattedKeys["tool:rectangle"]}`}
            variant={activeHandler === "Rectangle" ? "default" : "outline"}
            size="icon-sm"
            onClick={() => {
              window.app.editor.handlers.setActiveHandler("Rectangle");
            }}
          >
            <RectangleIcon />
          </Button>
          <Button
            title={`Ellipse ⎯ ${formattedKeys["tool:ellipse"]}`}
            variant={activeHandler === "Ellipse" ? "default" : "outline"}
            size="icon-sm"
            onClick={() => {
              window.app.editor.handlers.setActiveHandler("Ellipse");
            }}
          >
            <CircleIcon />
          </Button>
          <Button
            title={`Line ⎯ ${formattedKeys["tool:line"]}`}
            variant={activeHandler === "Line" ? "default" : "outline"}
            size="icon-sm"
            onClick={() => {
              window.app.editor.handlers.setActiveHandler("Line");
            }}
          >
            <LineIcon />
          </Button>
          <Button
            title={`Text ⎯ ${formattedKeys["tool:text"]}`}
            variant={activeHandler === "Text" ? "default" : "outline"}
            size="icon-sm"
            onClick={() => {
              window.app.editor.handlers.setActiveHandler("Text");
            }}
          >
            <TextIcon />
          </Button>
          <Button
            title={`Pen ⎯ ${formattedKeys["tool:pen"]}`}
            variant={activeHandler === "Pen" ? "default" : "outline"}
            size="icon-sm"
            onClick={() => {
              window.app.editor.handlers.setActiveHandler("Pen");
            }}
          >
            <PenIcon />
          </Button>
          {/* <Button
          variant={activeHandler === "Bitmap" ? "default" : "outline"}
          size="icon-sm"
          
          onClick={() => {
            window.app.editor.handlers.setActiveHandler("Bitmap");
          }}
        >
          <ImageIcon />
        </Button> */}
        </div>
        <div className="text-xl flex flex-row items-center justify-center gap-1">
          <Button
            title={`Zoom In ⎯ ${formattedKeys["view:zoom-in"]}`}
            variant="outline"
            size="icon-sm"
            onClick={() => {
              window.app.commands.execute("view:zoom-in");
            }}
          >
            <PlusIcon />
          </Button>
          <Button
            title={`Zoom Out ⎯ ${formattedKeys["view:zoom-out"]}`}
            variant="outline"
            size="icon-sm"
            onClick={() => {
              window.app.commands.execute("view:zoom-out");
            }}
          >
            <MinusIcon />
          </Button>
          <Button
            title={`Undo ⎯ ${formattedKeys["edit:undo"]}`}
            variant="outline"
            size="icon-sm"
            onClick={() => {
              window.app.editor.actions.undo();
            }}
          >
            <UndoIcon />
          </Button>
          <Button
            title={`Redo ⎯ ${formattedKeys["edit:redo"]}`}
            variant="outline"
            size="icon-sm"
            onClick={() => {
              window.app.editor.actions.redo();
            }}
          >
            <RedoIcon />
          </Button>
          <Button
            title={`Delete ⎯ ${formattedKeys["edit:delete"]}`}
            variant="outline"
            size="icon-sm"
            onClick={() => {
              window.app.editor.actions.delete();
            }}
          >
            <TrashIcon />
          </Button>
          <Button
            title={`Duplicate ⎯ ${formattedKeys["edit:duplicate"]}`}
            variant="outline"
            size="icon-sm"
            onClick={() => {
              window.app.editor.actions.duplicate();
            }}
          >
            <DuplicateIcon />
          </Button>
          <Button
            title={`Bring to Front ⎯ ${formattedKeys["align:bring-to-front"]}`}
            variant="outline"
            size="icon-sm"
            onClick={() => {
              window.app.editor.actions.bringToFront();
            }}
          >
            <BringToFrontIcon />
          </Button>
          <Button
            title={`Send to Back ⎯ ${formattedKeys["align:send-to-back"]}`}
            variant="outline"
            size="icon-sm"
            onClick={() => {
              window.app.editor.actions.sendToBack();
            }}
          >
            <SendToBackIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
