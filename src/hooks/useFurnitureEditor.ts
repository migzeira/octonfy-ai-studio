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
}

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
      { type: "snake_plant" as FurnitureType, label: "Espada-de-S.Jorge", emoji: "🌱", size: [1, 2] },
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
  const storageKey = `octonfy-office-${workspaceId}`;
  const [editorMode, setEditorMode] = useState(false);
  const [selectedTool, setSelectedTool] = useState<FurnitureType | null>(null);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPlacedItems(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(placedItems));
    } catch { /* ignore */ }
  }, [placedItems, storageKey]);

  const placeItem = (col: number, row: number) => {
    if (!selectedTool) return;
    setPlacedItems(prev => {
      const filtered = prev.filter(i => !(i.col === col && i.row === row));
      return [...filtered, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type: selectedTool, col, row }];
    });
  };

  const removeItem = (col: number, row: number) => {
    setPlacedItems(prev => prev.filter(i => !(i.col === col && i.row === row)));
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
    placedItems, placeItem, removeItem, clearAll, toggleEditor,
  };
}
