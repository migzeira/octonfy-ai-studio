/**
 * HireAgentModal — Catalog-based hiring flow.
 *
 * Step 0 → Grid of pre-built agent roles
 * Step 1 → Choose male / female variant, see name + avatar preview
 * (one click on "Contratar" → inserts into Supabase → closes)
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, X, Sparkles, ChevronRight } from "lucide-react";
import { AGENT_CATALOG, CHAR_CDN, type AgentCatalogEntry, type AgentVariant } from "@/data/agentCatalog";

/* ── Sprite preview helpers ──────────────────────────────────────── */
// Each char_N.png is a sprite sheet: 5 frames wide × 3 rows tall
// Frame 0, row 0 (standing still, facing down): position (0, 0) in source
// Source size: 16×32 px per cell → display at 3× = 48×96 px
const SPRITE_COLS = 5;
const SPRITE_SRC_W = 16;
const SPRITE_SRC_H = 32;
const SPRITE_SCALE = 3;
const SPRITE_DISP_W = SPRITE_SRC_W * SPRITE_SCALE; // 48 px
const SPRITE_DISP_H = SPRITE_SRC_H * SPRITE_SCALE; // 96 px
const SPRITE_SHEET_W = SPRITE_COLS * SPRITE_DISP_W; // 240 px

function SpritePreview({ charIdx }: { charIdx: number }) {
  return (
    <div
      style={{
        width: SPRITE_DISP_W,
        height: SPRITE_DISP_H,
        backgroundImage: `url(${CHAR_CDN}/char_${charIdx}.png)`,
        backgroundPosition: "0px 0px",
        backgroundRepeat: "no-repeat",
        backgroundSize: `${SPRITE_SHEET_W}px auto`,
        imageRendering: "pixelated",
        flexShrink: 0,
      }}
    />
  );
}

/* ── Variant card ─────────────────────────────────────────────────── */
function VariantCard({
  variant,
  role,
  model,
  selected,
  onSelect,
}: {
  variant: AgentVariant;
  role: string;
  model: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`
        flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 w-full
        ${selected
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
          : "border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/25"}
      `}
    >
      {/* Pixel character */}
      <div className="relative">
        <div
          className="rounded-xl p-2 flex items-end justify-center"
          style={{ background: `${variant.color}22`, border: `1px solid ${variant.color}44` }}
        >
          <SpritePreview charIdx={variant.charIdx} />
        </div>
        {selected && (
          <div
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]"
            style={{ background: variant.color }}
          >
            ✓
          </div>
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <div className="text-sm font-bold text-white leading-tight">{variant.name}</div>
        <div className="text-[10px] text-white/50 mt-0.5">{role}</div>
      </div>

      {/* Model badge */}
      <div
        className="text-[9px] font-mono px-2 py-0.5 rounded-full"
        style={{ background: `${variant.color}30`, color: variant.color, border: `1px solid ${variant.color}50` }}
      >
        {model}
      </div>
    </button>
  );
}

/* ── Main modal ───────────────────────────────────────────────────── */
interface HireAgentModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HireAgentModal({ open, onClose }: HireAgentModalProps) {
  const { workspace } = useWorkspace();
  const [step, setStep] = useState<0 | 1>(0);
  const [selectedEntry, setSelectedEntry] = useState<AgentCatalogEntry | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<AgentVariant | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSelectRole = (entry: AgentCatalogEntry) => {
    setSelectedEntry(entry);
    setSelectedVariant(null);
    setStep(1);
  };

  const handleBack = () => {
    setStep(0);
    setSelectedEntry(null);
    setSelectedVariant(null);
  };

