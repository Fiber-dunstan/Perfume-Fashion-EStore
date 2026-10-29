import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your Store | Style, Scent & Everyday Essentials",
  description: "Shop fragrances, clothing, accessories and everyday essentials. Order online and confirm details with us before payment.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
