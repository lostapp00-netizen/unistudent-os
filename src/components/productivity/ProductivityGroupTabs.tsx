import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';
import { Plus, MoreVertical, Edit2, Trash2, Check, X, Folder, Layers } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ProductivityGroupTabsProps {
  activeGroupId: string;
  setActiveGroupId: (id: string) => void;
}

export function ProductivityGroupTabs({ activeGroupId, setActiveGroupId }: ProductivityGroupTabsProps) {
  const { t } = useTranslation();
  const { groups, addGroup, updateGroup, deleteGroup, settings } = useAppStore();
  
  const [isAdding, setIsAdding] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);

  const isAr = settings.language === 'ar';

  const handleAddGroup = () => {
    if (!newGroupName.trim()) {
      setIsAdding(false);
      return;
    }
    const newGroup = { id: uuidv4(), name: newGroupName.trim(), color: 'indigo' };
    addGroup(newGroup);
    setNewGroupName('');
    setIsAdding(false);
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
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setEditingId(null);
    }
  };

  const selectedOptionsGroup = groups.find(g => g.id === showOptionsId);

  return (
    <>
      <div className="relative z-10 w-full max-w-full min-w-0 shrink-0 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setActiveGroupId('all')}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium border ${
            activeGroupId === 'all'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        >
          <Layers size={16} />
          <span>{isAr ? 'الكل' : 'All'}</span>
        </button>

        <button
          onClick={() => setActiveGroupId('none')}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium border ${
            activeGroupId === 'none'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        >
          <Folder size={16} />
          <span>{isAr ? 'بدون مجموعة' : 'No Group'}</span>
        </button>

        <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800 mx-1 flex-shrink-0"></div>

        {groups.map(group => (
          <div key={group.id} className="relative flex-shrink-0 group/item flex items-center">
            {editingId === group.id ? (
              <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-indigo-500 rounded-xl px-2 py-1 shadow-sm h-[38px]">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                  className="w-24 bg-transparent outline-none text-sm font-medium px-1"
                  autoFocus
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleSaveEdit}
                  className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                  title={isAr ? 'حفظ' : 'Save'}
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setEditingId(null)}
                  className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors"
                  title={isAr ? 'إلغاء' : 'Cancel'}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div 
                className={`flex items-center gap-1 px-3 py-2 rounded-xl transition-all text-sm font-medium border cursor-pointer ${
                  activeGroupId === group.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
                onClick={() => setActiveGroupId(group.id)}
              >
                <Folder size={16} className={activeGroupId === group.id ? 'text-indigo-200' : 'text-zinc-400'} />
                <span className="truncate max-w-[120px]">{group.name}</span>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptionsId(group.id);
                  }}
                  className={`p-1 rounded-md transition-colors ml-1 rtl:ml-0 rtl:mr-1 ${
                    activeGroupId === group.id 
                      ? 'text-indigo-200 hover:bg-indigo-700 hover:text-white' 
                      : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  title={isAr ? 'خيارات المجموعة' : 'Group Options'}
                >
                  <MoreVertical size={14} />
                </button>
              </div>
            )}
          </div>
        ))}

        {isAdding ? (
          <div className="flex-shrink-0 flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-indigo-500 rounded-xl px-2 py-1 shadow-sm h-[38px]">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleAddGroup)}
              placeholder={isAr ? 'اسم المجموعة...' : 'Group name...'}
              className="w-28 bg-transparent outline-none text-sm font-medium px-1"
              autoFocus
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddGroup}
              className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center"
              title={isAr ? 'إضافة المجموعة' : 'Add Group'}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setIsAdding(false); setNewGroupName(''); }}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors flex items-center justify-center"
              title={isAr ? 'إلغاء' : 'Cancel'}
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-dashed"
          >
            <Plus size={16} />
            <span>{isAr ? 'مجموعة جديدة' : 'Add Group'}</span>
          </button>
        )}
      </div>

      {/* Centered Modal for Group Options */}
      {selectedOptionsGroup && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowOptionsId(null)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Folder size={18} />
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                  {selectedOptionsGroup.name}
                </h3>
              </div>
              <button 
                onClick={() => setShowOptionsId(null)}
                className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  const grp = selectedOptionsGroup;
                  setShowOptionsId(null);
                  handleEdit(grp);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all text-left rtl:text-right"
              >
                <Edit2 size={16} />
                <span>{isAr ? 'تعديل اسم المجموعة' : 'Rename Group'}</span>
              </button>

              <button
                onClick={() => {
                  const grpId = selectedOptionsGroup.id;
                  setShowOptionsId(null);
                  deleteGroup(grpId);
                  if (activeGroupId === grpId) setActiveGroupId('all');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all text-left rtl:text-right"
              >
                <Trash2 size={16} />
                <span>{isAr ? 'حذف المجموعة' : 'Delete Group'}</span>
              </button>
            </div>

            <button
              onClick={() => setShowOptionsId(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
