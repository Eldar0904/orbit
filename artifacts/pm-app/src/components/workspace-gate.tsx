import { useAuth } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMyWorkspaces, setWorkspaceId } from "@workspace/api-client-react";
import { useEffect, useState, type ReactNode } from "react";

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { userId, isLoaded } = useAuth();
  const client = useQueryClient();
  const [selected, select] = useState<{ user: string; id: number } | null>(null);
  const workspaces = useQuery({ queryKey: ["workspace-memberships", userId], queryFn: () => listMyWorkspaces(), enabled: !!userId, retry: false });
  useEffect(() => {
    if (!userId) { setWorkspaceId(null); select(null); return; }
    const remembered = Number(sessionStorage.getItem(`orbit.workspace.${userId}`));
    const id = workspaces.data?.find(w => w.id === remembered)?.id ?? (workspaces.data?.length === 1 ? workspaces.data[0].id : null);
    if (id && (!selected || selected.user !== userId)) { setWorkspaceId(id); select({ user: userId, id }); }
  }, [userId, workspaces.data, selected]);
  if (!isLoaded || !userId) return <>{children}</>;
  if (workspaces.isPending) return <p className="p-8">Загрузка рабочих пространств…</p>;
  if (workspaces.isError) return <div className="p-8 space-y-3"><h1>Не удалось проверить доступ</h1><p>Проверьте соединение и настройку API.</p><button onClick={() => workspaces.refetch()}>Повторить</button></div>;
  if (!workspaces.data?.length) return <div className="p-8 space-y-3"><h1>Доступ ещё не назначен</h1><p>Администратор должен назначить ваше рабочее пространство. Старые проекты не привязываются к аккаунту автоматически.</p></div>;
  const current = selected?.user === userId && workspaces.data.some(w => w.id === selected.id) ? selected.id : null;
  return <>
    <div className="border-b bg-slate-50 px-6 py-2 text-sm flex items-center gap-3">
      <label htmlFor="workspace-select">Рабочее пространство</label>
      <select id="workspace-select" className="border rounded p-1" value={current ?? ""} onChange={e => {
        const id = Number(e.target.value); if (!workspaces.data?.some(w => w.id === id)) return;
        setWorkspaceId(id); sessionStorage.setItem(`orbit.workspace.${userId}`, String(id));
        client.removeQueries({ predicate: query => query.queryKey[0] !== "workspace-memberships" });
        select({ user: userId, id });
      }}><option value="" disabled>Выберите пространство</option>{workspaces.data.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
    </div>
    {current ? <div key={`${userId}:${current}`}>{children}</div> : <p className="p-8">Выберите рабочее пространство.</p>}
  </>;
}
