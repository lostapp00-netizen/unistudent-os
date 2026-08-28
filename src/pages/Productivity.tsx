import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, StickyNote, CheckSquare, CalendarDays } from 'lucide-react';
import { TasksTab } from '../components/productivity/TasksTab';
import { NotesTab } from '../components/productivity/NotesTab';
import { DriveTab } from '../components/productivity/DriveTab';
import { CalendarTab } from '../components/productivity/CalendarTab';

type Tab = 'tasks' | 'notes' | 'drive' | 'calendar';

export function Productivity() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('tasks');

  const tabs = [
    { id: 'tasks', label: t('tasks'), icon: CheckSquare },
    { id: 'notes', label: t('notes'), icon: StickyNote },
    { id: 'drive', label: t('drive'), icon: HardDrive },
    { id: 'calendar', label: t('calendar'), icon: CalendarDays },
  ] as const;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{t('productivity')}</h1>
      </header>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>
      
      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === 'tasks' && <TasksTab />}
        {activeTab === 'notes' && <NotesTab />}
        {activeTab === 'drive' && <DriveTab />}
        {activeTab === 'calendar' && <CalendarTab />}
      </div>
    </div>
  );
}

