import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/Sidebar";
import { UserProvider } from "@/lib/useUser";
import { LangProvider } from "@/lib/useLanguage";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "University Students OS",
  description: "A comprehensive operating system for university students.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 selection:bg-indigo-500/30 transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LangProvider>
            <UserProvider>
              <Sidebar />
              <main className="flex-1 overflow-y-auto h-screen p-6 md:p-10 relative">
                <div className="max-w-6xl mx-auto h-full">
                  {children}
                </div>
              </main>
            </UserProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
