import { useEffect } from "react";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Checkbox } from "../ui/checkbox";
import type { U8g2Options } from "@/apps/scene-editor/engine/code-generator";

export interface CodeDialogState {
  open: boolean;
  target: string;
  code: string;
  options: U8g2Options;
  setOpen: (open: boolean) => void;
  setTarget: (target: string) => void;
  setCode: (code: string) => void;
  setOptions: (options: U8g2Options) => void;
}

export const useCodeDialog = create<CodeDialogState>()(
  devtools(
    (set, get) => ({
      open: false,
      target: "u8g2",
      code: "",
      options: {
        useProgmem: true,
        lang: "cpp",
      },
      setOpen: (open) => {
        set((state) => ({ open }));
      },
      setTarget: (target) => {
        set((state) => ({ target }));
      },
      setCode: (code) => {
        set((state) => ({ code }));
      },
      setOptions: (options) => {
        set((state) => ({ options }));
      },
    }),
    { name: "CodeDialogStore" },
  ),
);

export function CodeDialog() {
  const {
    open,
    code,
    target,
    options,
    setOpen,
    setTarget,
    setCode,
    setOptions,
  } = useCodeDialog();

  const langItems = [
    { value: "cpp", label: "C++ (Arduino)" },
    { value: "c", label: "C" },
  ];

  useEffect(() => {
    if (open) {
      const app = window.app;
      if (app) {
        if (target === "u8g2") {
          const generatedCode = app.codeGenerator.generateU8g2(
            app.editor,
            options,
          );
          setCode(generatedCode);
        } else if (target === "xbm") {
          const generatedCode = app.codeGenerator.generateXBM(app.editor);
          setCode(generatedCode);
        }
      }
    }
  }, [open, target, options]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="fixed w-4xl h-130 max-w-full sm:max-w-full max-h-full sm:max-h-full">
        <DialogHeader className="absolute inset-x-0 top-0 w-full h-36 p-4 border-b-[1.5px]">
          <DialogTitle>Code</DialogTitle>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between py-2">
              <div className="flex gap-2">
                <Button
                  variant={target === "u8g2" ? "default" : "outline"}
                  onClick={() => setTarget("u8g2")}
                >
                  u8g2
                </Button>
                <Button
                  variant={target === "xbm" ? "default" : "outline"}
                  onClick={() => setTarget("xbm")}
                >
                  XBM
                </Button>
              </div>
              <div>
                <Button
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(code)}
                >
                  Copy Code
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-start gap-4 py-1">
              {target === "u8g2" && (
                <>
                  <div className="flex items-center gap-2">
                    <Select
                      items={langItems}
                      value={options.lang ?? "cpp"}
                      onValueChange={(value) =>
                        setOptions({ ...options, lang: value ?? "cpp" })
                      }
                    >
                      <SelectTrigger className="w-full" title="Target Language">
                        <SelectValue placeholder="Font" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {langItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  {options.lang === "cpp" && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={options.useProgmem}
                        onCheckedChange={(value) => {
                          setOptions({ ...options, useProgmem: value });
                        }}
                      />{" "}
                      Use PROGMEM
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="absolute inset-x-0 top-36 bottom-0">
          <SyntaxHighlighter
            className="h-full w-full text-sm"
            language="javascript"
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
