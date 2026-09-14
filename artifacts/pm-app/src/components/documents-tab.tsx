import {
  useListProjectDocuments,
  useCreateProjectDocument,
  useDeleteProjectDocument,
  getListProjectDocumentsQueryKey,
  type ProjectDocument,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DOCUMENT_CATEGORIES, getDocumentCategoryLabel } from "@/lib/project-constants";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

export function DocumentsTab({ projectId }: { projectId: number }) {
  const { t } = useTranslation();
  const { data: documents, isLoading } = useListProjectDocuments(projectId);
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <div className="bg-muted/30 px-5 py-3 border-b border-border flex justify-between items-center">
        <h3 className="font-bold text-sm tracking-tight">{t("common.documents")} ({documents?.length ?? 0})</h3>
        <AddDocumentDialog projectId={projectId} open={isAddOpen} onOpenChange={setIsAddOpen} />
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : documents && documents.length > 0 ? (
        <div className="divide-y divide-border">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} document={doc} projectId={projectId} />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h4 className="text-lg font-medium">{t("documents.noDocuments")}</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm">
            {t("documents.emptyHint")}
          </p>
          <Button onClick={() => setIsAddOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            {t("documents.addDocument")}
          </Button>
        </div>
      )}
    </Card>
  );
}

function DocumentRow({ document, projectId }: { document: ProjectDocument; projectId: number }) {
  const { t, i18n } = useTranslation();
  const deleteDoc = useDeleteProjectDocument();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = () => {
    if (!confirm(t("documents.deleteConfirm", { name: document.name }))) return;
    deleteDoc.mutate(
      { id: projectId, docId: document.id },
      {
        onSuccess: () => {
          toast({ title: t("documents.removed") });
          queryClient.invalidateQueries({ queryKey: getListProjectDocumentsQueryKey(projectId) });
        },
        onError: () => toast({ variant: "destructive", title: t("documents.deleteFailed") }),
      },
    );
  };

  return (
    <div className="p-4 hover:bg-muted/20 transition-colors flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-md bg-slate-50 border border-border/50 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{document.name}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {t("documents.added", { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(document.createdAt)) })}
            {document.sizeBytes ? ` · ${(document.sizeBytes / 1024).toFixed(1)} KB` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">
          {getDocumentCategoryLabel(document.category)}
        </Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function AddDocumentDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("other");
  const fileRef = useRef<HTMLInputElement>(null);
  const createDoc = useCreateProjectDocument();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const file = fileRef.current?.files?.[0];
    createDoc.mutate(
      {
        id: projectId,
        data: {
          name,
          category: category as ProjectDocument["category"],
          mimeType: file?.type,
          sizeBytes: file?.size,
          storageKey: file ? `local://${file.name}` : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: t("documents.registered") });
          onOpenChange(false);
          queryClient.invalidateQueries({ queryKey: getListProjectDocumentsQueryKey(projectId) });
          setName("");
          setCategory("other");
          if (fileRef.current) fileRef.current.value = "";
        },
        onError: () => toast({ variant: "destructive", title: t("documents.addFailed") }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {t("documents.addDocument")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("documents.registerDocument")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doc-name">{t("documents.name")}</Label>
              <Input
                id="doc-name"
                placeholder={t("documents.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>{t("documents.category")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{t(`documentCategories.${c.id}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("documents.fileOptional")}</Label>
              <div className="flex items-center gap-2">
                <Input ref={fileRef} type="file" className="text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("documents.fileHint")}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!name || createDoc.isPending}>
              {createDoc.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
