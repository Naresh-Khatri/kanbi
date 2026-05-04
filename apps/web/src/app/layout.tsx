import "@/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000"),
  title: "Kanbi",
  description: "A fast, keyboard-first kanban.",
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${geist.variable} dark`} lang="en">
      <body className="bg-[#0b0b0f] text-white antialiased">
        <TRPCReactProvider>{children}</TRPCReactProvider>
        <Toaster position="bottom-right" theme="dark" />
      </body>
    </html>
  );
}
