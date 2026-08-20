import { useCallback, useEffect, useState } from "react";
import { SaveIcon } from "lucide-react";
import { app, AppContext } from "@/apps/scene-editor/app-context";
import { Editor } from "@/components/editor/editor";
import { EditorComponent } from "@/components/editor/editor-component";
import {
  ConfirmDialog,
  useConfirmDialog,
} from "@/components/dialogs/confirm-dialog";
import { Layout } from "./layout";
import { Toolbar } from "./toolbar";
import { Appbar } from "@/components/appbar";
import { PropertiesPanel } from "./properties";
import type { ShapeProps } from "@/components/editor/shapes";
import { useEditorStore } from "@/apps/scene-editor/store/editor-store";
import { LayersPanel } from "./layers";
import { ScrollAreaBoth } from "@/components/ui/scroll-area-both";
import { CodeDialog, useCodeDialog } from "@/components/dialogs/code-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    app: AppContext;
  }
}

interface SceneEditorUser {
  name: string;
  image?: string | null;
}

interface InitialScene {
  id: string;
  name: string;
  data: string;
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new Error(await response.text());
  return response;
}

function App({
  user,
  initialScene,
}: {
  user: SceneEditorUser | null;
  initialScene: InitialScene | null;
}) {
  const selection = useEditorStore((state) => state.selection);
  // for ui update when actions are performed
  const actionSequence = useEditorStore((state) => state.actionSequence);
  const [notice, setNotice] = useState("");
  const [savedId, setSavedId] = useState<string | null>(
    initialScene?.id ?? null,
  );
  const [savedName, setSavedName] = useState(initialScene?.name ?? "");
  const [saving, setSaving] = useState(false);
  // actionSequence value as of the last successful save, to detect unsaved edits
  const [savedActionSequence, setSavedActionSequence] = useState(0);
  const dirty = actionSequence !== savedActionSequence;

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(""), 3000);
  };

  useEffect(() => {
    document.title = savedName
      ? `Pixpix Scene Editor — ${savedName}`
      : "Pixpix Scene Editor";
  }, [savedName]);

  const handleMount = async (editor: Editor) => {
    await app.initialize(
      editor,
      initialScene ? JSON.parse(initialScene.data) : undefined,
    );
    editor.fit();
    editor.repaint();
  };

  const handlePropsChange = (props: ShapeProps) => {
    try {
      const app = window.app;
      app.editor.actions.update(props);
    } catch (error) {
      console.error("Error handling props change:", error);
    }
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const data = JSON.stringify(window.app.editor.saveToJSON());
      if (savedId) {
        await api(`/api/scenes/${savedId}`, {
          method: "PATCH",
          body: JSON.stringify({ data }),
        });
      } else {
        const response = await api("/api/scenes", {
          method: "POST",
          body: JSON.stringify({ name: savedName || "untitled", data }),
        });
        const created: { id: string; name: string } = await response.json();
        setSavedId(created.id);
        setSavedName(created.name);
        history.replaceState(null, "", `/scene?id=${created.id}`);
      }
      setSavedActionSequence(actionSequence);
    } catch (error) {
      console.error("Failed to save the scene:", error);
      flash("Save failed");
    } finally {
      setSaving(false);
    }
  }, [savedId, savedName, actionSequence]);

  // warn before leaving the page (closing the tab or navigating to another
  // URL) while there are edits that haven't been saved
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  // auto-save 10s after the last edit, once signed in
  useEffect(() => {
    if (!user || !dirty || saving) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 10000);
    return () => clearTimeout(timer);
  }, [user, dirty, saving, handleSave]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (user && !saving && dirty) handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [user, saving, dirty, handleSave]);

  return (
    <>
      <Layout
        appbar={
          <Appbar active="scene">
            {savedName && (
              <span
                className="max-w-48 truncate pr-2 text-xs text-muted-foreground"
                title={savedName}
              >
                {savedName}
              </span>
            )}
            <Button
              variant="outline"
              onClick={() => {
                useConfirmDialog
                  .getState()
                  .show(
                    "Clear Canvas",
                    "Are you sure you want to clear the canvas? This action cannot be undone.",
                    () => {
                      window.app.editor.clear();
                      window.app.updateUI();
                    },
                  );
              }}
            >
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                useCodeDialog.getState().setOpen(true);
              }}
            >
              Code
            </Button>
            {user ? (
              <Button
                variant="outline"
                title={
                  savedId
                    ? "Save changes to your account"
                    : "Save this scene to your account"
                }
                disabled={saving || !dirty}
                onClick={handleSave}
              >
                <SaveIcon className="size-3.5" />
                {saving ? "Saving…" : "Save"}
              </Button>
            ) : (
              <a
                href="/login"
                title="Sign in to save scenes to your account"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Sign in to Save
              </a>
            )}
            {notice && (
              <span className="pl-2 text-xs text-muted-foreground">
                {notice}
              </span>
            )}
          </Appbar>
        }
        leftSidebar={
          <LayersPanel className="border-r-[1.5px] border-neutral-700" />
        }
        rightSidebar={
          <PropertiesPanel
            className="border-l-[1.5px] border-neutral-700"
            selection={selection}
            onChange={handlePropsChange}
          />
        }
        onContentResize={() => {
          // setTimeout(() => window.app?.editor.fit());
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-start w-full h-full">
          <div className="border-b-[1.5px] border-neutral-700 absolute inset-x-0 top-0 h-14 w-full flex flex-col justify-start">
            <Toolbar />
          </div>
          <div className="absolute inset-x-0 top-14 bottom-0 flex items-center justify-center">
            <ScrollAreaBoth className="w-full h-full flex items-center justify-center">
              <div className="w-full h-full flex items-start justify-center">
                <EditorComponent onMount={handleMount} />
              </div>
            </ScrollAreaBoth>
          </div>
        </div>
      </Layout>
      <ConfirmDialog />
      <CodeDialog />
    </>
  );
}

export default App;
