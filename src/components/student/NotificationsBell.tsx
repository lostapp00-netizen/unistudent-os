import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, BellRing, CheckCheck, Database, Megaphone, X } from 'lucide-react';
import { db } from '../../lib/db';
import { useAppStore } from '../../store/useAppStore';
import type { StudentNotification } from '../../types';

/**
 * The notification bell on the student dashboard.
 *
 * It opens a panel that belongs to the site itself (no browser popup) and shows
 * the notifications in two groups:
 *   • تحديثات قاعدة بياناتك — anything that changed in the university database
 *     this student restored (the admin edited it, or approved a change coming
 *     from the student the database was pulled from).
 *   • رسائل وإعلانات الإدارة — posts / messages the admin published.
 *
 * Unread count feeds the badge; opening an item marks it read, and "read all"
 * clears the badge. The read state lives on the server, so it survives a change
 * of device.
 */
export function NotificationsBell() {
  const { i18n } = useTranslation();
  const { userId, settings } = useAppStore();
  const isAr = settings?.language === 'ar' || i18n.language === 'ar';

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'database' | 'general'>('all');
  const isMountedRef = useRef(true);

  const linkedDatabaseIds = useMemo(
    () => [settings?.universityDatabaseId, settings?.specializationDatabaseId].filter(Boolean) as string[],
    [settings?.universityDatabaseId, settings?.specializationDatabaseId]
  );

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const list = await db.getNotificationsForStudent(userId, linkedDatabaseIds);
      if (isMountedRef.current) setNotifications(list);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [userId, linkedDatabaseIds.join('|')]);

  useEffect(() => {
    isMountedRef.current = true;
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(load, 60000);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [load]);

  const databaseNotifications = notifications.filter(n => n.scope === 'database');
  const generalNotifications = notifications.filter(n => n.scope !== 'database');
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const visibleNotifications =
    activeTab === 'database' ? databaseNotifications
    : activeTab === 'general' ? generalNotifications
    : notifications;

  const markRead = async (ids: string[]) => {
    const unreadIds = ids.filter(id => {
      const found = notifications.find(n => n.id === id);
      return found && !found.isRead;
    });
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, isRead: true } : n));
    if (userId) await db.markNotificationsRead(userId, unreadIds).catch(() => {});
  };

  const formatDate = (value: string) => {
    try {
      return new Date(value).toLocaleString(isAr ? 'ar-EG' : 'en-US', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return value;
    }
  };

  const typeStyles = (type: string) => {
    switch (type) {
      case 'add': return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-800/50';
      case 'delete': return 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/70 dark:border-rose-800/50';
      case 'rename': return 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/70 dark:border-amber-800/50';
      case 'update': return 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/70 dark:border-blue-800/50';
      default: return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
    }
  };

  const renderItem = (notification: StudentNotification) => (
    <li
      key={notification.id}
      onClick={() => markRead([notification.id])}
      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
        notification.isRead
          ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
          : 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60'
      } hover:shadow-sm`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center ${typeStyles(notification.type)}`}>
          {notification.scope === 'database'
            ? <Database size={16} />
            : <Megaphone size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-xs sm:text-sm font-bold ${notification.isRead ? 'text-zinc-700 dark:text-zinc-300' : 'text-zinc-900 dark:text-white'}`}>
              {notification.title}
            </p>
            {!notification.isRead && <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />}
          </div>
          {notification.message && (
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed break-words">
              {notification.message}
            </p>
          )}
          <p className="text-[10px] text-zinc-400 mt-1.5">{formatDate(notification.updatedAt || notification.createdAt)}</p>
        </div>
      </div>
    </li>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => { setIsOpen(true); load(); }}
        title={isAr ? 'الإشعارات' : 'Notifications'}
        className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 p-3 rounded-2xl shadow-sm transition-colors"
      >
        {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white dark:border-zinc-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 w-full max-w-2xl max-h-[88vh] rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden mt-6 sm:mt-10"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                    {isAr ? 'الإشعارات' : 'Notifications'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold">
                    {unreadCount > 0
                      ? (isAr ? `عندك ${unreadCount} إشعار لسه ما اتقراش` : `${unreadCount} unread`)
                      : (isAr ? 'كل الإشعارات اتقرت' : 'All caught up')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markRead(notifications.map(n => n.id))}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 transition-colors"
                  >
                    <CheckCheck size={14} />
                    <span>{isAr ? 'تعليم الكل كمقروء' : 'Mark all read'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 sm:px-5 pt-3">
              {([
                { id: 'all' as const, label: isAr ? 'الكل' : 'All', count: notifications.length },
                { id: 'database' as const, label: isAr ? 'تحديثات قاعدة بياناتك' : 'Database updates', count: databaseNotifications.length },
                { id: 'general' as const, label: isAr ? 'رسائل وإعلانات الإدارة' : 'Admin messages', count: generalNotifications.length }
              ]).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {isLoading && notifications.length === 0 ? (
                <p className="text-center text-xs text-zinc-400 py-10">{isAr ? 'جاري التحميل…' : 'Loading…'}</p>
              ) : visibleNotifications.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <Bell size={44} className="mx-auto mb-3 opacity-25" />
                  <p className="text-xs font-bold">{isAr ? 'مفيش إشعارات لحد الآن' : 'No notifications yet'}</p>
                  <p className="text-[11px] mt-1">
                    {isAr
                      ? 'أي تحديث في قاعدة بيانات كليتك أو رسالة من الإدارة هتظهر هنا.'
                      : 'Database updates and admin messages will show up here.'}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">{visibleNotifications.map(renderItem)}</ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
