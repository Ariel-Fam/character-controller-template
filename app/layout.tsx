import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Blue Character Template", description: "Full-body characters, Goku flight, keyboard and controller playground." };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
