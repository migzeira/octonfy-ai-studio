import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Document } from "@/hooks/useRealtimeDocuments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Eye, Code, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { marked } from "marked";

interface Props { doc: Document; workspaceId: string; onClose: () => void; }

export function DocumentEditorModal({ doc, workspaceId, onClose }: Props) {
  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content || "");
  const [type, setType] = useState(doc.type || "document");
  const [tagsInput, setTagsInput] = useState((doc.tags || []).join(", "));
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>();

  const save = async () => {
    setSaving(true);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    await supabase.from("documents").update({ title, content, type, tags, updated_by: "user" }).eq("id", doc.id);
    setSaving(false);
    setLastSaved(new Date());
  };

  // Auto-save every 3s on content change
  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => { save(); }, 3000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [content, title, type, tagsInput]);

  const insertMarkdown = (prefix: string, suffix = "") => {
    const textarea = document.getElementById("doc-editor") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const newContent = content.substring(0, start) + prefix + selected + suffix + content.substring(end);
    setContent(newContent);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-4 flex-1">
          <input className="text-xl font-bold bg-transparent border-none outline-none flex-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do documento..." />
          <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="document">Documento</option>
            <option value="report">Relatório</option>
            <option value="meeting_summary">Resumo</option>
            <option value="branding">Branding</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {saving ? "Salvando..." : lastSaved ? `Salvo há ${Math.floor((Date.now() - lastSaved.getTime()) / 1000)}s` : ""}
          </span>
          <Button variant="outline" size="sm" onClick={() => { save(); toast({ title: "✓ Salvo" }); }}>
            <Save className="h-3 w-3 mr-1" /> Salvar
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-border">
        <button className="px-2 py-1 text-xs rounded hover:bg-muted font-bold" onClick={() => insertMarkdown("**", "**")}>B</button>
        <button className="px-2 py-1 text-xs rounded hover:bg-muted italic" onClick={() => insertMarkdown("*", "*")}>I</button>
        <button className="px-2 py-1 text-xs rounded hover:bg-muted underline" onClick={() => insertMarkdown("<u>", "</u>")}>U</button>
        <button className="px-2 py-1 text-xs rounded hover:bg-muted" onClick={() => insertMarkdown("# ")}>H1</button>
        <button className="px-2 py-1 text-xs rounded hover:bg-muted" onClick={() => insertMarkdown("## ")}>H2</button>
        <button className="px-2 py-1 text-xs rounded hover:bg-muted" onClick={() => insertMarkdown("- ")}>Lista</button>
        <button className="px-2 py-1 text-xs rounded hover:bg-muted" onClick={() => insertMarkdown("`", "`")}>Código</button>
        <button className="px-2 py-1 text-xs rounded hover:bg-muted" onClick={() => insertMarkdown("> ")}>Quote</button>
        <button className="px-2 py-1 text-xs rounded hover:bg-muted" onClick={() => insertMarkdown("[", "](url)")}>Link</button>
        <div className="flex-1" />
        <Button variant={showPreview ? "default" : "ghost"} size="sm" onClick={() => setShowPreview(!showPreview)}>
          {showPreview ? <Code className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
          {showPreview ? "Editor" : "Preview"}
        </Button>
      </div>

      {/* Editor + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {showPreview ? (
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked(content) as string }} />
          ) : (
            <textarea
              id="doc-editor"
              className="w-full h-full bg-transparent border-none outline-none resize-none font-mono text-sm leading-relaxed"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Comece a escrever..."
            />
          )}
        </div>
        <div className="w-[200px] border-l border-border p-4 space-y-4 text-sm overflow-y-auto hidden lg:block">
          <div>
            <label className="text-xs text-muted-foreground">Criado por</label>
            <p className="font-medium">{doc.created_by === "user" ? "Você" : doc.created_by || "IA"}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Criado em</label>
            <p className="font-medium">{doc.created_at ? new Date(doc.created_at).toLocaleDateString("pt-BR") : "-"}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Tags</label>
            <Input className="text-xs" placeholder="tag1, tag2" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
