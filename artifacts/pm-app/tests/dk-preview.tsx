import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setWorkspaceId } from "@workspace/api-client-react";
import { EquipmentTab } from "../src/features/equipment/equipment-tab";
import "../src/index.css";
setWorkspaceId(1);
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><main className="max-w-6xl mx-auto p-8 space-y-6"><div className="bg-slate-900 text-white rounded-lg p-4"><strong>LOCAL DEMO — синтетические данные</strong><p className="text-sm mt-1">Отдельная одноразовая база. Не рабочие количества, площади или оплаты проекта.</p></div><h1 className="text-3xl font-bold">Оснащение · 10 ДК</h1><EquipmentTab projectId={2} /></main></QueryClientProvider></React.StrictMode>);
