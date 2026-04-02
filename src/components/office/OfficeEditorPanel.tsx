import { FURNITURE_CATALOG, FurnitureType, FloorTheme, FLOOR_THEMES } from "@/hooks/useFurnitureEditor";
import { X, Trash2, Layers, RotateCcw } from "lucide-react";

interface Props {
  selectedTool: FurnitureType | null;
  onSelectTool: (t: FurnitureType | null) => void;
  onClearAll: () => void;
  onClose: () => void;
  floorTheme: FloorTheme;
  onSetFloorTheme: (t: FloorTheme) => void;
}

export default function OfficeEditorPanel({
  selectedTool, onSelectTool, onClearAll, onClose, floorTheme, onSetFloorTheme,
}: Props) {
  return (
    <div
      className="absolute left-3 top-3 z-40 w-52 rounded-2xl border border-white/10 overflow-hidden"
      style={{ background: "rgba(14,12,24,0.95)", backdropFilter: "blur(12px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold text-white">Editor de Escritório</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Floor theme selector */}
      <div className="px-3 py-2 border-b border-white/10">
        <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1.5">Piso</div>
        <div className="flex gap-1.5">
          {(Object.entries(FLOOR_THEMES) as [FloorTheme, typeof FLOOR_THEMES[FloorTheme]][]).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => onSetFloorTheme(key)}
              title={theme.label}
              className={`flex-1 h-7 rounded-md border text-[9px] font-medium transition-all ${
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

      {/* Instruction */}
      <div className="px-3 py-1.5 text-[10px] border-b border-white/5">
        {selectedTool
          ? <span className="text-primary/80">Clique no canvas para posicionar</span>
          : <span className="text-white/35">Selecione um item ou clique num existente</span>}
      </div>

      {/* Catalog */}
      <div className="max-h-[55vh] overflow-y-auto">
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

      {/* Footer */}
      <div className="px-3 py-2 border-t border-white/10 flex gap-2">
        <button
          onClick={onClearAll}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs text-red-400/70
                     hover:text-red-400 py-1.5 rounded-lg hover:bg-red-400/10 transition-all"
        >
          <Trash2 className="h-3 w-3" />
          Limpar tudo
        </button>
      </div>
    </div>
  );
}
