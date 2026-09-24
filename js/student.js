/**
 * LearnBridge — Student Dashboard Logic
 * Dedicated, distraction-free student portal.
 * Enforces route protection and provides full curriculum learning + CBT mock exams.
 */

// Route Guard: Ensure only authenticated students can access this page
Auth.requireStudent();

let appState = getAppData();
const currentSession = Auth.getSession();
// The session stores a snapshot from login time. Always resolve the LIVE student
// record so results/materials approved after login are immediately visible.
const currentStudent =
  (appState.students || []).find(s => s.id === currentSession?.user?.id) ||
  (appState.students && appState.students[0]) ||
  currentSession?.user ||
  null;

// Active filter states — the level is fixed to the logged-in student's own class.
let activeLevel = 'all';
let activeSubject = 'all';
let activeFormat = 'all';
let searchQuery = '';

/**
 * Class & department helpers — every student's view is scoped to their own class.
 */
function getStudentLevel() {
  const cls = (currentStudent?.class || '').trim().toLowerCase();  if (cls.startsWith('jss')) return 'jss';
  if (cls.startsWith('ss ')) return 'sss';
  return 'jss';
}

function getStudentDepartment() {
  if (getStudentLevel() !== 'sss') return '';
  const cls = (currentStudent?.class || '').trim().toLowerCase();
  if (cls.includes('science')) return 'Science';
  if (cls.includes('arts')) return 'Arts';
  if (cls.includes('commercial')) return 'Commercial';
  return '';
}

// Class-based subject sets: every senior secondary student takes English + Mathematics
// plus their department's core subjects.
const DEPARTMENT_SUBJECTS = {
  Science:    ['English Language', 'General Mathematics', 'Physics', 'Chemistry', 'Biology'],
  Arts:       ['English Language', 'General Mathematics', 'Literature in English', 'Government', 'History'],
  Commercial: ['English Language', 'General Mathematics', 'Financial Accounting', 'Economics', 'Commerce']
};

/** Subjects belonging to the logged-in student's class and department only. */
function getStudentSubjects() {
  const level = getStudentLevel();
  const dept = getStudentDepartment();
  const pool = (appState.levelSubjects && appState.levelSubjects[level]) || [];

  if (level === 'sss' && DEPARTMENT_SUBJECTS[dept]) {
    const names = DEPARTMENT_SUBJECTS[dept];
    return pool.filter(s => names.includes(s.name));
  }
  return pool;
}

/**
 * True when a published resource belongs to this student's class/department.
 * Shared with the teacher portal through js/access.js so a resource can only
 * reach the class + department it was uploaded for (e.g. an "SS 2 Biology"
 * material is never visible to SS 2 Arts or SS 2 Commercial students).
 */
function resourceMatchesStudentClass(r) {
  if (!currentStudent) return false;

  if (typeof Access !== 'undefined' && Access.resourceVisibleToStudent) {
    return Access.resourceVisibleToStudent(r, currentStudent);
  }

  // Fallback (should not be needed — access.js is loaded on every portal page).
  const level = getStudentLevel();
  if (r.level && r.level !== level) return false;
  if (r.class) return r.class === currentStudent.class;
  if (r.department) return r.department === getStudentDepartment();
  return true;
}

// CBT Exam Active State
let activeCbtExam = null;
let currentQuestionIndex = 0;
let cbtUserAnswers = {};
let cbtTimerInterval = null;
let cbtSecondsRemaining = 0;
let currentLessonObj = null;

// Calculator state
let calcExpr = '';

document.addEventListener('DOMContentLoaded', () => {
  initStudentDashboard();
});

// ── Cross-tab & post-login sync ────────────────────────────────────────────
// When the admin approves a result/material in another tab, the student's open
// dashboard must refresh immediately instead of showing a stale empty state.
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('learnbridge_')) {
    initStudentDashboard();
  }
});

function initStudentDashboard() {
  // Always render from the freshest saved state — the teacher may have uploaded
  // and the admin approved results since this page was first loaded.
  appState = getAppData();

  // The library is always scoped to the logged-in student's own level.
  activeLevel = getStudentLevel();

  renderStudentHeaderInfo();
  renderAnnouncementBanner();
  renderMyClassBadge();
  renderLevelSubjects();
  renderLibraryCards();
  renderCbtExamsList();
  renderStudentResultDocs();
  renderAchievements();
  renderRecentActivity();
  renderStudentAssignments();
  renderStudentAnnouncementsSection();
  renderStudentProfileSection();
}

/**
 * 1. Render Student Profile & Metrics in Navbar and Hero
 */
function renderStudentHeaderInfo() {
  if (!currentStudent) return;

  // Hero info — shows only the student's own class (and department when applicable).
  const heroGreeting = document.getElementById('std-hero-greeting');
  const heroSub = document.getElementById('std-hero-sub');
  const heroDept = getStudentDepartment();
  const heroDeptPart = heroDept ? ` • Department: ${heroDept}` : '';
  if (heroGreeting) heroGreeting.textContent = `Welcome back, ${currentStudent.name || 'Student'}!`;
  if (heroSub) heroSub.textContent = `My Class: ${currentStudent.class || 'Secondary'}${heroDeptPart} • Admission No: ${currentStudent.admissionNo || 'N/A'}`;

  // Metrics
  const statStreak = document.getElementById('std-stat-streak');
  const statPoints = document.getElementById('std-stat-points');
  const statCompleted = document.getElementById('std-stat-completed');
  const cbtStatTaken = document.getElementById('cbt-stat-taken');
  const cbtStatHighest = document.getElementById('cbt-stat-highest');

  if (statStreak) statStreak.textContent = `${currentStudent.streakDays || 1} Days`;
  if (statPoints) statPoints.textContent = `${currentStudent.points || 100} pts`;
  if (statCompleted) statCompleted.textContent = (currentStudent.completedResourcesCount || 0).toString();
  if (cbtStatTaken) cbtStatTaken.textContent = (currentStudent.cbtExamsTakenCount || 0).toString();
  if (cbtStatHighest) cbtStatHighest.textContent = `${currentStudent.cbtBestScore || 0}%`;

  // Profile Picture manager — own account only, lives in the sidebar bottom.
  // The panel is the single unified profile section (picture + name + action).
  initDashboardProfilePicture({
    namespace: 'StudentProfilePicture',
    panelId: 'std-profile-picture-slot',
    accountId: currentStudent.id,
    name: currentStudent.name,
    sublabel: `${currentStudent.class || 'Secondary'}${getStudentDepartment() ? ' • ' + getStudentDepartment() : ''}`,
    onChange: () => {
      appState = getAppData();
      const fresh = (appState.students || []).find(s => s.id === currentStudent.id);
      if (fresh) {
        currentStudent.name = fresh.name;
        currentStudent.class = fresh.class;
        currentStudent.admissionNo = fresh.admissionNo;
      }
    }
  });
}

