import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetWorkspaceAccess, useListEquipmentSites, useListEquipmentRooms,
  useGetEquipmentSummary, useListEquipmentImports, useGetEquipmentImport,
  createEquipmentRoom, stageEquipmentImport, type EquipmentImportInput,
  getGetEquipmentImportQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function EquipmentTab({ projectId }: { projectId: number }) {
  const access = useGetWorkspaceAccess();
  const sites = useListEquipmentSites(projectId);
  const summary = useGetEquipmentSummary(projectId);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [section, setSection] = useState<"sites" | "imports">("sites");
  const canWrite = access.data?.writableProjectIds.includes(projectId) ?? false;
  const activeSite = sites.data?.find(s => s.id === siteId) ?? sites.data?.[0];
  return <div className="space-y-5">
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <strong>Основание для работы, не утверждённая смета.</strong> Количества, бюджет и платежи ожидают подтверждения. Исходная Google-книга используется только для чтения.
    </div>
    {summary.isError || sites.isError ? <p role="alert">Не удалось загрузить данные оснащения. Проверьте доступ и миграцию базы.</p> : null}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[['Объектов', summary.data?.sites], ['Помещений', summary.data?.rooms], ['Валюта отчёта', summary.data?.reportingCurrency], ['Утверждённый бюджет', 'Не подтверждён']].map(([name, value]) => <Card key={String(name)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{name}</p><p className="text-lg font-semibold mt-2">{value ?? '—'}</p></CardContent></Card>)}
    </div>
    <div className="flex gap-2"><Button variant={section === 'sites' ? 'default' : 'outline'} onClick={() => setSection('sites')}>Объекты и помещения</Button>{access.data?.canReviewImports && <Button variant={section === 'imports' ? 'default' : 'outline'} onClick={() => setSection('imports')}>Проверка импорта</Button>}</div>
    {section === 'sites' ? <div className="grid md:grid-cols-[220px_1fr] gap-4">
      <div className="space-y-2">{sites.data?.map(s => <button key={s.id} onClick={() => setSiteId(s.id)} className={`block w-full text-left border rounded-lg p-3 ${activeSite?.id === s.id ? 'bg-primary/10 border-primary' : 'bg-card'}`}><strong>{s.name}</strong><span className="block text-xs text-muted-foreground">{s.region}</span></button>)}</div>
      {activeSite ? <Rooms key={activeSite.id} projectId={projectId} siteId={activeSite.id} name={activeSite.name} canWrite={canWrite} /> : <p>Загрузка объектов…</p>}
    </div> : access.data?.canReviewImports ? <Imports projectId={projectId} canWrite={canWrite} /> : null}
  </div>;
}

function Rooms({ projectId, siteId, name, canWrite }: { projectId: number; siteId: number; name: string; canWrite: boolean }) {
  const rooms = useListEquipmentRooms(projectId, siteId);
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const values = new FormData(form);
    setPending(true); setError('');
    try {
      await createEquipmentRoom(projectId, siteId, { code: String(values.get('code')), name: String(values.get('name')), numberText: String(values.get('number') ?? ''), areaM2: values.get('area') ? String(values.get('area')).replace(',', '.') : null });
      await client.invalidateQueries(); form.reset();
    } catch { setError('Не удалось сохранить. Проверьте уникальность кода и площадь с точностью до двух знаков.'); }
    finally { setPending(false); }
  }
  return <Card><CardContent className="p-5 space-y-4"><h3 className="text-lg font-bold">{name}</h3>
    {rooms.isError ? <p role="alert">Не удалось загрузить помещения.</p> : <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Помещение</th><th>№</th><th>Площадь, м²</th><th>Проверка</th></tr></thead><tbody>{rooms.data?.map(r => <tr className="border-b" key={r.id}><td className="p-2">{r.name}</td><td>{r.numberText || '—'}</td><td>{r.areaM2 ?? '—'}</td><td>Не проверено</td></tr>)}</tbody></table>{!rooms.data?.length && <p className="py-6 text-muted-foreground">Помещения ещё не внесены. Импорт не создаёт утверждённые записи автоматически.</p>}</div>}
    {canWrite && <form onSubmit={save} className="border-t pt-4 space-y-3"><h4 className="font-medium">Добавить помещение</h4><div className="grid sm:grid-cols-2 gap-3">
      <Input name="code" aria-label="Уникальный код помещения" placeholder="Код: hall-108" pattern="[a-z0-9-]{1,50}" required />
      <Input name="name" aria-label="Название помещения" placeholder="Название" required maxLength={300} />
      <Input name="number" aria-label="Номер помещения" placeholder="Номер (текст)" maxLength={100} />
      <Input name="area" aria-label="Площадь помещения" placeholder="Площадь: 28.50" inputMode="decimal" />
    </div>{error && <p role="alert" className="text-red-700">{error}</p>}<Button disabled={pending}>{pending ? 'Сохранение…' : 'Сохранить непроверенный паспорт'}</Button></form>}
  </CardContent></Card>;
}

