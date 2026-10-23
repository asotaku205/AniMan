"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_REGION_DESCRIPTIONS, COLS, DEFAULT_CHARACTERS, DEFAULT_MAP,
  HEX_R, REGION_NAMES, ROWS, TERRAIN_LIST, hexCenter,
  parseWorldDescription, type CaptureFrame, type HexCell,
  type TerrainType, type WorldCharacter, type WorldMode,
} from "../data";

const WORLD_STORAGE_KEY = "animan-world-builder-v1";

interface SavedWorld {
  hexMap: HexCell[][];
  characters: WorldCharacter[];
}

function loadSavedWorld(): SavedWorld | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORLD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedWorld;
    if (!Array.isArray(parsed.hexMap) || !Array.isArray(parsed.characters))
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useWorldBuilder() {
  // Map state — khôi phục từ bản đã lưu (trước đây F5 là mất hết)
  const [hexMap, setHexMap] = useState<HexCell[][]>(
    () =>
      loadSavedWorld()?.hexMap ??
      DEFAULT_MAP.map((row, r) => row.map((terrain, c) => ({
        col: c, row: r, terrain,
        name: REGION_NAMES[`${c}-${r}`],
      })))
  );
  const [brushTerrain, setBrushTerrain] = useState<TerrainType>("plains");
  const [isPainting, setIsPainting] = useState(false);
  const [selectedHex, setSelectedHex] = useState<{ col: number; row: number } | null>(null);
  const [hoveredHex, setHoveredHex] = useState<{ col: number; row: number } | null>(null);

  // Mode
  const [mode, setMode] = useState<WorldMode>("map");

  // Characters
  const [characters, setCharacters] = useState<WorldCharacter[]>(
    () => loadSavedWorld()?.characters ?? DEFAULT_CHARACTERS,
  );

  // Lưu bền: bản đồ + nhân vật tự ghi lại mỗi khi thay đổi
  const firstSaveRef = useRef(true);
  useEffect(() => {
    if (firstSaveRef.current) {
      firstSaveRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(
        WORLD_STORAGE_KEY,
        JSON.stringify({ hexMap, characters } satisfies SavedWorld),
      );
    } catch {
      // Hết dung lượng hoặc trình duyệt chặn — bỏ qua, không chặn thao tác
    }
  }, [hexMap, characters]);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [addCharAt, setAddCharAt] = useState<{ col: number; row: number } | null>(null);
  const [placingChar, setPlacingChar] = useState(false);

  // Camera
  const [cameraElevation, setCameraElevation] = useState(35);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(1);

  // Capture
  const [captureFrame, setCaptureFrame] = useState<CaptureFrame | null>(null);

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [generatingWorld, setGeneratingWorld] = useState(false);

  // Description input
  const [showDescPanel, setShowDescPanel] = useState(true);
  const [worldDesc, setWorldDesc] = useState("");
  const [generatingFromDesc, setGeneratingFromDesc] = useState(false);
  const [genStep, setGenStep] = useState<number>(COLS * ROWS);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 2500);
  }, []);

  // Paint hex
  const paintHex = useCallback((col: number, row: number) => {
    if (mode !== "map") return;
    setHexMap(prev => prev.map((r, ri) => ri !== row ? r : r.map((h, ci) => ci !== col ? h : { ...h, terrain: brushTerrain })));
    setSelectedHex({ col, row });
    setAiDescription(null);
  }, [mode, brushTerrain]);

  // AI description
  const generateDescription = useCallback(() => {
    if (!selectedHex) return;
    setAiLoading(true); setAiDescription(null);
    const terrain = hexMap[selectedHex.row][selectedHex.col].terrain;
    setTimeout(() => {
      const descs = AI_REGION_DESCRIPTIONS[terrain];
      setAiDescription(descs[Math.floor(Math.random() * descs.length)]);
      setAiLoading(false);
    }, 1400);
  }, [selectedHex, hexMap]);

  // AI generate world
  const generateWorld = useCallback(() => {
    setGeneratingWorld(true);
    setTimeout(() => {
      const terrains: TerrainType[] = ["sea","sea","sea","plains","plains","forest","mountain","city","desert","snow","magic"];
      setHexMap(prev => prev.map((row, r) => row.map((h, c) => ({
        ...h,
        terrain: Math.random() < 0.45 ? "sea" : terrains[Math.floor(Math.random() * terrains.length)],
      }))));
      setGeneratingWorld(false);
      showToast("✓ AI đã tạo bản đồ thế giới mới");
    }, 2200);
  }, [showToast]);

  // Generate from description
  const generateFromDesc = useCallback(() => {
    if (!worldDesc.trim()) return;
    setGeneratingFromDesc(true);
    setGenStep(0);
    setTimeout(() => {
      const newTerrains = parseWorldDescription(worldDesc);
      setHexMap(prev => prev.map((row, r) => row.map((h, c) => ({
        ...h, terrain: newTerrains[r]?.[c] ?? h.terrain,
        name: REGION_NAMES[`${c}-${r}`],
      }))));
      const total = COLS * ROWS;
      let step = 0;
      const interval = setInterval(() => {
        step += 8;
        setGenStep(step);
        if (step >= total) {
          clearInterval(interval);
          setGenStep(total);
          setGeneratingFromDesc(false);
          showToast("✓ Thế giới đã được tạo từ mô tả của bạn");
        }
      }, 30);
    }, 1600);
  }, [worldDesc, showToast]);

  // Capture frame from hex
  const startCapture = useCallback((col: number, row: number) => {
    const { cx, cy } = hexCenter(col, row, HEX_R);
    setCaptureFrame({ x1: cx - 60, y1: cy - 40, x2: cx + 60, y2: cy + 40 });
  }, []);

  // Get terrains inside capture frame
  const getCapturedTerrains = useCallback((): TerrainType[][] => {
    if (!captureFrame) return [];
    const result: TerrainType[][] = [];
    for (let r = 0; r < ROWS; r++) {
      const rowData: TerrainType[] = [];
      for (let c = 0; c < COLS; c++) {
        const { cx, cy } = hexCenter(c, r, HEX_R);
        if (cx >= captureFrame.x1 && cx <= captureFrame.x2 && cy >= captureFrame.y1 && cy <= captureFrame.y2) {
          rowData.push(hexMap[r][c].terrain);
        }
      }
      if (rowData.length > 0) result.push(rowData);
    }
    return result.length > 0 ? result : [["plains"]];
  }, [captureFrame, hexMap]);

  const selectedCell = selectedHex ? hexMap[selectedHex.row]?.[selectedHex.col] : null;

  return {
    hexMap, setHexMap, brushTerrain, setBrushTerrain,
    isPainting, setIsPainting, selectedHex, setSelectedHex,
    hoveredHex, setHoveredHex, mode, setMode,
    characters, setCharacters, selectedChar, setSelectedChar,
    addCharAt, setAddCharAt, placingChar, setPlacingChar,
    cameraElevation, setCameraElevation, cameraRotation, setCameraRotation,
    cameraZoom, setCameraZoom, captureFrame, setCaptureFrame,
    aiLoading, aiDescription, generatingWorld, showDescPanel, setShowDescPanel,
    worldDesc, setWorldDesc, generatingFromDesc, genStep, toast, showToast,
    paintHex, generateDescription, generateWorld, generateFromDesc,
    startCapture, getCapturedTerrains, selectedCell,
  };
}

export type WorldBuilderState = ReturnType<typeof useWorldBuilder>;
