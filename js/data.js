/**
 * LearnBridge - Data Store & Initial State
 * Fresh-deployment initial state: NO demo accounts, NO preloaded results, resources,
 * quizzes, exams or statistics. Every account starts clean and only sees data that
 * was actually created (by that account or by the school administrator).
 * Curriculum configuration (levels, classes, subjects) is retained as system setup.
 *
 * Teacher/staff placeholder names — used ONLY as sample display names in form
 * placeholders and example listings. They are NOT demo accounts and do NOT
 * create any login access. Teachers must always use the normal
 * Teacher Registration → Teacher Login (Teacher ID + Password) → Staff Dashboard flow:
 *   JSS 1A–JSS 3E (class arms) and SS 1–3 (Science, Arts, Commercial)
 *
 * Teacher accounts now also carry the classes they teach and their department
 * (see js/access.js). Every teacher-scoped lookup verifies
 *   Teacher → Department → Assigned Classes → Authorized Students/Results/Resources.
 */

const DATA_VERSION = '5.0.0';

const INITIAL_DATA = {
  version: DATA_VERSION,
  currentRole: 'student', // 'student', 'teacher', 'admin', 'parent'
  dataSaverMode: false,

  // Registered users — accounts are created only through the registration form.
  currentStudentId: null,
  students: [],
  staff: [],

  // Forward-only admission-number sequence (GDSSA + 4 digits). Only ever
  // increases, so numbers of deleted accounts are never reissued.
  admissionCounter: 0,

  // Active student profile stats (synced on login)
  userStats: null,

  // Levels Definition
  levels: [
    { id: 'jss', name: 'Junior Secondary (JSS 1–3)', icon: 'bi-mortarboard', description: 'Basic Education Certificate Examination (BECE / Junior WAEC) curriculum' },
    { id: 'sss', name: 'Senior Secondary (SS 1–3)', icon: 'bi-award', description: 'WAEC WASSCE, NECO, and JAMB UTME syllabus & past questions' }
  ],

  // Classes by Level — secondary school ONLY (JSS class arms A–E + SS sections).
  // Nursery/Primary levels are permanently excluded from the platform.
  classes: [
    { id: 'jss1a', name: 'JSS 1A', level: 'jss' },
    { id: 'jss1b', name: 'JSS 1B', level: 'jss' },
    { id: 'jss1c', name: 'JSS 1C', level: 'jss' },
    { id: 'jss1d', name: 'JSS 1D', level: 'jss' },
    { id: 'jss1e', name: 'JSS 1E', level: 'jss' },
    { id: 'jss2a', name: 'JSS 2A', level: 'jss' },
    { id: 'jss2b', name: 'JSS 2B', level: 'jss' },
    { id: 'jss2c', name: 'JSS 2C', level: 'jss' },
    { id: 'jss2d', name: 'JSS 2D', level: 'jss' },
    { id: 'jss2e', name: 'JSS 2E', level: 'jss' },
    { id: 'jss3a', name: 'JSS 3A', level: 'jss' },
    { id: 'jss3b', name: 'JSS 3B', level: 'jss' },
    { id: 'jss3c', name: 'JSS 3C', level: 'jss' },
    { id: 'jss3d', name: 'JSS 3D', level: 'jss' },
    { id: 'jss3e', name: 'JSS 3E', level: 'jss' },
    { id: 'ss1', name: 'SS 1', level: 'sss' },
    { id: 'ss2', name: 'SS 2', level: 'sss' },
    { id: 'ss3', name: 'SS 3', level: 'sss' }
  ],

  // Complete Nigerian Curriculum Subjects Mapped to Levels
  levelSubjects: {
    jss: [
      { id: 'maths', name: 'Mathematics', icon: 'bi-calculator', color: '#0d9488' },
      { id: 'english', name: 'English Studies', icon: 'bi-journal-text', color: '#4f46e5' },
      { id: 'science', name: 'Basic Science', icon: 'bi-flower1', color: '#10b981' },
      { id: 'tech', name: 'Basic Technology', icon: 'bi-cpu', color: '#06b6d4' },
      { id: 'civic', name: 'Civic Education', icon: 'bi-shield-check', color: '#14b8a6' },
      { id: 'socialstudies', name: 'Social Studies', icon: 'bi-globe-americas', color: '#f59e0b' },
      { id: 'agric', name: 'Agricultural Science', icon: 'bi-tree', color: '#84cc16' },
      { id: 'business', name: 'Business Studies', icon: 'bi-briefcase', color: '#eab308' },
      { id: 'ict', name: 'Computer Studies / ICT', icon: 'bi-laptop', color: '#3b82f6' },
      { id: 'homeec', name: 'Home Economics', icon: 'bi-house-heart', color: '#ec4899' },
      { id: 'phe', name: 'Physical & Health Education', icon: 'bi-activity', color: '#10b981' },
      { id: 'french', name: 'French Language', icon: 'bi-translate', color: '#8b5cf6' },
      { id: 'crk_irk', name: 'CRS / IRS', icon: 'bi-book', color: '#6366f1' }
    ],
    sss: [
      { id: 'maths', name: 'General Mathematics', icon: 'bi-calculator', color: '#0d9488' },
      { id: 'english', name: 'English Language', icon: 'bi-journal-text', color: '#4f46e5' },
      { id: 'physics', name: 'Physics', icon: 'bi-lightning-charge', color: '#f59e0b' },
      { id: 'chemistry', name: 'Chemistry', icon: 'bi-beaker', color: '#8b5cf6' },
      { id: 'biology', name: 'Biology', icon: 'bi-heart-pulse', color: '#ec4899' },
      { id: 'furthermaths', name: 'Further Mathematics', icon: 'bi-infinity', color: '#06b6d4' },
      { id: 'economics', name: 'Economics', icon: 'bi-graph-up-arrow', color: '#10b981' },
      { id: 'commerce', name: 'Commerce', icon: 'bi-shop', color: '#f97316' },
      { id: 'accounting', name: 'Financial Accounting', icon: 'bi-receipt', color: '#14b8a6' },
      { id: 'government', name: 'Government', icon: 'bi-building-columns', color: '#6366f1' },
      { id: 'history', name: 'History', icon: 'bi-clock-history', color: '#a16207' },
      { id: 'literature', name: 'Literature in English', icon: 'bi-feather', color: '#d946ef' },
      { id: 'civic', name: 'Civic Education', icon: 'bi-shield-check', color: '#14b8a6' },
      { id: 'agric', name: 'Agricultural Science', icon: 'bi-tree', color: '#84cc16' },
      { id: 'geography', name: 'Geography', icon: 'bi-compass', color: '#0284c7' },
      { id: 'ict', name: 'Computer Studies / ICT', icon: 'bi-laptop', color: '#3b82f6' }
    ]
  },

  // Consolidated Subjects Master List
  subjects: [
    { id: 'maths', name: 'Mathematics', icon: 'bi-calculator', color: '#0d9488' },
    { id: 'english', name: 'English Studies', icon: 'bi-journal-text', color: '#4f46e5' },
    { id: 'science', name: 'Basic Science', icon: 'bi-flower1', color: '#10b981' },
    { id: 'tech', name: 'Basic Technology', icon: 'bi-cpu', color: '#06b6d4' },
    { id: 'biology', name: 'Biology', icon: 'bi-heart-pulse', color: '#ec4899' },
    { id: 'physics', name: 'Physics', icon: 'bi-lightning-charge', color: '#f59e0b' },
    { id: 'chemistry', name: 'Chemistry', icon: 'bi-beaker', color: '#8b5cf6' },
    { id: 'furthermaths', name: 'Further Mathematics', icon: 'bi-infinity', color: '#06b6d4' },
    { id: 'economics', name: 'Economics', icon: 'bi-graph-up-arrow', color: '#10b981' },
    { id: 'commerce', name: 'Commerce', icon: 'bi-shop', color: '#f97316' },
    { id: 'accounting', name: 'Financial Accounting', icon: 'bi-receipt', color: '#14b8a6' },
    { id: 'government', name: 'Government', icon: 'bi-building-columns', color: '#6366f1' },
    { id: 'history', name: 'History', icon: 'bi-clock-history', color: '#a16207' },
    { id: 'literature', name: 'Literature in English', icon: 'bi-feather', color: '#d946ef' },
    { id: 'civic', name: 'Civic Education', icon: 'bi-shield-check', color: '#14b8a6' },
    { id: 'agric', name: 'Agricultural Science', icon: 'bi-tree', color: '#84cc16' },
    { id: 'socialstudies', name: 'Social Studies', icon: 'bi-globe-americas', color: '#f59e0b' },
    { id: 'business', name: 'Business Studies', icon: 'bi-briefcase', color: '#eab308' },
    { id: 'ict', name: 'Computer Studies / ICT', icon: 'bi-laptop', color: '#06b6d4' },
    { id: 'verbal', name: 'Verbal Reasoning', icon: 'bi-chat-left-dots', color: '#ec4899' },
    { id: 'geography', name: 'Geography', icon: 'bi-compass', color: '#0284c7' }
  ],

  // Digital Learning Library — starts empty; materials appear only when teachers
  // or the school administrator upload them.
  //
  // Learning materials support MULTIPLE MATERIAL TYPES uploaded through the
  // New Material form: PDF documents, videos, Word documents, PowerPoint
  // presentations, images and other educational formats. Material record shape:
  //   {
  //     id, title, description, level, class, department, subject, topic,
  //     typeId: 'pdf'|'video'|'document'|'presentation'|'image'|'other',
  //     materialKey,      // IndexedDB key of the uploaded file (when a file was uploaded)
  //     videoUrl,         // optional external video link (YouTube etc.) when no file
  //     thumbnail,        // optional data-URL preview image
  //     fileName, fileSize, mimeType, uploadedBy, uploaderId, uploaderRole,
  //     status: 'published'|'pending', approved, dateAdded
  //   }
  // Binary material bytes are stored separately in IndexedDB (see js/filestore.js).
  resources: [],

  // Interactive Quizzes — attached to uploaded materials.
  quizzes: [],

  // Exam Preparation Hub — populated by the school when practice sets are added.
  examPreps: [],

  // Comprehensive CBT Question Banks — starts empty.
  cbtQuestionBanks: {},

  // CBT mock exams and question banks referenced by the student portal.
  cbtExams: [],
  cbtQuestions: {},

  // Student learning activity history — starts empty.
  activityHistory: [],

  // Student Progress & Teacher Overview — starts empty.
  studentProgressMatrix: [],

  // Result Documents & Broadsheet Store — starts empty.
  results: [],

  // Admin Dashboard Statistics — start at zero; grow only with real data.
  adminStats: {
    totalStudents: 0,
    totalTeachers: 0,
    totalResources: 0,
    activeStudentsToday: 0,
    pendingApprovalsCount: 0,
    mostPopularSubject: '',
    mostAccessedTopic: ''
  }
};

