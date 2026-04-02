import { useState, useEffect } from "react";

export type FurnitureType =
  | "desk" | "chair" | "plant" | "plant_small" | "cactus" | "snake_plant"
  | "bookshelf" | "tv" | "couch" | "coffee_table"
  | "coffee_machine" | "whiteboard" | "clock" | "rug" | "poster"
  | "wall_h" | "wall_v" | "door" | "meeting_table" | "table_square";

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
  door:           [1, 2],
  meeting_table:  [8, 6],
  table_square:   [3, 3],
};

// Items that agents can walk over (not blocking pathfinding)
export const WALKABLE_ITEM_TYPES = new Set<FurnitureType>([
  "rug", "poster", "clock", "door",
]);

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
    category: "Sala de Reunião",
    items: [
      { type: "meeting_table" as FurnitureType, label: "Mesa Oval", emoji: "⬭", size: [8, 6] },
      { type: "table_square" as FurnitureType, label: "Mesa Quadrada", emoji: "⬜", size: [3, 3] },
      { type: "whiteboard" as FurnitureType, label: "Quadro Branco", emoji: "📋", size: [2, 1] },
    ],
  },
  {
    category: "Decoração",
    items: [
      { type: "rug" as FurnitureType, label: "Tapete", emoji: "🟫", size: [2, 2] },
      { type: "poster" as FurnitureType, label: "Poster", emoji: "🖼", size: [1, 1] },
    ],
  },
  {
    category: "Paredes",
    items: [
      { type: "wall_h" as FurnitureType, label: "Parede H", emoji: "🧱", size: [2, 1] },
      { type: "wall_v" as FurnitureType, label: "Parede V", emoji: "🧱", size: [1, 2] },
      { type: "door" as FurnitureType, label: "Porta", emoji: "🚪", size: [1, 2] },
    ],
  },
];

// ── ROOM TEMPLATES ────────────────────────────────────────────────────
export interface RoomTemplate {
  id: string;
  emoji: string;
  label: string;
  description: string;
  items: Array<{
    type: FurnitureType;
    col: number;
    row: number;
    rotation?: 0 | 1 | 2 | 3;
  }>;
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "ceo",
    emoji: "🏆",
    label: "Escritório CEO",
    description: "Mesa executiva, estante, sofá e plantas",
    items: [
      { type: "desk",          col: 1, row: 1 },
      { type: "chair",         col: 2, row: 4 },
      { type: "bookshelf",     col: 0, row: 0 },
      { type: "bookshelf",     col: 2, row: 0 },
      { type: "couch",         col: 4, row: 3 },
      { type: "coffee_table",  col: 5, row: 2 },
      { type: "plant",         col: 0, row: 2 },
      { type: "snake_plant",   col: 7, row: 0 },
    ],
  },
  {
    id: "meeting_small",
    emoji: "📊",
    label: "Sala de Reunião",
    description: "Mesa quadrada com cadeiras e quadro branco",
    items: [
      { type: "table_square",  col: 1, row: 1 },
      { type: "chair",         col: 1, row: 0 },
      { type: "chair",         col: 2, row: 0 },
      { type: "chair",         col: 0, row: 2 },
      { type: "chair",         col: 4, row: 2 },
      { type: "whiteboard",    col: 0, row: 0 },
      { type: "plant_small",   col: 5, row: 0 },
    ],
  },
  {
    id: "copa",
    emoji: "☕",
    label: "Copa / Cozinha",
    description: "Cafeteira, mesas e cadeiras para descanso",
    items: [
      { type: "coffee_machine", col: 0, row: 0 },
      { type: "coffee_table",   col: 2, row: 0 },
      { type: "chair",          col: 2, row: 2 },
      { type: "chair",          col: 4, row: 2 },
      { type: "plant_small",    col: 5, row: 0 },
      { type: "clock",          col: 5, row: 2 },
    ],
  },
  {
    id: "reception",
    emoji: "🏛️",
    label: "Recepção",
    description: "Mesa de recepção, cadeiras para visitantes e plantas",
    items: [
      { type: "desk",          col: 1, row: 0 },
      { type: "chair",         col: 2, row: 3 },
      { type: "couch",         col: 5, row: 2 },
      { type: "coffee_table",  col: 6, row: 1 },
      { type: "plant",         col: 0, row: 2 },
      { type: "plant",         col: 9, row: 0 },
    ],
  },
  {
    id: "ti",
    emoji: "💻",
    label: "Sala de TI",
    description: "Múltiplas estações de trabalho e servidor",
    items: [
      { type: "desk",       col: 0, row: 0 },
      { type: "chair",      col: 1, row: 3 },
      { type: "desk",       col: 4, row: 0 },
      { type: "chair",      col: 5, row: 3 },
      { type: "bookshelf",  col: 8, row: 0 },
      { type: "bookshelf",  col: 8, row: 1 },
      { type: "whiteboard", col: 0, row: 5 },
    ],
  },
  {
    id: "lounge",
    emoji: "🛋️",
    label: "Sala de Descanso",
    description: "TV, sofá, tapete e plantas para relaxar",
    items: [
      { type: "tv",           col: 1, row: 0 },
      { type: "couch",        col: 1, row: 3 },
      { type: "rug",          col: 1, row: 2 },
      { type: "coffee_table", col: 2, row: 2 },
      { type: "plant",        col: 0, row: 2 },
      { type: "cactus",       col: 6, row: 3 },
      { type: "plant_small",  col: 6, row: 0 },
    ],
  },
];