function Imports({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const batches = useListEquipmentImports(projectId);
  const [batchId, setBatchId] = useState<number | null>(null);
  const batch = useGetEquipmentImport(projectId, batchId ?? 0, { query: { queryKey: getGetEquipmentImportQueryKey(projectId, batchId ?? 0), enabled: batchId !== null } });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const client = useQueryClient();
  const rows = batch.data?.payload?.rows;
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Загрузите подготовленные JSON-кандидаты (до 2 МБ и 2 000 строк). Они сохраняются для проверки. Утверждение, запись оплат и обратная отправка в Google Sheets отсутствуют.</p>
    {canWrite && <label className="block border rounded-lg p-4">{pending ? 'Проверка файла…' : 'Загрузить файл для проверки'}<input className="block mt-3" type="file" accept=".json,application/json" disabled={pending} onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 2_000_000) { setError('Разделите данные на файлы до 2 МБ.'); return; }
      setPending(true); setError('');
      try { const result = await stageEquipmentImport(projectId, JSON.parse(await file.text()) as EquipmentImportInput); setBatchId(result.id); await client.invalidateQueries(); }
      catch { setError('Файл не принят. Проверьте формат кандидатов, права и ограничения размера.'); }
      finally { setPending(false); e.target.value = ''; }
    }} /></label>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {batches.isError && <p role="alert">Нет доступа к списку импортов.</p>}
    <div className="flex flex-wrap gap-2">{batches.data?.map(b => <Button variant="outline" key={b.id} onClick={() => setBatchId(b.id)}>Пакет #{b.id} · {new Date(b.capturedAt).toLocaleDateString('ru-RU')} · Не утверждён</Button>)}</div>
    {batch.isError && <p role="alert">Не удалось открыть пакет.</p>}
    {batch.data && <Card><CardContent className="p-5 space-y-3"><h3 className="font-bold">Пакет #{batch.data.id} · Только проверка</h3><p className="text-xs break-all">Источник: {batch.data.sourceBookId}<br/>Контрольная сумма: {batch.data.contentHash}</p>
      <details><summary>Ошибки и состав</summary><pre className="text-xs whitespace-pre-wrap p-3 bg-muted rounded mt-2">{JSON.stringify(batch.data.summary, null, 2)}</pre></details>
      <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th>Источник</th><th>Тип</th><th>Кандидат</th></tr></thead><tbody>{Array.isArray(rows) && rows.slice(0, 100).map((r: {sheetId: number; row: number; kind: string; values: Record<string, unknown>}, i) => <tr key={i} className="border-b"><td className="p-2 whitespace-nowrap"><a className="underline" target="_blank" rel="noopener noreferrer" href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(batch.data!.sourceBookId)}/edit#gid=${r.sheetId}&range=A${r.row}`}>Лист {r.sheetId}, строка {r.row} ↗</a></td><td>{r.kind}</td><td className="p-2 max-w-md break-words">{String(r.values.name ?? r.values.amount ?? '')}</td></tr>)}</tbody></table></div><p className="text-xs text-muted-foreground">Показаны первые 100 строк. Все строки сохранены для проверки; утверждённых фактов не создано.</p>
    </CardContent></Card>}
  </div>;
}
