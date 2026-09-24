import { createContext, useContext } from "react";
import type { Artifact, Section, Workspace } from "../../../packages/domain/src";
import type { MuseApi } from "./api";
export type Detail =
  | { type: "file"; file: Artifact }
  | { type: "task"; taskId: string }
  | { type: "delegate" }
  | { type: "notifications" };
export interface WorkspaceContextValue {
  workspace: Workspace;
  api: MuseApi;
  section: Section;
  navigate: (section: Section) => void;
  refresh: () => Promise<void>;
  open: (detail: Detail) => void;
  close: () => void;
  notify: (message: string) => void;
  ask: (prompt: string) => void;
}
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace is unavailable");
  return context;
}
