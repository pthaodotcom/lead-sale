import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { execute, getDatabase, getStorageError } from "./store";
import { demoMode, supabase, loadWorkspace, sendCommand } from "./backend";
import { AuthScreen } from "./AuthScreen";
import type { Command, Database, Member } from "./types";
interface Workspace {
  db: Database;
  actor: Member;
  busy: boolean;
  cloud: boolean;
  setActor: (id: string) => void;
  run: (command: Command, message?: string) => Promise<boolean>;
  perform: (command: Command) => Promise<void>;
  refresh: () => Promise<void>;
}
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState(getDatabase);
  const dbRef = useRef(db);
  dbRef.current = db;
  const [actor, setActorState] = useState<Member | undefined>(() =>
    demoMode
      ? db.members.find(
          (m) =>
            m.id === (sessionStorage.getItem("lead-sale.actor") ?? "admin") &&
            m.active,
        )
      : undefined,
  );
  const [loading, setLoading] = useState(!demoMode);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (!supabase) return;
    const next = await loadWorkspace();
    setDb(next);
    dbRef.current = next;
    setActorState(next.actor);
    setError("");
  }, []);
  useEffect(() => {
    if (demoMode) return;
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    const init = async () => {
      const { data } = await supabase!.auth.getSession();
      if (!active) return;
      setSignedIn(!!data.session);
      if (data.session)
        try {
          await refresh();
        } catch (e) {
          setError((e as Error).message);
          setActorState(undefined);
        }
      else {
        setActorState(undefined);
        setDb(getDatabase());
      }
      if (active) setLoading(false);
    };
    void init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (active) void init();
      }, 0);
    });
    const timer = setInterval(() => {
      if (active) void init();
    }, 60000);
    return () => {
      active = false;
      subscription.unsubscribe();
      clearInterval(timer);
    };
  }, [refresh]);
  const setActor = (id: string) => {
    if (!demoMode) return;
    const next = db.members.find((m) => m.id === id && m.active);
    if (next) {
      sessionStorage.setItem("lead-sale.actor", id);
      setActorState(next);
    }
  };
  const perform = async (command: Command) => {
    if (!actor) throw new Error("Đăng nhập trước khi thao tác.");
    if (supabase) {
      await sendCommand(command, dbRef.current);
      await refresh();
    } else {
      if (!demoMode) throw new Error("Chưa cấu hình Supabase.");
      execute(actor.id, command);
      const next = getDatabase();
      dbRef.current = next;
      setDb(next);
    }
  };
  const run = async (command: Command, message?: string) => {
    setBusy(true);
    try {
      await perform(command);
      if (message) toast.success(message);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!demoMode || !actor) return;
    if (getStorageError()) {
      setError(getStorageError());
      return;
    }
    const timer = setInterval(() => {
      try {
        execute(actor.id, { type: "expire" });
        setDb(getDatabase());
      } catch (e) {
        setError((e as Error).message);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [actor?.id]);
  if (loading)
    return (
      <div className="auth-screen">
        <p role="status">Đang tải không gian Lead Sale…</p>
      </div>
    );
  if (!actor)
    return (
      <AuthScreen
        configured={!!supabase}
        signedIn={signedIn}
        error={error}
        onRetry={refresh}
      />
    );
  return (
    <Context.Provider
      value={{
        db,
        actor,
        busy,
        cloud: !!supabase,
        setActor,
        run,
        perform,
        refresh,
      }}
    >
      {error && <p role="alert">{error}</p>}
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing WorkspaceProvider");
  return value;
}
