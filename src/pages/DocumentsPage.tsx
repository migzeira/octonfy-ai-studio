import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRealtimeDocuments, Document } from "@/hooks/useRealtimeDocuments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FilePlus, FileText, BarChart, Video, Star, Search, Trash2, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DocumentEditorModal } from "@/components/documents/DocumentEditorModal";
import { NewDocumentModal } from "@/components/documents/NewDocumentModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TYPE_ICONS: Record<string, { icon: any; color: string; label: string }> = {
  document: { icon: FileText, color: "#3b82f6", label: "Documento" },
  report: { icon: BarChart, color: "#6366f1", label: "Relatório" },
  meeting_summary: { icon: Video, color: "#22c55e", label: "Resumo de Reunião" },
  branding: { icon: Star, color: "#f59e0b", label: "Branding" },
};
const TYPES = ["all", "document", "report", "meeting_summary", "branding"];
const AUTHORS = ["all", "user", "ai"];

export default function DocumentsPage() {
  const { workspace, loading: wsLoading } = useWorkspace();

  if (wsLoading || !workspace) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      </div>
    );
  }
  const { documents, loading } = useRealtimeDocuments(workspace?.id);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [editorDoc, setEditorDoc] = useState<Document | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (search) {
        const s = search.toLowerCase();
        if (!d.title.toLowerCase().includes(s) && !(d.content || "").toLowerCase().includes(s)) return false;
      }
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (authorFilter === "user" && d.created_by !== "user") return false;
      if (authorFilter === "ai" && d.created_by === "user") return false;
      return true;
    });
  }, [documents, search, typeFilter, authorFilter]);

  const handleDelete = async () => {
    if (!deleteDoc) return;
    await supabase.from("documents").delete().eq("id", deleteDoc.id);
    toast({ title: "Documento excluído" });
    setDeleteDoc(null);
  };

  const relativeTime = (date: string) => {
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documentos</h1>
          <p className="text-muted-foreground">{documents.length} documentos</p>
        </div>
        <Button className="gradient-cta border-0" onClick={() => setNewDocOpen(true)}>
          <FilePlus className="h-4 w-4 mr-2" /> Novo Documento
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar documentos..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {TYPES.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1 rounded-full text-xs transition-all ${typeFilter === t ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>
              {t === "all" ? "Todos" : TYPE_ICONS[t]?.label || t}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {AUTHORS.map((a) => (
            <button key={a} onClick={() => setAuthorFilter(a)} className={`px-3 py-1 rounded-full text-xs transition-all ${authorFilter === a ? "gradient-cta text-white" : "bg-muted text-muted-foreground"}`}>
              {a === "all" ? "Todos" : a === "user" ? "Criados por mim" : "Criados por IA"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold">Nenhum documento ainda</h2>
          <p className="text-muted-foreground">Agentes podem criar documentos automaticamente</p>
          <Button className="gradient-cta border-0" onClick={() => setNewDocOpen(true)}>Criar primeiro documento</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => {
            const typeInfo = TYPE_ICONS[doc.type || "document"] || TYPE_ICONS.document;
            const Icon = typeInfo.icon;
            return (
              <div key={doc.id} className="rounded-xl border border-border bg-card p-5 hover:glow-neon transition-all relative group cursor-pointer" onClick={() => setEditorDoc(doc)}>
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-1.5 rounded-md bg-muted hover:bg-accent" onClick={(e) => { e.stopPropagation(); setEditorDoc(doc); }}><Pencil className="h-3 w-3" /></button>
                  <button className="p-1.5 rounded-md bg-muted hover:bg-destructive/20 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteDoc(doc); }}><Trash2 className="h-3 w-3" /></button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-5 w-5" style={{ color: typeInfo.color }} />
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${typeInfo.color}20`, color: typeInfo.color }}>{typeInfo.label}</span>
                </div>
                <h3 className="font-bold text-sm line-clamp-2 mb-1">{doc.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-3">{doc.content || "Sem conteúdo"}</p>
                <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                  <span>{doc.created_by === "user" ? "Você" : "IA"}</span>
                  <span>{doc.created_at ? relativeTime(doc.created_at) : ""}</span>
                </div>
                {doc.tags && doc.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {doc.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                    ))}
                    {doc.tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{doc.tags.length - 3}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {newDocOpen && <NewDocumentModal workspaceId={workspace!.id} onClose={() => setNewDocOpen(false)} onCreated={(doc) => { setNewDocOpen(false); setEditorDoc(doc); }} />}
      {editorDoc && <DocumentEditorModal doc={editorDoc} workspaceId={workspace!.id} onClose={() => setEditorDoc(null)} />}
      <AlertDialog open={!!deleteDoc} onOpenChange={() => setDeleteDoc(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir documento?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
