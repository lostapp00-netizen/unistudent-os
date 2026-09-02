import { supabase } from './supabase';
import { UserSettings, Subject, DriveFile, Note, Task, Appointment, ScheduleItem, Group, FeedbackSuggestion, DatabaseBackup, EmailBackupConfig, UniversityDatabase, UniversityPendingUpdate } from '../types';

export const db = {
  // --- Settings ---
  async getSettings(userId: string) {
    const { data, error } = await supabase.from('settings').select('*').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') console.error('Error fetching settings:', error);
    if (!data) return null;
    return mapSettingsFromDB(data);
  },
  async upsertSettings(userId: string, settings: Partial<UserSettings>) {
    const payload: any = {
      user_id: userId,
      name: settings.name,
      university: settings.university,
      college: settings.college,
      enrollment_date: settings.enrollmentDate,
      total_years: settings.totalYears,
      semesters_per_year: settings.semestersPerYear,
      theme: settings.theme,
      language: settings.language,
      grading_scale: settings.gradingScale,
      semesters: settings.semesters
    };

    if (settings.email !== undefined && settings.email !== null) {
      payload.email = settings.email;
      try {
        localStorage.setItem(`unistudent_user_email_${userId}`, settings.email);
      } catch {}
    }
    
    if (settings.initialCumulativeGpa !== undefined) payload.initial_cumulative_gpa = settings.initialCumulativeGpa;
    if (settings.initialCompletedCreditHours !== undefined) payload.initial_completed_credit_hours = settings.initialCompletedCreditHours;
    if (settings.setupMode !== undefined) payload.setup_mode = settings.setupMode;
    if (settings.warningGradeLetter !== undefined) payload.warning_grade_letter = settings.warningGradeLetter;
    if (settings.warningGpaPoints !== undefined) payload.warning_gpa_points = settings.warningGpaPoints;

    try {
      const existingRaw = localStorage.getItem(`unistudent_settings_${userId}`);
      const existingObj = existingRaw ? JSON.parse(existingRaw) : {};
      localStorage.setItem(`unistudent_settings_${userId}`, JSON.stringify({
        ...existingObj,
        ...settings,
        enableGraduationScale: settings.enableGraduationScale !== undefined ? settings.enableGraduationScale : existingObj.enableGraduationScale,
        graduationGradingScale: settings.graduationGradingScale !== undefined ? settings.graduationGradingScale : existingObj.graduationGradingScale
      }));
    } catch {}

    const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      // If error is due to missing columns in Supabase, retry without new columns but keep in localStorage
      if (error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
        delete payload.initial_cumulative_gpa;
        delete payload.initial_completed_credit_hours;
        delete payload.setup_mode;
        delete payload.warning_grade_letter;
        delete payload.warning_gpa_points;
        delete payload.email;
        await supabase.from('settings').upsert(payload, { onConflict: 'user_id' });
      } else {
        console.error('Error upserting settings:', error);
      }
    }
  },

  // --- Subjects ---
  async getSubjects(userId: string): Promise<Subject[]> {
    let dbSubjects: Subject[] = [];
    try {
      const { data, error } = await supabase.from('subjects').select('*').eq('user_id', userId);
      if (error) console.error('Error fetching subjects:', error);
      if (data && data.length > 0) {
        dbSubjects = data.map(mapSubjectFromDB);
      }
    } catch (e) {
      console.warn('Supabase fetch subjects failed, checking cache:', e);
    }

    try {
      const cached = localStorage.getItem(`unistudent_subjects_${userId}`);
      if (cached) {
        const localList: Subject[] = JSON.parse(cached);
        if (dbSubjects.length === 0) return localList;
        // Merge with local changes if any
        const mergedMap = new Map<string, Subject>();
        dbSubjects.forEach(s => mergedMap.set(s.id, s));
        localList.forEach(s => {
          if (!mergedMap.has(s.id)) mergedMap.set(s.id, s);
        });
        const result = Array.from(mergedMap.values());
        localStorage.setItem(`unistudent_subjects_${userId}`, JSON.stringify(result));
        return result;
      } else if (dbSubjects.length > 0) {
        localStorage.setItem(`unistudent_subjects_${userId}`, JSON.stringify(dbSubjects));
      }
    } catch {}

    return dbSubjects;
  },
  async addSubject(userId: string, subject: Subject) {
    try {
      const key = `unistudent_subjects_${userId}`;
      const list: Subject[] = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...list.filter(s => s.id !== subject.id), subject]));
    } catch {}

    try {
      const { error } = await supabase.from('subjects').insert([mapSubjectToDB(userId, subject)]);
      if (error) {
        // Retry without non-critical columns if schema difference
        const payload: any = mapSubjectToDB(userId, subject);
        delete payload.include_in_gpa;
        delete payload.final_grade_letter;
        await supabase.from('subjects').insert([payload]);
      }
    } catch (err) {
      console.warn('Supabase addSubject fallback:', err);
    }
  },
  async updateSubject(userId: string, id: string, subject: Partial<Subject>) {
    try {
      const key = `unistudent_subjects_${userId}`;
      const list: Subject[] = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(list.map(s => s.id === id ? { ...s, ...subject } : s)));
    } catch {}

    const payload: any = {};
    if (subject.code !== undefined) payload.code = subject.code;
    if (subject.name !== undefined) payload.name = subject.name;
    if (subject.creditHours !== undefined) payload.credit_hours = subject.creditHours;
    if (subject.totalMarks !== undefined) payload.total_marks = subject.totalMarks;
    if (subject.yearIndex !== undefined) payload.year_index = subject.yearIndex;
    if (subject.semesterIndex !== undefined) payload.semester_index = subject.semesterIndex;
    if (subject.status !== undefined) payload.status = subject.status;
    if (subject.distributions !== undefined) payload.distributions = subject.distributions;
    if (subject.finalGradeLetter !== undefined) payload.final_grade_letter = subject.finalGradeLetter;
    
    try {
      const { error } = await supabase.from('subjects').update(payload).eq('id', id).eq('user_id', userId);
      if (error) {
        delete payload.final_grade_letter;
        await supabase.from('subjects').update(payload).eq('id', id).eq('user_id', userId);
      }
    } catch (e) {
      console.warn('Supabase updateSubject error:', e);
    }
  },
  async deleteSubject(userId: string, id: string) {
    try {
      const key = `unistudent_subjects_${userId}`;
      const list: Subject[] = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(list.filter(s => s.id !== id)));
    } catch {}

    try {
      const { error } = await supabase.from('subjects').delete().eq('id', id).eq('user_id', userId);
      if (error) console.error('Error deleting subject:', error);
    } catch (e) {}
  },

  // --- Tasks ---
  async getTasks(userId: string) {
    const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching tasks:', error);
    const extras = getEntityExtras(userId, 'tasks');
    return (data || []).map(row => {
      const task = mapTaskFromDB(row);
      const extra = extras[task.id] || {};
      return {
        ...task,
        attachments: (extra.attachments && extra.attachments.length > 0) ? extra.attachments : task.attachments,
        linkedNoteIds: (extra.linkedNoteIds && extra.linkedNoteIds.length > 0) ? extra.linkedNoteIds : task.linkedNoteIds,
        linkedFileIds: (extra.linkedFileIds && extra.linkedFileIds.length > 0) ? extra.linkedFileIds : task.linkedFileIds,
        linkedSubjectIds: (extra.linkedSubjectIds && extra.linkedSubjectIds.length > 0) ? extra.linkedSubjectIds : task.linkedSubjectIds,
      };
    });
  },
  async addTask(userId: string, task: Task) {
    saveEntityExtra(userId, 'tasks', task.id, {
      attachments: task.attachments || [],
      linkedNoteIds: task.linkedNoteIds || [],
      linkedFileIds: task.linkedFileIds || [],
      linkedSubjectIds: task.linkedSubjectIds || [],
    });
    const { error } = await supabase.from('tasks').insert([mapTaskToDB(userId, task)]);
    if (error) console.error('Error adding task:', error);
  },
  async updateTask(userId: string, id: string, task: Partial<Task>) {
    saveEntityExtra(userId, 'tasks', id, {
      ...(task.attachments !== undefined ? { attachments: task.attachments } : {}),
      ...(task.linkedNoteIds !== undefined ? { linkedNoteIds: task.linkedNoteIds } : {}),
      ...(task.linkedFileIds !== undefined ? { linkedFileIds: task.linkedFileIds } : {}),
      ...(task.linkedSubjectIds !== undefined ? { linkedSubjectIds: task.linkedSubjectIds } : {}),
    });
    const payload = mapTaskToDB(userId, task as Task);
    delete (payload as any).user_id;
    const { error } = await supabase.from('tasks').update(payload).eq('id', id).eq('user_id', userId);
    if (error) console.error('Error updating task:', error);
  },
  async deleteTask(userId: string, id: string) {
    removeEntityExtra(userId, 'tasks', id);
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Error deleting task:', error);
  },

  // --- Notes ---
  async getNotes(userId: string) {
    const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching notes:', error);
    const extras = getEntityExtras(userId, 'notes');
    return (data || []).map(row => {
      const note = mapNoteFromDB(row);
      const extra = extras[note.id] || {};
      return {
        ...note,
        priority: extra.priority || note.priority,
        attachments: (extra.attachments && extra.attachments.length > 0) ? extra.attachments : note.attachments,
        linkedTaskIds: (extra.linkedTaskIds && extra.linkedTaskIds.length > 0) ? extra.linkedTaskIds : note.linkedTaskIds,
        linkedFileIds: (extra.linkedFileIds && extra.linkedFileIds.length > 0) ? extra.linkedFileIds : note.linkedFileIds,
        linkedSubjectIds: (extra.linkedSubjectIds && extra.linkedSubjectIds.length > 0) ? extra.linkedSubjectIds : note.linkedSubjectIds,
      };
    });
  },
  async addNote(userId: string, note: Note) {
    saveEntityExtra(userId, 'notes', note.id, {
      priority: note.priority,
      attachments: note.attachments || [],
      linkedTaskIds: note.linkedTaskIds || [],
      linkedFileIds: note.linkedFileIds || [],
      linkedSubjectIds: note.linkedSubjectIds || [],
    });
    const { error } = await supabase.from('notes').insert([mapNoteToDB(userId, note)]);
    if (error) console.error('Error adding note:', error);
  },
  async updateNote(userId: string, id: string, note: Partial<Note>) {
    saveEntityExtra(userId, 'notes', id, {
      ...(note.priority !== undefined ? { priority: note.priority } : {}),
      ...(note.attachments !== undefined ? { attachments: note.attachments } : {}),
      ...(note.linkedTaskIds !== undefined ? { linkedTaskIds: note.linkedTaskIds } : {}),
      ...(note.linkedFileIds !== undefined ? { linkedFileIds: note.linkedFileIds } : {}),
      ...(note.linkedSubjectIds !== undefined ? { linkedSubjectIds: note.linkedSubjectIds } : {}),
    });
    const payload = mapNoteToDB(userId, note as Note);
    delete (payload as any).user_id;
    const { error } = await supabase.from('notes').update(payload).eq('id', id).eq('user_id', userId);
    if (error) console.error('Error updating note:', error);
  },
  async deleteNote(userId: string, id: string) {
    removeEntityExtra(userId, 'notes', id);
    const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Error deleting note:', error);
  },

  // --- Appointments ---
  async getAppointments(userId: string) {
    const { data, error } = await supabase.from('appointments').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching appointments:', error);
    const extras = getEntityExtras(userId, 'appointments');
    return (data || []).map(row => {
      const appt = mapAppointmentFromDB(row);
      const extra = extras[appt.id] || {};
      return {
        ...appt,
        priority: extra.priority || appt.priority,
        attachments: (extra.attachments && extra.attachments.length > 0) ? extra.attachments : appt.attachments,
        linkedFileIds: (extra.linkedFileIds && extra.linkedFileIds.length > 0) ? extra.linkedFileIds : appt.linkedFileIds,
        linkedSubjectIds: (extra.linkedSubjectIds && extra.linkedSubjectIds.length > 0) ? extra.linkedSubjectIds : appt.linkedSubjectIds,
      };
    });
  },
  async addAppointment(userId: string, appointment: Appointment) {
    saveEntityExtra(userId, 'appointments', appointment.id, {
      priority: appointment.priority,
      attachments: appointment.attachments || [],
      linkedFileIds: appointment.linkedFileIds || [],
      linkedSubjectIds: appointment.linkedSubjectIds || [],
    });
    const { error } = await supabase.from('appointments').insert([mapAppointmentToDB(userId, appointment)]);
    if (error) console.error('Error adding appointment:', error);
  },
  async updateAppointment(userId: string, id: string, appointment: Partial<Appointment>) {
    saveEntityExtra(userId, 'appointments', id, {
      ...(appointment.priority !== undefined ? { priority: appointment.priority } : {}),
      ...(appointment.attachments !== undefined ? { attachments: appointment.attachments } : {}),
      ...(appointment.linkedFileIds !== undefined ? { linkedFileIds: appointment.linkedFileIds } : {}),
      ...(appointment.linkedSubjectIds !== undefined ? { linkedSubjectIds: appointment.linkedSubjectIds } : {}),
    });
    const payload = mapAppointmentToDB(userId, appointment as Appointment);
    delete (payload as any).user_id;
    const { error } = await supabase.from('appointments').update(payload).eq('id', id).eq('user_id', userId);
    if (error) console.error('Error updating appointment:', error);
  },
  async deleteAppointment(userId: string, id: string) {
    removeEntityExtra(userId, 'appointments', id);
    const { error } = await supabase.from('appointments').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Error deleting appointment:', error);
  },

  // --- Schedule Items ---
  async getScheduleItems(userId: string) {
    const { data, error } = await supabase.from('schedule_items').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching schedule_items:', error);
    const extras = getEntityExtras(userId, 'schedule_items');
    return (data || []).map(row => {
      const item = mapScheduleItemFromDB(row);
      const extra = extras[item.id] || {};
      return {
        ...item,
        priority: extra.priority || item.priority,
        groupId: extra.groupId !== undefined ? extra.groupId : item.groupId,
        attachments: (extra.attachments && extra.attachments.length > 0) ? extra.attachments : item.attachments,
      };
    });
  },
  async addScheduleItem(userId: string, item: ScheduleItem) {
    saveEntityExtra(userId, 'schedule_items', item.id, {
      priority: item.priority,
      groupId: item.groupId,
      attachments: item.attachments || [],
    });
    const { error } = await supabase.from('schedule_items').insert([mapScheduleItemToDB(userId, item)]);
    if (error) console.error('Error adding schedule_item:', error);
  },
  async updateScheduleItem(userId: string, id: string, item: Partial<ScheduleItem>) {
    saveEntityExtra(userId, 'schedule_items', id, {
      ...(item.priority !== undefined ? { priority: item.priority } : {}),
      ...(item.groupId !== undefined ? { groupId: item.groupId } : {}),
      ...(item.attachments !== undefined ? { attachments: item.attachments } : {}),
    });
    const payload = mapScheduleItemToDB(userId, item as ScheduleItem);
    delete (payload as any).user_id;
    
    const { error } = await supabase.from('schedule_items').update(payload).eq('id', id).eq('user_id', userId);
    if (error) console.error('Error updating schedule_item:', error);
  },
  async deleteScheduleItem(userId: string, id: string) {
    removeEntityExtra(userId, 'schedule_items', id);
    const { error } = await supabase.from('schedule_items').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Error deleting schedule_item:', error);
  },

  // --- Groups ---
  async getGroups(userId: string) {
    const { data, error } = await supabase.from('groups').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching groups:', error);
    return data || [];
  },
  async addGroup(userId: string, group: Group) {
    const { error } = await supabase.from('groups').insert([{ ...group, user_id: userId }]);
    if (error) {
      console.error('Error adding group:', error);
      throw error;
    }
  },
  async updateGroup(userId: string, id: string, group: Partial<Group>) {
    const { error } = await supabase.from('groups').update(group).eq('id', id).eq('user_id', userId);
    if (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  },
  async deleteGroup(userId: string, id: string) {
    const { error } = await supabase.from('groups').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  },

  // --- Drive Files ---
  async getDriveFiles(userId: string) {
    const { data, error } = await supabase.from('drive_files').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching drive_files:', error);
    return (data || []).map(mapDriveFileFromDB);
  },
  async addDriveFile(userId: string, file: DriveFile & { b2FileId?: string }) {
    const { error } = await supabase.from('drive_files').insert([{ 
      id: file.id,
      user_id: userId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.url || '',
      upload_date: file.createdAt,
      b2_file_id: file.b2FileId,
      parent_id: file.parentId || null
    }]);
    if (error) console.error('Error adding drive_file:', error);
  },
  async updateDriveFile(userId: string, id: string, file: Partial<DriveFile>) {
    const payload: any = {};
    if (file.name !== undefined) payload.name = file.name;
    if (file.parentId !== undefined) payload.parent_id = file.parentId;
    if (file.url !== undefined) payload.url = file.url;

    const { error } = await supabase.from('drive_files').update(payload).eq('id', id).eq('user_id', userId);
    if (error) console.error('Error updating drive_file:', error);
  },
  async deleteDriveFile(userId: string, id: string) {
    const { error } = await supabase.from('drive_files').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Error deleting drive_file:', error);
  },

  // --- Feedback & Suggestions ---
  async addFeedback(feedback: FeedbackSuggestion) {
    try {
      // 1. Sanitize attachments for localStorage to avoid 5MB quota exhaustion
      const sanitizedAttachments = (feedback.attachments || []).map(a => ({
        id: a.id,
        name: a.name,
        size: a.size,
        type: a.type,
        url: a.url?.startsWith('data:') && a.url.length > 50000 ? '' : a.url,
        b2FileId: (a as any).b2FileId || (a as any).b2_file_id
      }));
      const cachedFeedback = { ...feedback, attachments: sanitizedAttachments };

      const allKey = 'unistudent_all_suggestions';
      const existingAll: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(allKey) || '[]');
      const updatedAll = [cachedFeedback, ...existingAll.filter(f => f.id !== feedback.id)];
      localStorage.setItem(allKey, JSON.stringify(updatedAll.slice(0, 100)));

      const userKey = `unistudent_user_suggestions_${feedback.userId}`;
      const existingUser: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(userKey) || '[]');
      localStorage.setItem(userKey, JSON.stringify([cachedFeedback, ...existingUser.filter(f => f.id !== feedback.id)].slice(0, 50)));
    } catch (e) {
      console.warn('LocalStorage error in addFeedback:', e);
    }

    try {
      const payload = {
        id: feedback.id,
        user_id: feedback.userId,
        user_email: feedback.userEmail,
        user_name: feedback.userName || '',
        type: feedback.type,
        title: feedback.title,
        content: feedback.content,
        attachments: (feedback.attachments || []).map(a => ({
          id: a.id,
          name: a.name,
          size: a.size,
          type: a.type,
          url: a.url?.startsWith('data:') && a.url.length > 200000 ? '' : a.url,
          b2FileId: (a as any).b2FileId || (a as any).b2_file_id
        })),
        created_at: feedback.createdAt,
        status: feedback.status,
        admin_notes: feedback.adminNotes || ''
      };
      await supabase.from('suggestions').insert([payload]);
    } catch (err) {
      console.warn('Supabase suggestions insert note:', err);
    }
  },

  async getUserFeedbacks(userId: string): Promise<FeedbackSuggestion[]> {
    try {
      const { data, error } = await supabase.from('suggestions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          userId: row.user_id,
          userEmail: row.user_email || '',
          userName: row.user_name || '',
          type: row.type || 'suggestion',
          title: row.title || '',
          content: row.content || '',
          attachments: (row.attachments || []).map((a: any) => ({
            id: a.id || a.name,
            name: a.name,
            size: a.size || 0,
            type: a.type || '',
            url: a.url || '',
            b2FileId: a.b2FileId || a.b2_file_id
          })),
          createdAt: row.created_at || new Date().toISOString(),
          status: row.status || 'new',
          adminNotes: row.admin_notes || ''
        }));
      }
    } catch (e) {}

    try {
      const cached = localStorage.getItem(`unistudent_user_suggestions_${userId}`);
      if (cached) return JSON.parse(cached);
    } catch {}

    return [];
  },

  async getAllFeedbacks(): Promise<FeedbackSuggestion[]> {
    try {
      const { data, error } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          userId: row.user_id,
          userEmail: row.user_email || '',
          userName: row.user_name || '',
          type: row.type || 'suggestion',
          title: row.title || '',
          content: row.content || '',
          attachments: (row.attachments || []).map((a: any) => ({
            id: a.id || a.name,
            name: a.name,
            size: a.size || 0,
            type: a.type || '',
            url: a.url || '',
            b2FileId: a.b2FileId || a.b2_file_id
          })),
          createdAt: row.created_at || new Date().toISOString(),
          status: row.status || 'new',
          adminNotes: row.admin_notes || ''
        }));
      }
    } catch (e) {}

    try {
      const cached = localStorage.getItem('unistudent_all_suggestions');
      if (cached) return JSON.parse(cached);
    } catch {}

    return [];
  },

  async updateFeedback(id: string, updates: Partial<FeedbackSuggestion>) {
    try {
      const allKey = 'unistudent_all_suggestions';
      const list: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(allKey) || '[]');
      const updated = list.map(item => item.id === id ? { ...item, ...updates } : item);
      localStorage.setItem(allKey, JSON.stringify(updated));

      // Also update user cache if exists
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('unistudent_user_suggestions_')) {
          try {
            const uList: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(key) || '[]');
            if (uList.some(f => f.id === id)) {
              localStorage.setItem(key, JSON.stringify(uList.map(item => item.id === id ? { ...item, ...updates } : item)));
            }
          } catch {}
        }
      }
    } catch {}

    try {
      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.content !== undefined) payload.content = updates.content;
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.attachments !== undefined) {
        payload.attachments = (updates.attachments || []).map(a => ({
          id: a.id,
          name: a.name,
          size: a.size,
          type: a.type,
          url: a.url?.startsWith('data:') && a.url.length > 200000 ? '' : a.url,
          b2FileId: (a as any).b2FileId || (a as any).b2_file_id
        }));
      }
      if (updates.adminNotes !== undefined) payload.admin_notes = updates.adminNotes;
      await supabase.from('suggestions').update(payload).eq('id', id);
    } catch (e) {
      console.warn('Supabase update feedback note:', e);
    }
  },

  async deleteFeedback(id: string) {
    try {
      // Find feedback to extract all attachment B2 keys before deleting
      const allKey = 'unistudent_all_suggestions';
      const list: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(allKey) || '[]');
      const targetLocal = list.find(f => f.id === id);

      let attachmentsToDelete: any[] = targetLocal?.attachments || [];
      if ((targetLocal as any)?.attachment_url) {
        attachmentsToDelete.push({ url: (targetLocal as any).attachment_url });
      }

      // Also check supabase if online
      try {
        const { data } = await supabase.from('suggestions').select('attachments, attachment_url').eq('id', id).single();
        if (data) {
          if (Array.isArray(data.attachments)) {
            attachmentsToDelete.push(...data.attachments);
          }
          if (data.attachment_url) {
            attachmentsToDelete.push({ url: data.attachment_url });
          }
        }
      } catch {}

      if (attachmentsToDelete.length > 0) {
        import('./backblaze').then(({ deleteMultipleFromB2, extractB2KeyFromUrl }) => {
          const keys = attachmentsToDelete
            .map(a => a.b2FileId || (a as any).b2_file_id || extractB2KeyFromUrl(a.url))
            .filter(Boolean);
          if (keys.length > 0) {
            deleteMultipleFromB2(keys).catch(console.error);
          }
        }).catch(console.error);
      }

      localStorage.setItem(allKey, JSON.stringify(list.filter(f => f.id !== id)));

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('unistudent_user_suggestions_')) {
          try {
            const uList: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify(uList.filter(f => f.id !== id)));
          } catch {}
        }
      }
    } catch {}

    try {
      await supabase.from('suggestions').delete().eq('id', id);
    } catch (e) {}
  },

  // --- University Databases ---
  async getUniversityDatabases(): Promise<UniversityDatabase[]> {
    try {
      const { data, error } = await supabase.from('university_databases').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data.map(d => mapUniversityDatabaseFromDB(d));
      }
    } catch (e) {
      console.warn('Supabase getUniversityDatabases warning:', e);
    }
    try {
      const local = localStorage.getItem('unistudent_university_databases');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  },

  async getUniversityDatabase(id: string): Promise<UniversityDatabase | null> {
    const list = await this.getUniversityDatabases();
    return list.find(u => u.id === id) || null;
  },

  async createUniversityDatabase(dbData: UniversityDatabase): Promise<void> {
    // 1. Local storage cache
    try {
      const current = await this.getUniversityDatabases();
      const updated = [dbData, ...current.filter(u => u.id !== dbData.id)];
      localStorage.setItem('unistudent_university_databases', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error in createUniversityDatabase:', e);
    }

    // 2. Supabase insert/upsert
    try {
      const payload = {
        id: dbData.id,
        university_name_ar: dbData.universityNameAr,
        university_name_en: dbData.universityNameEn,
        college_name_ar: dbData.collegeNameAr,
        college_name_en: dbData.collegeNameEn,
        source_user_id: dbData.sourceUserId,
        source_user_email: dbData.sourceUserEmail || '',
        source_user_name: dbData.sourceUserName || '',
        total_years: dbData.totalYears,
        semesters_per_year: dbData.semestersPerYear,
        subjects: dbData.subjects,
        drive_files: dbData.driveFiles,
        grading_scale: dbData.gradingScale || [],
        created_at: dbData.createdAt,
        updated_at: dbData.updatedAt
      };
      const { error } = await supabase.from('university_databases').upsert(payload);
      if (error) console.warn('Supabase createUniversityDatabase error:', error);
    } catch (e) {
      console.warn('Supabase createUniversityDatabase failed:', e);
    }
  },

  async updateUniversityDatabase(id: string, partialData: Partial<UniversityDatabase>): Promise<void> {
    // 1. Local storage update
    try {
      const current = await this.getUniversityDatabases();
      const updated = current.map(u => u.id === id ? { ...u, ...partialData, updatedAt: new Date().toISOString() } : u);
      localStorage.setItem('unistudent_university_databases', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error in updateUniversityDatabase:', e);
    }

    // 2. Supabase update
    try {
      const payload: any = { updated_at: new Date().toISOString() };
      if (partialData.universityNameAr !== undefined) payload.university_name_ar = partialData.universityNameAr;
      if (partialData.universityNameEn !== undefined) payload.university_name_en = partialData.universityNameEn;
      if (partialData.collegeNameAr !== undefined) payload.college_name_ar = partialData.collegeNameAr;
      if (partialData.collegeNameEn !== undefined) payload.college_name_en = partialData.collegeNameEn;
      if (partialData.sourceUserId !== undefined) payload.source_user_id = partialData.sourceUserId;
      if (partialData.sourceUserName !== undefined) payload.source_user_name = partialData.sourceUserName;
      if (partialData.sourceUserEmail !== undefined) payload.source_user_email = partialData.sourceUserEmail;
      if (partialData.totalYears !== undefined) payload.total_years = partialData.totalYears;
      if (partialData.semestersPerYear !== undefined) payload.semesters_per_year = partialData.semestersPerYear;
      if (partialData.subjects !== undefined) payload.subjects = partialData.subjects;
      if (partialData.driveFiles !== undefined) payload.drive_files = partialData.driveFiles;
      if (partialData.gradingScale !== undefined) payload.grading_scale = partialData.gradingScale;

      const { error } = await supabase.from('university_databases').update(payload).eq('id', id);
      if (error) console.warn('Supabase updateUniversityDatabase error:', error);
    } catch (e) {
      console.warn('Supabase updateUniversityDatabase failed:', e);
    }
  },

  async deleteUniversityDatabase(id: string): Promise<void> {
    try {
      const current = await this.getUniversityDatabases();
      localStorage.setItem('unistudent_university_databases', JSON.stringify(current.filter(u => u.id !== id)));
    } catch {}

    try {
      await supabase.from('university_databases').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase deleteUniversityDatabase failed:', e);
    }
  },

  // --- Pending Updates for University Databases ---
  async getPendingUpdates(universityDbId?: string): Promise<UniversityPendingUpdate[]> {
    try {
      let query = supabase.from('university_pending_updates').select('*').order('created_at', { ascending: false });
      if (universityDbId) {
        query = query.eq('university_database_id', universityDbId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map(d => mapPendingUpdateFromDB(d));
      }
    } catch (e) {
      console.warn('Supabase getPendingUpdates warning:', e);
    }
    try {
      const local = localStorage.getItem('unistudent_pending_updates');
      const all: UniversityPendingUpdate[] = local ? JSON.parse(local) : [];
      return universityDbId ? all.filter(p => p.universityDatabaseId === universityDbId) : all;
    } catch {
      return [];
    }
  },

  async recordPendingUpdate(update: UniversityPendingUpdate): Promise<void> {
    try {
      const current = await this.getPendingUpdates();
      const updated = [update, ...current.filter(u => u.id !== update.id)];
      localStorage.setItem('unistudent_pending_updates', JSON.stringify(updated.slice(0, 100)));
    } catch {}

    try {
      const payload = {
        id: update.id,
        university_database_id: update.universityDatabaseId,
        source_user_id: update.sourceUserId,
        source_user_email: update.sourceUserEmail || '',
        source_user_name: update.sourceUserName || '',
        type: update.type,
        description: update.description,
        data: update.data,
        status: update.status,
        created_at: update.createdAt
      };
      await supabase.from('university_pending_updates').upsert(payload);
    } catch (e) {
      console.warn('Supabase recordPendingUpdate error:', e);
    }
  },

  async respondToPendingUpdate(id: string, status: 'approved' | 'rejected', applyAction?: (db: UniversityDatabase) => UniversityDatabase): Promise<void> {
    const pendingList = await this.getPendingUpdates();
    const target = pendingList.find(p => p.id === id);
    if (!target) return;

    target.status = status;
    target.resolvedAt = new Date().toISOString();

    try {
      localStorage.setItem('unistudent_pending_updates', JSON.stringify(pendingList));
    } catch {}

    try {
      await supabase.from('university_pending_updates').update({ status, resolved_at: target.resolvedAt }).eq('id', id);
    } catch {}

    if (status === 'approved' && applyAction && target.universityDatabaseId) {
      const udb = await this.getUniversityDatabase(target.universityDatabaseId);
      if (udb) {
        const updatedDb = applyAction(udb);
        await this.updateUniversityDatabase(udb.id, updatedDb);
      }
    }
  },

  // --- Student Notifications ---
  async sendStudentNotification(studentId: string, notification: {
    id?: string;
    title: string;
    message: string;
    type?: 'info' | 'update' | 'source_alert';
    date?: string;
  }): Promise<void> {
    const notifId = notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newNotif = {
      id: notifId,
      title: notification.title,
      message: notification.message,
      type: notification.type || 'info',
      date: notification.date || new Date().toISOString(),
      dismissed: false
    };

    try {
      const key = `unistudent_student_notifications_${studentId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter((n: any) => n.id !== notifId);
      localStorage.setItem(key, JSON.stringify([newNotif, ...filtered].slice(0, 50)));
    } catch {}
  },

  getStudentNotifications(studentId: string): Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    date: string;
    dismissed: boolean;
  }> {
    try {
      const key = `unistudent_student_notifications_${studentId}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(saved)) {
        return saved.filter((n: any) => !n.dismissed);
      }
    } catch {}
    return [];
  },

  dismissStudentNotification(studentId: string, notificationId: string): void {
    try {
      const key = `unistudent_student_notifications_${studentId}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(saved)) {
        const updated = saved.map((n: any) => n.id === notificationId ? { ...n, dismissed: true } : n);
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch {}
  },

  async notifyEnrolledStudentsOfDbUpdate(universityDatabaseId: string, message: string): Promise<void> {
    try {
      // Find all students in known users or localStorage who have this universityDatabaseId or match uni/college
      const udb = await this.getUniversityDatabase(universityDatabaseId);
      if (!udb) return;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('unistudent_settings_')) {
          const uid = key.replace('unistudent_settings_', '');
          try {
            const st = JSON.parse(localStorage.getItem(key) || '{}');
            if (
              st.universityDatabaseId === universityDatabaseId ||
              (st.university === udb.universityNameAr && st.college === udb.collegeNameAr)
            ) {
              await this.sendStudentNotification(uid, {
                id: `db_update_${universityDatabaseId}_${Date.now()}`,
                title: 'تحديث جديد في خطة الكلية',
                message: message,
                type: 'update'
              });
            }
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Error notifying enrolled students:', e);
    }
  },

  // --- Admin All Platform Data ---
  async getAdminAllData() {
    let rawSettings: any[] = [];
    let rawSubjects: any[] = [];
    let rawTasks: any[] = [];
    let rawNotes: any[] = [];
    let rawAppointments: any[] = [];
    let rawSchedule: any[] = [];
    let rawGroups: any[] = [];
    let rawFiles: any[] = [];
    let feedbacks: any[] = [];

    // 1. Try Direct Supabase Query
    try {
      const [
        settingsRes,
        subjectsRes,
        tasksRes,
        notesRes,
        appointmentsRes,
        scheduleRes,
        groupsRes,
        filesRes,
        fbList
      ] = await Promise.all([
        supabase.from('settings').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('notes').select('*'),
        supabase.from('appointments').select('*'),
        supabase.from('schedule_items').select('*'),
        supabase.from('groups').select('*'),
        supabase.from('drive_files').select('*'),
        this.getAllFeedbacks()
      ]);

      if (settingsRes.data && settingsRes.data.length > 0) rawSettings = settingsRes.data;
      if (subjectsRes.data && subjectsRes.data.length > 0) rawSubjects = subjectsRes.data;
      if (tasksRes.data && tasksRes.data.length > 0) rawTasks = tasksRes.data;
      if (notesRes.data && notesRes.data.length > 0) rawNotes = notesRes.data;
      if (appointmentsRes.data && appointmentsRes.data.length > 0) rawAppointments = appointmentsRes.data;
      if (scheduleRes.data && scheduleRes.data.length > 0) rawSchedule = scheduleRes.data;
      if (groupsRes.data && groupsRes.data.length > 0) rawGroups = groupsRes.data;
      if (filesRes.data && filesRes.data.length > 0) rawFiles = filesRes.data;
      if (fbList && fbList.length > 0) feedbacks = fbList;
    } catch (e) {
      console.warn('Direct Supabase query warning:', e);
    }

    // 2. If RLS filtered out rows or returned empty, query through Edge Function (which has service_role permissions)
    if (rawSettings.length === 0 || rawSubjects.length === 0) {
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('send-database-backup', {
          body: { targetEmail: 'admin@gmail.com' }
        });

        if (!edgeErr && edgeData?.backup?.data) {
          const bData = edgeData.backup.data;
          if (bData.settings && bData.settings.length > 0) rawSettings = bData.settings;
          if (bData.subjects && bData.subjects.length > 0) rawSubjects = bData.subjects;
          if (bData.tasks && bData.tasks.length > 0) rawTasks = bData.tasks;
          if (bData.notes && bData.notes.length > 0) rawNotes = bData.notes;
          if (bData.appointments && bData.appointments.length > 0) rawAppointments = bData.appointments;
          if (bData.schedule_items && bData.schedule_items.length > 0) rawSchedule = bData.schedule_items;
          if (bData.groups && bData.groups.length > 0) rawGroups = bData.groups;
          if (bData.drive_files && bData.drive_files.length > 0) rawFiles = bData.drive_files;
          if (bData.suggestions && bData.suggestions.length > 0) feedbacks = bData.suggestions;

          if (bData.auth_users && Array.isArray(bData.auth_users)) {
            bData.auth_users.forEach((au: any) => {
              if (au.id) {
                const existing = rawSettings.find(s => s.user_id === au.id);
                if (existing) {
                  if (!existing.email || existing.email === '') existing.email = au.email;
                } else {
                  rawSettings.push({
                    user_id: au.id,
                    name: au.email ? au.email.split('@')[0] : 'طالب مسجل',
                    email: au.email || '',
                    university: '',
                    college: '',
                    grading_scale: [],
                    semesters: []
                  });
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn('Edge function service_role fetch fallback error:', err);
      }
    }

    // Collect all distinct user IDs
    const userIds = new Set<string>();
    rawSettings.forEach(s => s.user_id && userIds.add(s.user_id));
    rawSubjects.forEach(s => s.user_id && userIds.add(s.user_id));
    rawTasks.forEach(t => t.user_id && userIds.add(t.user_id));
    rawNotes.forEach(n => n.user_id && userIds.add(n.user_id));
    rawAppointments.forEach(a => a.user_id && userIds.add(a.user_id));
    rawSchedule.forEach(sc => sc.user_id && userIds.add(sc.user_id));
    rawFiles.forEach(f => f.user_id && userIds.add(f.user_id));
    feedbacks.forEach(fb => fb.userId && userIds.add(fb.userId));

    // Also scan localStorage for any cached student profiles and users
    try {
      const knownUsersRaw = localStorage.getItem('unistudent_known_users');
      if (knownUsersRaw) {
        const knownUsers = JSON.parse(knownUsersRaw);
        if (Array.isArray(knownUsers)) {
          knownUsers.forEach((u: any) => {
            if (u.id) {
              userIds.add(u.id);
              if (!rawSettings.find(s => s.user_id === u.id)) {
                rawSettings.push({
                  user_id: u.id,
                  name: u.name || 'طالب مسجل',
                  email: u.email || '',
                  university: u.university || '',
                  college: u.college || '',
                  grading_scale: u.gradingScale || [],
                  semesters: u.semesters || []
                });
              }
            }
          });
        }
      }

      // Check all localStorage keys for cached unistudent_settings_* and unistudent_user_email_*
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('unistudent_settings_')) {
          const uid = key.replace('unistudent_settings_', '');
          if (uid) {
            userIds.add(uid);
            const savedEmail = localStorage.getItem(`unistudent_user_email_${uid}`) || '';
            const existing = rawSettings.find(s => s.user_id === uid);
            if (!existing) {
              try {
                const st = JSON.parse(localStorage.getItem(key) || '{}');
                rawSettings.push({
                  user_id: uid,
                  name: st.name || 'طالب مسجل',
                  email: savedEmail || st.email || '',
                  university: st.university || '',
                  college: st.college || '',
                  grading_scale: st.gradingScale || [],
                  semesters: st.semesters || []
                });
              } catch {}
            } else if (!existing.email && savedEmail) {
              existing.email = savedEmail;
            }
          }
        } else if (key && key.startsWith('unistudent_user_email_')) {
          const uid = key.replace('unistudent_user_email_', '');
          const emailVal = localStorage.getItem(key) || '';
          if (uid && emailVal) {
            userIds.add(uid);
            const existing = rawSettings.find(s => s.user_id === uid);
            if (existing && !existing.email) {
              existing.email = emailVal;
            }
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage admin sync fallback warning:', e);
    }

    // Also check current active user
    try {
      const currentSession = await supabase.auth.getSession().catch(() => null);
      const curUser = currentSession?.data?.session?.user;
      if (curUser?.id) {
        userIds.add(curUser.id);
        const existing = rawSettings.find(s => s.user_id === curUser.id);
        if (existing) {
          if (!existing.email && curUser.email) existing.email = curUser.email;
        } else {
          rawSettings.push({
            user_id: curUser.id,
            name: curUser.email ? curUser.email.split('@')[0] : 'طالب مسجل',
            email: curUser.email || '',
            university: '',
            college: '',
            grading_scale: [],
            semesters: []
          });
        }
      }
    } catch {}

    // 3. For all user IDs, merge cached subjects & files if missing from Supabase response
    userIds.forEach(uid => {
      try {
        const cachedSubjs = localStorage.getItem(`unistudent_subjects_${uid}`);
        if (cachedSubjs) {
          const parsed = JSON.parse(cachedSubjs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach(s => {
              if (!rawSubjects.some(rs => rs.id === s.id)) {
                rawSubjects.push({
                  id: s.id,
                  user_id: uid,
                  code: s.code || '',
                  name: s.name || '',
                  credit_hours: s.creditHours || 3,
                  total_marks: s.totalMarks || 100,
                  year_index: s.yearIndex || 1,
                  semester_index: s.semesterIndex || 1,
                  status: s.status || 'current',
                  distributions: s.distributions || [],
                  final_grade_letter: s.finalGradeLetter,
                  include_in_gpa: s.includeInGpa !== false
                });
              }
            });
          }
        }
      } catch {}

      try {
        const cachedFiles = localStorage.getItem(`unistudent_drive_files_${uid}`);
        if (cachedFiles) {
          const parsed = JSON.parse(cachedFiles);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach(f => {
              if (!rawFiles.some(rf => rf.id === f.id)) {
                rawFiles.push({
                  id: f.id,
                  user_id: uid,
                  name: f.name || '',
                  size: f.size || 0,
                  type: f.type || 'file',
                  url: f.url || '',
                  upload_date: f.createdAt || new Date().toISOString(),
                  parent_id: f.parentId || null,
                  b2_file_id: f.b2FileId
                });
              }
            });
          }
        }
      } catch {}
    });

    return {
      userIds: Array.from(userIds),
      rawSettings,
      rawSubjects,
      rawTasks,
      rawNotes,
      rawAppointments,
      rawSchedule,
      rawGroups,
      rawFiles,
      feedbacks
    };
  },

  // --- Full Database Backup & Restore ---
  async exportFullDatabaseBackup(): Promise<DatabaseBackup> {
    const data = await this.getAdminAllData();
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: 'production',
      data: {
        settings: data.rawSettings,
        subjects: data.rawSubjects,
        tasks: data.rawTasks,
        notes: data.rawNotes,
        appointments: data.rawAppointments,
        schedule_items: data.rawSchedule,
        groups: data.rawGroups,
        drive_files: data.rawFiles,
        suggestions: data.feedbacks
      },
      summary: {
        totalStudents: data.userIds.length,
        totalSubjects: data.rawSubjects.length,
        totalTasks: data.rawTasks.length,
        totalNotes: data.rawNotes.length,
        totalFiles: data.rawFiles.length,
        totalSuggestions: data.feedbacks.length
      }
    };
  },

  async restoreDatabaseFromBackup(backup: DatabaseBackup, mode: 'overwrite' | 'merge' = 'merge'): Promise<{ success: boolean; message: string; details: any }> {
    if (!backup?.data) {
      throw new Error('Invalid backup file format.');
    }

    const { settings = [], subjects = [], tasks = [], notes = [], appointments = [], schedule_items = [], groups = [], drive_files = [], suggestions = [] } = backup.data;
    const errors: string[] = [];

    // 1. Settings
    if (settings.length > 0) {
      try {
        await supabase.from('settings').upsert(settings, { onConflict: 'user_id' });
      } catch (err: any) {
        errors.push(`Settings: ${err.message}`);
      }
    }

    // 2. Subjects
    if (subjects.length > 0) {
      try {
        await supabase.from('subjects').upsert(subjects, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Subjects: ${err.message}`);
      }
    }

    // 3. Tasks
    if (tasks.length > 0) {
      try {
        await supabase.from('tasks').upsert(tasks, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Tasks: ${err.message}`);
      }
    }

    // 4. Notes
    if (notes.length > 0) {
      try {
        await supabase.from('notes').upsert(notes, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Notes: ${err.message}`);
      }
    }

    // 5. Appointments
    if (appointments.length > 0) {
      try {
        await supabase.from('appointments').upsert(appointments, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Appointments: ${err.message}`);
      }
    }

    // 6. Schedule Items
    if (schedule_items.length > 0) {
      try {
        await supabase.from('schedule_items').upsert(schedule_items, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Schedule: ${err.message}`);
      }
    }

    // 7. Groups
    if (groups.length > 0) {
      try {
        await supabase.from('groups').upsert(groups, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Groups: ${err.message}`);
      }
    }

    // 8. Drive Files
    if (drive_files.length > 0) {
      try {
        await supabase.from('drive_files').upsert(drive_files, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Drive files: ${err.message}`);
      }
    }

    // 9. Suggestions
    if (suggestions.length > 0) {
      try {
        await supabase.from('suggestions').upsert(suggestions, { onConflict: 'id' });
        localStorage.setItem('unistudent_all_suggestions', JSON.stringify(suggestions));
      } catch (err: any) {
        errors.push(`Suggestions: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      message: errors.length === 0 ? 'تمت استعادة كافة بيانات قاعدة البيانات بنجاح!' : `تمت الاستعادة مع بعض التنبيهات: ${errors.join(', ')}`,
      details: {
        restoredCount: {
          settings: settings.length,
          subjects: subjects.length,
          tasks: tasks.length,
          notes: notes.length,
          appointments: appointments.length,
          schedule: schedule_items.length,
          files: drive_files.length,
          suggestions: suggestions.length
        },
        errors
      }
    };
  },

  // --- Email Backup Configuration ---
  getEmailBackupConfig(): EmailBackupConfig {
    try {
      const saved = localStorage.getItem('unistudent_email_backup_config');
      if (saved) return JSON.parse(saved);
    } catch {}

    return {
      enabled: false,
      targetEmail: '',
      senderEmail: '',
      appPassword: '',
      frequency: 'thursday',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      status: 'paused'
    };
  },

  saveEmailBackupConfig(config: EmailBackupConfig) {
    try {
      localStorage.setItem('unistudent_email_backup_config', JSON.stringify(config));
    } catch (e) {
      console.error('Error saving email backup config:', e);
    }
  }
};

// --- Local Extra Caching Helpers ---
function getEntityExtras(userId: string, entityType: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(`unistudent_${entityType}_extras_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveEntityExtra(userId: string, entityType: string, entityId: string, extras: any) {
  try {
    const all = getEntityExtras(userId, entityType);
    all[entityId] = { ...(all[entityId] || {}), ...extras };
    localStorage.setItem(`unistudent_${entityType}_extras_${userId}`, JSON.stringify(all));
  } catch (e) {
    console.error(`Error caching ${entityType} extras:`, e);
  }
}

function removeEntityExtra(userId: string, entityType: string, entityId: string) {
  try {
    const all = getEntityExtras(userId, entityType);
    delete all[entityId];
    localStorage.setItem(`unistudent_${entityType}_extras_${userId}`, JSON.stringify(all));
  } catch (e) {
    console.error(`Error removing ${entityType} extras:`, e);
  }
}

// --- Mapping Helpers ---
function mapSettingsFromDB(row: any): UserSettings {
  let localExtra: any = {};
  if (row.user_id) {
    try {
      const saved = localStorage.getItem(`unistudent_settings_${row.user_id}`);
      if (saved) localExtra = JSON.parse(saved);
    } catch {}
  }

  return {
    name: row.name || '',
    university: row.university || '',
    college: row.college || '',
    enrollmentDate: row.enrollment_date || '',
    totalYears: row.total_years || 4,
    semestersPerYear: row.semesters_per_year || 2,
    theme: row.theme || 'light',
    language: row.language || 'en',
    gradingScale: row.grading_scale || [],
    semesters: row.semesters || [],
    initialCumulativeGpa: row.initial_cumulative_gpa !== undefined ? row.initial_cumulative_gpa : (localExtra.initialCumulativeGpa ?? null),
    initialCompletedCreditHours: row.initial_completed_credit_hours !== undefined ? row.initial_completed_credit_hours : (localExtra.initialCompletedCreditHours ?? null),
    setupMode: row.setup_mode || localExtra.setupMode || 'initial_gpa',
    warningGradeLetter: row.warning_grade_letter !== undefined ? row.warning_grade_letter : (localExtra.warningGradeLetter ?? 'C'),
    warningGpaPoints: row.warning_gpa_points !== undefined ? Number(row.warning_gpa_points) : (localExtra.warningGpaPoints !== undefined ? Number(localExtra.warningGpaPoints) : 2.0),
    enableGraduationScale: row.enable_graduation_scale !== undefined ? row.enable_graduation_scale : (localExtra.enableGraduationScale ?? false),
    graduationGradingScale: row.graduation_grading_scale || localExtra.graduationGradingScale || []
  };
}

function mapSubjectFromDB(row: any): Subject {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    creditHours: row.credit_hours,
    totalMarks: row.total_marks,
    yearIndex: row.year_index,
    semesterIndex: row.semester_index,
    status: row.status,
    distributions: (row.distributions || []).map((d: any) => ({ ...d, status: d.status || 'current' })),
    finalGradeLetter: row.final_grade_letter,
    includeInGpa: row.include_in_gpa !== false // Defaults to true if null
  };
}

function mapSubjectToDB(userId: string, subject: Subject) {
  return {
    id: subject.id,
    user_id: userId,
    code: subject.code,
    name: subject.name,
    credit_hours: subject.creditHours,
    total_marks: subject.totalMarks,
    year_index: subject.yearIndex,
    semester_index: subject.semesterIndex,
    status: subject.status,
    distributions: subject.distributions,
    final_grade_letter: subject.finalGradeLetter,
    include_in_gpa: subject.includeInGpa !== false
  };
}

function mapAppointmentFromDB(row: any): Appointment {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    date: row.date,
    time: row.time,
    location: row.location,
    doctorName: row.doctor_name,
    notes: row.notes,
    groupId: row.group_id,
    priority: row.priority || 'medium',
    linkedFileIds: row.linked_file_ids || [],
    linkedSubjectIds: row.linked_subject_ids || [],
    attachments: row.attachments || []
  };
}

function mapAppointmentToDB(userId: string, appt: Appointment) {
  const payload: any = {};
  if (appt.id !== undefined) payload.id = appt.id;
  payload.user_id = userId;
  if (appt.title !== undefined) payload.title = appt.title;
  if (appt.type !== undefined) payload.type = appt.type;
  if (appt.date !== undefined) payload.date = appt.date;
  if (appt.time !== undefined) payload.time = appt.time;
  if (appt.location !== undefined) payload.location = appt.location;
  if (appt.doctorName !== undefined) payload.doctor_name = appt.doctorName;
  if (appt.notes !== undefined) payload.notes = appt.notes;
  if (appt.groupId !== undefined) payload.group_id = appt.groupId === '' ? null : appt.groupId;
  // if (appt.priority !== undefined) payload.priority = appt.priority;
  // if (appt.linkedFileIds !== undefined) payload.linked_file_ids = appt.linkedFileIds;
  // if (appt.linkedSubjectIds !== undefined) payload.linked_subject_ids = appt.linkedSubjectIds;
  // if (appt.attachments !== undefined) payload.attachments = appt.attachments;
  return payload;
}

function mapScheduleItemFromDB(row: any): ScheduleItem {
  return {
    id: row.id,
    subjectId: row.subject_id,
    dayOfWeek: row.day,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    type: row.type,
    instructor: row.instructor,
    groupId: row.group_id,
    priority: row.priority || 'medium',
    attachments: row.attachments || []
  };
}

function mapScheduleItemToDB(userId: string, item: ScheduleItem) {
  const payload: any = {};
  if (item.id !== undefined) payload.id = item.id;
  payload.user_id = userId;
  if (item.subjectId !== undefined) payload.subject_id = item.subjectId;
  if (item.dayOfWeek !== undefined) payload.day = item.dayOfWeek;
  if (item.startTime !== undefined) payload.start_time = item.startTime;
  if (item.endTime !== undefined) payload.end_time = item.endTime;
  if (item.location !== undefined) payload.location = item.location;
  if (item.type !== undefined) payload.type = item.type;
  if (item.instructor !== undefined) payload.instructor = item.instructor;
  // if (item.groupId !== undefined) payload.group_id = item.groupId === '' ? null : item.groupId;
  // if (item.priority !== undefined) payload.priority = item.priority;
  // if (item.attachments !== undefined) payload.attachments = item.attachments;
  return payload;
}

function mapTaskFromDB(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    isCompleted: row.completed,
    priority: row.priority || 'medium',
    type: row.type || 'task',
    linkedNoteIds: row.linked_note_ids || [],
    linkedFileIds: row.linked_file_ids || [],
    linkedSubjectIds: row.linked_subject_ids || [],
    groupId: row.group_id,
    attachments: row.attachments || []
  };
}

function mapTaskToDB(userId: string, task: Task) {
  const payload: any = {};
  if (task.id !== undefined) payload.id = task.id;
  payload.user_id = userId;
  if (task.title !== undefined) payload.title = task.title;
  if (task.description !== undefined) payload.description = task.description;
  if (task.date !== undefined) payload.date = task.date;
  if (task.isCompleted !== undefined) payload.completed = task.isCompleted;
  if (task.priority !== undefined) payload.priority = task.priority;
  // if (task.type !== undefined) payload.type = task.type;
  // if (task.linkedNoteIds !== undefined) payload.linked_note_ids = task.linkedNoteIds;
  // if (task.linkedFileIds !== undefined) payload.linked_file_ids = task.linkedFileIds;
  // if (task.linkedSubjectIds !== undefined) payload.linked_subject_ids = task.linkedSubjectIds;
  if (task.groupId !== undefined) payload.group_id = task.groupId === '' ? null : task.groupId;
  // if (task.attachments !== undefined) payload.attachments = task.attachments;
  return payload;
}

function mapNoteFromDB(row: any): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    date: row.date,
    priority: row.priority || 'medium',
    linkedTaskIds: row.linked_task_ids || [],
    linkedFileIds: row.linked_file_ids || [],
    linkedSubjectIds: row.linked_subject_ids || [],
    groupId: row.group_id,
    attachments: row.attachments || []
  };
}