/**
 * 2. My Class Badge & Dynamic Subject Tags (scoped to the student's own class)
 */
function renderMyClassBadge() {
  const container = document.getElementById('my-class-badge');
  if (!container) return;

  const dept = getStudentDepartment();
  container.innerHTML = `
    <span class="btn btn-sm btn-teal text-dark fw-bold">
      <i class="bi bi-mortarboard-fill me-1"></i> My Class: ${currentStudent?.class || '—'}
    </span>
    ${dept ? `<span class="btn btn-sm btn-hub-outline"><i class="bi bi-diagram-3 me-1"></i> Department: ${dept}</span>` : ''}
    <span class="text-xs" style="color:var(--text-muted);">Only materials for your class are shown.</span>
  `;
}

function renderLevelSubjects() {
  const container = document.getElementById('lib-subject-tags');
  if (!container) return;

  // Subjects come from the student's own class + department — never the full catalogue.
  const subjects = getStudentSubjects();

  let html = `
    <button type="button" class="btn btn-xs ${activeSubject === 'all' ? 'btn-teal text-dark' : 'btn-hub-ghost text-muted'}" onclick="setLibrarySubject('all', this)">
      All Subjects
    </button>
  `;

  subjects.forEach(sub => {
    const isAct = activeSubject === sub.name;
    html += `
      <button type="button" class="btn btn-xs ${isAct ? 'btn-teal text-dark' : 'btn-hub-ghost text-muted'}" onclick="setLibrarySubject('${sub.name}', this)">
        <i class="bi ${sub.icon || 'bi-journal-text'} me-1"></i> ${sub.name}
      </button>
    `;
  });

  container.innerHTML = html;
}


function setLibrarySubject(subName, btnEl) {
  activeSubject = subName;
  const btns = document.querySelectorAll('#lib-subject-tags button');
  btns.forEach(b => {
    b.className = 'btn btn-xs btn-hub-ghost text-muted';
  });
  if (btnEl) {
    btnEl.className = 'btn btn-xs btn-teal text-dark';
  }
  renderLibraryCards();
}

function handleLibraryFilter() {
  const searchInput = document.getElementById('lib-search-input');
  const typeSelect = document.getElementById('lib-type-select');

  if (searchInput) searchQuery = searchInput.value.trim().toLowerCase();
  if (typeSelect) activeFormat = typeSelect.value;

  renderLibraryCards();
}

/**
 * 3. Render Library Resources Grid
 */
