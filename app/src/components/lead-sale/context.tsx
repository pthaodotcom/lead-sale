import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { execute, getStorageError, useDatabase } from "./store";
import type { Command, Database, Member } from "./types";

interface Workspace {
  db: Database;
  actor: Member;
  setActor: (id: string) => void;
  run: (command: Command, message?: string) => boolean;
}
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const db = useDatabase();
  const [actorId, setActorId] = useState(() => {
    try {
      return sessionStorage.getItem("lead-sale.actor") ?? "admin";
    } catch {
      return "admin";
    }
  });
  const actor =
    db.members.find((m) => m.id === actorId && m.active) ??
    db.members.find((m) => m.active && m.role === "admin")!;
  const setActor = (id: string) => {
    sessionStorage.setItem("lead-sale.actor", id);
    setActorId(id);
  };
  const run = (command: Command, message?: string) => {
    try {
      execute(actor.id, command);
      if (message) toast.success(message);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Chưa thể lưu thay đổi. Vui lòng thử lại.",
      );
      return false;
    }
  };
  useEffect(() => {
    if (getStorageError()) {
      toast.error(getStorageError());
      return;
    }
    const expire = () => {
      if (
        db.assignments.some(
          (t) => t.status !== "Closed" && Date.parse(t.expiresAt) <= Date.now(),
        )
      ) {
        try {
          execute(actor.id, { type: "expire" });
        } catch (error) {
          toast.error(String(error));
        }
      }
    };
    expire();
    const timer = window.setInterval(expire, 60000);
    return () => clearInterval(timer);
  }, [actor.id, db.assignments]);
  return (
    <Context.Provider value={{ db, actor, setActor, run }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing WorkspaceProvider");
  return value;
}
