import { useState, useEffect } from "react";

export type FurnitureType =
  | "desk" | "chair" | "plant" | "plant_small" | "cactus" | "snake_plant"
  | "bookshelf" | "tv" | "couch" | "coffee_table"
  | "coffee_machine" | "whiteboard" | "clock" | "rug" | "poster"
  | "wall_h" | "wall_v";

export interface PlacedItem {
  id: string;
  type: FurnitureType;
  col: number;
  row: number;
  rotation?: 0 | 1 | 2 | 3;
}

export type FloorTheme = "warm" | "modern" | "dark";

export const FLOOR_THEMES: Record<FloorTheme, {
  workA: string; workB: string;
  meetA: string; meetB: string;
  breakA: string; breakB: string;
  label: string;
}> = {
  warm: {
    workA: "#9a7a4a", workB: "#8a6a3a",
    meetA: "#3e4466", meetB: "#2e3456",
    breakA: "#3a5c3a", breakB: "#2a4c2a",
    label: "Clássico",
  },
  modern: {
    workA: "#9090a4", workB: "#80809a",
    meetA: "#606880", meetB: "#505870",
    breakA: "#507060", breakB: "#406050",
    label: "Moderno",
  },
  dark: {
    workA: "#1c1c2c", workB: "#141420",
    meetA: "#18182e", meetB: "#101028",
    breakA: "#101e12", breakB: "#0c180e",
    label: "Dark",
  },
};

// Tile footprint [cols, rows] for each furniture type
export const ITEM_SIZES: Record<FurnitureType, [number, number]> = {
  desk:           [3, 2],
  chair:          [1, 1],
  plant:          [1, 2],
  plant_small:    [1, 1],
  cactus:         [1, 1],
  snake_plant:    [1, 2],
  bookshelf:      [2, 1],
  tv:             [3, 2],
  couch:          [4, 2],
  coffee_table:   [2, 1],
  coffee_machine: [1, 2],
  whiteboard:     [2, 1],
  clock:          [1, 1],
  rug:            [2, 2],
  poster:         [1, 1],
  wall_h:         [2, 1],
  wall_v:         [1, 2],
};

// Items that agents can walk over (not blocking)
export const WALKABLE_ITEM_TYPES = new Set<FurnitureType>(["rug", "poster", "clock"]);

export const FURNITURE_CATALOG = [
  {
    category: "Móveis",
    items: [
      { type: "desk" as FurnitureType, label: "Mesa Gamer", emoji: "🖥", size: [3, 2] },
      { type: "chair" as FurnitureType, label: "Cadeira Gamer", emoji: "🪑", size: [1, 1] },
      { type: "couch" as FurnitureType, label: "Sofá", emoji: "🛋", size: [4, 2] },
      { type: "coffee_table" as FurnitureType, label: "Mesa Centro", emoji: "🪵", size: [2, 1] },
      { type: "bookshelf" as FurnitureType, label: "Estante", emoji: "📚", size: [2, 1] },
    ],
  },
  {
    category: "Plantas",
    items: [
      { type: "plant" as FurnitureType, label: "Monstera", emoji: "🌿", size: [1, 2] },
      { type: "plant_small" as FurnitureType, label: "Suculenta", emoji: "🪴", size: [1, 1] },
      { type: "cactus" as FurnitureType, label: "Cacto", emoji: "🌵", size: [1, 1] },
      { type: "snake_plant" as FurnitureType, label: "Espada-S.Jorge", emoji: "🌱", size: [1, 2] },
    ],
  },
  {
    category: "Eletrônicos",
    items: [
      { type: "tv" as FurnitureType, label: "TV 4K", emoji: "📺", size: [3, 2] },
      { type: "coffee_machine" as FurnitureType, label: "Cafeteira", emoji: "☕", size: [1, 2] },
      { type: "clock" as FurnitureType, label: "Relógio", emoji: "🕐", size: [1, 1] },
    ],
  },
  {
    category: "Decoração",
    items: [
      { type: "whiteboard" as FurnitureType, label: "Quadro Branco", emoji: "📋", size: [2, 1] },
      { type: "rug" as FurnitureType, label: "Tapete", emoji: "🟫", size: [2, 2] },
      { type: "poster" as FurnitureType, label: "Poster", emoji: "🖼", size: [1, 1] },
    ],
  },
  {
    category: "Paredes",
    items: [
      { type: "wall_h" as FurnitureType, label: "Parede H", emoji: "🧱", size: [2, 1] },
      { type: "wall_v" as FurnitureType, label: "Parede V", emoji: "🧱", size: [1, 2] },
    ],
  },
];

export function useFurnitureEditor(workspaceId: string) {
  const itemsKey = `octonfy-office-${workspaceId}`;
  const themeKey = `octonfy-floor-${workspaceId}`;

  const [editorMode, setEditorMode] = useState(false);
  const [selectedTool, setSelectedTool] = useState<FurnitureType | null>(null);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [floorTheme, setFloorThemeState] = useState<FloorTheme>("warm");

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(itemsKey);
      if (raw) setPlacedItems(JSON.parse(raw));
    } catch { /* ignore */ }
    try {
      const t = localStorage.getItem(themeKey) as FloorTheme | null;
      if (t && t in FLOOR_THEMES) setFloorThemeState(t);
    } catch { /* ignore */ }
  }, [itemsKey, themeKey]);

  // Persist items
  useEffect(() => {
    try { localStorage.setItem(itemsKey, JSON.stringify(placedItems)); } catch { /* ignore */ }
  }, [placedItems, itemsKey]);

  const setFloorTheme = (t: FloorTheme) => {
    setFloorThemeState(t);
    try { localStorage.setItem(themeKey, t); } catch { /* ignore */ }
  };

  const placeItem = (col: number, row: number) => {
    if (!selectedTool) return;
    setPlacedItems(prev => {
      const filtered = prev.filter(i => !(i.col === col && i.row === row));
      return [...filtered, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: selectedTool, col, row, rotation: 0,
      }];
    });
  };

  const removeItem = (id: string) => {
    setPlacedItems(prev => prev.filter(i => i.id !== id));
  };

  const rotateItem = (id: string) => {
    setPlacedItems(prev => prev.map(i =>
      i.id === id ? { ...i, rotation: (((i.rotation ?? 0) + 1) % 4) as 0 | 1 | 2 | 3 } : i
    ));
  };

  const clearAll = () => setPlacedItems([]);

  const toggleEditor = () => {
    setEditorMode(prev => {
      if (prev) setSelectedTool(null);
      return !prev;
    });
  };

  return {
    editorMode, selectedTool, setSelectedTool,
    placedItems, placeItem, removeItem, rotateItem, clearAll, toggleEditor,
    floorTheme, setFloorTheme,
  };
}
