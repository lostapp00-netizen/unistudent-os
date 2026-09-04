"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FolderPlus, File as FileIcon, Folder, MoreVertical, Trash2, Edit2, Loader2, X, Download } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { useLang } from "@/lib/useLanguage";
import { Modal } from "@/components/Modal";

export default function DriveSection() {
  const { user } = useUser();
  const { lang, t } = useLang();
  
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState<string>(""); // "" means root
  
  // Modals state
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Actions menu state
  const [activeItemMenu, setActiveItemMenu] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchItems(currentPath);
    }
  }, [user, currentPath]);

  const fetchItems = async (path: string) => {
    if (!user) return;
    setLoading(true);
    try {
      // User isolated path: user_id/currentPath
      const basePath = path ? `${user.id}/${path}` : user.id;
      
      const { data, error } = await supabase.storage.from('student-drive').list(basePath, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });
      
      if (error) throw error;
      
      // Filter out dummy .keep files used for folders
      const filtered = data?.filter(item => item.name !== '.emptyFolderPlaceholder') || [];
      setItems(filtered);
    } catch (error) {
      console.error("Error fetching files", error);
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !user) return;
    
    try {
      const folderPath = currentPath ? `${user.id}/${currentPath}/${newFolderName}` : `${user.id}/${newFolderName}`;
      
      // Create a dummy file to instantiate the folder in Supabase
      const { error } = await supabase.storage.from('student-drive').upload(`${folderPath}/.emptyFolderPlaceholder`, new Blob([""]), {
        upsert: false
      });
      
      if (error) throw error;
      
      setIsNewFolderOpen(false);
      setNewFolderName("");
      fetchItems(currentPath);
    } catch (error) {
      console.error(error);
      alert("خطأ في إنشاء المجلد.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsUploading(true);
    try {
      const filePath = currentPath ? `${user.id}/${currentPath}/${file.name}` : `${user.id}/${file.name}`;
      
      const { error } = await supabase.storage.from('student-drive').upload(filePath, file, {
        upsert: true
      });
      
      if (error) throw error;
      fetchItems(currentPath);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء الرفع.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteItem = async (item: any) => {
    if (!user) return;
    if (!confirm(lang === 'ar' ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete this?")) return;
    
    try {
      const itemPath = currentPath ? `${user.id}/${currentPath}/${item.name}` : `${user.id}/${item.name}`;
      
      if (!item.id) {
        // It's a folder, we need to delete its contents first in a real scenario.
        // For MVP, we'll try to delete the folder path placeholder if it exists.
        await supabase.storage.from('student-drive').remove([`${itemPath}/.emptyFolderPlaceholder`]);
      } else {
        await supabase.storage.from('student-drive').remove([itemPath]);
      }
      
      fetchItems(currentPath);
      setActiveItemMenu(null);
    } catch (error) {
      console.error(error);
      alert("خطأ أثناء الحذف.");
    }
  };
  
  const handleDownload = async (item: any) => {
    if (!user || !item.id) return;
    const itemPath = currentPath ? `${user.id}/${currentPath}/${item.name}` : `${user.id}/${item.name}`;
    const { data, error } = await supabase.storage.from('student-drive').createSignedUrl(itemPath, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const navigateToFolder = (folderName: string) => {
    setCurrentPath(currentPath ? `${currentPath}/${folderName}` : folderName);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">{lang === 'ar' ? 'ملفاتي' : 'My Files'}</h2>
          <div className="flex items-center gap-2 mt-1">
            {currentPath && (
              <Button variant="outline" size="sm" onClick={navigateUp} className="h-7 text-xs">
                {lang === 'ar' ? 'الرجوع' : 'Back'}
              </Button>
            )}
            <p className="text-gray-500 text-sm font-medium" dir="ltr">
              / {currentPath || 'Root'}
            </p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <Button variant="outline" onClick={() => setIsNewFolderOpen(true)} className="flex-1 md:flex-none border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0a0a0a] hover:bg-gray-50 dark:hover:bg-gray-900">
            <FolderPlus className="w-5 h-5 ml-2" />
            {lang === 'ar' ? 'مجلد جديد' : 'New Folder'}
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex-1 md:flex-none bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200">
            {isUploading ? <Loader2 className="w-5 h-5 ml-2 animate-spin" /> : <Upload className="w-5 h-5 ml-2" />}
            {lang === 'ar' ? 'رفع ملف' : 'Upload'}
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex-1 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-gray-500" /></div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {items.map((item, i) => {
              const isFolder = !item.id; // Supabase list returns id for files, undefined for folders
              return (
                <div key={i} className="p-5 rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0a0a0a] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 relative group"
                  onClick={() => isFolder ? navigateToFolder(item.name) : null}
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveItemMenu(activeItemMenu === item.name ? null : item.name); }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all z-10"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  
                  {activeItemMenu === item.name && (
                    <div className="absolute top-10 right-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg rounded-xl z-20 py-1 min-w-[120px] overflow-hidden">
                      {!isFolder && (
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(item); }} className="w-full text-start px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2">
                          <Download className="w-4 h-4" /> {lang === 'ar' ? 'تحميل' : 'Download'}
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); deleteItem(item); }} className="w-full text-start px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> {lang === 'ar' ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  )}
                  
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#050505] group-hover:scale-110 transition-transform duration-300">
                    {isFolder ? (
                      <Folder className="w-10 h-10 text-black dark:text-white fill-gray-200 dark:fill-gray-800" />
                    ) : (
                      <FileIcon className="w-10 h-10 text-gray-600 dark:text-gray-300 fill-gray-100 dark:fill-gray-900" />
                    )}
                  </div>
                  
                  <div className="text-center w-full px-2">
                    <p className="font-bold text-sm truncate text-gray-900 dark:text-white" title={item.name}>{item.name}</p>
                    {!isFolder && item.metadata && <p className="text-xs text-gray-500 mt-1">{(item.metadata.size / 1024 / 1024).toFixed(2)} MB</p>}
                  </div>
                </div>
              );
            })}
            
            {items.length === 0 && (
              <div className="col-span-full text-center py-20 text-gray-500">
                {lang === 'ar' ? 'المجلد فارغ. قم برفع ملف أو إنشاء مجلد جديد.' : 'Empty folder. Upload a file or create a folder.'}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal 
        isOpen={isNewFolderOpen} 
        onClose={() => setIsNewFolderOpen(false)} 
        title={lang === 'ar' ? 'إنشاء مجلد جديد' : 'New Folder'}
      >
        <form onSubmit={createFolder} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{lang === 'ar' ? 'اسم المجلد' : 'Folder Name'}</label>
            <Input 
              required 
              value={newFolderName} 
              onChange={e => setNewFolderName(e.target.value)} 
              placeholder={lang === 'ar' ? 'مثال: مشروع التخرج' : 'e.g. Graduation Project'} 
            />
          </div>
          <Button type="submit" className="w-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 font-bold rounded-xl mt-2">
            {lang === 'ar' ? 'إنشاء' : 'Create'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
