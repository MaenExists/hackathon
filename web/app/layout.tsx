import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Corridor | Kerala intelligence lab",
  description:
    "Independent synthetic-data prototype for evidence-linked corridor analysis and resource planning.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
