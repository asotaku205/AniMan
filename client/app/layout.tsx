import "./styles/globals.css";
import "./styles/fonts.css";
import "./styles/theme.css";

export const metadata = {
  title: "AniMan",
  description: "Nền tảng tiêu thụ và sáng tạo nội dung",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}