// ── DEFAULT OFFICE LAYOUT ────────────────────────────────────────────
// Layout padrão baseado no escritório do Miguel (migueldrops@gmail.com)
// Todos os itens podem ser movidos/removidos pelo usuário.
export const DEFAULT_OFFICE_LAYOUT: PlacedItem[] = [
  // ── Top wall: bookshelves across work area ──
  { id: "def-shelf-0",  type: "bookshelf", col:  0, row: 0, rotation: 0 },
  { id: "def-shelf-2",  type: "bookshelf", col:  2, row: 0, rotation: 0 },
  { id: "def-shelf-4",  type: "bookshelf", col:  4, row: 0, rotation: 0 },
  { id: "def-shelf-6",  type: "bookshelf", col:  6, row: 0, rotation: 0 },
  { id: "def-shelf-8",  type: "bookshelf", col:  8, row: 0, rotation: 0 },
  { id: "def-shelf-10", type: "bookshelf", col: 10, row: 0, rotation: 0 },
  { id: "def-shelf-12", type: "bookshelf", col: 12, row: 0, rotation: 0 },
  { id: "def-shelf-14", type: "bookshelf", col: 14, row: 0, rotation: 0 },
  { id: "def-shelf-16", type: "bookshelf", col: 16, row: 0, rotation: 0 },
  { id: "def-shelf-18", type: "bookshelf", col: 18, row: 0, rotation: 0 },

  // ── CEO area (top-left) ──
  { id: "def-ceo-desk",    type: "desk",      col:  5, row: 1, rotation: 0 },
  { id: "def-ceo-chair",   type: "chair",     col:  6, row: 4, rotation: 0 },
  { id: "def-ceo-plant",   type: "plant",     col:  0, row: 1, rotation: 0 },
  { id: "def-ceo-plant2",  type: "snake_plant", col: 9, row: 1, rotation: 0 },

  // ── Meeting room decor (top wall) ──
  { id: "def-whiteboard-0", type: "whiteboard", col: 23, row: 0, rotation: 0 },
  { id: "def-whiteboard-1", type: "whiteboard", col: 25, row: 0, rotation: 0 },
  { id: "def-clock-0",      type: "clock",      col: 37, row: 0, rotation: 0 },

  // ── Meeting room: 4 square tables in 2x2 grid + chairs ──
  { id: "def-sq-tl", type: "table_square", col: 24, row: 3, rotation: 0 },
  { id: "def-sq-tr", type: "table_square", col: 28, row: 3, rotation: 0 },
  { id: "def-sq-bl", type: "table_square", col: 24, row: 7, rotation: 0 },
  { id: "def-sq-br", type: "table_square", col: 28, row: 7, rotation: 0 },
  // Chairs around meeting tables (left side)
  { id: "def-meet-ch-l0", type: "chair", col: 22, row: 4, rotation: 0 },
  { id: "def-meet-ch-l1", type: "chair", col: 22, row: 6, rotation: 0 },
  { id: "def-meet-ch-l2", type: "chair", col: 22, row: 8, rotation: 0 },
  // Chairs (right side)
  { id: "def-meet-ch-r0", type: "chair", col: 32, row: 4, rotation: 0 },
  { id: "def-meet-ch-r1", type: "chair", col: 32, row: 6, rotation: 0 },
  { id: "def-meet-ch-r2", type: "chair", col: 32, row: 8, rotation: 0 },
  // Chairs (top)
  { id: "def-meet-ch-t0", type: "chair", col: 25, row: 2, rotation: 0 },
  { id: "def-meet-ch-t1", type: "chair", col: 29, row: 2, rotation: 0 },
  // Chairs (bottom)
  { id: "def-meet-ch-b0", type: "chair", col: 25, row: 11, rotation: 0 },
  { id: "def-meet-ch-b1", type: "chair", col: 29, row: 11, rotation: 0 },

  // ── Work desks — Row 1 (2 desks) ──
  { id: "def-desk-0",  type: "desk",  col:  1, row:  5, rotation: 0 },
  { id: "def-chair-0", type: "chair", col:  2, row:  8, rotation: 0 },
  { id: "def-desk-1",  type: "desk",  col:  6, row:  5, rotation: 0 },
  { id: "def-chair-1", type: "chair", col:  7, row:  8, rotation: 0 },

  // ── Work desks — Row 2 (3 desks) ──
  { id: "def-desk-2",  type: "desk",  col:  1, row:  9, rotation: 0 },
  { id: "def-chair-2", type: "chair", col:  2, row: 12, rotation: 0 },
  { id: "def-desk-3",  type: "desk",  col:  6, row:  9, rotation: 0 },
  { id: "def-chair-3", type: "chair", col:  7, row: 12, rotation: 0 },
  { id: "def-desk-4",  type: "desk",  col: 11, row:  9, rotation: 0 },
  { id: "def-chair-4", type: "chair", col: 12, row: 12, rotation: 0 },

  // ── Work desks — Row 3 (4 desks) ──
  { id: "def-desk-5",  type: "desk",  col:  1, row: 13, rotation: 0 },
  { id: "def-chair-5", type: "chair", col:  2, row: 16, rotation: 0 },
  { id: "def-desk-6",  type: "desk",  col:  6, row: 13, rotation: 0 },
  { id: "def-chair-6", type: "chair", col:  7, row: 16, rotation: 0 },
  { id: "def-desk-7",  type: "desk",  col: 11, row: 13, rotation: 0 },
  { id: "def-chair-7", type: "chair", col: 12, row: 16, rotation: 0 },
  { id: "def-desk-8",  type: "desk",  col: 16, row: 13, rotation: 0 },
  { id: "def-chair-8", type: "chair", col: 17, row: 16, rotation: 0 },

  // ── Work area plants ──
  { id: "def-plant-0", type: "plant",       col:  0, row:  6, rotation: 0 },
  { id: "def-plant-1", type: "snake_plant", col:  0, row: 14, rotation: 0 },
  { id: "def-plant-2", type: "plant",       col: 20, row:  6, rotation: 0 },
  { id: "def-plant-3", type: "cactus",      col: 20, row: 14, rotation: 0 },

  // ── Break area (bottom-right, green zone) ──
  { id: "def-tv-0",           type: "tv",             col: 30, row: 13, rotation: 0 },
  { id: "def-couch-0",        type: "couch",          col: 23, row: 16, rotation: 0 },
  { id: "def-coffee-table-0", type: "coffee_table",   col: 25, row: 15, rotation: 0 },
  { id: "def-coffee-mach-0",  type: "coffee_machine", col: 35, row: 13, rotation: 0 },
  { id: "def-break-shelf-0",  type: "bookshelf",      col: 23, row: 18, rotation: 0 },
  { id: "def-break-shelf-1",  type: "bookshelf",      col: 25, row: 18, rotation: 0 },
  { id: "def-break-shelf-2",  type: "bookshelf",      col: 27, row: 18, rotation: 0 },
  { id: "def-break-shelf-3",  type: "bookshelf",      col: 29, row: 18, rotation: 0 },
  { id: "def-cactus-0",       type: "cactus",         col: 22, row: 18, rotation: 0 },
  { id: "def-plant-4",        type: "plant_small",    col: 37, row: 18, rotation: 0 },
  { id: "def-plant-5",        type: "plant_small",    col: 37, row: 13, rotation: 0 },
  { id: "def-plant-6",        type: "plant",          col: 22, row: 14, rotation: 0 },
  // Rugs (walkable, drawn under other items)
  { id: "def-rug-0", type: "rug", col: 24, row: 15, rotation: 0 },
  { id: "def-rug-1", type: "rug", col: 27, row: 15, rotation: 0 },
];

