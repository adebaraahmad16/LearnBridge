/**
 * LearnBridge — Staff Dashboard Logic
 * Dedicated portal for educators, teachers, and department heads.
 * Enforces staff-only route protection.
 */

// Route Guard: Ensure only authenticated staff can access this page
Auth.requireStaff();

let appState = getAppData();
const currentSession = Auth.getSession();
// Resolve the LIVE staff record — submissions approved/removed by the admin
// elsewhere must be reflected here, not hidden by a stale login snapshot.
const currentStaff =
  (appState.staff || []).find(s => s.id === currentSession?.user?.id) ||
  currentSession?.user ||
  (appState.staff && appState.staff[0]) ||
  null;

/**
 * ─── Teacher scope ───────────────────────────────────────────────────────────
 * Teacher → Department → Assigned Classes → Authorized Students/Results/Resources.
 * Every class list, student list and result/resource lookup on this dashboard is
 * derived from the logged-in teacher's own assignment — never from the full
 * school roster. All checks are funnelled through the shared Access module so a
 * tampered student id or class value is rejected at the data level.
 */

/** Classes the logged-in teacher is authorized to teach. */
function myAuthorizedClasses() {
  return Access.assignedClasses(currentStaff);
}

/** Departments covered by the teacher's assigned classes. */
function myAuthorizedDepartments() {
  return Access.assignedDepartments(currentStaff);
}

/** The teacher's declared department (falls back to their class sections). */
function myDepartmentLabel() {
  if (!currentStaff) return '—';
  if (currentStaff.department) return currentStaff.department;
  const depts = myAuthorizedDepartments();
  return depts.length > 0 ? depts.join(', ') : '—';
}

/** Students registered in the teacher's authorized classes only. */
function myStudents() {
  return Access.authorizedStudents(currentStaff, appState.students || []);
}

/** Data-level guard: refuse anything outside the teacher's assigned classes. */
function assertClassAccess(cls, actionLabel) {
  const allowed = Access.canTeachClass(currentStaff, cls);
  if (!allowed) {
    showToast('error', 'Access Denied',
      `You are not assigned to ${cls || 'that class'}, so you cannot ${actionLabel || 'access this'}.`);
  }
  return allowed;
}

let staffUploadedFile = null;

// Guards one upload from being submitted twice (no duplicate resources).
let resourceUploadInProgress = false;

// ─── New Resource form state ─────────────────────────────────────────────────
let staffMaterialFile = null;      // { file, detectedType }
let staffThumbnailDataUrl = null;  // optional preview image
let staffEditingResourceId = null; // set while editing an existing resource

// Accepted material types per Resource Type option (MIME + extension based).
const RESOURCE_TYPE_RULES = {
  pdf: {
    label: 'PDF Document', icon: 'bi-file-earmark-pdf', color: 'bg-danger bg-opacity-25 text-danger',
    accept: ['application/pdf'], extensions: ['.pdf'],
    hint: 'Lecture notes, textbooks, revision materials, past questions, study guides, handouts, assignments.'
  },
  video: {
    label: 'Video', icon: 'bi-file-earmark-play', color: 'bg-primary bg-opacity-25 text-primary',
    accept: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'], extensions: ['.mp4', '.webm', '.ogg', '.mov'],
    hint: 'Recorded lessons, practical demonstrations, revision videos, tutorials, subject explanations.'
  },
  document: {
    label: 'Word Document', icon: 'bi-file-earmark-word', color: 'bg-primary bg-opacity-25 text-info',
    accept: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    extensions: ['.doc', '.docx', '.txt'],
    hint: 'Assignments, essays, worksheets and printable handouts.'
  },
  presentation: {
    label: 'Presentation', icon: 'bi-file-earmark-slides', color: 'bg-warning bg-opacity-25 text-warning',
    accept: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    extensions: ['.ppt', '.pptx'],
    hint: 'Slide decks and classroom presentation materials.'
  },
  image: {
    label: 'Image', icon: 'bi-file-earmark-image', color: 'bg-success bg-opacity-25 text-success',
    accept: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], extensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    hint: 'Diagrams, charts, maps and illustrated study aids.'
  },
  other: {
    label: 'Other Material', icon: 'bi-file-earmark', color: 'bg-secondary bg-opacity-25 text-light',
    accept: [], extensions: [],
    hint: 'Spreadsheets, audio lessons and any other approved educational file format.'
  }
};

const MAX_MATERIAL_SIZE = 100 * 1024 * 1024; // 100 MB upload cap

/** Detect the resource type from a File so the form auto-selects itself. */
function detectResourceTypeFromFile(file) {
  const name = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();
  for (const [typeId, rule] of Object.entries(RESOURCE_TYPE_RULES)) {
    if (typeId === 'other') continue;
    const mimeOk = rule.accept.includes(mime);
    const extOk = rule.extensions.some(ext => name.endsWith(ext));
    if (mimeOk || extOk) return typeId;
  }
  return 'other';
}

/** Derive the department/section from a class name (e.g. "SS 2 Science" → "Science"). */
function getDepartmentFromClass(cls) {
  const lower = (cls || '').toLowerCase();
  if (lower.includes('science')) return 'Science';
  if (lower.includes('arts')) return 'Arts';
  if (lower.includes('commercial')) return 'Commercial';
  return '';
}

document.addEventListener('DOMContentLoaded', () => {
  initStaffDashboard();
});

// ── Cross-tab sync ────────────────────────────────────────────────────────
// When the admin approves or rejects a submission in another tab, the teacher's
// open dashboard refreshes immediately. The admin fires this ping on every
// approval/rejection decision (refreshStaffDashboardViews() in admin.js).
window.addEventListener('storage', (e) => {
  if (e.key === 'learnbridge_staff_refresh_ping' || (e.key && e.key.startsWith('learnbridge_'))) {
    initStaffDashboard();
  }
});

function initStaffDashboard() {
  // Always render from the freshest saved state — the admin may have approved,
  // rejected or removed submissions since this page was first loaded.
  appState = getAppData();

  renderStaffHeaderInfo();
  renderStaffKPIs();
  renderStaffResultDocs();
  renderStaffResources();
  populateStaffStudentClassFilter();
  renderStaffStudents();
  renderStaffSidebarSections();

  // Class lists are always limited to the signed-in teacher's own assignment.
  populateStaffResultForm();
  populateUploadLevels();
  populateUploadDepartments();
  updateUploadClasses();
  updateResultGrade();

  // "Upload Material" only becomes clickable once the form is complete.
  const resourceForm = document.getElementById('form-upload-resource');
  if (resourceForm) {
    resourceForm.addEventListener('input', updateResourceSubmitState);
    resourceForm.addEventListener('change', updateResourceSubmitState);
  }
  updateResourceSubmitState();
}

/**
 * 1. Render Staff Profile in Navbar and Hero
 */
function renderStaffHeaderInfo() {
  if (!currentStaff) return;

  // Role label shown inside the single unified sidebar profile section.
  const roleLabel = currentStaff.role === 'admin'
    ? 'Principal & Admin'
    : `${(currentStaff.subjects || ['Teacher'])[0]} Educator`;

  const heroGreeting = document.getElementById('staff-hero-greeting');
  const heroSub = document.getElementById('staff-hero-sub');
  const classes = myAuthorizedClasses();

  if (heroGreeting) heroGreeting.textContent = `Welcome back, ${currentStaff.name || 'Educator'}`;
  if (heroSub) {
    heroSub.textContent = `Staff ID: ${currentStaff.staffId || 'STAFF'} • Department: ${myDepartmentLabel()} • Classes: ${classes.length ? classes.join(', ') : 'None assigned'} • School: Amule Government Secondary School`;
  }

  const summaryEl = document.getElementById('staff-my-classes-summary');
  if (summaryEl) {
    summaryEl.innerHTML = classes.length
      ? `<span class="text-teal fw-bold"><i class="bi bi-diagram-3 me-1"></i>${Access.departmentOf(classes[0]) || myDepartmentLabel()}</span>
         <span class="text-muted"> &bull; My Classes: ${classes.join(' • ')}</span>`
      : `<span class="text-warning fw-bold"><i class="bi bi-exclamation-triangle me-1"></i>No classes assigned to your account yet.</span>`;
  }

  // Profile Picture manager — own account only, lives in the sidebar bottom.
  // The panel is the single unified profile section (picture + name + action).
  initDashboardProfilePicture({
    namespace: 'StaffProfilePicture',
    panelId: 'staff-profile-picture-slot',
    accountId: currentStaff.id,
    name: currentStaff.name,
    sublabel: roleLabel,
    onChange: () => {
      appState = getAppData();
      const fresh = (appState.staff || []).find(st => st.id === currentStaff.id);
      if (fresh) {
        currentStaff.name = fresh.name;
        currentStaff.subjects = fresh.subjects;
        currentStaff.staffId = fresh.staffId;
      }
    }
  });
}

