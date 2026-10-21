import { useState } from "react";
import { createEquipmentProject, useGetWorkspaceAccess } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function CreateEquipmentButton() {
  const access = useGetWorkspaceAccess();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const client = useQueryClient();
  const [, navigate] = useLocation();
  if (!access.data || access.data.role === 'viewer') return null;
  return <div><Button variant="outline" disabled={pending} onClick={async () => {
    setPending(true); setError('');
    try { const p = await createEquipmentProject({ name: '10 ДК', reportingCurrency: 'KZT' }); await client.invalidateQueries(); navigate(`/projects/${p.id}`); }
    catch { setError('Не удалось создать проект оснащения.'); }
    finally { setPending(false); }
  }}>{pending ? 'Создание…' : '+ Проект 10 ДК'}</Button>{error && <p role="alert" className="text-red-700 text-xs">{error}</p>}</div>;
}
