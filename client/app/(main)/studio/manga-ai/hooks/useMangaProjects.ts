"use client";

import { useState, useEffect, useCallback } from "react";
import type { LayoutDef, PanelStacks } from "../data";
import { LAYOUTS } from "../data";
import {
  LEGACY_STORAGE_KEY,
  getAllProjectsFromDB,
  saveProjectToDB,
  deleteProjectFromDB,
  savePageDrawingToDB,
  migrateStoredPageToStacks,
  cleanupLegacyMockData,
  stripLegacyMockProjects,
} from "../lib/mangaStorage";

import type { LayerItem } from "../data";

export interface MangaProjectPage {
  pageNumber: number;
  layoutId: string;
  panels: Record<string, string>; // panelId -> dataUrl (ảnh nét vẽ)
  layers?: LayerItem[];
  activeLayerId?: string;
}

export interface MangaProject {
  id: string;
  title: string;
  genre: string;
  description: string;
  coverUrl?: string;
  createdAt: number;
  updatedAt: number;
  status: "draft" | "published";
  pages: MangaProjectPage[];
}

const ACTIVE_PROJECT_KEY = "animan_manga_active_project_id_v1";

export function useMangaProjects() {
  const [projects, setProjects] = useState<MangaProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Khởi tạo và nạp dữ liệu từ IndexedDB, dọn dẹp mock data cũ
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Dọn dẹp mock data và các key vẽ chung cũ
    cleanupLegacyMockData();

    async function loadData() {
      try {
        let list = await getAllProjectsFromDB();

        // Di chuyển (migrate) dữ liệu thật cũ từ localStorage sang IndexedDB nếu có
        if (!list || list.length === 0) {
          const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                // Lọc bỏ triệt để mock data (cùng bộ lọc với cleanupLegacyMockData)
                const realProjects = stripLegacyMockProjects(parsed);
                for (const p of realProjects) {
                  await saveProjectToDB(p);
                  for (const pg of p.pages || []) {
                    if (pg.panels && Object.keys(pg.panels).length > 0) {
                      // Nâng cấp thẳng lên Schema v2 khi di chuyển từ localStorage
                      await savePageDrawingToDB(
                        p.id,
                        pg.pageNumber,
                        migrateStoredPageToStacks(pg),
                        pg.layoutId,
                        pg.panels,
                      );
                    }
                  }
                }
                list = realProjects;
              }
            } catch {
              // ignore parse error
            }
          }
        }

        const cleanedList = stripLegacyMockProjects(list || []);

        setProjects(cleanedList);

        const savedActiveId = localStorage.getItem(ACTIVE_PROJECT_KEY);
        if (savedActiveId && cleanedList.some((p) => p.id === savedActiveId)) {
          setActiveProjectId(savedActiveId);
        } else if (cleanedList.length > 0) {
          setActiveProjectId(cleanedList[0].id);
        } else {
          setActiveProjectId("");
        }
      } catch {
        setProjects([]);
        setActiveProjectId("");
      } finally {
        setIsLoaded(true);
      }
    }

    loadData();
  }, []);

  // Chọn dự án
  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    }
  }, []);

  // Tạo dự án mới (bắt đầu từ trạng thái sạch, không có mock data)
  const createProject = useCallback(
    (title: string, genre: string, description: string): MangaProject => {
      const newProj: MangaProject = {
        id: `proj-${Date.now()}`,
        title: title.trim() || "Tác phẩm Manga mới",
        genre: genre || "Action",
        description: description.trim() || "Mô tả truyện ngắn gọn...",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "draft",
        pages: [
          { pageNumber: 1, layoutId: "classic-5", panels: {} },
        ],
      };

      const updated = [newProj, ...projects];
      setProjects(updated);
      saveProjectToDB(newProj);
      selectProject(newProj.id);
      return newProj;
    },
    [projects, selectProject],
  );

  // Cập nhật thông tin dự án
  const updateProject = useCallback(
    (id: string, partial: Partial<MangaProject>) => {
      setProjects((prev) => {
        const updated = prev.map((p) => {
          if (p.id !== id) return p;
          const next = { ...p, ...partial, updatedAt: Date.now() };
          saveProjectToDB(next);
          return next;
        });
        return updated;
      });
    },
    [],
  );

  // Xóa dự án (xóa khỏi IndexedDB và xóa tất cả nét vẽ của dự án)
  const deleteProject = useCallback(
    (id: string) => {
      const filtered = projects.filter((p) => p.id !== id);
      setProjects(filtered);
      deleteProjectFromDB(id);

      if (activeProjectId === id) {
        if (filtered.length > 0) {
          selectProject(filtered[0].id);
        } else {
          setActiveProjectId("");
          if (typeof window !== "undefined") {
            localStorage.removeItem(ACTIVE_PROJECT_KEY);
          }
        }
      }
    },
    [projects, activeProjectId, selectProject],
  );

  // Lưu nét vẽ của một trang (Schema v2 — ngăn xếp layer theo khung)
  const savePageData = useCallback(
    (
      pageNumber: number,
      layoutId: string,
      panels: Record<string, string>,
      stacks: PanelStacks,
    ) => {
      if (!activeProjectId) return;

      // 1. Lưu vào IndexedDB bất đồng bộ (Schema v2 — spec 02 §3.3)
      savePageDrawingToDB(activeProjectId, pageNumber, stacks, layoutId, panels);

      // 2. Đồng bộ vào state React (state giữ composite để xem trang ngoài studio)
      setProjects((prevProjects) => {
        const next = prevProjects.map((p) => {
          if (p.id !== activeProjectId) return p;
          const pageExists = p.pages.some((pg) => pg.pageNumber === pageNumber);
          let newPages: MangaProjectPage[];
          if (pageExists) {
            newPages = p.pages.map((pg) =>
              pg.pageNumber === pageNumber ? { ...pg, layoutId, panels } : pg,
            );
          } else {
            newPages = [...p.pages, { pageNumber, layoutId, panels }].sort(
              (a, b) => a.pageNumber - b.pageNumber,
            );
          }
          const updatedProj: MangaProject = {
            ...p,
            pages: newPages,
            updatedAt: Date.now(),
          };
          saveProjectToDB(updatedProj);
          return updatedProj;
        });
        return next;
      });
    },
    [activeProjectId],
  );

  // Thêm trang mới vào dự án
  const addPageToProject = useCallback(
    (layoutId = "classic-5") => {
      if (!activeProjectId) return 1;
      const targetProj = projects.find((p) => p.id === activeProjectId);
      if (!targetProj) return 1;

      const nextNum =
        targetProj.pages.length > 0
          ? Math.max(...targetProj.pages.map((pg) => pg.pageNumber)) + 1
          : 1;

      const newPage: MangaProjectPage = {
        pageNumber: nextNum,
        layoutId,
        panels: {},
      };

      const updatedPages = [...targetProj.pages, newPage];
      updateProject(activeProjectId, { pages: updatedPages });
      return nextNum;
    },
    [activeProjectId, projects, updateProject],
  );

  // Xóa trang khỏi dự án
  const removePageFromProject = useCallback(
    (pageNumber: number) => {
      if (!activeProjectId) return;
      const targetProj = projects.find((p) => p.id === activeProjectId);
      if (!targetProj || targetProj.pages.length <= 1) return; // Giữ ít nhất 1 trang

      const filteredPages = targetProj.pages
        .filter((pg) => pg.pageNumber !== pageNumber)
        .map((pg, idx) => ({ ...pg, pageNumber: idx + 1 })); // Đánh số lại thứ tự

      updateProject(activeProjectId, { pages: filteredPages });
    },
    [activeProjectId, projects, updateProject],
  );

  // Đổi bố cục (layout) của một trang trong dự án
  const changePageLayout = useCallback(
    (pageNumber: number, layoutId: string) => {
      if (!activeProjectId) return;
      const targetProj = projects.find((p) => p.id === activeProjectId);
      if (!targetProj) return;

      const updatedPages = targetProj.pages.map((pg) =>
        pg.pageNumber === pageNumber ? { ...pg, layoutId } : pg,
      );

      updateProject(activeProjectId, { pages: updatedPages });
    },
    [activeProjectId, projects, updateProject],
  );

  // Xuất bản tác phẩm
  const publishProject = useCallback(
    (id: string) => {
      updateProject(id, { status: "published" });
    },
    [updateProject],
  );

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  return {
    projects,
    activeProjectId,
    activeProject,
    isLoaded,
    selectProject,
    createProject,
    updateProject,
    deleteProject,
    savePageData,
    addPageToProject,
    removePageFromProject,
    changePageLayout,
    publishProject,
  };
}