/**
 * 2. Render KPI Metrics — scoped to the logged-in teacher's own data.
 * Every account sees only content it created (or school-wide student counts).
 */
function isOwnedByCurrentStaff(item) {
  if (!currentStaff) return false;
  return !!item && (item.uploaderId === currentStaff.id ||
    (item.uploaderRole === 'teacher' && item.uploadedBy === currentStaff.name && !item.uploaderId));
}

/** Own resource AND still inside one of the teacher's assigned classes. */
function isVisibleToCurrentStaff(item) {
  return isOwnedByCurrentStaff(item) && Access.canAccessResource(currentStaff, item);
}

/** Own result document AND attached to one of the teacher's assigned classes. */
function isVisibleResultDoc(doc) {
  if (!isOwnedByCurrentStaff(doc)) return false;
  return !doc.class || Access.canTeachClass(currentStaff, doc.class);
}

function renderStaffKPIs() {
  // Only students in the teacher's assigned classes count towards their KPIs.
  const totalStudents = myStudents().length;
  const myResources = (appState.resources || []).filter(isVisibleToCurrentStaff);
  const totalResources = myResources.filter(r => r.status === 'published' && r.approved !== false).length;
  const totalResults = (appState.results || []).filter(isVisibleResultDoc).length;
  const pendingMaterials = myResources.filter(r => r.status === 'pending' || r.approved === false).length;
  const pendingResults = (appState.results || []).filter(isVisibleResultDoc)
    .filter(r => r.status === 'pending' || r.approved === false).length;
  const pendingApprovals = pendingMaterials + pendingResults;

  const elStudents = document.getElementById('metric-total-students');
  const elResources = document.getElementById('metric-total-resources');
  const elResults = document.getElementById('metric-total-results');
  const elPending = document.getElementById('metric-pending-approvals');

  if (elStudents) elStudents.textContent = totalStudents.toString();
  if (elResources) elResources.textContent = totalResources.toString();
  if (elResults) elResults.textContent = totalResults.toString();
  if (elPending) elPending.textContent = pendingApprovals.toString();
}

/**
 * 3. Results Documents Section Handlers
 */
