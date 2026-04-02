import { useState } from "react";
import { FURNITURE_CATALOG, FurnitureType, FloorTheme, FLOOR_THEMES, ROOM_TEMPLATES } from "@/hooks/useFurnitureEditor";
import { X, Trash2, Layers, Palette, Building2 } from "lucide-react";

interface Props {
  selectedTool:    FurnitureType | null;
  onSelectTool:    (t: FurnitureType | null) => void;
  onClearAll:      () => void;
  onClose:         () => void;
  floorTheme:      FloorTheme;
  onSetFloorTheme: (t: FloorTheme) => void;
  customFloorColors: { work: string | null; meet: string | null; break: string | null };
  onSetZoneColor:  (zone: "work" | "meet" | "break", color: string) => void;
  onAddRoomTemplate: (templateId: string) => void;
}

type Tab = "items" | "floor" | "rooms";

const ZONE_LABELS = [
  { key: "work"  as const, label: "Área de Trabalho",  default: "#9a7a4a" },
  { key: "meet"  as const, label: "Sala de Reunião",   default: "#3e4466" },
  { key: "break" as const, label: "Área de Descanso",  default: "#3a5c3a" },
];

export default function OfficeEditorPanel({
  selectedTool, onSelectTool, onClearAll, onClose,
  floorTheme, onSetFloorTheme,
  customFloorColors, onSetZoneColor,
  onAddRoomTemplate,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("items");

  const tabs: { key: Tab; icon: React.ElementType; label: string }[] = [
    { key: "items", icon: Layers,    label: "Itens"     },
    { key: "floor", icon: Palette,   label: "Piso"      },
    { key: "rooms", icon: Building2, label: "Ambientes" },
  ];

  // Effective color for each zone (custom override OR from preset theme)
  function effectiveColor(zone: "work" | "meet" | "break"): string {
    if (customFloorColors[zone]) return customFloorColors[zone]!;
    const t = FLOOR_THEMES[floorTheme];
    return zone === "work" ? t.workA : zone === "meet" ? t.meetA : t.breakA;
  }

  return (
    <div
      className="absolute right-4 top-[106px] z-40 w-56 rounded-2xl border border-white/10 overflow-hidden flex flex-col"
      style={{ background: "rgba(14,12,24,0.95)", backdropFilter: "blur(12px)", maxHeight: "calc(100vh - 130px)" }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold text-white">Editor de Escritório</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex border-b border-white/10 flex-shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-medium transition-colors ${
              activeTab === tab.key
                ? "text-primary border-b-2 border-primary"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Itens ──────────────────────────────────────────── */}
      {activeTab === "items" && (
        <>
          <div className="px-3 py-1.5 text-[10px] border-b border-white/5 flex-shrink-0">
            {selectedTool
              ? <span className="text-primary/80">Clique no canvas para posicionar</span>
              : <span className="text-white/35">Selecione um item ou clique num existente</span>}
          </div>
          <div className="overflow-y-auto flex-1">
            {FURNITURE_CATALOG.map(cat => (
              <div key={cat.category} className="py-1">
                <div className="px-3 py-1 text-[9px] font-bold text-white/30 uppercase tracking-widest">
                  {cat.category}
                </div>
                <div className="grid grid-cols-2 gap-1 px-2 pb-1">
                  {cat.items.map(item => (
                    <button
                      key={item.type}
                      onClick={() => onSelectTool(selectedTool === item.type ? null : item.type as FurnitureType)}
                      className={`
                        flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition-all
                        ${selectedTool === item.type
                          ? "bg-primary/30 border border-primary/60 text-white"
                          : "bg-white/5 border border-white/5 text-white/60 hover:bg-white/10 hover:text-white"}
                      `}
                    >
                      <span className="text-lg leading-none">{item.emoji}</span>
                      <span className="text-[9px] leading-tight">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Tab: Piso ───────────────────────────────────────────── */}
      {activeTab === "floor" && (
        <div className="overflow-y-auto flex-1 px-3 py-2 space-y-3">
          {/* Preset themes */}
          <div>
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2">Tema Rápido</div>
            <div className="flex gap-1.5">
              {(Object.entries(FLOOR_THEMES) as [FloorTheme, typeof FLOOR_THEMES[FloorTheme]][]).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => onSetFloorTheme(key)}
                  title={theme.label}
                  className={`flex-1 h-8 rounded-md border text-[9px] font-medium transition-all ${
                    floorTheme === key
                      ? "border-primary/70 text-white"
                      : "border-white/10 text-white/40 hover:border-white/30 hover:text-white/70"
                  }`}
                  style={{
                    background: floorTheme === key
                      ? `linear-gradient(135deg, ${theme.workA}, ${theme.breakA})`
                      : `linear-gradient(135deg, ${theme.workA}88, ${theme.breakA}88)`,
                  }}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* Per-zone custom color pickers */}
          <div>
            <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-2">Cor por Zona</div>
            <div className="space-y-2">
              {ZONE_LABELS.map(zone => (
                <div key={zone.key} className="flex items-center gap-2">
                  <label
                    className="relative flex-shrink-0 w-8 h-8 rounded-lg border border-white/20 overflow-hidden cursor-pointer"
                    title={zone.label}
                    style={{ background: effectiveColor(zone.key) }}
                  >
                    <input
                      type="color"
                      value={effectiveColor(zone.key)}
                      onChange={e => onSetZoneColor(zone.key, e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] text-white/50 leading-tight truncate">{zone.label}</div>
                    <div className="text-[9px] text-white/25 font-mono">{effectiveColor(zone.key)}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                onSetZoneColor("work", "");
                onSetZoneColor("meet", "");
                onSetZoneColor("break", "");
              }}
              className="mt-2 w-full text-[9px] text-white/30 hover:text-white/60 py-1 transition-colors"
            >
              Limpar cores personalizadas
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Ambientes ──────────────────────────────────────── */}
      {activeTab === "rooms" && (
        <div className="overflow-y-auto flex-1 px-2 py-2 space-y-1.5">
          <p className="text-[9px] text-white/35 px-1 pb-1">
            Adiciona um conjunto de móveis pré-montado. Mova os itens depois de adicionar.
          </p>
          {ROOM_TEMPLATES.map(tmpl => (
            <div
              key={tmpl.id}
              className="flex items-start gap-2 rounded-xl p-2 border border-white/5 bg-white/5"
            >
              <span className="text-2xl leading-none mt-0.5">{tmpl.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white leading-tight">{tmpl.label}</div>
                <div className="text-[9px] text-white/40 leading-tight mt-0.5">{tmpl.description}</div>
                <button
                  onClick={() => onAddRoomTemplate(tmpl.id)}
                  className="mt-1.5 text-[9px] bg-primary/20 hover:bg-primary/40 border border-primary/30
                             text-primary px-2 py-0.5 rounded-md transition-all"
                >
                  + Adicionar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-t border-white/10 flex-shrink-0">
        <button
          onClick={onClearAll}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-red-400/70
                     hover:text-red-400 py-1.5 rounded-lg hover:bg-red-400/10 transition-all"
        >
          <Trash2 className="h-3 w-3" />
          Restaurar padrão
        </button>
      </div>
    </div>
  );
}
