"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Locale, dict } from "./dictionaries";

type LangContextType = {
  lang: Locale;
  t: typeof dict.ar;
  toggleLang: () => void;
};

const LangContext = createContext<LangContextType>({ 
  lang: "ar", 
  t: dict.ar, 
  toggleLang: () => {} 
});

export const LangProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Locale>("ar");

  useEffect(() => {
    const saved = localStorage.getItem("app-lang") as Locale;
    if (saved === "ar" || saved === "en") {
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    localStorage.setItem("app-lang", lang);
  }, [lang]);

  const toggleLang = () => setLang(prev => prev === "ar" ? "en" : "ar");
  const t = dict[lang];

  return (
    <LangContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
