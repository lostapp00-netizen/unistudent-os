import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface GroupsManagerProps {
  embedded?: boolean;
}

export function GroupsManager({ embedded = false }: GroupsManagerProps) {
  const { t } = useTranslation();
  const { groups, addGroup, updateGroup, deleteGroup, settings } = useAppStore();
  const [newGroupName, setNewGroupName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const isAr = settings.language === 'ar';

  const handleAdd = () => {
    if (!newGroupName.trim()) return;
    addGroup({ id: uuidv4(), name: newGroupName.trim(), color: 'indigo' });
    setNewGroupName('');
  };

  const handleEdit = (group: {id: string, name: string}) => {
    setEditingId(group.id);
    setEditName(group.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      updateGroup(editingId, { name: editName.trim() });
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      action();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const content = (
    <div className="space-y-3 w-full max-w-full min-w-0">
      {groups.length === 0 && (
        <p className="text-xs text-zinc-400 py-2 text-center">
          {isAr ? 'لا توجد مجموعات حالياً. أضف مجموعة جديدة بالأسفل.' : 'No groups yet. Add a new group below.'}
        </p>
      )}

      {groups.map(group => (
        <div key={group.id} className="flex items-center justify-between p-2.5 sm:p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 gap-2 min-w-0">
          {editingId === group.id ? (
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                className="flex-1 min-w-0 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button 
                onClick={handleSaveEdit} 
                className="shrink-0 p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors cursor-pointer"
                title={isAr ? 'حفظ' : 'Save'}
              >
                <Check size={16} />
              </button>
              <button 
                onClick={() => setEditingId(null)} 
                className="shrink-0 p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                title={isAr ? 'إلغاء' : 'Cancel'}
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <span className="font-medium text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 px-1 truncate min-w-0 flex-1">
                {group.name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button 
                  onClick={() => handleEdit(group)} 
                  className="p-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all shadow-xs cursor-pointer"
                  title={isAr ? 'تعديل' : 'Edit'}
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={() => deleteGroup(group.id)} 
                  className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-xs cursor-pointer"
                  title={isAr ? 'حذف' : 'Delete'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2 pt-2 w-full max-w-full min-w-0">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, handleAdd)}
          placeholder={isAr ? 'اسم المجموعة الجديدة...' : 'New group name...'}
          className="flex-1 min-w-0 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3.5 py-2 bg-zinc-50/70 dark:bg-zinc-800/50 outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm font-medium"
        />
        <button
          onClick={handleAdd}
          disabled={!newGroupName.trim()}
          className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center p-2 sm:p-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
          title={isAr ? 'إضافة' : 'Add'}
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-zinc-200 dark:border-zinc-800 w-full max-w-full min-w-0">
      <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">{isAr ? 'إدارة المجموعات (الإنتاجية)' : 'Manage Groups (Productivity)'}</h3>
      {content}
    </div>
  );
}
