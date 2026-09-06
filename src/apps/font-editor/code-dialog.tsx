import { useEffect } from "react";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  defaultGfxIdentifier,
  defaultU8g2Identifier,
  generateAdafruitGfxFont,
  generateU8g2Font,
} from "./code-generator";
import { useFontStore } from "./font-store";

type Target = "u8g2" | "gfx";

export interface FontCodeDialogState {
  open: boolean;
  target: Target;
  identifier: string;
  useProgmem: boolean;
  code: string;
  warnings: string[];
  setOpen: (open: boolean) => void;
  setTarget: (target: Target) => void;
  setIdentifier: (identifier: string) => void;
  setUseProgmem: (useProgmem: boolean) => void;
}

export const useFontCodeDialog = create<FontCodeDialogState>()((set) => ({
  open: false,
  target: "u8g2",
  identifier: "",
  useProgmem: true,
  code: "",
  warnings: [],
  setOpen: (open) => set({ open }),
  setTarget: (target) => set({ target }),
  setIdentifier: (identifier) => set({ identifier }),
  setUseProgmem: (useProgmem) => set({ useProgmem }),
}));

/** Opens the dialog, resetting the identifier field to match the current font and target. */
export function showFontCodeDialog() {
  const font = useFontStore.getState().font;
  const target = useFontCodeDialog.getState().target;
  useFontCodeDialog.setState({
    open: true,
    identifier:
      target === "u8g2"
        ? defaultU8g2Identifier(font)
        : defaultGfxIdentifier(font),
  });
}

export function FontCodeDialog() {
  const {
    open,
    target,
    identifier,
    useProgmem,
    code,
    warnings,
    setOpen,
    setTarget,
    setIdentifier,
    setUseProgmem,
  } = useFontCodeDialog();
  const font = useFontStore((state) => state.font);

  useEffect(() => {
    if (!open) return;
    const result =
      target === "u8g2"
        ? generateU8g2Font(font, identifier || defaultU8g2Identifier(font))
        : generateAdafruitGfxFont(
            font,
            identifier || defaultGfxIdentifier(font),
            useProgmem,
          );
    useFontCodeDialog.setState({
      code: result.code,
      warnings: result.warnings,
    });
    // `code`/`warnings` are derived, not inputs — excluding them keeps this from looping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target, identifier, useProgmem, font]);

  const switchTarget = (next: Target) => {
    if (next === target) return;
    setTarget(next);
    setIdentifier(
      next === "u8g2"
        ? defaultU8g2Identifier(font)
        : defaultGfxIdentifier(font),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="fixed h-130 max-h-full w-4xl max-w-full sm:max-h-full sm:max-w-full">
        <DialogHeader className="absolute inset-x-0 top-0 h-auto w-full border-b-[1.5px] p-4">
          <DialogTitle>Code</DialogTitle>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 py-2">
              <div className="flex gap-2">
                <Button
                  variant={target === "u8g2" ? "default" : "outline"}
                  onClick={() => switchTarget("u8g2")}
                >
                  u8g2
                </Button>
                <Button
                  variant={target === "gfx" ? "default" : "outline"}
                  onClick={() => switchTarget("gfx")}
                >
                  Adafruit GFX
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(code)}
              >
                Copy Code
              </Button>
            </div>
            <div className="flex items-center gap-4 py-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Identifier
                </span>
                <TextField
                  className="h-7 w-56"
                  value={identifier}
                  onChange={setIdentifier}
                  placeholder={
                    target === "u8g2"
                      ? defaultU8g2Identifier(font)
                      : defaultGfxIdentifier(font)
                  }
                />
              </div>
              {target === "gfx" && (
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={useProgmem}
                    onCheckedChange={(value) => setUseProgmem(value === true)}
                  />
                  Use PROGMEM
                </label>
              )}
            </div>
            {warnings.length > 0 && (
              <div className="flex flex-col gap-0.5 text-xs text-amber-400">
                {warnings.map((warning, index) => (
                  <span key={index}>⚠ {warning}</span>
                ))}
              </div>
            )}
          </div>
        </DialogHeader>
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ top: warnings.length > 0 ? "9.5rem" : "8rem" }}
        >
          <SyntaxHighlighter
            className="h-full w-full text-sm"
            language="c"
            style={oneDark}
            customStyle={{
              backgroundColor: "var(--popover)",
              margin: 0,
            }}
            codeTagProps={{}}
            showLineNumbers={true}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
