"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/auth/AuthProvider";
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

export function AdminRoute({
  module,
  children,
}: {
  module?: string;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const routeModule =
    module ?? pathname.split("/").filter(Boolean).at(-1) ?? "dashboard";

  useEffect(() => {
    if (!isLoading && user?.role !== "admin") {
      router.replace(user ? "/" : "/auth");
    }
  }, [isLoading, router, user]);

  if (isLoading || user?.role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center bg-[#0b0612] text-white/70">
        Checking admin permissions...
      </div>
    );
  }

  return (
    <AdminPageClient
      initialActive={ROUTE_TO_MODULE[routeModule] ?? "dashboard"}
    >
      {children}
    </AdminPageClient>
  );
}
