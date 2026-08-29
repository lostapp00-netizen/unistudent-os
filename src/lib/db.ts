import { supabase } from './supabase';
import { UserSettings, Subject, DriveFile, Note, Task, Appointment, ScheduleItem, Group } from '../types';

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
    
    if (settings.initialCumulativeGpa !== undefined) payload.initial_cumulative_gpa = settings.initialCumulativeGpa;
    if (settings.initialCompletedCreditHours !== undefined) payload.initial_completed_credit_hours = settings.initialCompletedCreditHours;
    if (settings.setupMode !== undefined) payload.setup_mode = settings.setupMode;
    if (settings.warningGradeLetter !== undefined) payload.warning_grade_letter = settings.warningGradeLetter;
    if (settings.warningGpaPoints !== undefined) payload.warning_gpa_points = settings.warningGpaPoints;

    try {
      localStorage.setItem(`unistudent_settings_${userId}`, JSON.stringify(settings));
    } catch {}

    const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      // If error is due to missing columns, retry without new columns but keep in localStorage
      if (error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
        delete payload.initial_cumulative_gpa;
        delete payload.initial_completed_credit_hours;
        delete payload.setup_mode;
        delete payload.warning_grade_letter;
        delete payload.warning_gpa_points;
        await supabase.from('settings').upsert(payload, { onConflict: 'user_id' });
      } else {
        console.error('Error upserting settings:', error);
      }
    }
  },

  // --- Subjects ---
  async getSubjects(userId: string) {
    const { data, error } = await supabase.from('subjects').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching subjects:', error);
    return (data || []).map(mapSubjectFromDB);
  },
  async addSubject(userId: string, subject: Subject) {
    const { error } = await supabase.from('subjects').insert([mapSubjectToDB(userId, subject)]);
    if (error) console.error('Error adding subject:', error);
  },
  async updateSubject(userId: string, id: string, subject: Partial<Subject>) {
    // We only pass the fields that need updating. Since we map it, we can just send the whole mapped object
    // For partial, we need to map the keys. This is a bit tricky, so we'll just update the whole subject usually, or map specific keys.
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
    
    const { error } = await supabase.from('subjects').update(payload).eq('id', id).eq('user_id', userId);
    if (error) console.error('Error updating subject:', error);
  },
  async deleteSubject(userId: string, id: string) {
    const { error } = await supabase.from('subjects').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Error deleting subject:', error);
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
  async deleteDriveFile(userId: string, id: string) {
    const { error } = await supabase.from('drive_files').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Error deleting drive_file:', error);
  },

  // --- Feedback & Suggestions ---
  async addFeedback(feedback: FeedbackSuggestion) {
    try {
      // 1. Local Cache
      const allKey = 'unistudent_all_suggestions';
      const existingAll: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(allKey) || '[]');
      const updatedAll = [feedback, ...existingAll.filter(f => f.id !== feedback.id)];
      localStorage.setItem(allKey, JSON.stringify(updatedAll));

      const userKey = `unistudent_user_suggestions_${feedback.userId}`;
      const existingUser: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(userKey) || '[]');
      localStorage.setItem(userKey, JSON.stringify([feedback, ...existingUser.filter(f => f.id !== feedback.id)]));
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
        attachments: feedback.attachments || [],
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
          attachments: row.attachments || [],
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
          attachments: row.attachments || [],
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
    } catch {}

    try {
      const payload: any = {};
      if (updates.status) payload.status = updates.status;
      if (updates.adminNotes !== undefined) payload.admin_notes = updates.adminNotes;
      await supabase.from('suggestions').update(payload).eq('id', id);
    } catch (e) {
      console.warn('Supabase update feedback note:', e);
    }
  },

  async deleteFeedback(id: string) {
    try {
      const allKey = 'unistudent_all_suggestions';
      const list: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(allKey) || '[]');
      localStorage.setItem(allKey, JSON.stringify(list.filter(f => f.id !== id)));
    } catch {}

    try {
      await supabase.from('suggestions').delete().eq('id', id);
    } catch (e) {}
  },

  // --- Admin All Platform Data ---
  async getAdminAllData() {
    const [
      settingsRes,
      subjectsRes,
      tasksRes,
      notesRes,
      appointmentsRes,
      scheduleRes,
      groupsRes,
      filesRes,
      feedbacks
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

    const rawSettings = [...(settingsRes.data || [])];
    const rawSubjects = [...(subjectsRes.data || [])];
    const rawTasks = [...(tasksRes.data || [])];
    const rawNotes = [...(notesRes.data || [])];
    const rawAppointments = [...(appointmentsRes.data || [])];
    const rawSchedule = [...(scheduleRes.data || [])];
    const rawGroups = [...(groupsRes.data || [])];
    const rawFiles = [...(filesRes.data || [])];

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

      // Check all localStorage keys for cached unistudent_settings_*
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('unistudent_settings_')) {
          const uid = key.replace('unistudent_settings_', '');
          if (uid) {
            userIds.add(uid);
            if (!rawSettings.find(s => s.user_id === uid)) {
              try {
                const st = JSON.parse(localStorage.getItem(key) || '{}');
                rawSettings.push({
                  user_id: uid,
                  name: st.name || 'طالب مسجل',
                  email: st.email || '',
                  university: st.university || '',
                  college: st.college || '',
                  grading_scale: st.gradingScale || [],
                  semesters: st.semesters || []
                });
              } catch {}
            }
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage admin sync fallback warning:', e);
    }

    // Also check current active user
    const currentSession = await supabase.auth.getSession().catch(() => null);
    if (currentSession?.data?.session?.user?.id) {
      userIds.add(currentSession.data.session.user.id);
    }

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
      frequency: 'weekly',
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
    language: row.language || 'ar',
    gradingScale: row.grading_scale || [],
    semesters: row.semesters || [],
    initialCumulativeGpa: row.initial_cumulative_gpa !== undefined ? row.initial_cumulative_gpa : (localExtra.initialCumulativeGpa ?? null),
    initialCompletedCreditHours: row.initial_completed_credit_hours !== undefined ? row.initial_completed_credit_hours : (localExtra.initialCompletedCreditHours ?? null),
    setupMode: row.setup_mode || localExtra.setupMode || 'initial_gpa',
    warningGradeLetter: row.warning_grade_letter !== undefined ? row.warning_grade_letter : (localExtra.warningGradeLetter ?? 'C'),
    warningGpaPoints: row.warning_gpa_points !== undefined ? Number(row.warning_gpa_points) : (localExtra.warningGpaPoints !== undefined ? Number(localExtra.warningGpaPoints) : 2.0)
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
