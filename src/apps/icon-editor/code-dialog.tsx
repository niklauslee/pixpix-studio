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
import { findIcon } from "./icon";
import { generateXBM } from "./code-generator";
import { useIconStore } from "./icon-store";

type Scope = "all" | "selected";

export interface IconCodeDialogState {
  open: boolean;
  lang: "c" | "cpp";
  useProgmem: boolean;
  scope: Scope;
  code: string;
  setOpen: (open: boolean) => void;
  setLang: (lang: "c" | "cpp") => void;
  setUseProgmem: (useProgmem: boolean) => void;
  setScope: (scope: Scope) => void;
}

export const useIconCodeDialog = create<IconCodeDialogState>()((set) => ({
  open: false,
  lang: "cpp",
  useProgmem: true,
  scope: "all",
  code: "",
  setOpen: (open) => set({ open }),
  setLang: (lang) => set({ lang }),
  setUseProgmem: (useProgmem) => set({ useProgmem }),
  setScope: (scope) => set({ scope }),
}));

export function showIconCodeDialog() {
  useIconCodeDialog.setState({ open: true });
}

export function IconCodeDialog() {
  const {
    open,
    lang,
    useProgmem,
    scope,
    code,
    setOpen,
    setLang,
    setUseProgmem,
    setScope,
  } = useIconCodeDialog();
  const project = useIconStore((state) => state.project);
  const name = useIconStore((state) => state.name);

  const langItems = [
    { value: "cpp", label: "C++ (Arduino)" },
    { value: "c", label: "C" },
  ];
  const scopeItems = [
    { value: "all", label: "All icons" },
    { value: "selected", label: "Selected icon only" },
  ];

  useEffect(() => {
    if (!open) return;
    const icon = findIcon(project, name);
    const icons = scope === "selected" ? (icon ? [icon] : []) : project.icons;
    const generated = generateXBM(project.box, icons, { lang, useProgmem });
    useIconCodeDialog.setState({ code: generated });
    // `code` is derived, not an input — excluding it keeps this from looping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lang, useProgmem, scope, project, name]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="fixed w-4xl h-130 max-w-full sm:max-w-full max-h-full sm:max-h-full">
        <DialogHeader className="absolute inset-x-0 top-0 w-full h-36 p-4 border-b-[1.5px]">
          <DialogTitle>Code</DialogTitle>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between py-2">
              <div className="flex items-center gap-2">
                <Select
                  items={scopeItems}
                  value={scope}
                  onValueChange={(value) => setScope((value ?? "all") as Scope)}
                >
                  <SelectTrigger className="w-full" title="Icons to export">
                    <SelectValue placeholder="Scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {scopeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
              <div className="flex items-center gap-2">
                <Select
                  items={langItems}
                  value={lang}
                  onValueChange={(value) =>
                    setLang((value ?? "cpp") as "c" | "cpp")
                  }
                >
                  <SelectTrigger className="w-full" title="Target Language">
                    <SelectValue placeholder="Language" />
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
              {lang === "cpp" && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={useProgmem}
                    onCheckedChange={(value) => setUseProgmem(value === true)}
                  />{" "}
                  Use PROGMEM
                </div>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="absolute inset-x-0 top-36 bottom-0">
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
