"use client";

import { useState, useEffect, useCallback } from "react";
import type { LayoutDef } from "../data";
import { LAYOUTS } from "../data";

export interface MangaProjectPage {
  pageNumber: number;
  layoutId: string;
  panels: Record<string, string>; // panelId -> dataUrl (ảnh nét vẽ)
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

const STORAGE_KEY = "animan_manga_projects_v1";
const ACTIVE_PROJECT_KEY = "animan_manga_active_project_id_v1";

const DEFAULT_PROJECTS: MangaProject[] = [
  {
    id: "proj-1",
    title: "Chiến Binh Ánh Sáng",
    genre: "Action",
    description: "Hành trình của kiếm sĩ trẻ bảo vệ vương quốc khỏi thế lực bóng tối.",
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 3600000,
    status: "draft",
    pages: [
      { pageNumber: 1, layoutId: "classic-5", panels: {} },
      { pageNumber: 2, layoutId: "action-4", panels: {} },
      { pageNumber: 3, layoutId: "splash-3", panels: {} },
    ],
  },
  {
    id: "proj-2",
    title: "Ký Ức Mùa Hè",
    genre: "Romance",
    description: "Câu chuyện tình yêu tuổi học trò ngọt ngào dưới bóng cây phượng vĩ.",
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000,
    status: "draft",
    pages: [
      { pageNumber: 1, layoutId: "classic-5", panels: {} },
      { pageNumber: 2, layoutId: "manga-6", panels: {} },
    ],
  },
];

export function useMangaProjects() {
  const [projects, setProjects] = useState<MangaProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Khởi tạo và nạp dữ liệu từ localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let list: MangaProject[] = [];
      if (raw) {
        list = JSON.parse(raw);
      }
      if (!list || !Array.isArray(list) || list.length === 0) {
        list = DEFAULT_PROJECTS;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
      setProjects(list);

      const savedActiveId = localStorage.getItem(ACTIVE_PROJECT_KEY);
      if (savedActiveId && list.some((p) => p.id === savedActiveId)) {
        setActiveProjectId(savedActiveId);
      } else {
        setActiveProjectId(list[0]?.id ?? "");
      }
    } catch {
      setProjects(DEFAULT_PROJECTS);
      setActiveProjectId(DEFAULT_PROJECTS[0].id);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Đồng bộ projects vào localStorage
  const saveProjects = useCallback((newProjects: MangaProject[]) => {
    setProjects(newProjects);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProjects));
      } catch {
        // storage quota
      }
    }
  }, []);

  // Chọn dự án
  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    }
  }, []);

  // Tạo dự án mới
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
          { pageNumber: 2, layoutId: "action-4", panels: {} },
          { pageNumber: 3, layoutId: "splash-3", panels: {} },
        ],
      };

      const updated = [newProj, ...projects];
      saveProjects(updated);
      selectProject(newProj.id);
      return newProj;
    },
    [projects, saveProjects, selectProject],
  );

  // Cập nhật thông tin dự án
  const updateProject = useCallback(
    (id: string, partial: Partial<MangaProject>) => {
      const updated = projects.map((p) =>
        p.id === id ? { ...p, ...partial, updatedAt: Date.now() } : p,
      );
      saveProjects(updated);
    },
    [projects, saveProjects],
  );

  // Xóa dự án
  const deleteProject = useCallback(
    (id: string) => {
      const filtered = projects.filter((p) => p.id !== id);
      saveProjects(filtered);
      if (activeProjectId === id && filtered.length > 0) {
        selectProject(filtered[0].id);
      }
    },
    [projects, activeProjectId, saveProjects, selectProject],
  );

  // Lưu nét vẽ của một trang vào dự án hiện tại
  const savePageData = useCallback(
    (pageNumber: number, layoutId: string, panels: Record<string, string>) => {
      if (!activeProjectId) return;
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
          return { ...p, pages: newPages, updatedAt: Date.now() };
        });
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
    },
    [activeProjectId],
  );

  // Thêm trang mới vào dự án
  const addPageToProject = useCallback(
    (layoutId = "classic-5") => {
      if (!activeProjectId) return;
      const targetProj = projects.find((p) => p.id === activeProjectId);
      if (!targetProj) return;

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
