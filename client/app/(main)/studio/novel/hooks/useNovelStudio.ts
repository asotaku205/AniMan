"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FONTS, INITIAL_NOTES, INITIAL_TRACKS, type Note, type Track } from "../data";
import {
  applyWordDelta,
  chapterWords,
  createChapter,
  createNovel,
  createScene,
  moveOrdered,
  novelWords,
  sceneWords,
  SEED_LEFT,
  SEED_RIGHT,
  sortByOrder,
  todayKey,
  type Chapter,
  type Novel,
  type Scene,
} from "../lib/novel";
import {
  deleteChapterCascade,
  deleteNovelCascade,
  deleteScene,
  listChapters,
  listNovels,
  listScenes,
  saveChapter,
  saveNovel,
  saveScene,
} from "../lib/novelStorage";

export function useNovelStudio() {
  // ── Không khí viết (giữ nguyên như trước) ──────────────────────────────
  const [fontId, setFontId] = useState("caveat");
  const font = FONTS.find((f) => f.id === fontId)!.family;
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [wordCount, setWordCount] = useState(0);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // Pomodoro timer
  const [phase, setPhase] = useState<"work" | "break">("work");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          const nextPhase = phase === "work" ? "break" : "work";
          setPhase(nextPhase);
          return nextPhase === "work" ? 25 * 60 : 5 * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase]);

  const totalForPhase = phase === "work" ? 25 * 60 : 5 * 60;
  const progress = 1 - seconds / totalForPhase;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const addNote = () => {
    setNotes((n) => [...n, { id: Date.now(), text: "Ghi chú mới…", top: Math.min(80, 8 + n.length * 18), expanded: true }]);
  };

  const toggleRun = () => setRunning((r) => !r);
  const resetTimer = () => {
    setRunning(false);
    setPhase("work");
    setSeconds(25 * 60);
  };

  // ── Dữ liệu N1: tiểu thuyết → chương → cảnh, lưu bền ──────────────────
  const [novels, setNovels] = useState<Novel[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedNovelId, setSelectedNovelId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dataRef = useRef({ novels, chapters });
  dataRef.current = { novels, chapters };
  const lastSavedWordsRef = useRef<Map<string, number>>(new Map());
  const pendingSaveRef = useRef<Scene | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);

  const loadAll = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      let ns = await listNovels();
      let chs = await listChapters();
      let scs = await listScenes();
      if (ns.length === 0) {
        // Lần đầu: giữ lại nội dung demo cũ thành dữ liệu thật.
        const novel = createNovel("Tiểu thuyết mới");
        const c1 = createChapter(novel.id, 0, "Mưa xuân");
        const c2 = createChapter(novel.id, 1, "Tiếng chuông gió");
        const c3 = createChapter(novel.id, 2, "Cánh hoa cuối cùng");
        const s1 = createScene(c1.id, 0, "Cảnh 1", SEED_LEFT, SEED_RIGHT);
        const s2 = createScene(c2.id, 0, "Cảnh 1");
        const s3 = createScene(c3.id, 0, "Cảnh 1");
        await saveNovel(novel);
        for (const c of [c1, c2, c3]) await saveChapter(c);
        for (const s of [s1, s2, s3]) await saveScene(s);
        ns = [novel];
        chs = [c1, c2, c3];
        scs = [s1, s2, s3];
      }
      setNovels(ns);
      setChapters(chs);
      setScenes(scs);
      const m = new Map<string, number>();
      for (const sc of scs) m.set(sc.id, sceneWords(sc));
      lastSavedWordsRef.current = m;
      const firstNovel = [...ns].sort((a, b) => a.createdAt - b.createdAt)[0];
      const firstChapter = firstNovel
        ? sortByOrder(chs.filter((c) => c.novelId === firstNovel.id))[0]
        : undefined;
      const firstScene = firstChapter
        ? sortByOrder(scs.filter((s) => s.chapterId === firstChapter.id))[0]
        : undefined;
      setSelectedNovelId(firstNovel?.id ?? null);
      setSelectedChapterId(firstChapter?.id ?? null);
      setSelectedSceneId(firstScene?.id ?? null);
      setSaveError(null);
    } catch {
      setSaveError("Không tải được dữ liệu tiểu thuyết.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Lưu bản thảo đang chờ (debounce + khi chuyển cảnh + khi rời trang).
  const flushPendingSave = useCallback(async () => {
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    try {
      await saveScene(pending);
      const current = sceneWords(pending);
      const prev = lastSavedWordsRef.current.get(pending.id) ?? current;
      lastSavedWordsRef.current.set(pending.id, current);
      const delta = current - prev;
      if (delta !== 0) {
        const { novels: ns, chapters: chs } = dataRef.current;
        const chapter = chs.find((c) => c.id === pending.chapterId);
        const novel = ns.find((n) => n.id === chapter?.novelId);
        if (novel) {
          const updated: Novel = {
            ...novel,
            dailyWords: applyWordDelta(novel.dailyWords, todayKey(), delta),
            updatedAt: Date.now(),
          };
          setNovels((prevNovels) => prevNovels.map((n) => (n.id === updated.id ? updated : n)));
          await saveNovel(updated);
        }
      }
      setSaveError(null);
    } catch {
      pendingSaveRef.current = pending;
      setSaveError("Không lưu được bản thảo — kiểm tra lại rồi bấm thử lại.");
    }
  }, []);

  useEffect(() => {
    return () => {
      void flushPendingSave();
    };
  }, [flushPendingSave]);

  // Đổi cảnh thì nạp nội dung vào 2 trang giấy (gõ phím không reset).
  useEffect(() => {
    const scene = scenes.find((s) => s.id === selectedSceneId);
    if (leftRef.current) leftRef.current.innerText = scene?.contentLeft ?? "";
    if (rightRef.current) rightRef.current.innerText = scene?.contentRight ?? "";
    setWordCount(scene ? sceneWords(scene) : 0);
    // Chỉ reset khi đổi cảnh, không reset khi nội dung đổi lúc đang gõ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneId]);

  const onSceneInput = () => {
    const scene = scenes.find((s) => s.id === selectedSceneId);
    if (!scene) return;
    const updated: Scene = {
      ...scene,
      contentLeft: leftRef.current?.innerText ?? "",
      contentRight: rightRef.current?.innerText ?? "",
      updatedAt: Date.now(),
    };
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setWordCount(sceneWords(updated));
    pendingSaveRef.current = updated;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void flushPendingSave(), 600);
  };

  // ── Chọn ────────────────────────────────────────────────────────────────
  const firstSceneOf = useCallback(
    (chapterId: string | null, allScenes: Scene[]): Scene | undefined =>
      chapterId ? sortByOrder(allScenes.filter((s) => s.chapterId === chapterId))[0] : undefined,
    [],
  );

  const selectNovel = (id: string) => {
    void flushPendingSave();
    const chapter = sortByOrder(chapters.filter((c) => c.novelId === id))[0];
    setSelectedNovelId(id);
    setSelectedChapterId(chapter?.id ?? null);
    setSelectedSceneId(firstSceneOf(chapter?.id ?? null, scenes)?.id ?? null);
  };

  const selectChapter = (id: string) => {
    void flushPendingSave();
    setSelectedChapterId(id);
    setSelectedSceneId(firstSceneOf(id, scenes)?.id ?? null);
  };

  const selectScene = (id: string) => {
    void flushPendingSave();
    setSelectedSceneId(id);
  };

  // ── Thêm / đổi tên / xoá / di chuyển ────────────────────────────────────
  const addNovel = async (title: string) => {
    const novel = createNovel(title.trim() || "Tiểu thuyết mới");
    try {
      await saveNovel(novel);
      setNovels((prev) => [...prev, novel]);
      selectNovel(novel.id);
      setSaveError(null);
    } catch {
      setSaveError("Không tạo được tiểu thuyết.");
    }
  };

  const renameNovel = async (id: string, title: string) => {
    const novel = novels.find((n) => n.id === id);
    if (!novel || !title.trim()) return;
    const updated = { ...novel, title: title.trim(), updatedAt: Date.now() };
    setNovels((prev) => prev.map((n) => (n.id === id ? updated : n)));
    try {
      await saveNovel(updated);
    } catch {
      setSaveError("Không lưu được tên tiểu thuyết.");
    }
  };

  const deleteNovel = async (id: string) => {
    try {
      await deleteNovelCascade(id);
      const restNovels = novels.filter((n) => n.id !== id);
      const restChapters = chapters.filter((c) => c.novelId !== id);
      const chapterIds = new Set(chapters.filter((c) => c.novelId === id).map((c) => c.id));
      setNovels(restNovels);
      setChapters(restChapters);
      setScenes((prev) => prev.filter((s) => !chapterIds.has(s.chapterId)));
      if (selectedNovelId === id) {
        const next = [...restNovels].sort((a, b) => a.createdAt - b.createdAt)[0];
        if (next) selectNovel(next.id);
        else {
          setSelectedNovelId(null);
          setSelectedChapterId(null);
          setSelectedSceneId(null);
        }
      }
    } catch {
      setSaveError("Không xoá được tiểu thuyết.");
    }
  };

  const addChapter = async (title: string) => {
    if (!selectedNovelId) return;
    const siblings = chapters.filter((c) => c.novelId === selectedNovelId);
    const chapter = createChapter(
      selectedNovelId,
      siblings.length === 0 ? 0 : Math.max(...siblings.map((c) => c.order)) + 1,
      title.trim() || "Chương mới",
    );
    try {
      await saveChapter(chapter);
      setChapters((prev) => [...prev, chapter]);
      selectChapter(chapter.id);
    } catch {
      setSaveError("Không tạo được chương.");
    }
  };

  const renameChapter = async (id: string, title: string) => {
    const chapter = chapters.find((c) => c.id === id);
    if (!chapter || !title.trim()) return;
    const updated = { ...chapter, title: title.trim() };
    setChapters((prev) => prev.map((c) => (c.id === id ? updated : c)));
    try {
      await saveChapter(updated);
    } catch {
      setSaveError("Không lưu được tên chương.");
    }
  };

  const deleteChapter = async (id: string) => {
    try {
      await deleteChapterCascade(id);
      const rest = chapters.filter((c) => c.id !== id);
      setChapters(rest);
      setScenes((prev) => prev.filter((s) => s.chapterId !== id));
      if (selectedChapterId === id) {
        const novelId = chapters.find((c) => c.id === id)?.novelId ?? selectedNovelId;
        const next = novelId ? sortByOrder(rest.filter((c) => c.novelId === novelId))[0] : undefined;
        if (next) selectChapter(next.id);
        else {
          setSelectedChapterId(null);
          setSelectedSceneId(null);
        }
      }
    } catch {
      setSaveError("Không xoá được chương.");
    }
  };

  const moveChapter = async (id: string, dir: -1 | 1) => {
    if (!selectedNovelId) return;
    const siblings = chapters.filter((c) => c.novelId === selectedNovelId);
    const before = sortByOrder(siblings).map((c) => `${c.id}:${c.order}`).join(",");
    const reordered = moveOrdered(siblings, id, dir);
    if (reordered.map((c) => `${c.id}:${c.order}`).join(",") === before) return;
    const moved = new Map(reordered.map((c) => [c.id, c]));
    setChapters((prev) => prev.map((c) => moved.get(c.id) ?? c));
    try {
      for (const c of reordered) await saveChapter(c);
    } catch {
      setSaveError("Không lưu được thứ tự chương.");
    }
  };

  const addScene = async (title: string) => {
    if (!selectedChapterId) return;
    const siblings = scenes.filter((s) => s.chapterId === selectedChapterId);
    const scene = createScene(
      selectedChapterId,
      siblings.length === 0 ? 0 : Math.max(...siblings.map((s) => s.order)) + 1,
      title.trim() || "Cảnh mới",
    );
    try {
      await saveScene(scene);
      setScenes((prev) => [...prev, scene]);
      lastSavedWordsRef.current.set(scene.id, 0);
      selectScene(scene.id);
    } catch {
      setSaveError("Không tạo được cảnh.");
    }
  };

  const renameScene = async (id: string, title: string) => {
    const scene = scenes.find((s) => s.id === id);
    if (!scene || !title.trim()) return;
    const updated = { ...scene, title: title.trim() };
    setScenes((prev) => prev.map((s) => (s.id === id ? updated : s)));
    try {
      await saveScene(updated);
    } catch {
      setSaveError("Không lưu được tên cảnh.");
    }
  };

  const deleteSceneById = async (id: string) => {
    try {
      await deleteScene(id);
      const rest = scenes.filter((s) => s.id !== id);
      setScenes(rest);
      lastSavedWordsRef.current.delete(id);
      if (selectedSceneId === id) {
        const next = selectedChapterId ? sortByOrder(rest.filter((s) => s.chapterId === selectedChapterId))[0] : undefined;
        setSelectedSceneId(next?.id ?? null);
      }
    } catch {
      setSaveError("Không xoá được cảnh.");
    }
  };

  const moveScene = async (id: string, dir: -1 | 1) => {
    if (!selectedChapterId) return;
    const siblings = scenes.filter((s) => s.chapterId === selectedChapterId);
    const before = sortByOrder(siblings).map((x) => `${x.id}:${x.order}`).join(",");
    const reordered = moveOrdered(siblings, id, dir);
    if (reordered.map((x) => `${x.id}:${x.order}`).join(",") === before) return;
    const moved = new Map(reordered.map((s) => [s.id, s]));
    setScenes((prev) => prev.map((s) => moved.get(s.id) ?? s));
    try {
      for (const s of reordered) await saveScene(s);
    } catch {
      setSaveError("Không lưu được thứ tự cảnh.");
    }
  };

  const setGoal = async (wordsPerDay: number) => {
    const novel = novels.find((n) => n.id === selectedNovelId);
    if (!novel) return;
    const updated = { ...novel, goalWordsPerDay: Math.max(0, Math.round(wordsPerDay)), updatedAt: Date.now() };
    setNovels((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    try {
      await saveNovel(updated);
    } catch {
      setSaveError("Không lưu được mục tiêu.");
    }
  };

  // ── Thống kê ─────────────────────────────────────────────────────────────
  const selectedNovel = novels.find((n) => n.id === selectedNovelId) ?? null;
  const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null;
  const selectedScene = scenes.find((s) => s.id === selectedSceneId) ?? null;
  const novelChapters = selectedNovelId ? sortByOrder(chapters.filter((c) => c.novelId === selectedNovelId)) : [];
  const chapterScenes = selectedChapterId ? sortByOrder(scenes.filter((s) => s.chapterId === selectedChapterId)) : [];
  const novelScenes = selectedNovelId
    ? scenes.filter((s) => chapters.some((c) => c.id === s.chapterId && c.novelId === selectedNovelId))
    : [];
  const todayWords = selectedNovel ? (selectedNovel.dailyWords[todayKey()] ?? 0) : 0;

  return {
    fontId, setFontId, font,
    tracks, setTracks,
    notes, setNotes,
    wordCount,
    leftRef, rightRef,
    onSceneInput,
    phase, progress, mm, ss, running,
    toggleRun, resetTimer, addNote,
    // N1
    loading, saveError, reload: loadAll, retrySave: flushPendingSave,
    novels, chapters: novelChapters, scenes: chapterScenes,
    selectedNovel, selectedChapter, selectedScene,
    selectedNovelId, selectedChapterId, selectedSceneId,
    selectNovel, selectChapter, selectScene,
    addNovel, renameNovel, deleteNovel,
    addChapter, renameChapter, deleteChapter, moveChapter,
    addScene, renameScene, deleteScene: deleteSceneById, moveScene,
    setGoal,
    sceneWordCount: selectedScene ? sceneWords(selectedScene) : 0,
    chapterWordCount: chapterWords(chapterScenes),
    novelWordCount: novelWords(novelScenes),
    todayWords,
  };
}

export type NovelStudioState = ReturnType<typeof useNovelStudio>;
