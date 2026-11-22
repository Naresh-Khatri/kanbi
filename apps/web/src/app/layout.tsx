import "@/styles/globals.css";

import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.BETTER_AUTH_URL || "http://kanbi.localhost:3333",
  ),
  title: "Kanbi",
  description: "The kanban your AI agents work from.",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      className={cn("dark", inter.variable, geistMono.variable)}
      lang="en"
    >
      <body className="antialiased">
        <TRPCReactProvider>
          <TooltipProvider>
            <ToastProvider>
              {/* isolate = base ui portal layering */}
              <div className="relative isolate flex min-h-dvh flex-col">
                {children}
              </div>
            </ToastProvider>
          </TooltipProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
