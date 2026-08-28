import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { Plus, MoreVertical, Edit2, Trash2, Check, X, Folder, Layers } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ProductivitySidebarProps {
  activeGroupId: string;
  setActiveGroupId: (id: string) => void;
}

export function ProductivitySidebar({ activeGroupId, setActiveGroupId }: ProductivitySidebarProps) {
  const { t } = useTranslation();
  const { groups, addGroup, updateGroup, deleteGroup, settings } = useAppStore();
  
  const [newGroupName, setNewGroupName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup = { id: uuidv4(), name: newGroupName.trim(), color: 'indigo' };
    addGroup(newGroup);
    setNewGroupName('');
    setActiveGroupId(newGroup.id);
  };

  const handleEdit = (group: {id: string, name: string}) => {
    setEditingId(group.id);
    setEditName(group.name);
    setShowOptionsId(null);
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

  const isAr = settings.language === 'ar';

  return (
    <div className="w-full md:w-64 flex flex-col gap-4 bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm h-auto md:h-full overflow-y-auto">
      <h3 className="font-bold text-lg px-2 flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
        <Layers size={18} className="text-indigo-600 dark:text-indigo-400" />
        {isAr ? 'المجموعات' : 'Groups'}
      </h3>

      <div className="flex flex-col gap-1 flex-1">
        <button
          onClick={() => setActiveGroupId('all')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
            activeGroupId === 'all'
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Folder size={16} />
          <span>{isAr ? 'كل المجموعات' : 'All Groups'}</span>
        </button>
        
        <button
          onClick={() => setActiveGroupId('none')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
            activeGroupId === 'none'
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Folder size={16} />
          <span>{isAr ? 'بدون مجموعة' : 'No Group'}</span>
        </button>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-2"></div>

        {groups.map(group => (
          <div key={group.id} className="relative group/item">
            {editingId === group.id ? (
              <div className="flex items-center gap-1 p-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                  className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
                <button onClick={handleSaveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-md">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div 
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-sm font-medium cursor-pointer ${
                  activeGroupId === group.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
                onClick={() => setActiveGroupId(group.id)}
              >
                <div className="flex items-center gap-3 truncate">
                  <Folder size={16} />
                  <span className="truncate">{group.name}</span>
                </div>
                
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowOptionsId(showOptionsId === group.id ? null : group.id);
                    }}
                    className={`p-1 rounded-md transition-colors ${showOptionsId === group.id ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200' : 'text-transparent group-hover/item:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                  >
                    <MoreVertical size={14} />
                  </button>
                  
                  {showOptionsId === group.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={(e) => { e.stopPropagation(); setShowOptionsId(null); }}
                      />
                      <div className={`absolute z-20 ${isAr ? 'right-full mr-1' : 'left-full ml-1'} top-0 w-32 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg py-1`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(group); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <Edit2 size={14} /> {isAr ? 'تعديل' : 'Edit'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteGroup(group.id);
                            if (activeGroupId === group.id) setActiveGroupId('all');
                            setShowOptionsId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        >
                          <Trash2 size={14} /> {isAr ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleAddGroup)}
            placeholder={isAr ? 'مجموعة جديدة...' : 'New group...'}
            className="flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-800 dark:text-zinc-200"
          />
          <button
            onClick={handleAddGroup}
            disabled={!newGroupName.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center p-2 rounded-xl transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
