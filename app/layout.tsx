import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "چوونەژوورەوە",
  description: "چوونەژوورەوە و پانێڵی بەڕێوەبردنی بەکارهێنەران",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ckb" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
