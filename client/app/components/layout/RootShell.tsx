"use client";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen text-ink font-vn-sans">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}