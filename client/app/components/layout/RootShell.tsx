"use client";
import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Các tab studio là không gian làm việc toàn màn hình: không hiện
  // footer để workspace dùng trọn chiều cao còn lại dưới header cố
  // định (Navbar đã sticky top-0). Trang ngoài studio vẫn có footer.
  const isStudio = pathname?.startsWith("/studio") ?? false;
  return (
    <div className="min-h-screen text-ink font-vn-sans">
      <Navbar />
      <main>{children}</main>
      {!isStudio && <Footer />}
    </div>
  );
}