import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest cho client — phục vụ TDD cho logic thuần
 * (layer stack, công cụ vẽ, hợp đồng AI) trong epic Manga Studio.
 *
 * Chỉ test file `.test.ts`/`.test.tsx`; không đụng tới Next.js runtime.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    environment: "node",
  },
});