function renderLibraryCards() {
  const grid = document.getElementById('lib-resources-grid');
  if (!grid) return;

  let items = (appState.resources || []).filter(r => r.approved !== false && r.status !== 'pending' && r.status !== 'rejected');

  // Class-level data isolation: only resources assigned to this student's class are shown.
  items = items.filter(resourceMatchesStudentClass);

  // Filter subject
  if (activeSubject !== 'all') {
    items = items.filter(r => r.subject === activeSubject);
  }

  // Filter format
  if (activeFormat !== 'all') {
    items = items.filter(r => r.typeId === activeFormat || r.type === activeFormat);
  }

  // Filter search
  if (searchQuery) {
    items = items.filter(r => 
      (r.title && r.title.toLowerCase().includes(searchQuery)) ||
      (r.topic && r.topic.toLowerCase().includes(searchQuery)) ||
      (r.subject && r.subject.toLowerCase().includes(searchQuery)) ||
      (r.summary && r.summary.toLowerCase().includes(searchQuery))
    );
  }

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="col-12 py-5 text-center text-muted">
        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
        <h6 class="fw-bold">No materials available yet</h6>
        <p class="text-xs">Learning materials your teachers upload for <strong>your class and department</strong> will appear here.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(res => {
    const info = getMaterialTypeInfo(res);
    const summary = res.description || res.summary || '';
    const author = res.uploader || res.author || 'Staff';
    const dateStr = formatDateAdded(res.dateAdded);
    const deptPart = res.department ? ` &bull; ${res.department}` : '';

    const mediaBlock = res.thumbnail
      ? `<div class="resource-card-media"><img src="${res.thumbnail}" alt="${res.title} preview" loading="lazy"></div>`
      : `<div class="resource-card-media resource-card-media-fallback"><i class="bi ${info.icon} fs-2"></i></div>`;

    return `
      <div class="col-md-6 col-lg-4">
        <div class="card-hub h-100 p-0 d-flex flex-column justify-content-between overflow-hidden">
          ${mediaBlock}
          <div class="p-3 d-flex flex-column flex-grow-1">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge ${info.color} text-xs"><i class="bi ${info.icon} me-1"></i>${info.label}</span>
              <span class="badge bg-secondary bg-opacity-25 text-teal text-xs">${(res.level || 'JSS').toUpperCase()} &bull; ${res.class || ''}${deptPart}</span>
            </div>

            <h6 class="fw-bold mb-1 text-white">${res.title}</h6>
            <div class="text-xs text-teal fw-medium mb-2">${res.subject}${res.topic ? ' &bull; ' + res.topic : ''}</div>
            <p class="text-xs text-muted mb-3" style="line-height:1.4;">
              ${summary ? summary.substring(0, 130) + (summary.length > 130 ? '...' : '') : 'Approved curriculum learning material.'}
            </p>

            <div class="d-flex align-items-center justify-content-between pt-2 border-top border-secondary border-opacity-10 mb-2 text-xs text-muted">
              <span><i class="bi bi-person me-1"></i> ${author}</span>
              <span><i class="bi bi-calendar3 me-1"></i> ${dateStr}</span>
            </div>

            <div class="d-flex gap-2">
              <button type="button" class="btn btn-sm btn-hub-primary w-100 py-1" onclick="openResourceViewer('${res.id}')">
                <i class="bi ${info.actionIcon} me-1"></i> ${info.actionLabel}
              </button>
              ${res.materialKey ? `
                <button type="button" class="btn btn-sm btn-hub-outline py-1" title="Download Material" onclick="downloadResourceMaterial('${res.id}')">
                  <i class="bi bi-download"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/** Material type metadata for badges, buttons and viewer behaviour. */
function getMaterialTypeInfo(res) {
  const map = {
    pdf:          { label: 'PDF',          icon: 'bi-file-earmark-pdf',   color: 'bg-danger bg-opacity-25 text-danger',           actionLabel: 'View PDF',    actionIcon: 'bi-file-earmark-pdf' },
    video:        { label: 'Video',        icon: 'bi-file-earmark-play',  color: 'bg-primary bg-opacity-25 text-primary',         actionLabel: 'Watch Video', actionIcon: 'bi-play-btn' },
    document:     { label: 'Word Document',icon: 'bi-file-earmark-word',  color: 'bg-info bg-opacity-25 text-info',               actionLabel: 'Open Document', actionIcon: 'bi-file-earmark-word' },
    presentation: { label: 'Presentation', icon: 'bi-file-earmark-slides',color: 'bg-warning bg-opacity-25 text-warning',         actionLabel: 'Open Slides', actionIcon: 'bi-file-earmark-slides' },
    image:        { label: 'Image',        icon: 'bi-file-earmark-image', color: 'bg-success bg-opacity-25 text-success',         actionLabel: 'View Image',  actionIcon: 'bi-image' },
    other:        { label: 'Material',     icon: 'bi-file-earmark',       color: 'bg-secondary bg-opacity-25 text-light',         actionLabel: 'Open Material', actionIcon: 'bi-box-arrow-up-right' }
  };
  return map[res.typeId] || { label: res.type || 'Material', icon: 'bi-journal-text', color: 'bg-secondary', actionLabel: 'Read / Study', actionIcon: 'bi-book-half' };
}

function formatDateAdded(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Download the binary material attached to a resource (where permitted). */
function downloadResourceMaterial(resId) {
  const res = (appState.resources || []).find(r => r.id === resId);
  if (!res || !res.materialKey) return;

  // Data-level protection: students may only download material visible to their class.
  if (!resourceMatchesStudentClass(res)) {
    showToast('error', 'Access Denied', 'This material is not assigned to your class.');
    return;
  }

  FileStore.downloadMaterial(res).catch(err => {
    showToast('error', 'Download Failed', err.message || 'Could not download the material.');
  });
}

/**
 * 3B. Learning Material Viewer — PDF, Video (uploaded + external), Image & more.
 */
function openResourceViewer(resId) {
  const resource = (appState.resources || []).find(r => r.id === resId);
  if (!resource) return;

  // Strict authorization: only resources matching the student's class/department.
  if (!resourceMatchesStudentClass(resource)) {
    showToast('error', 'Access Denied', 'This material is not assigned to your class.');
    return;
  }

  currentLessonObj = resource;

  const modalEl = document.getElementById('materialViewerModal');
  const subjectBadge = document.getElementById('viewer-subject-badge');
  const titleEl = document.getElementById('viewer-title');
  const metaClass = document.getElementById('viewer-meta-class');
  const metaTeacher = document.getElementById('viewer-meta-teacher');
  const metaDate = document.getElementById('viewer-meta-date');
  const bodyEl = document.getElementById('viewer-body');
  const dlBtn = document.getElementById('viewer-download-btn');
  const completeBtn = document.getElementById('viewer-complete-btn');

  const info = getMaterialTypeInfo(resource);
  if (subjectBadge) subjectBadge.textContent = `${resource.subject}${resource.topic ? ' • ' + resource.topic : ''}`;
  if (titleEl) titleEl.textContent = resource.title;
  if (metaClass) metaClass.textContent = `${(resource.level || '').toUpperCase()} • ${resource.class || ''}${resource.department ? ' (' + resource.department + ')' : ''}`;
  if (metaTeacher) metaTeacher.textContent = `Uploaded by ${resource.uploader || resource.author || 'Staff'}`;
  if (metaDate) metaDate.textContent = formatDateAdded(resource.dateAdded);
  if (completeBtn) completeBtn.classList.remove('d-none');

  bodyEl.innerHTML = '';
  if (dlBtn) {
    dlBtn.classList.add('d-none');
    dlBtn.onclick = null;
  }

  const openLegacyReader = () => openLessonReader(resource.id);

  if (resource.videoUrl && !resource.materialKey) {
    // External video (YouTube / Vimeo / direct link) — plays inside the dashboard.
    bodyEl.innerHTML = embedExternalVideo(resource.videoUrl);
  } else if (resource.materialKey) {
    FileStore.getMaterial(resource.materialKey).then(material => {
      if (!material) {
        bodyEl.innerHTML = viewerFallback(resource, 'The material file could not be loaded. Please ask your teacher to re-upload it.');
        return;
      }
      if (dlBtn) {
        dlBtn.classList.remove('d-none');
        dlBtn.onclick = () => downloadResourceMaterial(resource.id);
      }

      const url = URL.createObjectURL(material.blob);

      if (material.type === 'application/pdf') {
        bodyEl.innerHTML = `<iframe class="material-frame" src="${url}" title="${resource.title}"></iframe>
          <div class="text-xs text-muted mt-2 text-center">PDF preview — use the Download button to save a copy for offline study.</div>`;
      } else if (material.type.startsWith('video/')) {
        bodyEl.innerHTML = `<video class="material-video w-100 rounded" src="${url}" controls autoplay playsinline></video>`;
      } else if (material.type.startsWith('image/')) {
        bodyEl.innerHTML = `<img class="img-fluid rounded mx-auto d-block" src="${url}" alt="${resource.title}">`;
      } else if (material.type.startsWith('text/')) {
        material.blob.text().then(text => {
          bodyEl.innerHTML = `<pre class="p-3 rounded text-xs" style="background:rgba(15,23,42,0.7);white-space:pre-wrap;">${escapeHtml(text)}</pre>`;
        });
      } else {
        // Word / PowerPoint / other formats: offer download + optional notes.
        bodyEl.innerHTML = `
          ${viewerFallback(resource, `${info.label} material — download to open it on your device.`)}
          ${resource.content ? `<div class="mt-3 p-3 rounded lesson-article-content" style="background:rgba(255,255,255,0.03);">${formatLessonContent(resource.content)}</div>` : ''}
        `;
      }
    }).catch(() => {
      bodyEl.innerHTML = viewerFallback(resource, 'Unexpected error while loading the material.');
    });
  } else {
    // Legacy text-based lesson resource.
    openLegacyReader();
    return;
  }

  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}

function viewerFallback(resource, message) {
  return `
    <div class="p-5 rounded text-center text-muted" style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-subtle);">
      <i class="bi bi-file-earmark text-teal fs-1 d-block mb-2"></i>
      <h6 class="fw-bold text-white mb-1">${resource.title}</h6>
      <p class="text-xs mb-0">${message}</p>
      ${resource.fileName ? `<p class="text-xs mt-2 font-monospace">${resource.fileName}</p>` : ''}
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function embedExternalVideo(url) {
  let embedUrl = url;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (ytMatch) {
    embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
  } else {
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return `<div class="ratio ratio-16x9 rounded overflow-hidden"><iframe src="${embedUrl}" title="Lesson video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
}

/**
 * 4. Lesson Reader Modal & Offline Worksheet
 */
function openLessonReader(resId) {
  const resource = (appState.resources || []).find(r => r.id === resId);
  if (!resource) return;

  // Data-level guard: a lesson outside this student's class/department is refused
  // even when its id is passed in directly.
  if (!resourceMatchesStudentClass(resource)) {
    showToast('error', 'Access Denied', 'This lesson is not assigned to your class.');
    return;
  }

  currentLessonObj = resource;

  const modalEl = document.getElementById('lessonReaderModal');
  const subjectBadge = document.getElementById('reader-subject-badge');
  const titleEl = document.getElementById('reader-title');
  const bodyEl = document.getElementById('reader-body');

  if (subjectBadge) subjectBadge.textContent = `${resource.subject} (${(resource.level || '').toUpperCase()})`;
  if (titleEl) titleEl.textContent = resource.title;

  let bodyHtml = `
    <div class="mb-3 p-3 rounded" style="background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);">
      <div class="row g-2 text-xs text-muted">
        <div class="col-sm-4"><strong>Topic:</strong> ${resource.topic || 'N/A'}</div>
        <div class="col-sm-4"><strong>Class:</strong> ${resource.class || 'All classes'}</div>
        <div class="col-sm-4"><strong>Curriculum:</strong> NERDC Approved</div>
      </div>
    </div>
  `;

  if (resource.content) {
    bodyHtml += `
      <div class="lesson-article-content mb-4 lh-lg fs-6" style="color:#cbd5e1;">
        ${formatLessonContent(resource.content)}
      </div>
    `;
  }

  // If resource has sample questions or worksheet section
  if (resource.questions && resource.questions.length > 0) {
    bodyHtml += `
      <div class="card-hub p-3 mb-3">
        <h6 class="fw-bold text-teal mb-3"><i class="bi bi-question-circle me-1"></i> Self-Check Practice Questions</h6>
        <div class="d-flex flex-column gap-3">
          ${resource.questions.map((q, idx) => `
            <div class="p-2 rounded bg-secondary bg-opacity-10 border border-secondary border-opacity-10">
              <div class="fw-bold text-sm mb-1">${idx + 1}. ${q.question}</div>
              <div class="text-xs text-muted">A) ${q.options ? q.options[0] : ''} &nbsp;|&nbsp; B) ${q.options ? q.options[1] : ''} &nbsp;|&nbsp; C) ${q.options ? q.options[2] : ''} &nbsp;|&nbsp; D) ${q.options ? q.options[3] : ''}</div>
              <div class="text-xs text-teal mt-1">Answer: ${q.answer || 'Refer to notes'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  bodyEl.innerHTML = bodyHtml;

  const bsModal = new bootstrap.Modal(modalEl);
  bsModal.show();
}

function openWorksheetDirect(resId) {
  openLessonReader(resId);
  setTimeout(() => {
    window.print();
  }, 500);
}

function formatLessonContent(rawText) {
  if (!rawText) return '';
  return rawText
    .split('\n\n')
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function markCurrentLessonComplete() {
  if (!currentStudent || !currentLessonObj) return;

  currentStudent.completedResourcesCount = (currentStudent.completedResourcesCount || 0) + 1;
  currentStudent.points = (currentStudent.points || 100) + 25;

  // Record activity
  if (!appState.activityHistory) appState.activityHistory = [];
  appState.activityHistory.unshift({
    title: `Completed Lesson: ${currentLessonObj.title}`,
    time: 'Just now',
    type: 'lesson',
    points: '+25 pts'
  });

  // Update in students array
  const sIdx = (appState.students || []).findIndex(s => s.id === currentStudent.id);
  if (sIdx !== -1) {
    appState.students[sIdx] = currentStudent;
  }

  saveAppData(appState);
  renderStudentHeaderInfo();
  renderAchievements();
  renderRecentActivity();

  showToast('success', 'Lesson Completed', 'Great job! You earned 25 reward points for completing this lesson.');

  // Close whichever viewer modal is open (material viewer or legacy lesson reader).
  ['materialViewerModal', 'lessonReaderModal'].forEach(id => {
    const modalEl = document.getElementById(id);
    if (!modalEl) return;
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();
  });
}

/**
 * 5. CBT Mock Exam Center
 */
function renderCbtExamsList() {
  const grid = document.getElementById('cbt-exams-grid');
  if (!grid) return;

  // Mock exams are school-created content — a fresh account has none.
  const exams = appState.cbtExams || [];

  if (exams.length === 0) {
    grid.innerHTML = `
      <div class="col-12 py-5 text-center text-muted">
        <i class="bi bi-laptop fs-1 d-block mb-2"></i>
        <h6 class="fw-bold">No mock exams available yet</h6>
        <p class="text-xs">Timed CBT practice exams will appear here once the school publishes them.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = exams.map(exam => `
    <div class="col-md-6 col-lg-3">
      <div class="card-hub p-3 h-100 d-flex flex-column justify-content-between" style="border:1px solid rgba(20, 184, 166, 0.2);">
        <div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge bg-teal text-dark text-xs">${(exam.level || 'JSS').toUpperCase()}</span>
            <span class="badge bg-secondary bg-opacity-25 text-muted text-xs">
              <i class="bi bi-clock me-1"></i> ${exam.durationMinutes} mins
            </span>
          </div>

          <h6 class="fw-bold text-white mb-2">${exam.title}</h6>
          <p class="text-xs text-muted mb-3" style="line-height:1.4;">${exam.description}</p>
          
          <div class="mb-3">
            <span class="text-xs text-teal fw-bold d-block mb-1">Subjects Covered:</span>
            <div class="d-flex flex-wrap gap-1">
              ${(exam.subjects || []).map(s => `<span class="badge bg-secondary bg-opacity-20 text-xs text-light">${s}</span>`).join('')}
            </div>
          </div>
        </div>

        <div>
          <div class="d-flex justify-content-between text-xs text-muted mb-2 pt-2 border-top border-secondary border-opacity-10">
            <span>Questions: <strong>${exam.totalQuestions || 5}</strong></span>
            <span>Mode: <strong>Timed CBT</strong></span>
          </div>
          <button type="button" class="btn btn-sm btn-hub-primary w-100 py-2" onclick="startCbtExam('${exam.id}')">
            <i class="bi bi-play-circle me-1"></i> Start CBT Mock Exam
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function startCbtExam(examId) {
  // Load questions bank — exams are school-created; nothing is hardcoded.
  const questionBanks = appState.cbtQuestions || {};
  const questions = questionBanks[examId];
  if (!questions || questions.length === 0) {
    showToast('warning', 'No Questions Available', 'This mock exam has no questions yet. Please check back later.');
    return;
  }

  const exam = (appState.cbtExams || []).find(ex => ex.id === examId) || {};

  activeCbtExam = {
    id: examId,
    title: exam.title || 'CBT Mock Examination',
    questions: questions,
    durationMinutes: exam.durationMinutes || 15
  };

  currentQuestionIndex = 0;
  cbtUserAnswers = {};
  cbtSecondsRemaining = activeCbtExam.durationMinutes * 60;

  // Set Modal Headings
  document.getElementById('cbt-modal-exam-title').textContent = activeCbtExam.title;
  document.getElementById('cbt-modal-candidate-info').textContent = `Candidate: ${currentStudent?.name || 'Student'} | ${currentStudent?.admissionNo || 'N/A'} (${(currentStudent?.class || 'Secondary').toUpperCase()})`;

  renderCbtPalette();
  loadCbtQuestion(0);
  startCbtTimer();

  const examModal = new bootstrap.Modal(document.getElementById('cbtExamModal'));
  examModal.show();
}

function startCbtTimer() {
  if (cbtTimerInterval) clearInterval(cbtTimerInterval);

  updateCbtTimerDisplay();
  cbtTimerInterval = setInterval(() => {
    cbtSecondsRemaining--;
    updateCbtTimerDisplay();

    if (cbtSecondsRemaining <= 0) {
      clearInterval(cbtTimerInterval);
      showToast('warning', 'Time Elapsed', 'Exam time has expired! Automatically submitting your answers.');
      submitCbtExamResults();
    }
  }, 1000);
}

function updateCbtTimerDisplay() {
  const display = document.getElementById('cbt-timer-display');
  if (!display) return;

  const mins = Math.floor(cbtSecondsRemaining / 60);
  const secs = cbtSecondsRemaining % 60;
  display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  if (cbtSecondsRemaining < 120) {
    display.className = 'fw-bold font-monospace fs-5 text-danger';
  } else {
    display.className = 'fw-bold font-monospace fs-5 text-teal';
  }
}

function loadCbtQuestion(idx) {
  if (!activeCbtExam || !activeCbtExam.questions[idx]) return;

  currentQuestionIndex = idx;
  const q = activeCbtExam.questions[idx];

  document.getElementById('cbt-question-number-badge').textContent = `Question ${idx + 1} of ${activeCbtExam.questions.length}`;
  document.getElementById('cbt-question-topic').textContent = `Topic: ${q.topic}`;
  document.getElementById('cbt-question-text').textContent = q.question;

  const optionsContainer = document.getElementById('cbt-options-container');
  const optionLetters = ['A', 'B', 'C', 'D'];
  const savedAnswer = cbtUserAnswers[idx];

  optionsContainer.innerHTML = q.options.map((opt, optIdx) => {
    const isSelected = savedAnswer === optIdx;
    return `
      <div class="cbt-option-item ${isSelected ? 'selected' : ''}" onclick="selectCbtOption(${idx}, ${optIdx})">
        <span class="cbt-opt-letter">${optionLetters[optIdx]}</span>
        <span class="cbt-opt-text">${opt}</span>
      </div>
    `;
  }).join('');

  // Update button states
  document.getElementById('cbt-prev-btn').disabled = idx === 0;
  document.getElementById('cbt-next-btn').disabled = idx === activeCbtExam.questions.length - 1;

  renderCbtPalette();
}

function selectCbtOption(qIndex, optIndex) {
  cbtUserAnswers[qIndex] = optIndex;
  loadCbtQuestion(qIndex);
}

function prevCbtQuestion() {
  if (currentQuestionIndex > 0) {
    loadCbtQuestion(currentQuestionIndex - 1);
  }
}

function nextCbtQuestion() {
  if (activeCbtExam && currentQuestionIndex < activeCbtExam.questions.length - 1) {
    loadCbtQuestion(currentQuestionIndex + 1);
  }
}

function renderCbtPalette() {
  const grid = document.getElementById('cbt-palette-grid');
  if (!grid || !activeCbtExam) return;

  grid.innerHTML = activeCbtExam.questions.map((_, idx) => {
    const isAnswered = cbtUserAnswers[idx] !== undefined;
    const isCurrent = currentQuestionIndex === idx;

    let style = 'background:rgba(255,255,255,0.06);border:1px solid var(--border-subtle);color:var(--text-muted);';
    if (isAnswered) {
      style = 'background:var(--teal);border:1px solid var(--teal);color:#0f172a;font-weight:bold;';
    }
    if (isCurrent) {
      style += 'box-shadow:0 0 0 2px #38bdf8;';
    }

    return `
      <button type="button" class="btn btn-sm" style="width:36px;height:36px;padding:0;${style}" onclick="loadCbtQuestion(${idx})">
        ${idx + 1}
      </button>
    `;
  }).join('');
}

function confirmSubmitCbtExam() {
  const total = activeCbtExam.questions.length;
  const answeredCount = Object.keys(cbtUserAnswers).length;
  const unanswered = total - answeredCount;

  let msg = `You have answered ${answeredCount} of ${total} questions.`;
  if (unanswered > 0) {
    msg += ` You still have ${unanswered} unanswered question(s).`;
  }
  msg += ' Are you sure you want to submit your exam now?';

  if (confirm(msg)) {
    submitCbtExamResults();
  }
}

function submitCbtExamResults() {
  if (cbtTimerInterval) clearInterval(cbtTimerInterval);

  // Close exam modal
  const examModalEl = document.getElementById('cbtExamModal');
  const examModalInstance = bootstrap.Modal.getInstance(examModalEl);
  if (examModalInstance) examModalInstance.hide();

  // Calculate score
  let correctCount = 0;
  const questions = activeCbtExam.questions;
  const details = [];

  questions.forEach((q, idx) => {
    const userSelected = cbtUserAnswers[idx];
    const isCorrect = userSelected === q.correctIndex;
    if (isCorrect) correctCount++;

    details.push({
      question: q.question,
      topic: q.topic,
      userAns: userSelected !== undefined ? q.options[userSelected] : 'Not Answered',
      correctAns: q.options[q.correctIndex],
      isCorrect: isCorrect,
      explanation: q.explanation
    });
  });

  const percentage = Math.round((correctCount / questions.length) * 100);
  const earnedPoints = correctCount * 20;

  // Update student stats
  if (currentStudent) {
    currentStudent.cbtExamsTakenCount = (currentStudent.cbtExamsTakenCount || 0) + 1;
    if (percentage > (currentStudent.cbtBestScore || 0)) {
      currentStudent.cbtBestScore = percentage;
    }
    currentStudent.points = (currentStudent.points || 100) + earnedPoints;

    // Record activity
    if (!appState.activityHistory) appState.activityHistory = [];
    appState.activityHistory.unshift({
      title: `Completed Mock Exam: ${activeCbtExam.title} (${percentage}%)`,
      time: 'Just now',
      type: 'cbt',
      points: `+${earnedPoints} pts`
    });

    const sIdx = (appState.students || []).findIndex(s => s.id === currentStudent.id);
    if (sIdx !== -1) {
      appState.students[sIdx] = currentStudent;
    }
    saveAppData(appState);
    renderStudentHeaderInfo();
    renderAchievements();
    renderRecentActivity();
  }

  // Display Result Modal
  const resultBody = document.getElementById('cbt-result-body');
  resultBody.innerHTML = `
    <div class="text-center py-3 mb-4 rounded" style="background:rgba(20, 184, 166, 0.1);border:1px solid rgba(20, 184, 166, 0.3);">
      <h3 class="fw-bold mb-1 ${percentage >= 50 ? 'text-teal' : 'text-warning'}">${percentage}%</h3>
      <div class="fw-semibold text-white fs-6 mb-1">${correctCount} of ${questions.length} Questions Correct</div>
      <div class="text-xs text-muted">Earned +${earnedPoints} Reward Points</div>
    </div>

    <h6 class="fw-bold text-white mb-3"><i class="bi bi-card-checklist text-teal me-2"></i> Question Breakdown &amp; Solutions</h6>
    <div class="d-flex flex-column gap-3">
      ${details.map((d, i) => `
        <div class="p-3 rounded" style="background:rgba(255,255,255,0.03);border-left:4px solid ${d.isCorrect ? 'var(--teal)' : '#ef4444'};">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-xs fw-bold text-muted">Question ${i + 1} (${d.topic})</span>
            <span class="badge ${d.isCorrect ? 'bg-teal text-dark' : 'bg-danger'} text-xs">${d.isCorrect ? 'Correct' : 'Incorrect'}</span>
          </div>
          <div class="fw-semibold text-sm mb-2 text-white">${d.question}</div>
          <div class="text-xs mb-1">Your Answer: <strong class="${d.isCorrect ? 'text-teal' : 'text-danger'}">${d.userAns}</strong></div>
          ${!d.isCorrect ? `<div class="text-xs text-teal mb-1">Correct Answer: <strong>${d.correctAns}</strong></div>` : ''}
          <div class="text-xs text-muted mt-2 pt-2 border-top border-secondary border-opacity-15">
            <strong>Explanation:</strong> ${d.explanation}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  const resultModal = new bootstrap.Modal(document.getElementById('cbtResultModal'));
  resultModal.show();
}

/**
 * 6. On-Screen Calculator Logic
 */
function calcInput(char) {
  const display = document.getElementById('calc-display');
  if (calcExpr === '0' || calcExpr === 'Error') calcExpr = '';
  calcExpr += char;
  if (display) display.value = calcExpr;
}

function calcClear() {
  const display = document.getElementById('calc-display');
  calcExpr = '';
  if (display) display.value = '0';
}

function calcEquals() {
  const display = document.getElementById('calc-display');
  try {
    // evaluate simple arithmetic safely
    const cleanExpr = calcExpr.replace(/[^0-9+\-*/.]/g, '');
    const res = Function(`'use strict'; return (${cleanExpr})`)();
    calcExpr = res.toString();
    if (display) display.value = calcExpr;
  } catch (e) {
    calcExpr = '';
    if (display) display.value = 'Error';
  }
}

/**
 * 7. Progress & Achievements
 */
function renderAchievements() {
  const list = document.getElementById('achievements-list');
  if (!list) return;

  const points = currentStudent?.points || 100;
  const completed = currentStudent?.completedResourcesCount || 0;
  const cbtTaken = currentStudent?.cbtExamsTakenCount || 0;

  const badges = [
    {
      title: 'Portal Pioneer',
      desc: 'Enrolled and registered in Amule Digital Learning Hub.',
      achieved: true,
      icon: 'bi-award'
    },
    {
      title: 'Scholar in Training',
      desc: 'Completed at least 5 curriculum lesson modules.',
      achieved: completed >= 5,
      icon: 'bi-book'
    },
    {
      title: 'CBT Test Ready',
      desc: 'Completed at least 1 timed computerized mock exam.',
      achieved: cbtTaken >= 1,
      icon: 'bi-laptop'
    },
    {
      title: 'Honor Roll Status',
      desc: 'Earned 300+ total reward points across quizzes and tests.',
      achieved: points >= 300,
      icon: 'bi-star'
    }
  ];

  list.innerHTML = badges.map(b => `
    <div class="p-3 rounded d-flex align-items-center gap-3" style="background:${b.achieved ? 'rgba(20, 184, 166, 0.08)' : 'rgba(255,255,255,0.02)'};border:1px solid ${b.achieved ? 'rgba(20, 184, 166, 0.3)' : 'var(--border-subtle)'};opacity:${b.achieved ? '1' : '0.6'};">
      <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;background:${b.achieved ? 'var(--teal)' : 'rgba(255,255,255,0.1)'};color:${b.achieved ? '#0f172a' : '#94a3b8'};">
        <i class="bi ${b.icon} fs-5"></i>
      </div>
      <div>
        <div class="fw-bold text-sm text-white d-flex align-items-center gap-2">
          ${b.title}
          ${b.achieved ? '<span class="badge bg-teal text-dark text-xs">Unlocked</span>' : '<span class="badge bg-secondary bg-opacity-25 text-muted text-xs">Locked</span>'}
        </div>
        <div class="text-xs text-muted">${b.desc}</div>
      </div>
    </div>
  `).join('');
}

function renderRecentActivity() {
  const container = document.getElementById('activity-history-list');
  if (!container) return;

  const history = appState.activityHistory || [];

  if (history.length === 0) {
    container.innerHTML = `
      <div class="p-4 rounded text-center text-muted" style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-subtle);">
        <i class="bi bi-clock-history fs-3 d-block mb-1"></i>
        <h6 class="fw-bold text-white mb-1">No learning activity yet</h6>
        <p class="text-xs mb-0">Your completed lessons, quizzes and mock exams will appear here as you learn.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = history.slice(0, 5).map(h => `
    <div class="p-2 rounded d-flex justify-content-between align-items-center" style="background:rgba(255,255,255,0.02);border:1px solid var(--border-subtle);">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-check-circle text-teal"></i>
        <div>
          <div class="fw-medium text-xs text-white">${h.title}</div>
          <div class="text-xs text-muted" style="font-size:0.7rem;">${h.time}</div>
        </div>
      </div>
      <span class="badge bg-secondary bg-opacity-25 text-teal text-xs font-monospace">${h.points || ''}</span>
    </div>
  `).join('');
}

/**
 * 7b. School Announcement & Notice Banner
 */
function renderAnnouncementBanner() {
  const row = document.getElementById('std-announcement-row');
  const textEl = document.getElementById('std-announcement-text');
  if (!row || !textEl) return;

  const announcement = (localStorage.getItem('learnbridge_announcement') || '').trim();
  if (announcement) {
    textEl.textContent = announcement;
    row.classList.remove('d-none');
  } else {
    // No school announcement configured — hide the banner entirely.
    row.classList.add('d-none');
  }
}

/**
 * 7c. Student Results Documents & Broadsheets Hub
 */
function renderStudentResultDocs() {
  const container = document.getElementById('student-results-grid');
  if (!container) return;

  const results = appState.results || [];

  // Data isolation: a student only sees result documents that contain their own
  // admission number (or that were published specifically for their account) —
  // AND only after the school administrator has approved the upload.
  const relevantDocs = results.filter(r =>
    r.status === 'published' &&
    r.approved !== false &&
    (r.studentId === currentStudent?.id ||
     (Array.isArray(r.scores) && r.scores.some(sc => sc.admissionNo === currentStudent?.admissionNo)))
  );

  if (relevantDocs.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="p-4 rounded text-center text-muted" style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-subtle);">
          <i class="bi bi-file-earmark-check fs-2 text-teal d-block mb-1"></i>
          <h6 class="fw-bold text-white mb-1">No results available yet.</h6>
          <p class="text-xs mb-0">Your results will appear here once your teacher uploads them and the school administrator approves them.</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = relevantDocs.map(doc => {
    const iconClass = doc.docType === 'pdf' ? 'bi-file-earmark-pdf text-danger' : 
                      doc.docType === 'excel' ? 'bi-file-earmark-excel text-success' : 'bi-file-earmark-text text-info';

    return `
      <div class="col-md-6 col-lg-4">
        <div class="card-hub p-3 h-100 d-flex flex-column justify-content-between">
          <div>
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="badge bg-secondary bg-opacity-25 text-teal font-monospace text-xs">${(doc.level || 'JSS').toUpperCase()} &bull; ${doc.class}</span>
              <span class="badge bg-dark border border-secondary border-opacity-25 text-xs text-uppercase">${doc.docType}</span>
            </div>
            
            <div class="d-flex align-items-center gap-2 mb-2">
              <i class="bi ${iconClass} fs-3"></i>
              <div class="text-truncate">
                <h6 class="fw-bold text-white mb-0 text-truncate text-sm">${doc.title}</h6>
                <span class="text-xs text-muted font-monospace">${doc.session} &bull; ${doc.term}</span>
              </div>
            </div>

            <p class="text-xs text-muted mb-3" style="line-height:1.4;">
              ${doc.description || 'Official academic examination broadsheet published by Amule Government Secondary School.'}
            </p>
          </div>

          <div class="d-flex justify-content-between align-items-center pt-2 border-top border-secondary border-opacity-15">
            <span class="text-xs text-muted font-monospace">${doc.fileSize || '2.0 MB'}</span>
            <div class="d-flex gap-1">
              <button class="btn btn-xs btn-hub-primary" onclick="openActiveStudentReportCard()">
                <i class="bi bi-eye"></i> View Card
              </button>
              <button class="btn btn-xs btn-outline-teal" onclick="simulateStudentDownload('${doc.fileName}')" title="Download Document File">
                <i class="bi bi-download"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openActiveStudentReportCard() {
  const student = currentStudent || (appState.students && appState.students[0]);
  if (!student) return;

  // Find student's scores from any broadsheet
  let studentScoreEntry = null;
  let broadsheetTitle = 'First Term Examination 2025/2026';

  for (const r of (appState.results || [])) {
    if (r.status !== 'published' || r.approved === false) continue;
    if (r.scores) {
      const match = r.scores.find(sc => sc.admissionNo === student.admissionNo || sc.name === student.name);
      if (match) {
        studentScoreEntry = match;
        broadsheetTitle = r.title;
        break;
      }
    }
  }

  const reportContainer = document.getElementById('student-report-body');

  // No scores recorded yet — show a clean empty state instead of sample data.
  if (!studentScoreEntry) {
    reportContainer.innerHTML = `
      <div class="p-5 rounded text-center text-muted" style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-subtle);">
        <i class="bi bi-file-earmark-dashed fs-1 d-block mb-2"></i>
        <h6 class="fw-bold text-white mb-1">No results available yet.</h6>
        <p class="text-xs mb-0">Your official report card will appear here once the school publishes your examination results.</p>
      </div>
    `;
    const modalEl = document.getElementById('studentReportCardModal');
    const modalInstance = new bootstrap.Modal(modalEl);
    modalInstance.show();
    return;
  }

  const subjectsTable = studentScoreEntry.subjects && Object.keys(studentScoreEntry.subjects).length > 0 ? Object.entries(studentScoreEntry.subjects).map(([sub, score]) => `
    <tr>
      <td class="fw-bold text-white">${sub}</td>
      <td class="font-monospace text-center">${score.ca} / 40</td>
      <td class="font-monospace text-center">${score.exam} / 60</td>
      <td class="font-monospace text-center fw-bold text-warning">${score.total} / 100</td>
      <td class="text-center"><span class="badge ${score.grade === 'A' ? 'bg-success' : 'bg-primary'}">${score.grade}</span></td>
    </tr>
  `).join('') : `
    <tr>
      <td colspan="5" class="text-center text-muted text-xs py-3">No subject scores recorded in this document.</td>
    </tr>
  `;

  reportContainer.innerHTML = `
    <div class="p-4 rounded text-light" style="background:rgba(15,23,42,0.95);border:1px solid var(--border-teal);">
      <!-- School Header -->
      <div class="text-center pb-3 border-bottom border-secondary border-opacity-25 mb-4">
        <div class="d-inline-flex align-items-center gap-2 mb-2">
          <div class="brand-logo-icon" style="width:44px;height:44px;">
            <i class="bi bi-book-half fs-3 text-white"></i>
          </div>
          <div>
            <h4 class="fw-bold mb-0 text-white">Amule Government Secondary School</h4>
            <span class="text-xs text-teal">Amule, Lagos State • Official Digital Registry</span>
          </div>
        </div>
        <p class="text-xs text-muted mb-0">Continuous Assessment (40%) &amp; Terminal Examination (60%) Official Student Report</p>
        <div class="text-xs text-warning font-monospace mt-1">${broadsheetTitle}</div>
      </div>

      <!-- Student Bio Summary -->
      <div class="row g-3 mb-4 p-3 rounded" style="background:rgba(30,41,59,0.5);border:1px solid var(--border-subtle);">
        <div class="col-md-3 d-flex align-items-center gap-2">
          ${studentBadgeHtml(student, 46)}
          <div>
            <div class="fw-bold text-sm text-white">${student.name}</div>
            <div class="text-xs text-teal font-monospace">${student.admissionNo}</div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="text-xs text-muted">Class &amp; Level</div>
          <div class="fw-bold text-sm text-white">${student.class} (${(student.level || 'JSS').toUpperCase()})</div>
        </div>
        <div class="col-md-3">
          <div class="text-xs text-muted">Overall Average &amp; Rank</div>
          <div class="fw-bold text-sm text-warning font-monospace">${studentScoreEntry.average != null ? studentScoreEntry.average + '%' : '—'} (${studentScoreEntry.position || '—'})</div>
        </div>
        <div class="col-md-3">
          <div class="text-xs text-muted">Promotion Status</div>
          <span class="badge bg-success text-xs"><i class="bi bi-check-circle me-1"></i> Passed (On Track)</span>
        </div>
      </div>

      <!-- Subject Scores Breakdown -->
      <h6 class="fw-bold text-white mb-2"><i class="bi bi-card-checklist text-teal me-1"></i> Performance by Subject</h6>
      <div class="table-responsive mb-4">
        <table class="table table-bordered table-dark align-middle text-sm mb-0">
          <thead style="background:rgba(15,23,42,0.8);">
            <tr class="text-xs text-teal text-uppercase">
              <th>Subject</th>
              <th class="text-center">Continuous Assessment (40)</th>
              <th class="text-center">Terminal Exam (60)</th>
              <th class="text-center">Total Score (100)</th>
              <th class="text-center">Grade</th>
            </tr>
          </thead>
          <tbody>
            ${subjectsTable}
          </tbody>
        </table>
      </div>

      <!-- Remarks and Signature -->
      <div class="row g-3 p-3 rounded" style="background:rgba(30,41,59,0.4);border:1px solid var(--border-subtle);">
        <div class="col-md-8">
          <div class="text-xs text-muted mb-1">Principal's Official Remarks:</div>
          <p class="text-xs text-light mb-0 fst-italic">"${studentScoreEntry.remark || 'No official remarks recorded yet.'}"</p>
        </div>
        <div class="col-md-4 text-end">
          <div class="text-xs text-teal fw-bold font-monospace">School Principal</div>
          <div class="text-xs text-muted">Principal &amp; Chief Administrator</div>
          <div class="text-xs text-muted">Amule Government Secondary School</div>
        </div>
      </div>
    </div>
  `;

  const modalEl = document.getElementById('studentReportCardModal');
  const modalInstance = new bootstrap.Modal(modalEl);
  modalInstance.show();
}

function simulateStudentDownload(fileName = 'Report_Card.pdf') {
  showToast('info', 'Download Started', `Downloading "${fileName}" to your device.`);

  const content = `Amule Government Secondary School\nOfficial Examination Broadsheet & Terminal Report\nDocument: ${fileName}\nStudent: ${currentStudent?.name || 'Student'}\nAdmission No: ${currentStudent?.admissionNo || 'N/A'}\nStatus: Certified Official Record.`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 8. Utility: Data Saver Mode
 */
function toggleDataSaver() {
  const isEnabled = document.body.classList.toggle('low-data-mode');
  const btn = document.getElementById('data-saver-btn');
  if (btn) {
    btn.className = isEnabled ? 'btn btn-sm btn-teal text-dark d-none d-sm-inline-flex align-items-center gap-1' : 'btn btn-sm btn-hub-outline d-none d-sm-inline-flex align-items-center gap-1';
  }
  showToast('info', 'Data Saver Mode', isEnabled ? 'Low-data mode activated. High-res images and background effects paused.' : 'Standard mode restored.');
}

/**
 * 9. Toast Notification System
 */
function showToast(type = 'info', title = '', message = '', durationMs = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const iconMap = {
    success: 'bi-check-circle-fill',
    info: 'bi-info-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    error: 'bi-x-circle-fill'
  };

  const el = document.createElement('div');
  el.className = `hub-toast toast-${type}`;
  el.innerHTML = `
    <i class="bi ${iconMap[type] || iconMap.info} toast-icon"></i>
    <div class="toast-msg">
      ${title ? `<strong>${title}</strong>` : ''}
      ${message}
    </div>
  `;

  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 320);
  }, durationMs);
}

/**
 * 10. Sidebar Sections — Assignments, Announcements & Profile
 * Assignments: approved class/department-scoped resources flagged as
 * assignments. Announcements: the Principal's school-wide notice.
 */
function renderStudentAssignments() {
  const container = document.getElementById('student-assignments-list');
  if (!container || !currentStudent) return;

  const assignments = (appState.resources || []).filter(r => {
    if (r.status !== 'published' || r.approved === false) return false;
    if (!r.isAssignment) return false;
    // Same class + department scope every other student view uses.
    return resourceMatchesStudentClass(r);
  });

  if (assignments.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4">
        <i class="bi bi-journal-check fs-1 text-muted d-block mb-2"></i>
        <p class="text-sm text-muted mb-1">No assignments yet.</p>
        <p class="text-xs text-muted mb-0">Take-home tasks and worksheets for your class will appear here once your teachers publish them.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = assignments.map(a => {
    const meta = getMaterialTypeInfo(a);
    return `
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 p-3 mb-2 rounded" style="background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.16);">
        <div>
          <div class="fw-bold text-sm text-white">${escapeHtml(a.title || 'Untitled assignment')}</div>
          <div class="text-xs text-muted mt-1">
            <span class="badge ${meta.color} me-1">${meta.label}</span>
            ${a.subject ? `<span class="me-2"><i class="bi bi-book me-1"></i>${escapeHtml(a.subject)}</span>` : ''}
            ${a.class ? `<span class="me-2"><i class="bi bi-people me-1"></i>${escapeHtml(a.class)}</span>` : ''}
            ${a.uploadedBy ? `<span><i class="bi bi-person me-1"></i>${escapeHtml(a.uploadedBy)}</span>` : ''}
          </div>
          ${a.description ? `<div class="text-xs text-muted mt-1">${escapeHtml(String(a.description).substring(0, 140))}</div>` : ''}
        </div>
        <div class="text-md-end">
          <button class="btn btn-sm btn-teal text-dark fw-bold" onclick="openResourceViewer('${a.id}')">
            <i class="bi ${meta.actionIcon} me-1"></i> ${meta.actionLabel}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderStudentAnnouncementsSection() {
  const container = document.getElementById('student-announcements-list');
  if (!container) return;

  const announcement = (localStorage.getItem('learnbridge_announcement') || '').trim();
  if (!announcement) {
    container.innerHTML = `
      <div class="text-center py-4">
        <i class="bi bi-megaphone fs-1 text-muted d-block mb-2"></i>
        <p class="text-sm text-muted mb-0">No announcements at the moment. Notices from the Principal will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="p-3 rounded d-flex align-items-start gap-3" style="background:rgba(13,148,136,0.1);border:1px solid rgba(13,148,136,0.3);">
      <i class="bi bi-megaphone-fill text-teal fs-4 mt-1"></i>
      <div>
        <strong class="text-white text-sm d-block mb-1">Principal's Notice</strong>
        <span class="text-light text-sm">${escapeHtml(announcement)}</span>
      </div>
    </div>
  `;
}

function renderStudentProfileSection() {
  const container = document.getElementById('student-profile-info');
  if (!container || !currentStudent) return;

  const dept = getStudentDepartment();
  const rows = [
    ['Full Name', currentStudent.name || '—'],
    ['Admission Number', currentStudent.admissionNo || '—'],
    ['Class', currentStudent.class || '—'],
    ['Department / Section', dept || 'General (no department)'],
    ['Role', 'Student'],
    ['Email', currentStudent.email || '—']
  ];

  container.innerHTML = rows.map(([label, value]) => `
    <div class="col-md-6">
      <div class="p-2 rounded" style="background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.14);">
        <div class="text-xs text-muted text-uppercase fw-bold">${label}</div>
        <div class="text-sm text-white fw-bold mt-1">${escapeHtml(String(value))}</div>
      </div>
    </div>
  `).join('') + `
    <div class="col-12">
      <div class="text-xs text-muted">Your subjects: ${getStudentSubjects().map(s => escapeHtml(s.name)).join(', ') || '—'}</div>
    </div>
  `;
}
