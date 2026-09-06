import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Log kya bolenge — A world of possible decisions",
  description: "Explore launch and policy decisions in a shared isometric town. Inspect the people, evidence, and assumptions behind each outcome.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#091e2b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
