"use client";

import { useEffect, useRef, useState } from "react";
import { FONTS, INITIAL_NOTES, INITIAL_TRACKS, type Note, type Track } from "../data";

export function useNovelStudio() {
  const [fontId, setFontId] = useState("caveat");
  const font = FONTS.find((f) => f.id === fontId)!.family;
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [notes, setNotes] = useState<Note[]>(INITIAL_NOTES);
  const [wordCount, setWordCount] = useState(0);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const recountWords = () => {
    const text = `${leftRef.current?.innerText ?? ""} ${rightRef.current?.innerText ?? ""}`;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  };

  useEffect(() => {
    recountWords();
  }, []);

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

  return {
    fontId, setFontId, font,
    tracks, setTracks,
    notes, setNotes,
    wordCount,
    leftRef, rightRef,
    recountWords,
    phase, progress, mm, ss, running,
    toggleRun, resetTimer, addNote,
  };
}

export type NovelStudioState = ReturnType<typeof useNovelStudio>;