// ── HOOK ─────────────────────────────────────────────────────────────
// localStorage key v2: fresh start with DEFAULT_OFFICE_LAYOUT for all workspaces
export function useFurnitureEditor(workspaceId: string) {
  const itemsKey      = `octonfy-office-v2-${workspaceId}`;
  const themeKey      = `octonfy-floor-${workspaceId}`;
  const floorColorKey = `octonfy-floor-colors-${workspaceId}`;

  const [editorMode, setEditorMode] = useState(false);
  const [selectedTool, setSelectedTool] = useState<FurnitureType | null>(null);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [floorTheme, setFloorThemeState] = useState<FloorTheme>("warm");
  const [customFloorColors, setCustomFloorColors] = useState<{
    work: string | null;
    meet: string | null;
    break: string | null;
  }>({ work: null, meet: null, break: null });

  // Load from localStorage; if key absent, seed with DEFAULT_OFFICE_LAYOUT
  useEffect(() => {
    try {
      const raw = localStorage.getItem(itemsKey);
      if (raw !== null) {
        setPlacedItems(JSON.parse(raw));
      } else {
        setPlacedItems(DEFAULT_OFFICE_LAYOUT);
      }
    } catch {
      setPlacedItems(DEFAULT_OFFICE_LAYOUT);
    }
    try {
      const t = localStorage.getItem(themeKey) as FloorTheme | null;
      if (t && t in FLOOR_THEMES) setFloorThemeState(t);
    } catch { /* ignore */ }
    try {
      const rawColors = localStorage.getItem(floorColorKey);
      if (rawColors !== null) {
        setCustomFloorColors(JSON.parse(rawColors));
      }
    } catch { /* ignore */ }
  }, [itemsKey, themeKey, floorColorKey]);

  // Persist items on every change
  useEffect(() => {
    try { localStorage.setItem(itemsKey, JSON.stringify(placedItems)); } catch { /* ignore */ }
  }, [placedItems, itemsKey]);

  // Persist custom floor colors on every change
  useEffect(() => {
    try { localStorage.setItem(floorColorKey, JSON.stringify(customFloorColors)); } catch { /* ignore */ }
  }, [customFloorColors, floorColorKey]);

  const setFloorTheme = (t: FloorTheme) => {
    setFloorThemeState(t);
    try { localStorage.setItem(themeKey, t); } catch { /* ignore */ }
  };

  const setZoneColor = (zone: "work" | "meet" | "break", color: string) => {
    setCustomFloorColors(prev => ({ ...prev, [zone]: color }));
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

  const moveItem = (id: string, col: number, row: number) => {
    setPlacedItems(prev => prev.map(i =>
      i.id === id ? { ...i, col, row } : i
    ));
  };

  const addRoomTemplate = (templateId: string, baseCol: number = 1, baseRow: number = 7) => {
    const template = ROOM_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    const newItems: PlacedItem[] = template.items.map(item => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: item.type,
      col: baseCol + item.col,
      row: baseRow + item.row,
      rotation: (item.rotation ?? 0) as 0 | 1 | 2 | 3,
    }));
    setPlacedItems(prev => [...prev, ...newItems]);
  };

  // Restore to default layout (not an empty slate)
  const clearAll = () => setPlacedItems(DEFAULT_OFFICE_LAYOUT);

  const toggleEditor = () => {
    setEditorMode(prev => {
      if (prev) setSelectedTool(null);
      return !prev;
    });
  };

  return {
    editorMode, selectedTool, setSelectedTool,
    placedItems, placeItem, removeItem, rotateItem, moveItem, clearAll, toggleEditor,
    floorTheme, setFloorTheme,
    customFloorColors, setZoneColor,
    addRoomTemplate,
  };
}
