"use client";
import React, { useState } from "react";
import { Folder, StickyNote, CheckSquare, Calendar as CalendarIcon } from "lucide-react";
import DriveSection from "./components/DriveSection";
import NotesSection from "./components/NotesSection";
import TasksSection from "./components/TasksSection";
import CalendarSection from "./components/CalendarSection";

export default function ProductivityPage() {
  const [activeTab, setActiveTab] = useState("drive");

  const tabs = [
    { id: "drive", label: "مساحة التخزين", icon: Folder },
    { id: "notes", label: "الملاحظات", icon: StickyNote },
    { id: "tasks", label: "المهام", icon: CheckSquare },
    { id: "calendar", label: "التقويم", icon: CalendarIcon },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 h-[calc(100vh-4rem)] flex flex-col">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">قسم الإنتاجية</h1>
        <p className="text-gray-500 mt-1">نظم ملفاتك، مهامك، ملاحظاتك، ومواعيدك في مكان واحد.</p>
      </header>
      
      <div className="flex gap-2 p-1 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md rounded-2xl w-fit shadow-sm border border-gray-200/50 dark:border-gray-700/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all duration-300 ${activeTab === tab.id ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md scale-[1.02]" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"}`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden bg-white/40 dark:bg-gray-900/40 backdrop-blur-2xl border border-gray-200/60 dark:border-gray-800/60 rounded-3xl p-6 shadow-xl relative z-10">
        {activeTab === "drive" && <DriveSection />}
        {activeTab === "notes" && <NotesSection />}
        {activeTab === "tasks" && <TasksSection />}
        {activeTab === "calendar" && <CalendarSection />}
      </div>
    </div>
  );
}
