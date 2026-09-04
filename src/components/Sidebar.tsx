"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarCheck, Settings, Home, TrendingUp, Globe } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useLang } from "@/lib/useLanguage";

export function Sidebar() {
  const pathname = usePathname();
  const { lang, t, toggleLang } = useLang();

  // Hide sidebar on the auth page
  if (pathname === "/") return null;

  const navItems = [
    { href: "/dashboard", label: t.sidebar.dashboard, icon: Home },
    { href: "/academic", label: t.sidebar.academic, icon: BookOpen },
    { href: "/productivity", label: t.sidebar.productivity, icon: CalendarCheck },
    { href: "/insights", label: t.sidebar.insights, icon: TrendingUp },
    { href: "/settings", label: t.sidebar.settings, icon: Settings },
  ];

  return (
    <aside className={`w-64 bg-white dark:bg-[#0a0a0a] border-gray-100 dark:border-gray-800 flex flex-col h-screen p-4 shadow-xl z-50 ${lang === 'ar' ? 'border-l' : 'border-r'}`}>
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 rounded-xl bg-black dark:bg-white shadow-md flex items-center justify-center text-white dark:text-black font-bold text-xl">
          U
        </div>
        <h1 className="font-bold text-xl text-black dark:text-white">
          Students OS
        </h1>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${
                isActive
                  ? "bg-gray-100 dark:bg-gray-900 text-black dark:text-white font-bold"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "scale-110" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
              <span className="font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
        <button 
          onClick={toggleLang}
          className="flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-xl transition-colors"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span>{t.sidebar.toggleLang}</span>
          </div>
        </button>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{lang === 'ar' ? 'المظهر' : 'Theme'}</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