  const handleHire = async () => {
    if (!workspace || !selectedEntry || !selectedVariant) return;
    setLoading(true);

    try {
      const systemPrompt =
        selectedEntry.systemPrompt +
        `\n\n---\nEmpresa: ${workspace.name}` +
        (workspace.mission ? `\nMissão: ${workspace.mission}` : "") +
        (workspace.products ? `\nProdutos/Serviços: ${workspace.products}` : "");

      const { error } = await supabase.from("agents").insert({
        workspace_id: workspace.id,
        name: selectedVariant.name,
        role: selectedEntry.role,
        specialty: selectedEntry.specialty,
        model: selectedEntry.model,
        avatar_color: selectedVariant.color,
        system_prompt: systemPrompt,
        is_active: true,
        status: "idle",
      });

      if (error) throw error;

      await supabase.from("event_logs").insert({
        workspace_id: workspace.id,
        event_type: "hired",
        actor: "user",
        description: `${selectedVariant.name} contratado(a) como ${selectedEntry.role}`,
        target: selectedVariant.name,
      });

      toast({
        title: `✓ ${selectedVariant.name} entrou para o time!`,
        description: `${selectedEntry.role} está pronto(a) no escritório.`,
      });

      resetAndClose();
    } catch (err: any) {
      toast({ title: "Erro ao contratar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setStep(0);
    setSelectedEntry(null);
    setSelectedVariant(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={resetAndClose}
    >
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl border border-white/10 overflow-hidden flex flex-col"
        style={{
          background: "rgba(10,8,20,0.97)",
          backdropFilter: "blur(24px)",
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step === 1 && (
              <button
                onClick={handleBack}
                className="text-white/40 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {step === 0 ? (
                  <>
                    <Sparkles className="h-4 w-4 text-primary" />
                    Contratar agente
                  </>
                ) : (
                  <>
                    <span className="text-xl">{selectedEntry?.categoryEmoji}</span>
                    {selectedEntry?.role}
                  </>
                )}
              </h2>
              <p className="text-[11px] text-white/40 mt-0.5">
                {step === 0
                  ? "Selecione o perfil ideal para o seu time"
                  : selectedEntry?.description}
              </p>
            </div>
          </div>
          <button onClick={resetAndClose} className="text-white/30 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Step 0 — Role selection grid ─────────────────────────── */}
        {step === 0 && (
          <div className="overflow-y-auto flex-1 p-5">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {AGENT_CATALOG.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleSelectRole(entry)}
                  className="group flex flex-col items-center gap-2 p-3.5 rounded-xl border border-white/8
                             bg-white/4 hover:bg-white/8 hover:border-primary/40 transition-all duration-150 text-center"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform duration-150">
                    {entry.categoryEmoji}
                  </span>
                  <div className="text-[11px] font-semibold text-white leading-tight">{entry.role}</div>
                  <div className="text-[9px] text-white/35 leading-tight line-clamp-2">
                    {entry.description}
                  </div>
                  <div className="flex items-center gap-0.5 text-white/25 text-[9px] mt-auto pt-1">
                    <span className="font-mono">{entry.model}</span>
                    <ChevronRight className="h-2.5 w-2.5" />
                  </div>
                </button>
              ))}
            </div>

            {/* Custom agent hint */}
            <p className="text-center text-[10px] text-white/20 mt-5">
              Não encontrou o que precisa?{" "}
              <span className="text-white/40">Em breve: criar agente personalizado</span>
            </p>
          </div>
        )}

        {/* ── Step 1 — Choose variant (male / female) ──────────────── */}
        {step === 1 && selectedEntry && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Specialty + model info */}
            <div className="px-6 py-3 border-b border-white/6 flex-shrink-0 flex items-center gap-3">
              <div
                className="text-[10px] px-2 py-1 rounded-lg font-mono"
                style={{
                  background: "rgba(99,102,241,0.15)",
                  color: "#a5b4fc",
                  border: "1px solid rgba(99,102,241,0.25)",
                }}
              >
                🤖 {selectedEntry.model}
              </div>
              <div className="text-[10px] text-white/40">
                Especialidade: {selectedEntry.specialty}
              </div>
            </div>

            {/* Variant cards */}
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-[11px] text-white/40 text-center mb-5">
                Escolha qual avatar vai representar este agente no escritório
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <VariantCard
                  variant={selectedEntry.male}
                  role={selectedEntry.role}
                  model={selectedEntry.model}
                  selected={selectedVariant?.name === selectedEntry.male.name}
                  onSelect={() => setSelectedVariant(selectedEntry.male)}
                />
                <VariantCard
                  variant={selectedEntry.female}
                  role={selectedEntry.role}
                  model={selectedEntry.model}
                  selected={selectedVariant?.name === selectedEntry.female.name}
                  onSelect={() => setSelectedVariant(selectedEntry.female)}
                />
              </div>

              {/* Preview of system prompt (collapsed) */}
              <details className="mt-6 max-w-md mx-auto">
                <summary className="text-[10px] text-white/25 cursor-pointer hover:text-white/40 transition-colors select-none list-none flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 transition-transform [[open]_&]:rotate-90" />
                  Ver instruções do agente
                </summary>
                <div className="mt-2 text-[10px] text-white/40 leading-relaxed max-h-40 overflow-y-auto
                               bg-white/3 rounded-lg p-3 border border-white/6 whitespace-pre-wrap font-mono">
                  {selectedEntry.systemPrompt.slice(0, 600)}…
                </div>
              </details>
            </div>

            {/* Hire CTA */}
            <div className="px-6 py-4 border-t border-white/8 flex-shrink-0">
              <button
                onClick={handleHire}
                disabled={!selectedVariant || loading}
                className={`
                  w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
                  transition-all duration-200
                  ${selectedVariant && !loading
                    ? "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30"
                    : "bg-white/6 text-white/30 cursor-not-allowed"}
                `}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Contratando…
                  </>
                ) : selectedVariant ? (
                  <>
                    <span className="text-base">{selectedEntry.categoryEmoji}</span>
                    Contratar {selectedVariant.name}
                  </>
                ) : (
                  "Selecione um avatar acima"
                )}
              </button>
              {selectedVariant && (
                <p className="text-center text-[10px] text-white/25 mt-2">
                  Ele(a) vai aparecer no escritório imediatamente após a contratação
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
