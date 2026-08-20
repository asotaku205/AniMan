import { BookOpen, FileText, Film, Globe, Lock, Palette } from "lucide-react";

export const WORK_TYPES = [
  { k: "manga", label: "Manga", icon: BookOpen, desc: "Truyện tranh" },
  { k: "novel", label: "Tiểu thuyết", icon: FileText, desc: "Tiểu Thuyết" },
  { k: "animation", label: "Hoạt hình", icon: Film, desc: "Phim hoạt hình" },
  { k: "fanart", label: "Fan Art", icon: Palette, desc: "Ảnh, tranh" },
] as const;

export type WorkType = (typeof WORK_TYPES)[number]["k"];

export const VISIBILITY_OPTIONS = [
  { k: "public", label: "Công khai", icon: Globe },
  { k: "unlisted", label: "Có link", icon: FileText },
  { k: "private", label: "Riêng tư", icon: Lock },
] as const;

export type VisibilityMode = (typeof VISIBILITY_OPTIONS)[number]["k"];
