"use client";

import { usePathname } from "next/navigation";
import AdminPageClient from "../AdminPageClient";

const ROUTE_TO_MODULE: Record<string, string> = {
  dashboard: "dashboard",
  analytics: "analytics",
  anime: "anime",
  phim: "phim",
  manga: "manga",
  novel: "novel",
  categories: "categories",
  schedule: "schedule",
  users: "users",
  studio: "studio",
  watchparty: "watchparty",
  forum: "forum",
  reports: "reports",
  billing: "billing",
  roles: "roles",
  announcements: "announcements",
  audit: "audit",
  settings: "settings",
};

export function AdminRoute({ module, children }: { module?: string; children?: React.ReactNode }) {
  const pathname = usePathname();
  const routeModule = module ?? pathname.split("/").filter(Boolean).at(-1) ?? "dashboard";

  return <AdminPageClient initialActive={ROUTE_TO_MODULE[routeModule] ?? "dashboard"}>{children}</AdminPageClient>;
}
