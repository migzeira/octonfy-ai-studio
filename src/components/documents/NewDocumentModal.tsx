import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Document } from "@/hooks/useRealtimeDocuments";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const TYPES = [
  { value: "document", label: "Documento" },
  { value: "report", label: "Relatório" },
  { value: "meeting_summary", label: "Resumo de Reunião" },
  { value: "branding", label: "Branding" },
];

interface Props { workspaceId: string; onClose: () => void; onCreated: (doc: Document) => void; }

export function NewDocumentModal({ workspaceId, onClose, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("document");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const { data, error } = await supabase.from("documents").insert({ workspace_id: workspaceId, title: title.trim(), type, tags, content: "" }).select().single();
    if (error || !data) { toast({ title: "Erro ao criar", variant: "destructive" }); setSaving(false); return; }
    toast({ title: "✓ Documento criado" });
    onCreated(data as Document);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="glassmorphism max-w-md">
        <DialogHeader><DialogTitle>Novo Documento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <Input placeholder="Tags (separadas por vírgula)" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          <Button className="w-full gradient-cta border-0" onClick={handleCreate} disabled={saving}>{saving ? "Criando..." : "Criar e abrir editor"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
