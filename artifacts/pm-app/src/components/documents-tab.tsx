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
import { format } from "date-fns";

export function DocumentsTab({ projectId }: { projectId: number }) {
  const { data: documents, isLoading } = useListProjectDocuments(projectId);
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <div className="bg-muted/30 px-5 py-3 border-b border-border flex justify-between items-center">
        <h3 className="font-bold text-sm tracking-tight">DOCUMENTS ({documents?.length ?? 0})</h3>
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
          <h4 className="text-lg font-medium">No documents yet</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm">
            Register project documents such as specifications, contracts, and floor plans.
          </p>
          <Button onClick={() => setIsAddOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Document
          </Button>
        </div>
      )}
    </Card>
  );
}

function DocumentRow({ document, projectId }: { document: ProjectDocument; projectId: number }) {
  const deleteDoc = useDeleteProjectDocument();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = () => {
    if (!confirm(`Delete "${document.name}"?`)) return;
    deleteDoc.mutate(
      { id: projectId, docId: document.id },
      {
        onSuccess: () => {
          toast({ title: "Document removed" });
          queryClient.invalidateQueries({ queryKey: getListProjectDocumentsQueryKey(projectId) });
        },
        onError: () => toast({ variant: "destructive", title: "Failed to delete document" }),
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
            Added {format(new Date(document.createdAt), "MMM d, yyyy")}
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
          toast({ title: "Document registered" });
          onOpenChange(false);
          queryClient.invalidateQueries({ queryKey: getListProjectDocumentsQueryKey(projectId) });
          setName("");
          setCategory("other");
          if (fileRef.current) fileRef.current.value = "";
        },
        onError: () => toast({ variant: "destructive", title: "Failed to add document" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Register document</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doc-name">Document name</Label>
              <Input
                id="doc-name"
                placeholder="e.g. Floor plan v2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>File (optional)</Label>
              <div className="flex items-center gap-2">
                <Input ref={fileRef} type="file" className="text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">
                Metadata is stored now; file storage can be connected later.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name || createDoc.isPending}>
              {createDoc.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