// Storage helper functions
function getAppData() {
  const dataStr = localStorage.getItem('learnbridge_data_v2');
  if (!dataStr) {
    localStorage.setItem('learnbridge_data_v2', JSON.stringify(INITIAL_DATA));
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }
  try {
    const parsed = JSON.parse(dataStr);
    if (parsed.version !== DATA_VERSION) {
      // CLEAN RESET — version change wipes every account, admission number,
      // result, material record, announcement and session so the application
      // behaves as if no student, teacher or admin has ever registered.
      // Profile pictures and uploaded material files live in IndexedDB
      // ('learnbridge_files') and are wiped here too. Dashboards then start
      // from clean empty states; the first student to register receives
      // GDSSA0001 and the sequence grows only from genuine registrations.
      const staleKeys = [];
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.indexOf('learnbridge_') === 0) staleKeys.push(k);
        }
      } catch (enumErr) {
        // Fallback for environments where Storage keys are not enumerable via .key()
        Object.keys(localStorage)
          .filter(k => k && k.indexOf('learnbridge_') === 0)
          .forEach(k => staleKeys.push(k));
      }
      staleKeys.forEach(k => localStorage.removeItem(k));
      try {
        if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
          indexedDB.deleteDatabase('learnbridge_files');
        }
      } catch (idbErr) { console.warn('Could not clear file storage:', idbErr); }
      localStorage.setItem('learnbridge_data_v2', JSON.stringify(INITIAL_DATA));
      if (typeof window !== 'undefined' && window.location && !window.location.href.includes('login.html')) {
        window.location.replace('login.html');
      }
      return JSON.parse(JSON.stringify(INITIAL_DATA));
    }
    // Standardise any legacy admission numbers to the GDSSA format.
    migrateAdmissionNumbers(parsed);
    return parsed;
  } catch (e) {
    console.error('Failed to parse local storage data, resetting to initial', e);
    localStorage.setItem('learnbridge_data_v2', JSON.stringify(INITIAL_DATA));
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }
}

