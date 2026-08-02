import { useState } from "react";
import { CatalogTab } from "@/components/kazniisa/catalog-tab";
import { MatchingTab } from "@/components/kazniisa/matching-tab";

type Tab = "catalog" | "matching";

export default function KazniisaPage() {
  const [activeTab, setActiveTab] = useState<Tab>("matching");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">🏛️ КазНИИСА</h1>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "catalog"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          📚 Каталог
        </button>
        <button
          onClick={() => setActiveTab("matching")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "matching"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          📋 Подбор
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "catalog" && <CatalogTab />}
      {activeTab === "matching" && <MatchingTab />}
    </div>
  );
}