function renderStaffResultDocs() {
  const tbody = document.getElementById('staff-results-tbody');
  if (!tbody) return;

  const search = (document.getElementById('staff-result-search')?.value || '').trim().toLowerCase();
  // Data isolation: only result documents this teacher uploaded for a class they
  // teach. A document for an unauthorized class is filtered out at the data level.
  let list = (appState.results || []).filter(isVisibleResultDoc);

  if (search) {
    list = list.filter(r => 
      (r.title && r.title.toLowerCase().includes(search)) ||
      (r.class && r.class.toLowerCase().includes(search)) ||
      (r.subject && r.subject.toLowerCase().includes(search)) ||
      (r.fileName && r.fileName.toLowerCase().includes(search))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">
          <i class="bi bi-file-earmark-x fs-3 d-block mb-1"></i>
          <div class="fw-bold text-white mb-1">No results uploaded yet.</div>
          Use <strong>Upload Result Doc</strong> above to record a score for a student in your classes.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(doc => {
    const typeBadge = {
      pdf: '<span class="badge bg-danger bg-opacity-25 text-danger font-monospace text-xs">PDF</span>',
      excel: '<span class="badge bg-success bg-opacity-25 text-success font-monospace text-xs">XLSX</span>',
      csv: '<span class="badge bg-info bg-opacity-25 text-info font-monospace text-xs">CSV</span>',
      doc: '<span class="badge bg-primary bg-opacity-25 text-primary font-monospace text-xs">DOCX</span>'
    }[doc.docType] || '<span class="badge bg-secondary text-xs">DOC</span>';

    return `
      <tr>
        <td>
          <div class="fw-bold text-white text-sm">${doc.title}</div>
          <div class="text-xs text-muted font-monospace">${doc.fileName || 'Doc'} &bull; <span class="text-teal">${doc.subject || 'All Subjects'}</span></div>
        </td>
        <td>
          <span class="badge bg-secondary bg-opacity-25 text-teal font-monospace text-xs">
            ${(doc.level || 'JSS').toUpperCase()} &bull; ${doc.class || 'All'}
          </span>
          ${doc.department ? `<div class="text-xs text-muted mt-1">${doc.department}</div>` : ''}
        </td>
        <td>
          <div class="text-xs text-light">${doc.studentName || 'Class sheet'}</div>
          ${doc.score !== undefined && doc.score !== null && doc.score !== ''
            ? `<div class="text-xs text-muted font-monospace">${doc.score}% &bull; <strong class="text-teal">${doc.grade || '—'}</strong></div>`
            : `<div class="text-xs text-muted font-monospace">${doc.admissionNo || ''}</div>`}
        </td>
        <td>
          <div class="text-xs text-light font-monospace">${doc.session || '2025/2026'}</div>
          <div class="text-xs text-warning">${doc.term || '1st Term'}</div>
        </td>
        <td>
          <div class="d-flex align-items-center gap-1">
            ${typeBadge}
            <span class="text-xs text-muted font-monospace">${doc.fileSize || '1.5 MB'}</span>
          </div>
        </td>
        <td><span class="text-xs text-muted">${doc.uploadedBy || 'Staff'}</span></td>
        <td>
          <span class="badge ${doc.status === 'published' ? 'bg-teal text-dark' : 'bg-warning text-dark'} text-xs">
            ${doc.status === 'published' ? 'Admin Approved' : 'Pending Admin Approval'}
          </span>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-hub-primary" onclick="viewStaffBroadsheetModal('${doc.id}')">
            <i class="bi bi-eye"></i> View
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openStaffResultUploadModal() {
  const form = document.getElementById('form-staff-upload-result');
  if (form) form.reset();
  staffUploadedFile = null;
  const label = document.getElementById('staff-resdoc-file-label');
  if (label) label.textContent = 'Click to attach file (.pdf, .xlsx, .csv, .docx)';
  populateStaffResultForm();
  new bootstrap.Modal(document.getElementById('staffUploadResultModal')).show();
}

/** Grade scale used for the auto-computed grade field. */
function gradeForScore(score) {
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 45) return 'D';
  if (score >= 40) return 'E';
  return 'F';
}

/**
 * Build every teacher-scoped list inside the Upload Result form.
 * Only the classes this teacher is assigned to are ever offered.
 */
function populateStaffResultForm() {
  const classes = myAuthorizedClasses();

  const classSel = document.getElementById('staff-resdoc-class');
  if (classSel) {
    classSel.innerHTML = classes.length
      ? '<option value="">Select class…</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('')
      : '<option value="">No classes assigned to your account</option>';
    if (classes.length > 0) classSel.value = classes[0];
  }

  const depSel = document.getElementById('staff-resdoc-department');
  if (depSel) {
    const depts = myAuthorizedDepartments();
    depSel.innerHTML = '<option value="">Select department…</option>' +
      depts.map(d => `<option value="${d}">${d}</option>`).join('');
  }

  handleResultClassChanged();
}

/** Keeps the department in step with the chosen class and refreshes students. */
function handleResultClassChanged() {
  const cls = document.getElementById('staff-resdoc-class')?.value || '';
  const depSel = document.getElementById('staff-resdoc-department');
  const derived = Access.departmentOf(cls);
  if (depSel && derived) depSel.value = derived;

  const studentSel = document.getElementById('staff-resdoc-student');
  if (!studentSel) return;

  if (!cls) {
    studentSel.innerHTML = '<option value="">Select a class first…</option>';
    return;
  }

  // Only students registered in the selected (authorized) class are offered.
  const students = myStudents()
    .filter(s => Access.classMatches(s.class, cls))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  studentSel.innerHTML = students.length
    ? '<option value="">Select student…</option>' + students.map(s =>
        `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.admissionNo || 'N/A')}</option>`).join('')
    : '<option value="">No students in this class yet</option>';
}

function updateResultGrade() {
  const scoreInput = document.getElementById('staff-resdoc-score');
  const gradeInput = document.getElementById('staff-resdoc-grade');
  if (!scoreInput || !gradeInput) return;
  const score = parseInt(scoreInput.value, 10);
  gradeInput.value = Number.isNaN(score) ? '—' : gradeForScore(score);
}

function handleStaffResultFileSelected(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const sizeKb = (file.size / 1024).toFixed(1);
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  const displaySize = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

  staffUploadedFile = {
    fileName: file.name,
    fileSize: displaySize,
    fileType: file.type || file.name.split('.').pop().toLowerCase()
  };

  const label = document.getElementById('staff-resdoc-file-label');
  if (label) {
    label.innerHTML = `<span class="text-teal fw-bold"><i class="bi bi-file-earmark-check me-1"></i> Attached: ${file.name} (${displaySize})</span>`;
  }
}

function handleStaffResultUploadSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('staff-resdoc-title').value.trim();
  const session = document.getElementById('staff-resdoc-session').value;
  const term = document.getElementById('staff-resdoc-term').value;
  const cls = document.getElementById('staff-resdoc-class').value;
  const department = document.getElementById('staff-resdoc-department')?.value || Access.departmentOf(cls);
  const studentId = document.getElementById('staff-resdoc-student').value;
  const subject = document.getElementById('staff-resdoc-subject').value.trim();
  const docType = document.getElementById('staff-resdoc-type').value;
  const desc = document.getElementById('staff-resdoc-desc').value.trim();

  if (!cls) {
    showToast('warning', 'Class Required', 'Select one of the classes you teach before uploading a result.');
    return;
  }

  // Data-level authorization: the class must be one of the teacher's own…
  if (!assertClassAccess(cls, 'upload result documents for it')) return;

  const classDept = Access.departmentOf(cls);
  if (classDept && department && department !== classDept) {
    showToast('error', 'Department Mismatch', `${cls} belongs to the ${classDept} department, not ${department}.`);
    return;
  }

  // …and the student must be enrolled in an authorized class.
  const student = Access.findStudentForTeacher(currentStaff, appState.students || [], studentId);
  if (!student) {
    showToast('error', 'Access Denied', 'The selected student is not registered in any class you teach.');
    return;
  }

  const score = parseInt(document.getElementById('staff-resdoc-score').value, 10);
  if (Number.isNaN(score) || score < 0 || score > 100) {
    showToast('warning', 'Invalid Score', 'Please enter a score between 0 and 100.');
    return;
  }
  const grade = gradeForScore(score);

  const fileName = staffUploadedFile ? staffUploadedFile.fileName : `${cls.replace(/\s+/g, '_')}_${subject}_Result.${docType}`;
  const fileSize = staffUploadedFile ? staffUploadedFile.fileSize : '1.2 MB';

  const newDoc = {
    id: `resdoc-${Date.now()}`,
    title: title,
    session: session,
    term: term,
    level: Access.levelOf(cls),
    class: cls,
    department: department,
    subject: subject,
    studentId: student.id,
    studentName: student.name,
    admissionNo: student.admissionNo,
    score: score,
    grade: grade,
    docType: docType,
    fileName: fileName,
    fileSize: fileSize,
    uploadDate: new Date().toISOString().split('T')[0],
    uploadedBy: currentStaff?.name || 'Staff Educator',
    uploaderId: currentStaff?.id,
    uploaderRole: 'teacher',
    // Teacher uploads stay hidden from students until the admin approves them.
    status: 'pending',
    approved: false,
    description: desc || `Continuous assessment score for ${student.name} (${cls}).`
  };

  if (!appState.results) appState.results = [];
  appState.results.unshift(newDoc);
  saveAppData(appState);

  const modalEl = document.getElementById('staffUploadResultModal');
  const modalInstance = bootstrap.Modal.getInstance(modalEl);
  if (modalInstance) modalInstance.hide();

  document.getElementById('form-staff-upload-result').reset();
  staffUploadedFile = null;
  const label = document.getElementById('staff-resdoc-file-label');
  if (label) label.textContent = 'Click to attach file (.pdf, .xlsx, .csv, .docx)';
  populateStaffResultForm();

  renderStaffKPIs();
  renderStaffResultDocs();
  updateResultGrade();
  showToast('info', 'Result Submitted', `${student.name} — ${subject}: ${score}% (${grade}) recorded for ${cls}. It will be visible to the student after the administrator approves it.`);
}

function viewStaffBroadsheetModal(docId) {
  const doc = (appState.results || []).find(r => r.id === docId);
  if (!doc) return;

  const titleEl = document.getElementById('staff-broadsheet-title');
  const bodyEl = document.getElementById('staff-broadsheet-body');

  if (titleEl) titleEl.textContent = `${doc.title} — Preview`;

  let scoresHtml = '';
  if (doc.scores && doc.scores.length > 0) {
    scoresHtml = `
      <div class="table-responsive my-3">
        <table class="table table-bordered table-dark align-middle text-sm mb-0">
          <thead style="background:rgba(15,23,42,0.9);">
            <tr class="text-xs text-teal text-uppercase">
              <th>Adm. No.</th>
              <th>Student Name</th>
              <th>Subjects &amp; Scores</th>
              <th>Average</th>
              <th>Position</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${doc.scores.map(s => `
              <tr>
                <td class="font-monospace text-teal text-xs">${s.admissionNo}</td>
                <td class="fw-bold text-white">${s.name}</td>
                <td>
                  ${Object.entries(s.subjects || {}).map(([sub, sc]) => `
                    <span class="badge bg-secondary bg-opacity-25 me-1 text-xs">
                      ${sub}: CA:${sc.ca}, Ex:${sc.exam} = <strong>${sc.total} (${sc.grade})</strong>
                    </span>
                  `).join('')}
                </td>
                <td><span class="badge bg-teal text-dark font-monospace">${s.average}%</span></td>
                <td><span class="text-warning font-monospace text-xs">${s.position || 'N/A'}</span></td>
                <td class="text-xs text-muted">${s.remark || 'Satisfactory'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    scoresHtml = `
      <div class="p-4 rounded text-center my-3" style="background:rgba(15,23,42,0.7);border:1px dashed var(--border-subtle);">
        <i class="bi bi-file-earmark-text text-teal fs-1 d-block mb-2"></i>
        <h6 class="fw-bold text-white mb-1">Attached Document File Archive</h6>
        <p class="text-xs text-muted mb-0">Original Document: <strong>${doc.fileName}</strong> (${doc.fileSize})</p>
      </div>
    `;
  }

  bodyEl.innerHTML = `
    <div class="p-3 rounded mb-3" style="background:rgba(30,41,59,0.5);border:1px solid var(--border-subtle);">
      <div class="row g-2 text-xs">
        <div class="col-md-3"><strong>Class:</strong> <span class="text-teal">${doc.class}</span></div>
        ${doc.studentName ? `<div class="col-md-3"><strong>Student:</strong> <span class="text-light">${escapeHtml(doc.studentName)} (${escapeHtml(doc.admissionNo || '')})</span></div>` : ''}
        ${(doc.score !== undefined && doc.score !== null) ? `<div class="col-md-3"><strong>Score:</strong> <span class="text-teal">${doc.score}% &bull; ${escapeHtml(doc.grade || '')}</span></div>` : ''}
        <div class="col-md-3"><strong>Term:</strong> <span class="text-warning">${doc.session} - ${doc.term}</span></div>
        <div class="col-md-3"><strong>Format:</strong> <span class="text-light">${doc.docType.toUpperCase()} (${doc.fileSize})</span></div>
        <div class="col-md-3"><strong>Uploaded By:</strong> <span class="text-light">${doc.uploadedBy}</span></div>
      </div>
    </div>
    ${scoresHtml}
  `;

  const modalEl = document.getElementById('staffBroadsheetModal');
  const modalInstance = new bootstrap.Modal(modalEl);
  modalInstance.show();
}

/**
 * 4. Curriculum Resources Handlers
 */
function renderStaffResources() {
  const tbody = document.getElementById('staff-resources-tbody');
  if (!tbody) return;

  const searchVal = (document.getElementById('staff-res-search')?.value || '').trim().toLowerCase();
  const levelVal = document.getElementById('staff-res-level')?.value || 'all';

  // Data isolation: teachers only see their own resources, and only those that
  // still belong to one of the classes they teach.
  let items = (appState.resources || []).filter(isVisibleToCurrentStaff);

  if (levelVal !== 'all') {
    items = items.filter(r => r.level === levelVal);
  }

  if (searchVal) {
    items = items.filter(r => 
      (r.title && r.title.toLowerCase().includes(searchVal)) ||
      (r.subject && r.subject.toLowerCase().includes(searchVal)) ||
      (r.topic && r.topic.toLowerCase().includes(searchVal)) ||
      (r.uploader && r.uploader.toLowerCase().includes(searchVal)) ||
      (r.author && r.author.toLowerCase().includes(searchVal))
    );
  }

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">
          <i class="bi bi-folder-x fs-3 d-block mb-1"></i>
          <div class="fw-bold text-white mb-1">No materials added yet.</div>
          Use the single <strong>+ New Material</strong> button above to upload your first learning material
          (PDF documents, videos, Word documents, presentations or images).
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(res => {
    const isApproved = res.status === 'published' && res.approved !== false;
    const typeRule = RESOURCE_TYPE_RULES[res.typeId] || null;
    const typeLabel = typeRule ? typeRule.label : (res.type || 'Lesson');
    const typeIcon = typeRule ? typeRule.icon : 'bi-file-earmark';
    const typeBadge = typeRule ? typeRule.color : 'bg-dark';
    const canManage = isOwnedByCurrentStaff(res); // teachers only manage their own uploads
    return `
      <tr>
        <td>
          <div class="fw-bold text-white text-sm">${res.title}</div>
          <div class="text-xs text-teal">${res.topic || ''}</div>
        </td>
        <td>
          <span class="badge bg-secondary bg-opacity-25 text-white font-monospace text-xs">
            ${(res.level || 'JSS').toUpperCase()} &bull; ${res.class || 'All'}${res.department ? ` &bull; ${res.department}` : ''}
          </span>
        </td>
        <td><span class="text-xs fw-medium text-light">${res.subject}</span></td>
        <td>
          <span class="badge ${typeBadge} text-xs">
            <i class="bi ${typeIcon} me-1"></i>${typeLabel}
          </span>
        </td>
        <td><span class="text-xs text-muted">${res.uploader || res.author || 'Staff'}</span></td>
        <td>
          <span class="badge ${isApproved ? 'bg-teal text-dark' : 'bg-warning text-dark'} text-xs">
            ${isApproved ? 'Published' : 'Pending Review'}
          </span>
        </td>
        <td class="text-end">
          ${canManage ? `
            <div class="btn-group btn-group-sm">
              <button class="btn btn-sm btn-hub-outline" title="Preview Material" onclick="openResourcePreview('${res.id}')">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-sm btn-hub-outline" title="Edit Material" onclick="openEditResourceModal('${res.id}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-xs" title="Delete Material" onclick="deleteResource('${res.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          ` : '<span class="text-xs text-muted">View only</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

/** Preview a stored material file from the staff dashboard. */
function openResourcePreview(resId) {
  const res = (appState.resources || []).find(r => r.id === resId);
  if (!res) return;

  // Data-level guard: a teacher may only preview material for their own classes.
  if (!Access.canAccessResource(currentStaff, res) && !isOwnedByCurrentStaff(res)) {
    showToast('error', 'Access Denied', 'That material is not assigned to a class you teach.');
    return;
  }

  const modalEl = document.getElementById('staffMaterialViewerModal');
  const titleEl = document.getElementById('staff-viewer-title');
  const metaEl = document.getElementById('staff-viewer-meta');
  const bodyEl = document.getElementById('staff-viewer-body');
  const dlBtn = document.getElementById('staff-viewer-download-btn');
  if (!modalEl || !bodyEl) return;

  if (titleEl) titleEl.textContent = res.title;
  if (metaEl) {
    metaEl.innerHTML = `${res.subject || ''} &bull; ${res.class || ''}${res.department ? ' • ' + res.department : ''} &bull; ${res.fileName || 'External link'}`;
  }
  if (dlBtn) dlBtn.classList.add('d-none');

  bodyEl.innerHTML = '';

  if (res.videoUrl && !res.materialKey) {
    bodyEl.innerHTML = embedExternalVideo(res.videoUrl);
  } else if (res.materialKey) {
    FileStore.getMaterial(res.materialKey).then(material => {
      if (!material) {
        bodyEl.innerHTML = staffViewerUnavailable(res);
        return;
      }
      if (dlBtn) {
        dlBtn.classList.remove('d-none');
        dlBtn.onclick = () => FileStore.downloadMaterial(res);
      }
      bodyEl.innerHTML = staffViewerUnavailable(res); // replaced below by type-specific preview
      if (material.type === 'application/pdf') {
        bodyEl.innerHTML = `<iframe class="material-frame" src="${URL.createObjectURL(material.blob)}" title="${res.title}"></iframe>`;
      } else if (material.type.startsWith('video/')) {
        bodyEl.innerHTML = `<video class="material-video w-100" src="${URL.createObjectURL(material.blob)}" controls playsinline></video>`;
      } else if (material.type.startsWith('image/')) {
        bodyEl.innerHTML = `<img class="img-fluid rounded" src="${URL.createObjectURL(material.blob)}" alt="${res.title}">`;
      } else {
        bodyEl.innerHTML = staffViewerUnavailable(res);
      }
    });
  } else {
    bodyEl.innerHTML = staffViewerUnavailable(res);
  }

  new bootstrap.Modal(modalEl).show();
}

function staffViewerUnavailable(res) {
  return `
    <div class="p-5 rounded text-center text-muted" style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-subtle);">
      <i class="bi bi-file-earmark fs-1 d-block mb-2 text-teal"></i>
      <h6 class="fw-bold text-white mb-1">${res.title}</h6>
      <p class="text-xs mb-0">Material: <strong>${res.fileName || res.videoUrl || 'Text-based material'}</strong></p>
    </div>
  `;
}

/** Embed an external video URL (YouTube/Vimeo watch links become embed links). */
function embedExternalVideo(url) {
  let embedUrl = url;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  if (ytMatch) {
    embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
  } else {
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return `<div class="ratio ratio-16x9"><iframe src="${embedUrl}" title="External video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
}

function deleteResource(resId) {
  if (!confirm('Are you sure you want to delete this learning material? Its uploaded file will also be removed. This action cannot be undone.')) return;

  const res = (appState.resources || []).find(r => r.id === resId);

  // Ownership + class guard: a teacher may only delete their own resource, and
  // only while it still belongs to a class they teach.
  if (res && !isOwnedByCurrentStaff(res) && Auth.getRole() !== 'admin') {
    showToast('error', 'Not Permitted', 'You can only delete materials you uploaded yourself.');
    return;
  }
  if (res && !Access.canAccessResource(currentStaff, res)) {
    showToast('error', 'Access Denied', 'That material is not assigned to a class you teach.');
    return;
  }

  // Remove the binary material from IndexedDB as well.
  if (res && res.materialKey) FileStore.deleteMaterial(res.materialKey);

  appState.resources = (appState.resources || []).filter(r => r.id !== resId);
  saveAppData(appState);
  renderStaffKPIs();
  renderStaffResources();
  renderApprovalQueue();
  showToast('info', 'Material Removed', 'Learning material was successfully removed from the portal.');
}

/**
 * 5. Approval Queue
 */
function renderApprovalQueue() {
  const container = document.getElementById('approvals-container');
  if (!container) return;

  // Teachers cannot approve their own submissions — the school administrator
  // does. This section is a status tracker for the teacher's materials AND
  // results that are still awaiting the administrator's decision.
  const pendingMaterials = (appState.resources || []).filter(r =>
    isVisibleToCurrentStaff(r) && (r.status === 'pending' || r.approved === false));
  const pendingResults = (appState.results || []).filter(isVisibleResultDoc)
    .filter(r => r.status === 'pending' || r.approved === false);

  if (pendingMaterials.length === 0 && pendingResults.length === 0) {
    container.innerHTML = `
      <div class="p-4 rounded text-center text-muted" style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-subtle);">
        <i class="bi bi-check-all text-teal fs-3 d-block mb-1"></i>
        <h6 class="fw-bold text-white mb-1">No Pending Submissions</h6>
        <p class="text-xs mb-0">All your materials and results have been approved by the school administrator — or you have not uploaded anything yet.</p>
      </div>
    `;
    return;
  }

  const pendingItem = (item, kind) => {
    const isResult = kind === 'Result';
    const author = item.uploader || item.author || 'Educator';
    const detail = isResult
      ? `${item.studentName || 'Class sheet'}${item.score !== undefined && item.score !== null && item.score !== '' ? ' — ' + item.score + '%' : ''}`
      : `Subject: ${item.subject || ''}${item.topic ? ' &bull; Topic: ' + item.topic : ''}`;
    return `
        <div class="p-3 rounded d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style="background:rgba(234, 179, 8, 0.05);border:1px solid rgba(234, 179, 8, 0.2);">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <span class="badge bg-warning text-dark text-xs">Awaiting Admin Approval</span>
              <span class="badge bg-secondary bg-opacity-25 text-teal text-xs">${kind}</span>
              <span class="badge bg-secondary bg-opacity-25 text-teal text-xs">${(item.level || 'JSS').toUpperCase()} &bull; ${item.class || ''}</span>
              <span class="text-xs text-muted">Uploaded by: <strong>${author}</strong></span>
            </div>
            <h6 class="fw-bold text-white mb-1">${item.title}</h6>
            <div class="text-xs text-light mb-1">${detail}</div>
          </div>
          <div>
            <span class="badge bg-warning text-dark text-xs"><i class="bi bi-hourglass-split me-1"></i>Waiting for the school administrator</span>
          </div>
        </div>
        `;
  };

  container.innerHTML = `
    <p class="text-xs text-muted mb-3">
      Your submissions become visible to students only after the school administrator approves them.
    </p>
    <div class="d-flex flex-column gap-3">
      ${pendingMaterials.map(r => pendingItem(r, 'Material')).join('')}
      ${pendingResults.map(r => pendingItem(r, 'Result')).join('')}
    </div>
  `;
}

/**
 * 6. Students Directory
 */
/** Dropdown listing the teacher's own classes only. */
function populateStaffStudentClassFilter() {
  const sel = document.getElementById('staff-student-class-filter');
  if (!sel) return;

  const previous = sel.value || 'all';
  const classes = myAuthorizedClasses();
  sel.innerHTML = '<option value="all">All My Classes</option>' +
    classes.map(c => `<option value="${c}">${c}</option>`).join('');
  sel.value = (previous === 'all' || classes.includes(previous)) ? previous : 'all';
}

/** Enrolment status shown on the student row. */
function studentStatusLabel(student) {
  if (student.status) return String(student.status);
  if ((student.cbtExamsTakenCount || 0) > 0 || (student.completedResourcesCount || 0) > 0) return 'Active';
  return 'Enrolled';
}

function renderStaffStudents() {
  const tbody = document.getElementById('staff-students-tbody');
  if (!tbody) return;

  const searchVal = (document.getElementById('staff-student-search')?.value || '').trim().toLowerCase();
  const classFilter = document.getElementById('staff-student-class-filter')?.value || 'all';

  // Data-level scope: only students whose class is one of the teacher's own.
  const myClassStudents = myStudents();

  let students = myClassStudents;
  if (classFilter !== 'all') {
    students = students.filter(s => Access.classMatches(s.class, classFilter));
  }

  if (searchVal) {
    students = students.filter(s =>
      (s.name && s.name.toLowerCase().includes(searchVal)) ||
      (s.admissionNo && s.admissionNo.toLowerCase().includes(searchVal)) ||
      (s.class && s.class.toLowerCase().includes(searchVal))
    );
  }

  // Keep the list grouped by class, then alphabetically by name.
  students = [...students].sort((a, b) =>
    String(a.class || '').localeCompare(String(b.class || '')) ||
    String(a.name || '').localeCompare(String(b.name || ''))
  );

  if (myClassStudents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">
          <i class="bi bi-person-x fs-3 d-block mb-1"></i>
          <div class="fw-bold text-white mb-1">No students assigned to your classes yet.</div>
          Students will appear here as soon as they register under ${myAuthorizedClasses().length
            ? `<strong>${myAuthorizedClasses().join(', ')}</strong>` : 'the classes assigned to your account'}.
        </td>
      </tr>
    `;
    return;
  }

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">
          <i class="bi bi-search fs-3 d-block mb-1"></i>
          No students match this filter or search.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const dept = Access.departmentOf(s.class) || '—';
    const status = studentStatusLabel(s);
    const statusClass = status.toLowerCase() === 'active' ? 'bg-teal text-dark'
      : status.toLowerCase() === 'enrolled' ? 'bg-secondary bg-opacity-25 text-teal'
      : 'bg-primary bg-opacity-25 text-primary';

    return `
    <tr>
      <td>
        <div class="d-flex align-items-center gap-2">
          ${studentBadgeHtml(s)}
          <span class="fw-bold text-white text-sm">${s.name}</span>
        </div>
      </td>
      <td><span class="font-monospace text-xs text-teal">${s.admissionNo || 'N/A'}</span></td>
      <td><span class="badge bg-secondary bg-opacity-25 text-light text-xs">${s.class || 'Secondary'}</span></td>
      <td><span class="text-xs text-light">${dept}</span></td>
      <td><span class="badge ${statusClass} text-xs">${status}</span></td>
      <td><span class="text-xs text-light font-monospace">${s.completedResourcesCount || 0}</span></td>
      <td>
        <span class="badge ${ (s.cbtBestScore || 0) >= 50 ? 'bg-teal text-dark' : 'bg-secondary bg-opacity-25 text-muted' } text-xs font-monospace">
          ${s.cbtBestScore ? s.cbtBestScore + '%' : 'None'}
        </span>
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-hub-outline btn-xs" onclick="viewStaffStudentProfile('${s.id}')">
          <i class="bi bi-person-badge me-1"></i> View Profile
        </button>
      </td>
    </tr>
  `;
  }).join('');
}

/**
 * Authorized student profile view. The student id is re-verified against the
 * teacher's assigned classes here, so a tampered id is rejected outright.
 */
function viewStaffStudentProfile(studentId) {
  const student = Access.findStudentForTeacher(currentStaff, appState.students || [], studentId);
  if (!student) {
    showToast('error', 'Access Denied', 'That student is not registered in any class you teach.');
    return;
  }

  const dept = Access.departmentOf(student.class) || '—';
  const status = studentStatusLabel(student);
  const results = (appState.results || []).filter(r =>
    r.studentId === student.id || (r.studentName && r.studentName === student.name)
  );
  const myResources = (appState.resources || []).filter(r =>
    isOwnedByCurrentStaff(r) && Access.classMatches(r.class, student.class)
  );

  const titleEl = document.getElementById('staff-student-profile-title');
  const bodyEl = document.getElementById('staff-student-profile-body');
  if (!bodyEl) return;
  if (titleEl) titleEl.textContent = `${student.name} — Student Profile`;

  const rows = [
    ['Student Name', student.name || '—'],
    ['Student / Admission ID', student.admissionNo || '—'],
    ['Class', student.class || '—'],
    ['Department / Section', dept],
    ['Status', status],
    ['Educational Level', Access.levelLabel(student.level || Access.levelOf(student.class))],
    ['Lessons Completed', String(student.completedResourcesCount || 0)],
    ['CBT Exams Taken', String(student.cbtExamsTakenCount || 0)],
    ['CBT Best Score', `${student.cbtBestScore || 0}%`],
    ['Reward Points', `${student.points || 0} pts`]
  ];

  bodyEl.innerHTML = `
    <div class="d-flex align-items-center gap-3 mb-3 p-3 rounded" style="background:rgba(30,41,59,0.5);border:1px solid var(--border-subtle);">
      ${studentBadgeHtml(student)}
      <div>
        <div class="fw-bold text-white">${escapeHtml(student.name || '')}</div>
        <div class="text-xs text-muted font-monospace">${escapeHtml(student.admissionNo || '')} &bull; ${escapeHtml(student.class || '')} &bull; ${escapeHtml(dept)}</div>
      </div>
      <span class="badge bg-teal text-dark ms-auto">Authorized</span>
    </div>

    <div class="row g-2 mb-3">
      ${rows.map(([label, value]) => `
        <div class="col-md-6">
          <div class="p-2 rounded h-100" style="background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.14);">
            <div class="text-xs text-muted text-uppercase fw-bold">${escapeHtml(label)}</div>
            <div class="text-sm text-white fw-bold mt-1">${escapeHtml(String(value))}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="p-3 rounded" style="background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.14);">
      <div class="text-xs text-teal fw-bold text-uppercase mb-2">
        Results &amp; Materials I posted for ${escapeHtml(student.class || 'this class')}
      </div>
      ${results.length === 0 && myResources.length === 0
        ? '<p class="text-xs text-muted mb-0">Nothing posted for this student yet.</p>'
        : `
          ${results.map(r => `<div class="text-xs text-light mb-1">
            <i class="bi bi-file-earmark-spreadsheet text-teal me-1"></i>${escapeHtml(r.title || 'Result')}
            ${r.grade ? `<span class="badge bg-secondary bg-opacity-25 text-teal ms-1">${escapeHtml(r.score || '')} · ${escapeHtml(r.grade)}</span>` : ''}
          </div>`).join('')}
          ${myResources.map(r => `<div class="text-xs text-light mb-1">
            <i class="bi bi-folder-check text-teal me-1"></i>${escapeHtml(r.title || 'Material')}
          </div>`).join('')}
        `}
    </div>
  `;

  new bootstrap.Modal(document.getElementById('staffStudentProfileModal')).show();
}/**
 * 7. NEW RESOURCE — Multi Material Type Upload Modal Handlers
 * Supports PDF documents, videos (file upload or external link), Word documents,
 * PowerPoint presentations, images and other educational file formats.
 */
function openUploadModal() {
  resetResourceFormState();
  const headingEl = document.getElementById('upload-modal-heading');  if (headingEl) headingEl.textContent = 'New Material';
  // Task 1 of 2: choose the file. Nothing is stored until "Upload Material" is clicked.
  populateUploadLevels();
  populateUploadDepartments();
  updateUploadClasses();
  updateResourceSubmitState();

  const modalEl = document.getElementById('uploadResourceModal');
  new bootstrap.Modal(modalEl).show();
}

/** Level dropdown — restricted to the levels the teacher's classes cover. */
function populateUploadLevels() {
  const sel = document.getElementById('upload-level');
  if (!sel) return;

  const levels = [];
  myAuthorizedClasses().forEach(c => {
    const lv = Access.levelOf(c);
    if (lv && !levels.includes(lv)) levels.push(lv);
  });

  sel.innerHTML = levels.length
    ? levels.map(lv => `<option value="${lv}">${Access.levelLabel(lv)}</option>`).join('')
    : '<option value="">No assigned levels</option>';
}

/** Department dropdown — only departments the teacher actually teaches in. */
function populateUploadDepartments() {
  const dep = document.getElementById('upload-department');
  if (!dep) return;

  const depts = myAuthorizedDepartments();
  dep.innerHTML = depts.length
    ? depts.map(d => `<option value="${d}">${d}</option>`).join('')
    : '<option value="">Not Applicable</option>';
}

/** Keeps the department select in step with the selected class. */
function syncUploadDepartment() {
  const cls = document.getElementById('upload-class')?.value || '';
  const derived = Access.departmentOf(cls);
  const dep = document.getElementById('upload-department');
  if (dep && derived) dep.value = derived;
}

function openEditResourceModal(resId) {
  const res = (appState.resources || []).find(r => r.id === resId);
  if (!res) return;
  if (!isOwnedByCurrentStaff(res) && Auth.getRole() !== 'admin') {
    showToast('error', 'Not Permitted', 'You can only edit materials you uploaded yourself.');
    return;
  }

  // A teacher may never edit material posted to a class they do not teach.
  if (!Access.canAccessResource(currentStaff, res)) {
    showToast('error', 'Access Denied', `${res.class || 'That class'} is not one of the classes you teach.`);
    return;
  }

  resetResourceFormState();
  staffEditingResourceId = res.id;

  populateUploadLevels();
  populateUploadDepartments();

  document.getElementById('upload-edit-id').value = res.id;
  document.getElementById('upload-title').value = res.title || '';
  document.getElementById('upload-level').value = res.level
    || document.getElementById('upload-level').options[0]?.value || '';
  document.getElementById('upload-department').value = res.department
    || document.getElementById('upload-department').options[0]?.value || '';
  updateUploadClasses(document.getElementById('upload-level').value);
  document.getElementById('upload-class').value = res.class || '';
  syncUploadDepartment();
  document.getElementById('upload-subject').value = res.subject || '';
  document.getElementById('upload-topic').value = res.topic || '';
  document.getElementById('upload-type').value = res.typeId || 'other';
  document.getElementById('upload-summary').value = res.description || '';
  document.getElementById('upload-content').value = res.content || '';
  if (res.videoUrl) {
    document.getElementById('upload-video-url').value = res.videoUrl;
    handleVideoUrlInput();
  }
  if (res.thumbnail) {
    staffThumbnailDataUrl = res.thumbnail;
    renderThumbnailPreview(res.thumbnail);
  }

  // Show the already-attached material (kept unless replaced).
  if (res.fileName) {
    staffMaterialFile = { keptResource: res };
    showMaterialFileSummary(res.fileName, res.fileSize || '', res.typeId || 'other', null);
  }

  const headingEl = document.getElementById('upload-modal-heading');
  if (headingEl) headingEl.textContent = 'Edit Material';
  const submitLabel = document.getElementById('upload-resource-submit-label');
  if (submitLabel) submitLabel.textContent = 'Save Changes';

  updateResourceSubmitState();
  new bootstrap.Modal(document.getElementById('uploadResourceModal')).show();
}

/**
 * Class dropdown — ONLY classes assigned to the signed-in teacher, optionally
 * narrowed by the chosen level and department. Unauthorized classes are never
 * rendered, so a resource cannot be posted to a class the teacher does not teach.
 */
function updateUploadClasses(level) {
  const sel = document.getElementById('upload-class');
  if (!sel) return;

  const lv = (level === undefined || level === null)
    ? (document.getElementById('upload-level')?.value || '')
    : level;
  const dep = document.getElementById('upload-department')?.value || '';

  let classes = myAuthorizedClasses();
  if (lv) classes = classes.filter(c => Access.levelOf(c) === lv);
  if (dep) classes = classes.filter(c => Access.departmentOf(c) === dep);

  sel.innerHTML = classes.length
    ? '<option value="">Select class…</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('')
    : '<option value="">No classes assigned to your account</option>';

  syncUploadDepartment();
  updateResourceSubmitState();
}

/** Resource Type select changed → adjust accept list + video link visibility. */
function handleResourceTypeChanged() {
  const typeId = document.getElementById('upload-type').value;
  const input = document.getElementById('upload-file-input');
  const rule = RESOURCE_TYPE_RULES[typeId];

  if (input) {
    if (rule && rule.extensions.length > 0) {
      input.accept = rule.extensions.join(',') + (typeId === 'other' ? ',.mp4,.pdf,.docx,.pptx,.xlsx,.png,.jpg' : '');
    } else {
      input.accept = '';
    }
  }
  updateVideoUrlVisibility();
}

function updateVideoUrlVisibility() {
  const typeId = document.getElementById('upload-type').value;
  const section = document.getElementById('video-url-section');
  if (section) section.classList.toggle('d-none', typeId !== 'video');
  updateResourceSubmitState();
}

function handleVideoUrlInput() {
  // A typed URL is fine on its own for video resources; nothing else to do here.
}

/**
 * Step 1 of the two-step upload — validate the chosen file and show its details.
 * The file is held in memory only; it is written to storage when the teacher
 * clicks "Upload Resource".
 */
function handleMaterialFileSelected(input) {
  clearMaterialFileError();
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];

  const detectedType = detectResourceTypeFromFile(file);

  // Auto-recognize the file type where possible.
  if (document.getElementById('upload-type').value === 'other' && detectedType !== 'other') {
    document.getElementById('upload-type').value = detectedType;
    updateVideoUrlVisibility();
  }

  const typeId = document.getElementById('upload-type').value;
  const rule = RESOURCE_TYPE_RULES[typeId] || RESOURCE_TYPE_RULES.other;
  const name = (file.name || '').toLowerCase();

  // Validate the file type against the selected resource type (soft check for "other").
  if (typeId !== 'other' && rule.extensions.length > 0) {
    const extOk = rule.extensions.some(ext => name.endsWith(ext));
    const mimeOk = file.type && rule.accept.includes(file.type);
    if (!extOk && !mimeOk) {
      abortMaterialSelection(`Unsupported file for "${rule.label}". Expected ${rule.extensions.join(', ')} — selected "${file.name}".`, input);
      return;
    }
  }

  // Validate the file size.
  if (file.size > MAX_MATERIAL_SIZE) {
    abortMaterialSelection(`File is too large (${FileStore.formatSize(file.size)}). The maximum allowed size is 100 MB.`, input);
    return;
  }

  if (file.size === 0) {
    abortMaterialSelection('The selected file is empty and may be corrupted. Please choose a valid file.', input);
    return;
  }

  revokeMaterialPreview();
  staffMaterialFile = {
    file: file,
    detectedType: detectedType,
    previewUrl: (file.type.startsWith('image/') || file.type.startsWith('video/'))
      ? URL.createObjectURL(file) : null
  };

  showMaterialFileSummary(file.name, FileStore.formatSize(file.size), detectedType, staffMaterialFile.previewUrl);
  updateResourceSubmitState();
}

/** Reject an invalid selection without leaving a stale summary behind. */
function abortMaterialSelection(message, input) {
  clearMaterialFileSelection();
  if (input) input.value = '';
  showMaterialFileError(message);
  updateResourceSubmitState();
}

function revokeMaterialPreview() {
  if (staffMaterialFile && staffMaterialFile.previewUrl) {
    try { URL.revokeObjectURL(staffMaterialFile.previewUrl); } catch (e) { /* not critical */ }
  }
}

/** Show the selected filename, type, size and (where possible) a preview. */
function showMaterialFileSummary(name, size, typeId, previewUrl) {
  document.getElementById('material-file-summary').classList.remove('d-none');
  document.getElementById('material-file-name').textContent = name;
  document.getElementById('material-file-size').textContent = size || '';

  const rule = RESOURCE_TYPE_RULES[typeId] || RESOURCE_TYPE_RULES.other;
  const typeEl = document.getElementById('material-file-type');
  if (typeEl) typeEl.textContent = rule.label;

  const prev = document.getElementById('material-file-preview');
  if (prev) {
    if (previewUrl && typeId === 'image') {
      prev.classList.remove('d-none');
      prev.innerHTML = `<img src="${previewUrl}" alt="Selected file preview">`;
    } else if (previewUrl && typeId === 'video') {
      prev.classList.remove('d-none');
      prev.innerHTML = `<video src="${previewUrl}" muted playsinline></video>`;
    } else {
      prev.classList.remove('d-none');
      prev.innerHTML = `<i class="bi ${rule.icon} text-teal fs-5"></i>`;
    }
  }
}

/** Step 1 again — swap the chosen file without uploading anything. */
function changeMaterialFile() {
  const input = document.getElementById('upload-file-input');
  if (!input) return;
  input.value = '';
  input.click();
}

function clearMaterialFileSelection() {
  revokeMaterialPreview();
  staffMaterialFile = null;
  const input = document.getElementById('upload-file-input');
  if (input) input.value = '';
  document.getElementById('material-file-summary').classList.add('d-none');
  const prev = document.getElementById('material-file-preview');
  if (prev) { prev.classList.add('d-none'); prev.innerHTML = ''; }
  clearMaterialFileError();
  updateResourceSubmitState();
}

/**
 * Step 2 gate — the "Upload Resource" button stays disabled until a valid file
 * (or a video link) AND all required information are supplied.
 */
function updateResourceSubmitState() {
  const btn = document.getElementById('upload-resource-submit');
  if (!btn) return;

  const label = document.getElementById('upload-resource-submit-label');
  const hint = document.getElementById('upload-submit-hint');

  if (resourceUploadInProgress) {
    btn.disabled = true;
    if (label) label.textContent = 'Uploading…';
    return;
  }

  if (label) label.textContent = 'Upload Material';

  const title = (document.getElementById('upload-title')?.value || '').trim();
  const cls = document.getElementById('upload-class')?.value || '';
  const subject = (document.getElementById('upload-subject')?.value || '').trim();
  const desc = (document.getElementById('upload-summary')?.value || '').trim();
  const typeId = document.getElementById('upload-type')?.value || 'pdf';
  const videoUrl = (document.getElementById('upload-video-url')?.value || '').trim();

  const hasFile = !!(staffMaterialFile && (staffMaterialFile.file || staffMaterialFile.keptResource));
  const hasLink = typeId === 'video' && !!videoUrl;
  const ready = !!(title && cls && subject && desc && (hasFile || hasLink));

  btn.disabled = !ready;

  if (hint) {
    if (ready) {
      hint.innerHTML = '<strong class="text-teal">Ready.</strong> Click “Upload Material” to save this material.';
    } else if (hasFile || hasLink) {
      hint.textContent = 'Fill in the title, class, subject and description to enable upload.';
    } else {
      hint.textContent = 'Step 1: choose a file (or paste a video link), then click “Upload Material”.';
    }
  }
}

function showMaterialFileError(message) {
  const box = document.getElementById('material-file-error');
  document.getElementById('material-file-error-text').textContent = message;
  box.classList.remove('d-none');
}

function clearMaterialFileError() {
  const box = document.getElementById('material-file-error');
  if (box) box.classList.add('d-none');
}

function setMaterialProgressVisible(visible) {
  document.getElementById('material-progress-wrap').classList.toggle('d-none', !visible);
  if (!visible) {
    const bar = document.getElementById('material-progress-bar');
    bar.style.width = '0%';
    document.getElementById('material-progress-percent').textContent = '0%';
  }
}

function setMaterialProgress(percent) {
  document.getElementById('material-progress-bar').style.width = `${percent}%`;
  document.getElementById('material-progress-percent').textContent = `${percent}%`;
}

function handleThumbnailSelected(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  if (!file.type.startsWith('image/')) {
    showToast('error', 'Invalid Thumbnail', 'Please choose a PNG, JPG, GIF or WebP image.');
    input.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('error', 'Thumbnail Too Large', 'Please choose a thumbnail image under 2 MB.');
    input.value = '';
    return;
  }
  FileStore.fileToDataUrl(file).then(dataUrl => {
    staffThumbnailDataUrl = dataUrl;
    renderThumbnailPreview(dataUrl);
  }).catch(() => showToast('error', 'Thumbnail Error', 'Could not read the selected image.'));
}

function renderThumbnailPreview(dataUrl) {
  const box = document.getElementById('thumbnail-preview-box');
  box.innerHTML = `<img src="${dataUrl}" class="w-100 h-100 rounded" style="object-fit:cover;" alt="Thumbnail preview">`;
  document.getElementById('thumbnail-remove-btn').classList.remove('d-none');
}

function clearThumbnailSelection() {
  staffThumbnailDataUrl = null;
  const box = document.getElementById('thumbnail-preview-box');
  box.innerHTML = '<i class="bi bi-image text-muted fs-4"></i>';
  document.getElementById('thumbnail-remove-btn').classList.add('d-none');
  const input = document.getElementById('upload-thumbnail-input');
  if (input) input.value = '';
}

function resetResourceFormState() {
  revokeMaterialPreview();
  staffMaterialFile = null;
  staffThumbnailDataUrl = null;
  staffEditingResourceId = null;
  document.getElementById('form-upload-resource').reset();
  document.getElementById('upload-edit-id').value = '';
  clearMaterialFileSelection();
  clearThumbnailSelection();
  setMaterialProgressVisible(false);
  updateVideoUrlVisibility();
  const label = document.getElementById('upload-resource-submit-label');
  if (label) label.textContent = 'Upload Material';
  updateResourceSubmitState();
}

/** Lock the upload button and switch its label while the file is being stored. */
function setResourceUploadBusy(busy) {
  resourceUploadInProgress = busy;
  const btn = document.getElementById('upload-resource-submit');
  const label = document.getElementById('upload-resource-submit-label');
  if (btn) btn.disabled = busy;
  if (label) label.textContent = busy ? 'Uploading Material…' : 'Upload Material';
  if (!busy) updateResourceSubmitState();
}

/**
 * Publish (or save) the resource: validates the form, stores the binary material
 * in IndexedDB with progress feedback, then saves the JSON record.
 */
function handleResourceUploadSubmit(e) {
  e.preventDefault();

  // One upload at a time — a double click can never create duplicate resources.
  if (resourceUploadInProgress) return;

  const title = document.getElementById('upload-title').value.trim();
  const level = document.getElementById('upload-level').value;
  const cls = document.getElementById('upload-class').value;
  const department = document.getElementById('upload-department')?.value || Access.departmentOf(cls);
  const subject = document.getElementById('upload-subject').value.trim();
  const topic = document.getElementById('upload-topic').value.trim();
  const typeId = document.getElementById('upload-type').value;
  const summary = document.getElementById('upload-summary').value.trim();
  const content = document.getElementById('upload-content').value.trim();
  const videoUrl = (document.getElementById('upload-video-url')?.value || '').trim();

  const isNewFile = staffMaterialFile && staffMaterialFile.file;
  const isKeepingFile = staffMaterialFile && staffMaterialFile.keptResource;

  // Data-level authorization: a resource may only ever be posted to a class the
  // signed-in teacher actually teaches.
  if (!cls || !Access.canTeachClass(currentStaff, cls)) {
    showToast('error', 'Access Denied', 'You can only upload materials for the classes assigned to you.');
    return;
  }

  const classDept = Access.departmentOf(cls);
  if (classDept && department && classDept !== department) {
    showToast('error', 'Department Mismatch', `${cls} belongs to the ${classDept} department, not ${department}.`);
    return;
  }

  if (!title || !subject || !summary) {
    showToast('warning', 'Missing Information', 'Please complete the title, subject and description.');
    return;
  }

  // Step 2: a material is required unless it is a video with an external link.
  if (!isNewFile && !isKeepingFile && !(typeId === 'video' && videoUrl)) {
    showToast('error', 'Material Required', 'Please choose the material file (or paste a video link for video materials).');
    return;
  }

  setResourceUploadBusy(true);

  const finishSave = (materialInfo) => {
    try {
      const editing = staffEditingResourceId ? (appState.resources || []).find(r => r.id === staffEditingResourceId) : null;

      // Editing is also re-checked against the teacher's assigned classes.
      if (editing && !Access.canAccessResource(currentStaff, editing)) {
        showToast('error', 'Access Denied', 'That material is not assigned to a class you teach.');
        return;
      }

      let resource;
      if (editing) {
        resource = editing;
      } else {
        resource = {
          id: `res-${Date.now()}`,
          uploader: currentStaff?.name || 'Staff Educator',
          uploaderId: currentStaff?.id,
          uploaderRole: 'teacher',
          uploaderDepartment: currentStaff?.department || '',
          uploaderClasses: myAuthorizedClasses(),
          author: currentStaff?.name || 'Staff Educator',
          // Teachers cannot publish directly: every new material waits for
          // admin approval before it becomes visible to students.
          status: 'pending',
          approved: false,
          dateAdded: new Date().toISOString(),
          uploadedAt: new Date().toISOString()
        };
        if (!appState.resources) appState.resources = [];
        appState.resources.unshift(resource);
      }

      resource.title = title;
      resource.level = level || Access.levelOf(cls);
      resource.class = cls;
      resource.department = department || classDept;
      resource.subject = subject;
      resource.topic = topic;
      resource.typeId = typeId;
      resource.type = RESOURCE_TYPE_RULES[typeId] ? RESOURCE_TYPE_RULES[typeId].label : typeId;
      resource.description = summary;
      resource.content = content;
      resource.estimatedTime = resource.estimatedTime || '15 mins';

      if (materialInfo) {
        resource.materialKey = materialInfo.materialKey;
        resource.fileName = materialInfo.fileName;
        resource.fileSize = materialInfo.fileSize;
        resource.mimeType = materialInfo.mimeType;
        resource.videoUrl = '';
      } else if (typeId === 'video' && videoUrl && !resource.materialKey) {
        // External video link replaces nothing — only used when no file is attached.
        resource.videoUrl = videoUrl;
        resource.fileName = '';
        resource.fileSize = '';
        resource.mimeType = '';
      } else if (typeId === 'video' && videoUrl) {
        // Video resource edited to use an external link alongside an existing file.
        resource.videoUrl = videoUrl;
      }

      if (staffThumbnailDataUrl) {
        resource.thumbnail = staffThumbnailDataUrl;
      }

      saveAppData(appState);

      const modalEl = document.getElementById('uploadResourceModal');
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();

      resetResourceFormState();
      renderStaffKPIs();
      renderStaffResources();
      renderApprovalQueue();

      showToast('info', 'Material Submitted',
        `"${title}" (${subject}) was uploaded successfully and is awaiting approval by the school administrator before students can see it.`);
    } finally {
      setResourceUploadBusy(false);
    }
  }

  if (isNewFile) {
    const file = staffMaterialFile.file;
    const materialKey = `material_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setMaterialProgressVisible(true);
    FileStore.readWithProgress(file, setMaterialProgress)
      .then(() => FileStore.saveMaterial(materialKey, file))
      .then(() => {
        setMaterialProgressVisible(false);
        finishSave({
          materialKey,
          fileName: file.name,
          fileSize: FileStore.formatSize(file.size),
          mimeType: file.type || 'application/octet-stream'
        });
      })
      .catch(err => {
        setMaterialProgressVisible(false);
        FileStore.deleteMaterial(materialKey);
        setResourceUploadBusy(false);
        showToast('error', 'Upload failed. Please try again.', err.message || 'The material could not be stored.');
      });
  } else {
    finishSave(null);
  }
}

/**
 * 8. Toast Notification System
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
 * Sidebar sections — Assignments, Announcements & Profile.
 * Assignments: the logged-in teacher's own published resources flagged as
 * assignments. Announcements: the Principal's school-wide notice (read-only).
 */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderStaffSidebarSections() {
  // ── Assignments (teacher's own) ──
  const listEl = document.getElementById('staff-assignments-list');
  if (listEl) {
    const mine = (appState.resources || []).filter(r =>
      isVisibleToCurrentStaff(r) && r.status === 'published' && r.approved !== false && r.isAssignment);

    if (mine.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-4">
          <i class="bi bi-journal-check fs-1 text-muted d-block mb-2"></i>
          <p class="text-sm text-muted mb-1">No assignments set yet.</p>
          <p class="text-xs text-muted mb-0">Tick “Mark as assignment” in the New Material form to publish take-home tasks for your classes.</p>
        </div>
      `;
    } else {
      listEl.innerHTML = mine.map(a => `
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 p-3 mb-2 rounded" style="background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.16);">
          <div>
            <div class="fw-bold text-sm text-white">${escapeHtml(a.title || 'Untitled assignment')}</div>
            <div class="text-xs text-muted mt-1">
              ${a.subject ? `<span class="me-2"><i class="bi bi-book me-1"></i>${escapeHtml(a.subject)}</span>` : ''}
              ${a.class ? `<span class="me-2"><i class="bi bi-people me-1"></i>${escapeHtml(a.class)}</span>` : ''}
              ${a.uploadedAt ? `<span><i class="bi bi-calendar me-1"></i>${new Date(a.uploadedAt).toLocaleDateString()}</span>` : ''}
            </div>
          </div>
          <div class="text-md-end">
            <button class="btn btn-sm btn-hub-outline" onclick="openResourcePreview('${a.id}')">
              <i class="bi bi-eye me-1"></i> Preview
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  // ── Announcements (read-only notice from the Principal) ──
  const annEl = document.getElementById('staff-announcement-display');
  if (annEl) {
    const announcement = (localStorage.getItem('learnbridge_announcement') || '').trim();
    annEl.innerHTML = announcement
      ? `
        <div class="p-3 rounded d-flex align-items-start gap-3" style="background:rgba(13,148,136,0.1);border:1px solid rgba(13,148,136,0.3);">
          <i class="bi bi-megaphone-fill text-teal fs-4 mt-1"></i>
          <div>
            <strong class="text-white text-sm d-block mb-1">Principal's Notice</strong>
            <span class="text-light text-sm">${escapeHtml(announcement)}</span>
          </div>
        </div>
      `
      : `
        <div class="text-center py-4">
          <i class="bi bi-megaphone fs-1 text-muted d-block mb-2"></i>
          <p class="text-sm text-muted mb-0">No school announcements have been published. The Principal's notices will appear here.</p>
        </div>
      `;
  }

  // ── Profile (own account summary) ──
  const profileEl = document.getElementById('staff-profile-info');
  if (profileEl && currentStaff) {
    const rows = [
      ['Full Name', currentStaff.name || '—'],
      ['Staff ID', currentStaff.staffId || '—'],
      ['Email', currentStaff.email || '—'],
      ['Role / Title', currentStaff.role === 'admin' ? 'Principal & Admin' : (currentStaff.title || 'Educator')],
      ['Department / Section', myDepartmentLabel()],
      ['Subject(s) Taught', (currentStaff.subjects || []).join(', ') || '—'],
      ['Assigned Classes', myAuthorizedClasses().join(', ') || 'All Classes'],
      ['Students in My Classes', String(myStudents().length)]
    ];
    profileEl.innerHTML = rows.map(([label, value]) => `
      <div class="col-md-6">
        <div class="p-2 rounded" style="background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.14);">
          <div class="text-xs text-muted text-uppercase fw-bold">${label}</div>
          <div class="text-sm text-white fw-bold mt-1">${escapeHtml(String(value))}</div>
        </div>
      </div>
    `).join('');
  }
}