function saveAppData(data) {
  localStorage.setItem('learnbridge_data_v2', JSON.stringify(data));
}

// ─── Admission Numbers (GDSSA + sequential 4-digit) ──────────────────────────
// Single source of truth for the school's admission-number format:
//   GDSSA0001, GDSSA0002, GDSSA0003 … GDSSA0010 … GDSSA0100 … GDSSA1000 …
// The prefix is always "GDSSA" followed by exactly 4 sequential digits.
// Numbers are derived from the actual student records — never from a frontend
// counter, never random and never based on a student's name. Numbers of deleted
// accounts are never reused: the sequence always moves forward.

const ADMISSION_PREFIX = 'GDSSA';
const ADMISSION_WIDTH = 4;

/** GDSSA + zero-padded sequential number, e.g. 7 → "GDSSA0007". */
function formatAdmissionNumber(seq) {
  return `${ADMISSION_PREFIX}${String(seq).padStart(ADMISSION_WIDTH, '0')}`;
}

/** Extract the sequential part of a canonical GDSSA number (0 when not GDSSA). */
function parseAdmissionSequence(value) {
  const m = /^GDSSA0*(\d+)$/i.exec(String(value == null ? '' : value).trim());
  return m ? parseInt(m[1], 10) : 0;
}

/** True only for the canonical "GDSSA" + exactly-4-digits format. */
function isCanonicalAdmissionNo(value) {
  return /^GDSSA\d{4}$/.test(String(value == null ? '' : value).trim());
}

