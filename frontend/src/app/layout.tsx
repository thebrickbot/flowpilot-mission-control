import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Space_Grotesk, DM_Serif_Display } from "next/font/google";

import { AuthProvider } from "@/components/providers/AuthProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { GlobalLoader } from "@/components/ui/global-loader";

export const metadata: Metadata = {
  title: "FlowPilot Mission Control",
  description: "A calm command center for every AI workflow.",
  icons: {
    icon: "/favicon.png",
  },
};

// Space Grotesk — primary UI font (body + headings)
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
});

// Space Grotesk also drives headings (consistent brand feel)
const headingFont = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
  weight: ["500", "600", "700"],
});

// DM Serif Display — display / editorial use only
const displayFont = DM_Serif_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400"],
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${headingFont.variable} ${displayFont.variable} min-h-screen bg-app text-strong antialiased`}
      >
        <AuthProvider>
          <QueryProvider>
            <GlobalLoader />
            {children}
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
