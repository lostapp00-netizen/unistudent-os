import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function GroupsManager() {
  const { t } = useTranslation();
  const { groups, addGroup, updateGroup, deleteGroup, settings } = useAppStore();
  const [newGroupName, setNewGroupName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-200 dark:border-zinc-800">
      <h3 className="text-xl font-bold mb-6">{settings.language === 'ar' ? 'إدارة المجموعات (الإنتاجية)' : 'Manage Groups (Productivity)'}</h3>
      
      <div className="space-y-4">
        {groups.map(group => (
          <div key={group.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
            {editingId === group.id ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                  className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <button onClick={handleSaveEdit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg">
                  <Check size={16} />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <span className="font-medium px-2">{group.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleEdit(group)} className="p-2 text-zinc-500 hover:text-indigo-600 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => deleteGroup(group.id)} className="p-2 text-zinc-500 hover:text-rose-600 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        <div className="flex items-center gap-2 mt-4">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleAdd)}
            placeholder={settings.language === 'ar' ? 'اسم المجموعة الجديدة...' : 'New group name...'}
            className="flex-1 border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleAdd}
            disabled={!newGroupName.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center p-2.5 rounded-xl transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
