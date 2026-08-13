import { RootShell } from "../components/layout/RootShell";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
        <RootShell>{children}</RootShell>
  );
}