function mapNoteToDB(userId: string, note: Note) {
  const payload: any = {};
  if (note.id !== undefined) payload.id = note.id;
  payload.user_id = userId;
  if (note.title !== undefined) payload.title = note.title;
  if (note.content !== undefined) payload.content = note.content;
  if (note.date !== undefined) payload.date = note.date;
  // if (note.priority !== undefined) payload.priority = note.priority;
  // if (note.linkedTaskIds !== undefined) payload.linked_task_ids = note.linkedTaskIds;
  // if (note.linkedFileIds !== undefined) payload.linked_file_ids = note.linkedFileIds;
  // if (note.linkedSubjectIds !== undefined) payload.linked_subject_ids = note.linkedSubjectIds;
  if (note.groupId !== undefined) payload.group_id = note.groupId === '' ? null : note.groupId;
  // if (note.attachments !== undefined) payload.attachments = note.attachments;
  return payload;
}

function mapDriveFileFromDB(row: any): DriveFile {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    type: row.type,
    url: row.url,
    createdAt: row.upload_date,
    parentId: row.parent_id,
    b2FileId: row.b2_file_id
  };
}

function mapUniversityDatabaseFromDB(row: any): UniversityDatabase {
  return {
    id: row.id,
    universityNameAr: row.university_name_ar || '',
    universityNameEn: row.university_name_en || '',
    collegeNameAr: row.college_name_ar || '',
    collegeNameEn: row.college_name_en || '',
    sourceUserId: row.source_user_id,
    sourceUserEmail: row.source_user_email || '',
    sourceUserName: row.source_user_name || '',
    totalYears: row.total_years || 4,
    semestersPerYear: row.semesters_per_year || 2,
    subjects: (row.subjects || []).map((s: any) => ({
      id: s.id,
      code: s.code || '',
      name: s.name || '',
      creditHours: Number(s.creditHours || s.credit_hours || 3),
      totalMarks: Number(s.totalMarks || s.total_marks || 100),
      yearIndex: Number(s.yearIndex || s.year_index || 1),
      semesterIndex: Number(s.semesterIndex || s.semester_index || 1),
      distributions: s.distributions || [],
      status: s.status || 'current',
      includeInGpa: s.includeInGpa !== false
    })),
    driveFiles: (row.drive_files || []).map((f: any) => ({
      id: f.id,
      name: f.name || '',
      size: Number(f.size || 0),
      type: f.type || 'file',
      parentId: f.parentId || f.parent_id || null,
      createdAt: f.createdAt || f.upload_date || new Date().toISOString(),
      url: f.url || '',
      b2FileId: f.b2FileId || f.b2_file_id
    })),
    gradingScale: row.grading_scale || [],
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

function mapPendingUpdateFromDB(row: any): UniversityPendingUpdate {
  return {
    id: row.id,
    universityDatabaseId: row.university_database_id,
    sourceUserId: row.source_user_id,
    sourceUserEmail: row.source_user_email || '',
    sourceUserName: row.source_user_name || '',
    type: row.type,
    description: row.description || '',
    data: row.data || {},
    status: row.status || 'pending',
    createdAt: row.created_at || new Date().toISOString(),
    resolvedAt: row.resolved_at
  };
}
