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
    return (data || []).map(mapTaskFromDB);
  },
  async addTask(userId: string, task: Task) {
    const { error } = await supabase.from('tasks').insert([mapTaskToDB(userId, task)]);
    if (error) console.error('Error adding task:', error);
  },
  async updateTask(userId: string, id: string, task: Partial<Task>) {
    const payload = mapTaskToDB(userId, task as Task);
    delete (payload as any).user_id;
    const { error } = await supabase.from('tasks').update(payload).eq('id', id).eq('user_id', userId);
    if (error) console.error('Error updating task:', error);
  },
  async deleteTask(userId: string, id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Error deleting task:', error);
  },

  // --- Notes ---
  async getNotes(userId: string) {
    const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching notes:', error);
    return (data || []).map(mapNoteFromDB);
  },
  async addNote(userId: string, note: Note) {
    const { error } = await supabase.from('notes').insert([mapNoteToDB(userId, note)]);
    if (error) console.error('Error adding note:', error);
  },
  async updateNote(userId: string, id: string, note: Partial<Note>) {
    const payload = mapNoteToDB(userId, note as Note);
    delete (payload as any).user_id;
    const { error } = await supabase.from('notes').update(payload).eq('id', id).eq('user_id', userId);
    if (error) console.error('Error updating note:', error);
  },
  async deleteNote(userId: string, id: string) {
    const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Error deleting note:', error);
  },

  // --- Appointments ---
  async getAppointments(userId: string) {
    const { data, error } = await supabase.from('appointments').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching appointments:', error);
    return (data || []).map(mapAppointmentFromDB);
  },
  async addAppointment(userId: string, appointment: Appointment) {
    const { error } = await supabase.from('appointments').insert([mapAppointmentToDB(userId, appointment)]);
    if (error) console.error('Error adding appointment:', error);
  },
  async updateAppointment(userId: string, id: string, appointment: Partial<Appointment>) {
    const payload = mapAppointmentToDB(userId, appointment as Appointment);
    delete (payload as any).user_id;
    const { error } = await supabase.from('appointments').update(payload).eq('id', id).eq('user_id', userId);
    if (error) console.error('Error updating appointment:', error);
  },
  async deleteAppointment(userId: string, id: string) {
    const { error } = await supabase.from('appointments').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Error deleting appointment:', error);
  },

  // --- Schedule Items ---
  async getScheduleItems(userId: string) {
    const { data, error } = await supabase.from('schedule_items').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching schedule_items:', error);
    return (data || []).map(mapScheduleItemFromDB);
  },
  async addScheduleItem(userId: string, item: ScheduleItem) {
    const { error } = await supabase.from('schedule_items').insert([mapScheduleItemToDB(userId, item)]);
    if (error) console.error('Error adding schedule_item:', error);
  },
  async updateScheduleItem(userId: string, id: string, item: Partial<ScheduleItem>) {
    const payload = mapScheduleItemToDB(userId, item as ScheduleItem);
    delete (payload as any).user_id;
    
    const { error } = await supabase.from('schedule_items').update(payload).eq('id', id).eq('user_id', userId);
    if (error) console.error('Error updating schedule_item:', error);
  },
  async deleteScheduleItem(userId: string, id: string) {
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
  }
};

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
    setupMode: row.setup_mode || localExtra.setupMode || 'initial_gpa'
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