/**
 * Allocate the next sequential admission number. Computed from the stored
 * student records (the database truth) rather than any frontend counter, and
 * stamped onto the data store's forward-only `admissionCounter` by the caller's
 * save. The counter guarantees that a number is never issued twice — even when
 * the highest-numbered student's account is deleted, that number is not reused
 * and the sequence keeps moving forward. Uniqueness is additionally re-checked
 * against the current records before returning.
 */
function nextAdmissionNumber(data) {
  const students = (data && data.students) || [];
  const taken = new Set();
  let max = 0;
  students.forEach(s => {
    const no = String((s && s.admissionNo) || '').trim().toUpperCase();
    if (!no) return;
    taken.add(no);
    const seq = parseAdmissionSequence(no);
    if (seq > max) max = seq;
  });
  // Start after both the highest existing record and the persisted counter —
  // so deleted accounts' numbers are skipped, never reissued.
  let seq = Math.max(max, Number(data && data.admissionCounter) || 0) + 1;
  let candidate = formatAdmissionNumber(seq);
  while (taken.has(candidate)) {
    seq += 1;
    candidate = formatAdmissionNumber(seq);
  }
  if (data) data.admissionCounter = seq; // persisted by the caller's saveAppData
  return candidate;
}

/**
 * One-time migration: renumber any student whose stored admission number does
 * not use the canonical GDSSA format (e.g. legacy "AGSS/2026/xxxx" numbers) so
 * no non-GDSSA admission number remains anywhere in the system. Existing
 * accounts keep their login access — only the number itself is standardised.
 */
function migrateAdmissionNumbers(data) {
  if (!Array.isArray(data.students) || data.students.length === 0) return false;
  if (data.students.every(s => isCanonicalAdmissionNo(s && s.admissionNo))) return false;

  // First pass: the earliest student keeps each canonical GDSSA number;
  // every other account (legacy format or duplicate) is renumbered forward.
  const seen = new Set();
  const keep = data.students.map(s => {
    const no = String((s && s.admissionNo) || '').trim().toUpperCase();
    if (isCanonicalAdmissionNo(no) && !seen.has(no)) {
      seen.add(no);
      return true;
    }
    return false;
  });

  let max = 0;
  data.students.forEach((s, i) => {
    if (keep[i]) {
      const seq = parseAdmissionSequence(s.admissionNo);
      if (seq > max) max = seq;
    }
  });

  let changed = false;
  data.students.forEach((s, i) => {
    if (!keep[i]) {
      max += 1;
      s.admissionNo = formatAdmissionNumber(max);
      changed = true;
    }
  });

  if (changed) {
    // Keep the forward-only counter ahead of every renumbered account.
    data.admissionCounter = Math.max(Number(data.admissionCounter) || 0, max);
    saveAppData(data);
  }
  return changed;
}