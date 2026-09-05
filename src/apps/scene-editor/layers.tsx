import { cn } from "@/lib/utils";
import { ShapeType, type Shape } from "@/components/editor/shapes";
import {
  RectangleIcon,
  CircleIcon,
  LineIcon,
  TextIcon,
  ImageIcon,
  PenIcon,
} from "@/components/icons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditorStore } from "@/apps/scene-editor/store/editor-store";

interface LayersPanelProps extends React.HTMLAttributes<HTMLDivElement> {}

const LayerItem: React.FC<{
  shape: Shape;
  selected: boolean;
}> = ({ shape, selected = false }) => {
  return (
    <div
      className={cn(
        "text-sm h-8 w-full flex items-center justify-start gap-2 px-4 cursor-pointer hover:bg-neutral-800",
        selected && "bg-neutral-700",
      )}
      onClick={() => {
        const clickedShape = window.app.editor.store.getShapeById(shape.id)!;
        if (clickedShape) {
          window.app.editor.selection.clear();
          window.app.editor.selection.select(clickedShape);
          window.app.editor.repaint();
        }
      }}
    >
      <div className="min-w-4 min-h-4 flex items-center justify-center">
        {shape.type === ShapeType.RECTANGLE && <RectangleIcon size={14} />}
        {shape.type === ShapeType.ELLIPSE && <CircleIcon size={14} />}
        {shape.type === ShapeType.LINE && <LineIcon size={14} />}
        {shape.type === ShapeType.TEXT && <TextIcon size={14} />}
        {shape.type === ShapeType.PEN && <PenIcon size={14} />}
        {shape.type === ShapeType.BITMAP && <ImageIcon size={14} />}
      </div>
      <div className="truncate">{shape.name}</div>
    </div>
  );
};

export const LayersPanel: React.FC<LayersPanelProps> = ({ className }) => {
  const shapes = useEditorStore((state) => state.shapes).toReversed();
  const selection = useEditorStore((state) => state.selection);

  return (
    <div className={cn("absolute inset-0", className)}>
      <div className="absolute inset-x-0 top-0 h-10 flex items-center px-4">
        <div>Layers</div>
      </div>
      <div className="absolute inset-x-0 top-8 bottom-0">
        <ScrollArea className="w-full h-full">
          {shapes.length === 0 && (
            <div className="px-4 h-8 mt-2 text-sm text-muted-foreground/60">
              No shapes
            </div>
          )}
          <div className="flex flex-col gap-0 py-2">
            {shapes.map((shape) => (
              <LayerItem
                key={shape.id}
                shape={shape}
                selected={selection.some((s) => s.id === shape.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
