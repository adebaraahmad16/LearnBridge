/**
 * LearnBridge — Master School Administrator & Principal Portal Logic
 * Controls examination result broadsheets, document uploads, curriculum authorizations,
 * student rosters, staff assignments, and institutional settings.
 */

// Enforce Administrator Route Protection
Auth.requireAdmin();

let appState = getAppData();
const currentSession = Auth.getSession();
// Resolve the LIVE admin record so roster and approval changes made in other
// tabs are reflected here instead of being hidden by a stale login snapshot.
const currentAdmin =
  (appState.staff || []).find(s => s.id === currentSession?.user?.id) ||
  (appState.staff && appState.staff.find(s => s.role === 'admin')) ||
  currentSession?.user || {
  name: 'Administrator',
  role: 'admin',
  roleTitle: 'School Administrator'
};

const CLASS_MAP = {
  jss: ['All JSS Classes', 'JSS 1A', 'JSS 1B', 'JSS 2A', 'JSS 2B', 'JSS 3A', 'JSS 3B'],
  sss: ['All SSS Classes', 'SS 1 Science', 'SS 1 Arts', 'SS 1 Commercial', 'SS 2 Science', 'SS 2 Arts', 'SS 2 Commercial', 'SS 3 Science', 'SS 3 Arts', 'SS 3 Commercial']
};

let activeViewingDoc = null;

/** Derive the department/section from a class name (e.g. "SS 2 Science" → "Science"). */
function getDepartmentFromClass(cls) {
  const lower = (cls || '').toLowerCase();
  if (lower.includes('science')) return 'Science';
  if (lower.includes('arts')) return 'Arts';
  if (lower.includes('commercial')) return 'Commercial';
  return '';
}

document.addEventListener('DOMContentLoaded', () => {
  initAdminDashboard();
});

function initAdminDashboard() {
  // Always render from the freshest saved state — teachers may have uploaded
  // submissions since this page was first loaded.
  appState = getAppData();

  renderAdminHeader();
  renderAdminKPIs();
  renderAdminResultDocs();
  renderAdminApprovalQueue();
  renderAdminResources();
  renderAdminStudents();
  renderAdminStaff();
  renderAdminSidebarSections();
  refreshAdminAnnouncementDisplays();
}

// ── Cross-tab sync ────────────────────────────────────────────────────────
// Teacher uploads from another tab appear in the approval queue immediately.
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('learnbridge_')) {
    initAdminDashboard();
  }
});

/**
 * 1. Header Profile & Status Info
 */
function renderAdminHeader() {
  const heroGreeting = document.getElementById('admin-hero-greeting');
  const sessionDisplay = document.getElementById('admin-session-display');

  if (heroGreeting) heroGreeting.textContent = `Welcome back, ${currentAdmin.name || 'Administrator'}`;

  const currentSessionName = localStorage.getItem('learnbridge_active_session') || '2025/2026';
  const currentTermName = localStorage.getItem('learnbridge_active_term') || 'First Term';
  if (sessionDisplay) {
    sessionDisplay.textContent = `${currentSessionName} (${currentTermName})`;
  }

  // Profile Picture manager — the signed-in admin's own account only.
  // The panel is the single unified profile section (picture + name + action).
  if (currentAdmin.id) {
    initDashboardProfilePicture({
      namespace: 'AdminProfilePicture',
      panelId: 'admin-profile-picture-slot',
      accountId: currentAdmin.id,
      name: currentAdmin.name,
      sublabel: 'Principal & Admin',
      onChange: () => {
        appState = getAppData();
        const fresh = (appState.staff || []).find(st => st.id === currentAdmin.id);
        if (fresh) currentAdmin.name = fresh.name;
      }
    });
  }
}

/**
 * 2. KPI Metrics Calculation
 */
function renderAdminKPIs() {
  const totalStudents = (appState.students || []).length;
  const totalTeachers = (appState.staff || []).filter(s => s.role !== 'admin').length;
  const totalResults = (appState.results || []).length;
  const totalResources = (appState.resources || []).filter(r => r.status === 'published' && r.approved !== false).length;
  const pendingMaterials = (appState.resources || []).filter(r => r.status === 'pending' || r.approved === false).length;
  const pendingResults = (appState.results || []).filter(r => r.status === 'pending' || r.approved === false).length;
  const pendingApprovals = pendingMaterials + pendingResults;

  const elStudents = document.getElementById('metric-admin-students');
  const elTeachers = document.getElementById('metric-admin-teachers');
  const elResults = document.getElementById('metric-admin-results');
  const elResources = document.getElementById('metric-admin-resources');
  const elPending = document.getElementById('metric-admin-pending');

  if (elStudents) elStudents.textContent = totalStudents.toString();
  if (elTeachers) elTeachers.textContent = totalTeachers.toString();
  if (elResults) elResults.textContent = totalResults.toString();
  if (elResources) elResources.textContent = totalResources.toString();
  if (elPending) elPending.textContent = pendingApprovals.toString();
}

/**
 * 3. Results Documents & Broadsheets Hub (uploaded by teachers; admin approves)
 */
function renderAdminResultDocs() {
  const tbody = document.getElementById('admin-results-tbody');
  if (!tbody) return;

  const search = (document.getElementById('admin-result-search')?.value || '').trim().toLowerCase();
  const level = document.getElementById('admin-result-level')?.value || 'all';
  const term = document.getElementById('admin-result-term')?.value || 'all';
  const type = document.getElementById('admin-result-type')?.value || 'all';

  let list = appState.results || [];

  if (level !== 'all') {
    list = list.filter(r => r.level === level);
  }
  if (term !== 'all') {
    list = list.filter(r => r.term && r.term.toLowerCase().includes(term.toLowerCase()));
  }
  if (type !== 'all') {
    list = list.filter(r => r.docType === type);
  }
  if (search) {
    list = list.filter(r => 
      (r.title && r.title.toLowerCase().includes(search)) ||
      (r.class && r.class.toLowerCase().includes(search)) ||
      (r.subject && r.subject.toLowerCase().includes(search)) ||
      (r.uploadedBy && r.uploadedBy.toLowerCase().includes(search)) ||
      (r.fileName && r.fileName.toLowerCase().includes(search))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">
          <i class="bi bi-file-earmark-x fs-2 d-block mb-1"></i>
          No result documents match the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(doc => {
    const typeBadgeMap = {
      pdf: '<span class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25"><i class="bi bi-file-earmark-pdf me-1"></i>PDF</span>',
      excel: '<span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25"><i class="bi bi-file-earmark-excel me-1"></i>XLSX</span>',
      csv: '<span class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-25"><i class="bi bi-filetype-csv me-1"></i>CSV</span>',
      doc: '<span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25"><i class="bi bi-file-earmark-word me-1"></i>DOCX</span>'
    };

    const typeBadge = typeBadgeMap[doc.docType] || '<span class="badge bg-secondary">DOC</span>';

    return `
      <tr>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="text-teal fs-4">
              <i class="bi ${doc.docType === 'pdf' ? 'bi-file-pdf' : doc.docType === 'excel' ? 'bi-file-spreadsheet' : 'bi-file-earmark-text'}"></i>
            </div>
            <div>
              <div class="fw-bold text-white text-sm">${doc.title}</div>
              <div class="text-xs text-muted font-monospace">${doc.fileName} &bull; <span class="text-teal">${doc.subject || 'All Subjects'}</span></div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge bg-secondary bg-opacity-25 text-teal font-monospace text-xs">
            ${(doc.level || 'JSS').toUpperCase()} &bull; ${doc.class || 'All'}
          </span>
        </td>
        <td>
          <div class="text-xs text-light font-monospace">${doc.session || '2025/2026'}</div>
          <div class="text-xs text-warning">${doc.term || '1st Term'}</div>
        </td>
        <td>
          <div class="d-flex align-items-center gap-1">
            ${typeBadge}
            <span class="text-xs text-muted font-monospace">${doc.fileSize || '2.0 MB'}</span>
          </div>
        </td>
        <td>
          <div class="text-xs text-light">${doc.uploadedBy || 'Admin'}</div>
          <div class="text-xs text-muted font-monospace">${doc.uploadDate || '2026-02-10'}</div>
        </td>
        <td>
          <span class="badge ${doc.status === 'published' ? 'bg-teal text-dark' : 'bg-warning text-dark'} text-xs">
            ${doc.status === 'published' ? 'Admin Approved' : 'Pending Admin Approval'}
          </span>
        </td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-sm btn-hub-primary" onclick="viewBroadsheetModal('${doc.id}')" title="Interactive Broadsheet Preview">
              <i class="bi bi-eye"></i> View
            </button>
            <button class="btn btn-sm btn-outline-info" onclick="downloadResultFile('${doc.id}')" title="Download Document">
              <i class="bi bi-download"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteResultDoc('${doc.id}')" title="Delete Document">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function resetResultFilters() {
  const s = document.getElementById('admin-result-search');
  const l = document.getElementById('admin-result-level');
  const t = document.getElementById('admin-result-term');
  const ty = document.getElementById('admin-result-type');
  if (s) s.value = '';
  if (l) l.value = 'all';
  if (t) t.value = 'all';
  if (ty) ty.value = 'all';
  renderAdminResultDocs();
}

function viewBroadsheetModal(docId) {
  const doc = (appState.results || []).find(r => r.id === docId);
  if (!doc) return;

  activeViewingDoc = doc;

  const titleEl = document.getElementById('broadsheet-modal-title');
  const subEl = document.getElementById('broadsheet-modal-sub');
  const bodyEl = document.getElementById('broadsheet-modal-body');

  if (titleEl) titleEl.textContent = doc.title;
  if (subEl) subEl.textContent = `Amule Government Secondary School • ${doc.session} • ${doc.term} • Class: ${doc.class}`;

  let scoresHtml = '';
  if (doc.scores && doc.scores.length > 0) {
    scoresHtml = `
      <div class="table-responsive my-3">
        <table class="table table-bordered table-dark align-middle text-sm mb-0" style="border-color:var(--border-subtle);">
          <thead style="background:rgba(15,23,42,0.9);">
            <tr class="text-xs text-teal text-uppercase">
              <th>Adm. No.</th>
              <th>Student Name</th>
              <th>Subjects &amp; Scores (CA / Exam / Total / Grade)</th>
              <th>Average</th>
              <th>Class Position</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${doc.scores.map(s => {
              const subjEntries = Object.entries(s.subjects || {}).map(([subName, score]) => `
                <div class="d-inline-flex align-items-center gap-1 p-1 px-2 rounded bg-secondary bg-opacity-20 text-xs me-1 mb-1 font-monospace">
                  <strong class="text-white">${subName}:</strong> 
                  <span class="text-muted">CA:${score.ca}</span> 
                  <span class="text-muted">Ex:${score.exam}</span> 
                  <span class="text-warning fw-bold">${score.total}</span>
                  <span class="badge ${score.grade === 'A' ? 'bg-success' : 'bg-primary'} text-xs">${score.grade}</span>
                </div>
              `).join('');

              return `
                <tr>
                  <td class="font-monospace text-teal text-xs">${s.admissionNo}</td>
                  <td class="fw-bold text-white">${s.name}</td>
                  <td>${subjEntries || '<span class="text-muted">Composite Mark</span>'}</td>
                  <td><span class="badge bg-teal text-dark font-monospace">${s.average}%</span></td>
                  <td><span class="badge bg-secondary bg-opacity-25 text-warning font-monospace">${s.position || 'N/A'}</span></td>
                  <td class="text-xs text-muted" style="max-width:220px;">${s.remark || 'Good'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    scoresHtml = `
      <div class="p-4 rounded text-center my-3" style="background:rgba(15,23,42,0.7);border:1px dashed var(--border-subtle);">
        <i class="bi bi-file-earmark-text text-teal fs-1 d-block mb-2"></i>
        <h6 class="fw-bold text-white mb-1">Attached Document File Archive</h6>
        <p class="text-xs text-muted mb-2">Original Document: <strong>${doc.fileName}</strong> (${doc.fileSize})</p>
        <span class="badge bg-secondary bg-opacity-25 text-teal text-xs">Ready for Download &amp; Printing</span>
      </div>
    `;
  }

  bodyEl.innerHTML = `
    <div class="p-3 rounded mb-3" style="background:rgba(30,41,59,0.5);border:1px solid var(--border-subtle);">
      <div class="row g-2 text-xs">
        <div class="col-md-3"><strong>Document Title:</strong> <span class="text-light">${doc.title}</span></div>
        <div class="col-md-3"><strong>Class &amp; Level:</strong> <span class="text-teal font-monospace">${doc.class} (${(doc.level || 'JSS').toUpperCase()})</span></div>
        <div class="col-md-3"><strong>Academic Term:</strong> <span class="text-warning">${doc.session} - ${doc.term}</span></div>
        <div class="col-md-3"><strong>Author:</strong> <span class="text-light">${doc.uploadedBy}</span></div>
      </div>
      <div class="text-xs text-muted mt-2 border-top border-secondary border-opacity-15 pt-2">
        <strong>Notes / Abstract:</strong> ${doc.description || 'No extra notes provided.'}
      </div>
    </div>

    <h6 class="fw-bold text-white mb-2 d-flex align-items-center gap-2">
      <i class="bi bi-table text-teal"></i> Composite Broadsheet &amp; Score Records
    </h6>
    ${scoresHtml}
  `;

  const modalEl = document.getElementById('broadsheetViewerModal');
  const modalInstance = new bootstrap.Modal(modalEl);
  modalInstance.show();
}

function downloadResultFile(docId) {
  const doc = (appState.results || []).find(r => r.id === docId);
  if (!doc) return;

  simulateDocumentDownload(doc.fileName || 'Result_Document.pdf');
}

function simulateDocumentDownload(name = 'Result_Broadsheet.pdf') {
  showToast('info', 'Download Initiated', `Downloading document file "${name}" to your local device.`);
  
  // Create simulated blob download
  const content = `Amule Government Secondary School\nOfficial Examination Broadsheet & Result Dossier\nDocument: ${name}\nGenerated on: ${new Date().toLocaleString()}\nStatus: Verified and Certified by School Principal.`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.endsWith('.txt') ? name : `${name}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function deleteResultDoc(docId) {
  if (!confirm('Are you sure you want to delete this result document? This action cannot be undone.')) return;

  appState.results = (appState.results || []).filter(r => r.id !== docId);
  saveAppData(appState);

  renderAdminKPIs();
  renderAdminResultDocs();
  showToast('info', 'Document Removed', 'Result document was successfully deleted from portal records.');
}

/**
 * 4. Curriculum Approval Queue Handlers
 */
function renderAdminApprovalQueue() {
  const container = document.getElementById('admin-approvals-container');
  if (!container) return;

  const pending = [
    ...(appState.resources || [])
      .filter(r => r.status === 'pending' || r.approved === false)
      .map(r => ({ ...r, submissionKind: 'Material' })),
    ...(appState.results || [])
      .filter(r => r.status === 'pending' || r.approved === false)
      .map(r => ({ ...r, submissionKind: 'Result' }))
  ];

  if (pending.length === 0) {
    container.innerHTML = `
      <div class="p-4 rounded text-center text-muted" style="background:rgba(255,255,255,0.02);border:1px dashed var(--border-subtle);">
        <i class="bi bi-check-circle-fill text-teal fs-3 d-block mb-1"></i>
        <h6 class="fw-bold text-white mb-1">Approval Queue is Up-to-Date</h6>
        <p class="text-xs mb-0">No teacher submissions are awaiting review. Materials and results appear here after teachers upload them.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="d-flex flex-column gap-3">
      ${pending.map(res => `
        <div class="p-3 rounded d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style="background:rgba(234, 179, 8, 0.05);border:1px solid rgba(234, 179, 8, 0.2);">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <span class="badge bg-warning text-dark text-xs">Pending Principal Approval</span>
              <span class="badge bg-secondary bg-opacity-25 text-teal text-xs">${res.submissionKind}</span>
              <span class="badge bg-secondary bg-opacity-25 text-teal text-xs">${(res.level || 'JSS').toUpperCase()} &bull; ${res.class || 'All'}</span>
              <span class="text-xs text-muted">Educator: <strong>${res.uploader || res.author || 'Teacher'}</strong></span>
            </div>
            <h6 class="fw-bold text-white mb-1">${res.title}</h6>
            <div class="text-xs text-light mb-1">
              ${res.submissionKind === 'Result'
                ? `${res.studentName || 'Class sheet'}${res.score !== undefined && res.score !== null && res.score !== '' ? ' — ' + res.score + '%' : ''} &bull; ${res.session || ''} ${res.term || ''}`
                : `<strong>Subject:</strong> ${res.subject || ''} &bull; <strong>Topic:</strong> ${res.topic || ''} &bull; Format: <strong>${res.type || 'Lesson'}</strong>`}
            </div>
            ${res.submissionKind === 'Material' && (res.description || res.summary)
              ? `<p class="text-xs text-muted mb-0" style="max-width:750px;">${(res.description || res.summary || '').substring(0, 220)}...</p>`
              : ''}
          </div>

          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-teal text-dark fw-bold" onclick="approveSubmissionAsAdmin('${res.id}', '${res.submissionKind}')">
              <i class="bi bi-check-circle me-1"></i> Approve
            </button>
            <button type="button" class="btn btn-sm btn-danger" onclick="rejectSubmissionAsAdmin('${res.id}', '${res.submissionKind}')">
              <i class="bi bi-x-circle me-1"></i> Reject
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function approveSubmissionAsAdmin(subId, kind) {
  if (kind === 'Result') {
    const doc = (appState.results || []).find(r => r.id === subId);
    if (!doc) return;
    doc.approved = true;
    doc.status = 'published';
    saveAppData(appState);
    renderAdminKPIs();
    renderAdminApprovalQueue();
    renderAdminResultDocs();
    refreshStaffDashboardViews();
    showToast('success', 'Result Approved', `"${doc.title}" is now visible to the student${doc.class ? 's in ' + doc.class : ''}.`);
    return;
  }

  const res = (appState.resources || []).find(r => r.id === subId);
  if (!res) return;

  res.approved = true;
  res.status = 'published';
  saveAppData(appState);

  renderAdminKPIs();
  renderAdminApprovalQueue();
  renderAdminResources();
  refreshStaffDashboardViews();
  showToast('success', 'Material Approved', `"${res.title}" has been approved and published to the class.`);
}

/**
 * Cross-tab sync: when the admin approves or rejects a submission, any open
 * teacher dashboard (another tab or window) refreshes immediately, and the
 * student dashboard follows on its next login or page load.
 */
function refreshStaffDashboardViews() {
  try {
    localStorage.setItem('learnbridge_staff_refresh_ping', String(Date.now()));
  } catch (e) { /* storage unavailable — other tabs will refresh on next load */ }
}

function rejectSubmissionAsAdmin(subId, kind) {
  if (!confirm(`Are you sure you want to reject this ${String(kind || 'submission').toLowerCase()}? The teacher will no longer see it in their submission list.`)) return;

  if (kind === 'Result') {
    appState.results = (appState.results || []).filter(r => r.id !== subId);
  } else {
    appState.resources = (appState.resources || []).filter(r => r.id !== subId);
  }
  saveAppData(appState);

  renderAdminKPIs();
  renderAdminApprovalQueue();
  renderAdminResources();
  renderAdminResultDocs();
  refreshStaffDashboardViews();
  showToast('info', 'Submission Rejected', 'The teacher submission has been rejected and removed. Refreshing teacher dashboard…');
}

/**
 * 5. Curriculum Resources Repository
 */
function renderAdminResources() {
  const tbody = document.getElementById('admin-resources-tbody');
  if (!tbody) return;

  const searchVal = (document.getElementById('admin-res-search')?.value || '').trim().toLowerCase();
  const levelVal = document.getElementById('admin-res-level')?.value || 'all';

  let items = appState.resources || [];

  if (levelVal !== 'all') {
    items = items.filter(r => r.level === levelVal);
  }

  if (searchVal) {
    items = items.filter(r => 
      (r.title && r.title.toLowerCase().includes(searchVal)) ||
      (r.subject && r.subject.toLowerCase().includes(searchVal)) ||
      (r.topic && r.topic.toLowerCase().includes(searchVal)) ||
      (r.author && r.author.toLowerCase().includes(searchVal)) ||
      (r.uploader && r.uploader.toLowerCase().includes(searchVal))
    );
  }

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">
          <i class="bi bi-folder-x fs-3 d-block mb-1"></i>
          No curriculum materials match the filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(res => {
    const isApproved = res.status === 'published' && res.approved !== false;
    return `
      <tr>
        <td>
          <div class="fw-bold text-white text-sm">${res.title}</div>
          <div class="text-xs text-teal">${res.topic || ''}</div>
        </td>
        <td>
          <span class="badge bg-secondary bg-opacity-25 text-white font-monospace text-xs">
            ${(res.level || 'JSS').toUpperCase()} &bull; ${res.class || 'All'}
          </span>
        </td>
        <td><span class="text-xs fw-medium text-light">${res.subject}</span></td>
        <td><span class="badge bg-dark border border-secondary border-opacity-25 text-xs text-capitalize">${res.type || 'Lesson'}</span></td>
        <td><span class="text-xs text-muted">${res.uploader || res.author || 'Educator'}</span></td>
        <td>
          <span class="badge ${isApproved ? 'bg-teal text-dark' : 'bg-warning text-dark'} text-xs">
            ${isApproved ? 'Published' : 'Pending'}
          </span>
        </td>
        <td class="text-end">
          <button class="btn btn-outline-danger btn-xs" title="Delete" onclick="deleteResourceAsAdmin('${res.id}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function deleteResourceAsAdmin(resId) {
  if (!confirm('Are you sure you want to delete this material?')) return;

  appState.resources = (appState.resources || []).filter(r => r.id !== resId);
  saveAppData(appState);

  renderAdminKPIs();
  renderAdminResources();
  renderAdminApprovalQueue();
  showToast('info', 'Material Removed', 'Material was removed from the portal library.');
}

/**
 * 6. Student Directory & Report Card Generator
 */
function renderAdminStudents() {
  const tbody = document.getElementById('admin-students-tbody');
  if (!tbody) return;

  const search = (document.getElementById('admin-student-search')?.value || '').trim().toLowerCase();
  let students = appState.students || [];

  if (search) {
    students = students.filter(s => 
      (s.name && s.name.toLowerCase().includes(search)) ||
      (s.admissionNo && s.admissionNo.toLowerCase().includes(search)) ||
      (s.class && s.class.toLowerCase().includes(search))
    );
  }

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-muted">
          <i class="bi bi-person-x fs-3 d-block mb-1"></i>
          No students registered yet. Students appear here once they create accounts.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr>
      <td>
        <div class="d-flex align-items-center gap-2">
          ${studentBadgeHtml(s)}
          <span class="fw-bold text-white text-sm">${s.name}</span>
        </div>
      </td>
      <td><span class="font-monospace text-xs text-teal">${s.admissionNo || 'N/A'}</span></td>
      <td><span class="badge bg-secondary bg-opacity-25 text-light text-xs">${s.class || 'Secondary'}</span></td>
      <td><span class="text-xs text-muted font-monospace">${s.passcode ? '••••' : '—'}</span></td>
      <td><span class="text-xs text-warning font-monospace">${s.streakDays || 1} Days</span></td>
      <td><span class="badge bg-secondary bg-opacity-25 text-teal text-xs">${s.points || 100} pts</span></td>
      <td>
        <span class="badge ${(s.cbtBestScore || 0) >= 50 ? 'bg-teal text-dark' : 'bg-secondary'} font-monospace text-xs">
          ${s.cbtBestScore ? s.cbtBestScore + '%' : 'N/A'}
        </span>
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-hub-outline" onclick="openStudentReportCard('${s.id}')">
          <i class="bi bi-file-earmark-person me-1"></i> Report Card
        </button>
      </td>
    </tr>
  `).join('');
}

function openStudentReportCard(studentId) {
  const student = (appState.students || []).find(s => s.id === studentId);
  if (!student) return;

  // Search if we have student scores in any broadsheet result
  let studentScoreEntry = null;
  let broadsheetTitle = 'First Term Examination 2025/2026';

  for (const r of (appState.results || [])) {
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
        <h6 class="fw-bold text-white mb-1">No Results Published Yet</h6>
        <p class="text-xs mb-0">This student has no recorded scores yet. A report card will be generated once the school publishes a broadsheet containing this student.</p>
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
    <div class="p-4 rounded text-light" style="background:rgba(15,23,42,0.9);border:1px solid var(--border-teal);">
      <!-- School Header -->
      <div class="text-center pb-3 border-bottom border-secondary border-opacity-25 mb-4">
        <div class="d-inline-flex align-items-center gap-2 mb-2">
          <div class="brand-logo-icon" style="width:40px;height:40px;">
            <i class="bi bi-book-half fs-4 text-white"></i>
          </div>
          <h4 class="fw-bold mb-0 text-white">Amule Government Secondary School</h4>
        </div>
        <p class="text-xs text-muted mb-0">Official Continuous Assessment &amp; Terminal Examination Report Card</p>
        <div class="text-xs text-teal font-monospace mt-1">${broadsheetTitle} &bull; 2025/2026 Session</div>
      </div>

      <!-- Student Bio Summary -->
      <div class="row g-3 mb-4 p-3 rounded" style="background:rgba(30,41,59,0.5);">
        <div class="col-md-3 d-flex align-items-center gap-2">
          ${studentBadgeHtml(student, 48)}
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
          <div class="text-xs text-muted">Term Average &amp; Position</div>
          <div class="fw-bold text-sm text-warning font-monospace">${studentScoreEntry.average != null ? studentScoreEntry.average + '%' : '—'} (${studentScoreEntry.position || '—'})</div>
        </div>
        <div class="col-md-3">
          <div class="text-xs text-muted">Academic Status</div>
          <span class="badge bg-success text-xs">Passed &bull; Promoted</span>
        </div>
      </div>

      <!-- Subject Scores Breakdown -->
      <h6 class="fw-bold text-white mb-2"><i class="bi bi-list-check text-teal me-1"></i> Subject Performance Summary</h6>
      <div class="table-responsive mb-4">
        <table class="table table-bordered table-dark align-middle text-sm mb-0">
          <thead style="background:rgba(15,23,42,0.8);">
            <tr class="text-xs text-teal text-uppercase">
              <th>Subject</th>
              <th class="text-center">Continuous Assessment (40%)</th>
              <th class="text-center">Terminal Exam (60%)</th>
              <th class="text-center">Total Score (100%)</th>
              <th class="text-center">Grade</th>
            </tr>
          </thead>
          <tbody>
            ${subjectsTable}
          </tbody>
        </table>
      </div>

      <!-- Remarks and Signature -->
      <div class="row g-3 p-3 rounded" style="background:rgba(30,41,59,0.4);">
        <div class="col-md-8">
          <div class="text-xs text-muted mb-1">Principal's Remarks:</div>
          <p class="text-xs text-light mb-0 fst-italic">"${studentScoreEntry.remark || 'No official remarks recorded yet.'}"</p>
        </div>
        <div class="col-md-4 text-end">
          <div class="text-xs text-teal fw-bold font-monospace">School Principal</div>
          <div class="text-xs text-muted">Principal &amp; Chief Administrator</div>
          <div class="text-xs text-muted">Certified Official Record</div>
        </div>
      </div>
    </div>
  `;

  const modalEl = document.getElementById('studentReportCardModal');
  const modalInstance = new bootstrap.Modal(modalEl);
  modalInstance.show();
}

/**
 * 7. Staff & Account Management
 */
function renderAdminStaff() {
  const tbody = document.getElementById('admin-staff-tbody');
  if (!tbody) return;

  const staffList = appState.staff || [];

  if (staffList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">
          <i class="bi bi-person-badge fs-3 d-block mb-1"></i>
          No staff members yet. Use the Add New Teacher button to register the first member of staff.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = staffList.map(st => `
    <tr>
      <td>
        <div class="d-flex align-items-center gap-2">
          ${accountBadgeHtml(st)}
          <span class="fw-bold text-white text-sm">${st.name}</span>
        </div>
      </td>
      <td>
        <div class="font-monospace text-xs text-teal">${st.staffId || 'STAFF'}</div>
        <div class="text-xs text-muted">${st.email || ''}</div>
      </td>
      <td>
        <span class="badge ${st.role === 'admin' ? 'bg-primary' : 'bg-secondary bg-opacity-25 text-teal'} text-xs">
          ${st.roleTitle || (st.role === 'admin' ? 'Principal & Admin' : 'Educator')}
        </span>
      </td>
      <td><span class="text-xs text-light">${(st.subjects || ['General']).join(', ')}</span></td>
      <td>
        <span class="text-xs text-muted font-monospace">${(st.classes || ['All']).join(', ')}</span>
        <div class="text-xs text-teal">${st.department || (st.role === 'admin' ? 'Administration' : '—')}</div>
      </td>
      <td class="text-end">
        ${st.role === 'admin' ? '<span class="text-xs text-muted">Master Admin</span>' : `
          <button class="btn btn-outline-danger btn-xs" onclick="removeStaffMember('${st.id}')">
            <i class="bi bi-trash"></i>
          </button>
        `}
      </td>
    </tr>
  `).join('');
}

function openAddStaffModal() {
  Access.renderClassPicker('add-staff-classes-picker', []);
  const modalEl = document.getElementById('addStaffModal');
  const modalInstance = new bootstrap.Modal(modalEl);
  modalInstance.show();
}

/** Show/hide the teaching fields when the role selector changes. */
function handleAddStaffRoleChanged() {
  const isAdmin = (document.getElementById('add-staff-role')?.value || 'teacher') === 'admin';
  ['add-staff-department', 'add-staff-classes-picker'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('opacity-50', isAdmin);
  });
}

function handleAddStaffSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('add-staff-name').value.trim();
  const staffId = document.getElementById('add-staff-id').value.trim();
  const email = document.getElementById('add-staff-email').value.trim();
  const role = document.getElementById('add-staff-role')?.value || 'teacher';
  const subject = document.getElementById('add-staff-subject').value.trim();
  const department = document.getElementById('add-staff-department')?.value || '';
  const classes = Access.readClassPicker('add-staff-classes-picker');
  const title = document.getElementById('add-staff-title').value.trim();
  const isAdmin = role === 'admin';

  if (!name || !staffId || !email) {
    showToast('warning', 'Missing Fields', 'Please fill in the staff name, ID and email address.');
    return;
  }

  // A teacher account must be tied to a department and at least one class,
  // otherwise it would have no student/result/resource scope at all.
  if (!isAdmin) {
    if (!subject || !department) {
      showToast('warning', 'Missing Fields', 'Please provide the primary subject and department for this teacher.');
      return;
    }
    if (classes.length === 0) {
      showToast('warning', 'Select Class(es)', 'Tick at least one class this teacher is responsible for.');
      return;
    }
    const mismatched = classes.filter(c => {
      const classDept = Access.departmentOf(c);
      return classDept && classDept !== 'Junior Secondary' && classDept !== department;
    });
    if (mismatched.length > 0) {
      showToast('error', 'Department Mismatch',
        `${mismatched.join(', ')} do not belong to the ${department} department.`);
      return;
    }
  }

  // No hardcoded default passwords — generate a unique credential for this account.
  const generatedPassword = Math.floor(100000 + Math.random() * 900000).toString();

  const newStaff = {
    id: `stf-${Date.now()}`,
    staffId: staffId,
    name: name,
    email: email,
    role: isAdmin ? 'admin' : 'teacher',
    roleTitle: isAdmin ? 'School Administrator & Principal' : (title || 'Senior Educator'),
    passcode: generatedPassword,
    subjects: isAdmin ? ['Administration'] : [subject],
    department: isAdmin ? 'Administration' : department,
    classes: isAdmin ? ['All Classes'] : classes
  };

  if (!appState.staff) appState.staff = [];
  appState.staff.push(newStaff);
  saveAppData(appState);

  const modalEl = document.getElementById('addStaffModal');
  const modalInstance = bootstrap.Modal.getInstance(modalEl);
  if (modalInstance) modalInstance.hide();

  document.getElementById('form-add-staff').reset();
  Access.clearClassPicker('add-staff-classes-picker');
  renderAdminKPIs();
  renderAdminStaff();
  showToast('success', 'Staff Account Created', `${name} enrolled for ${isAdmin ? 'school-wide administration' : classes.join(', ') + ' — ' + department}. Share their sign-in password with them: ${generatedPassword}`);
}

function removeStaffMember(staffId) {
  if (!confirm('Are you sure you want to remove this staff member?')) return;

  appState.staff = (appState.staff || []).filter(s => s.id !== staffId);
  saveAppData(appState);

  renderAdminKPIs();
  renderAdminStaff();
  showToast('info', 'Staff Removed', 'Staff member removed from directory.');
}

/**
 * 8. School Settings Handlers
 */
function saveSchoolSettings() {
  const session = document.getElementById('config-session').value.trim();
  const term = document.getElementById('config-term').value;
  const school = document.getElementById('config-school').value.trim();
  const announcement = document.getElementById('config-announcement').value.trim();

  localStorage.setItem('learnbridge_active_session', session);
  localStorage.setItem('learnbridge_active_term', term);
  localStorage.setItem('learnbridge_school_name', school);    localStorage.setItem('learnbridge_announcement', announcement);
    refreshAdminAnnouncementDisplays();

  renderAdminHeader();
  showToast('success', 'Settings Saved', 'Academic session, calendar, and announcement updated successfully.');
}


/**
 * 9. Upload Learning Material (admin)
 * Same two-step flow as the staff portal: Step 1 — choose and validate a file;
 * Step 2 — "Upload Material" stores it in IndexedDB and saves the record.
 * Materials uploaded by the administrator are published immediately.
 */

const ADMIN_RESOURCE_TYPE_RULES = {
  pdf: {
    label: 'PDF Document', icon: 'bi-file-earmark-pdf',
    accept: ['application/pdf'], extensions: ['.pdf']
  },
  video: {
    label: 'Video', icon: 'bi-file-earmark-play',
    accept: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'], extensions: ['.mp4', '.webm', '.ogg', '.mov']
  },
  document: {
    label: 'Word Document', icon: 'bi-file-earmark-word',
    accept: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    extensions: ['.doc', '.docx', '.txt']
  },
  presentation: {
    label: 'Presentation', icon: 'bi-file-earmark-slides',
    accept: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    extensions: ['.ppt', '.pptx']
  },
  image: {
    label: 'Image', icon: 'bi-file-earmark-image',
    accept: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], extensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp']
  },
  other: {
    label: 'Other Material', icon: 'bi-file-earmark',
    accept: [], extensions: []
  }
};

const ADMIN_MAX_MATERIAL_SIZE = 100 * 1024 * 1024; // 100 MB upload cap

let adminMaterialFile = null;      // { file, previewUrl } while choosing a file
let adminThumbnailDataUrl = null;
let adminUploadInProgress = false;

function detectAdminResourceTypeFromFile(file) {
  const name = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();
  for (const [typeId, rule] of Object.entries(ADMIN_RESOURCE_TYPE_RULES)) {
    if (typeId === 'other') continue;
    const mimeOk = rule.accept.includes(mime);
    const extOk = rule.extensions.some(ext => name.endsWith(ext));
    if (mimeOk || extOk) return typeId;
  }
  return 'other';
}

/** Open the upload modal with a clean form. */
function openAdminUploadModal() {
  resetAdminUploadFormState();
  updateAdminUploadClasses();
  new bootstrap.Modal(document.getElementById('adminUploadMaterialModal')).show();
}

/** Class dropdown — all catalogue classes for the chosen level + department. */
function updateAdminUploadClasses(level) {
  const sel = document.getElementById('admin-upload-class');
  if (!sel) return;

  const lv = (level === undefined || level === null)
    ? (document.getElementById('admin-upload-level')?.value || '')
    : level;
  const dep = document.getElementById('admin-upload-department')?.value || '';

  let classes = (Access.CLASS_CATALOGUE || []).map(c => c.name);
  if (lv) classes = classes.filter(c => Access.levelOf(c) === lv);
  if (dep) classes = classes.filter(c => Access.departmentOf(c) === dep);

  sel.innerHTML = classes.length
    ? '<option value="">Select class…</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('')
    : '<option value="">No classes for this selection</option>';

  updateAdminResourceSubmitState();
}

/** Resource Type select changed → adjust accept list + video link visibility. */
function handleAdminResourceTypeChanged() {
  const typeId = document.getElementById('admin-upload-type').value;
  const input = document.getElementById('admin-upload-file-input');
  const rule = ADMIN_RESOURCE_TYPE_RULES[typeId];

  if (input) {
    if (rule && rule.extensions.length > 0) {
      input.accept = rule.extensions.join(',') + (typeId === 'other' ? ',.mp4,.pdf,.docx,.pptx,.xlsx,.png,.jpg' : '');
    } else {
      input.accept = '';
    }
  }
  updateAdminVideoUrlVisibility();
}

function updateAdminVideoUrlVisibility() {
  const typeId = document.getElementById('admin-upload-type').value;
  const section = document.getElementById('admin-video-url-section');
  if (section) section.classList.toggle('d-none', typeId !== 'video');
  updateAdminResourceSubmitState();
}

/**
 * Step 1 of the two-step upload — validate the chosen file and show its details.
 * The file is held in memory only; it is written to storage when the admin
 * clicks "Upload Material".
 */
function handleAdminMaterialFileSelected(input) {
  clearAdminMaterialFileError();
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];

  const detectedType = detectAdminResourceTypeFromFile(file);

  // Auto-recognize the file type where possible.
  if (document.getElementById('admin-upload-type').value === 'other' && detectedType !== 'other') {
    document.getElementById('admin-upload-type').value = detectedType;
    updateAdminVideoUrlVisibility();
  }

  const typeId = document.getElementById('admin-upload-type').value;
  const rule = ADMIN_RESOURCE_TYPE_RULES[typeId] || ADMIN_RESOURCE_TYPE_RULES.other;
  const name = (file.name || '').toLowerCase();

  // Validate the file type against the selected resource type (soft check for "other").
  if (typeId !== 'other' && rule.extensions.length > 0) {
    const extOk = rule.extensions.some(ext => name.endsWith(ext));
    const mimeOk = file.type && rule.accept.includes(file.type);
    if (!extOk && !mimeOk) {
      abortAdminMaterialSelection(`Unsupported file for "${rule.label}". Expected ${rule.extensions.join(', ')} — selected "${file.name}".`, input);
      return;
    }
  }

  // Validate the file size.
  if (file.size > ADMIN_MAX_MATERIAL_SIZE) {
    abortAdminMaterialSelection(`File is too large (${FileStore.formatSize(file.size)}). The maximum allowed size is 100 MB.`, input);
    return;
  }

  if (file.size === 0) {
    abortAdminMaterialSelection('The selected file is empty and may be corrupted. Please choose a valid file.', input);
    return;
  }

  revokeAdminMaterialPreview();
  adminMaterialFile = {
    file: file,
    detectedType: detectedType,
    previewUrl: (file.type.startsWith('image/') || file.type.startsWith('video/'))
      ? URL.createObjectURL(file) : null
  };

  showAdminMaterialFileSummary(file.name, FileStore.formatSize(file.size), detectedType, adminMaterialFile.previewUrl);
  updateAdminResourceSubmitState();
}

/** Reject an invalid selection without leaving a stale summary behind. */
function abortAdminMaterialSelection(message, input) {
  clearAdminMaterialFileSelection();
  if (input) input.value = '';
  showAdminMaterialFileError(message);
  updateAdminResourceSubmitState();
}

function revokeAdminMaterialPreview() {
  if (adminMaterialFile && adminMaterialFile.previewUrl) {
    try { URL.revokeObjectURL(adminMaterialFile.previewUrl); } catch (e) { /* not critical */ }
  }
}

/** Show the selected filename, type, size and (where possible) a preview. */
function showAdminMaterialFileSummary(name, size, typeId, previewUrl) {
  document.getElementById('admin-material-file-summary').classList.remove('d-none');
  document.getElementById('admin-material-file-name').textContent = name;
  document.getElementById('admin-material-file-size').textContent = size || '';

  const rule = ADMIN_RESOURCE_TYPE_RULES[typeId] || ADMIN_RESOURCE_TYPE_RULES.other;
  const typeEl = document.getElementById('admin-material-file-type');
  if (typeEl) typeEl.textContent = rule.label;

  const prev = document.getElementById('admin-material-file-preview');
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
function changeAdminMaterialFile() {
  const input = document.getElementById('admin-upload-file-input');
  if (!input) return;
  input.value = '';
  input.click();
}

function clearAdminMaterialFileSelection() {
  revokeAdminMaterialPreview();
  adminMaterialFile = null;
  const input = document.getElementById('admin-upload-file-input');
  if (input) input.value = '';
  document.getElementById('admin-material-file-summary').classList.add('d-none');
  const prev = document.getElementById('admin-material-file-preview');
  if (prev) { prev.classList.add('d-none'); prev.innerHTML = ''; }
  clearAdminMaterialFileError();
  updateAdminResourceSubmitState();
}

function showAdminMaterialFileError(message) {
  const box = document.getElementById('admin-material-file-error');
  document.getElementById('admin-material-file-error-text').textContent = message;
  box.classList.remove('d-none');
}

function clearAdminMaterialFileError() {
  const box = document.getElementById('admin-material-file-error');
  if (box) box.classList.add('d-none');
}

function setAdminMaterialProgressVisible(visible) {
  document.getElementById('admin-material-progress-wrap').classList.toggle('d-none', !visible);
  if (!visible) {
    const bar = document.getElementById('admin-material-progress-bar');
    bar.style.width = '0%';
    document.getElementById('admin-material-progress-percent').textContent = '0%';
  }
}

function setAdminMaterialProgress(percent) {
  document.getElementById('admin-material-progress-bar').style.width = `${percent}%`;
  document.getElementById('admin-material-progress-percent').textContent = `${percent}%`;
}

function handleAdminThumbnailSelected(input) {
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
    adminThumbnailDataUrl = dataUrl;
    renderAdminThumbnailPreview(dataUrl);
  }).catch(() => showToast('error', 'Thumbnail Error', 'Could not read the selected image.'));
}

function renderAdminThumbnailPreview(dataUrl) {
  const box = document.getElementById('admin-thumbnail-preview-box');
  box.innerHTML = `<img src="${dataUrl}" class="w-100 h-100 rounded" style="object-fit:cover;" alt="Thumbnail preview">`;
  document.getElementById('admin-thumbnail-remove-btn').classList.remove('d-none');
}

function clearAdminThumbnailSelection() {
  adminThumbnailDataUrl = null;
  const box = document.getElementById('admin-thumbnail-preview-box');
  box.innerHTML = '<i class="bi bi-image text-muted fs-4"></i>';
  document.getElementById('admin-thumbnail-remove-btn').classList.add('d-none');
  const input = document.getElementById('admin-upload-thumbnail-input');
  if (input) input.value = '';
}

function resetAdminUploadFormState() {
  revokeAdminMaterialPreview();
  adminMaterialFile = null;
  adminThumbnailDataUrl = null;
  document.getElementById('form-admin-upload-material').reset();
  clearAdminMaterialFileSelection();
  clearAdminThumbnailSelection();
  setAdminMaterialProgressVisible(false);
  updateAdminVideoUrlVisibility();
  const label = document.getElementById('admin-upload-resource-submit-label');
  if (label) label.textContent = 'Upload Material';
  updateAdminResourceSubmitState();
}

/** Lock the upload button and switch its label while the file is being stored. */
function setAdminResourceUploadBusy(busy) {
  adminUploadInProgress = busy;
  const btn = document.getElementById('admin-upload-resource-submit');
  const label = document.getElementById('admin-upload-resource-submit-label');
  if (btn) btn.disabled = busy;
  if (label) label.textContent = busy ? 'Uploading Material…' : 'Upload Material';
  if (!busy) updateAdminResourceSubmitState();
}

/**
 * Step 2 gate — the "Upload Material" button stays disabled until a valid file
 * (or a video link) AND all required information are supplied.
 */
function updateAdminResourceSubmitState() {
  const btn = document.getElementById('admin-upload-resource-submit');
  if (!btn) return;

  const label = document.getElementById('admin-upload-resource-submit-label');
  const hint = document.getElementById('admin-upload-submit-hint');

  if (adminUploadInProgress) {
    btn.disabled = true;
    if (label) label.textContent = 'Uploading…';
    return;
  }

  if (label) label.textContent = 'Upload Material';

  const title = (document.getElementById('admin-upload-title')?.value || '').trim();
  const cls = document.getElementById('admin-upload-class')?.value || '';
  const subject = (document.getElementById('admin-upload-subject')?.value || '').trim();
  const desc = (document.getElementById('admin-upload-summary')?.value || '').trim();
  const typeId = document.getElementById('admin-upload-type')?.value || 'pdf';
  const videoUrl = (document.getElementById('admin-upload-video-url')?.value || '').trim();

  const hasFile = !!(adminMaterialFile && adminMaterialFile.file);
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

/**
 * Publish the material: validates the form, stores the binary material in
 * IndexedDB with progress feedback, then saves the JSON record. Admin uploads
 * are approved immediately (status: 'published').
 */
function handleAdminMaterialUploadSubmit(e) {
  e.preventDefault();

  // One upload at a time — a double click can never create duplicate resources.
  if (adminUploadInProgress) return;

  const title = document.getElementById('admin-upload-title').value.trim();
  const level = document.getElementById('admin-upload-level').value;
  const cls = document.getElementById('admin-upload-class').value;
  const department = document.getElementById('admin-upload-department')?.value || Access.departmentOf(cls);
  const subject = document.getElementById('admin-upload-subject').value.trim();
  const topic = document.getElementById('admin-upload-topic').value.trim();
  const typeId = document.getElementById('admin-upload-type').value;
  const summary = document.getElementById('admin-upload-summary').value.trim();
  const content = document.getElementById('admin-upload-content').value.trim();
  const videoUrl = (document.getElementById('admin-upload-video-url')?.value || '').trim();

  const isNewFile = !!(adminMaterialFile && adminMaterialFile.file);

  if (!title || !cls || !subject || !summary) {
    showToast('warning', 'Missing Information', 'Please complete the title, class, subject and description.');
    return;
  }

  const classDept = Access.departmentOf(cls);
  if (classDept && department && classDept !== department) {
    showToast('error', 'Department Mismatch', `${cls} belongs to the ${classDept} department, not ${department}.`);
    return;
  }

  // Step 2: a material is required unless it is a video with an external link.
  if (!isNewFile && !(typeId === 'video' && videoUrl)) {
    showToast('error', 'Material Required', 'Please choose the material file (or paste a video link for video materials).');
    return;
  }

  setAdminResourceUploadBusy(true);

  const finishSave = (materialInfo) => {
    try {
      const resource = {
        id: `res-${Date.now()}`,
        title: title,
        level: level || Access.levelOf(cls),
        class: cls,
        department: department || classDept,
        subject: subject,
        topic: topic,
        typeId: typeId,
        type: ADMIN_RESOURCE_TYPE_RULES[typeId] ? ADMIN_RESOURCE_TYPE_RULES[typeId].label : typeId,
        description: summary,
        content: content,
        estimatedTime: '15 mins',
        uploader: currentAdmin?.name || 'School Administrator',
        uploaderId: currentAdmin?.id,
        uploaderRole: 'admin',
        uploaderDepartment: currentAdmin?.department || '',
        uploaderClasses: ['All Classes'],
        author: currentAdmin?.name || 'School Administrator',
        // Admin uploads bypass the approval queue — published straight away.
        status: 'published',
        approved: true,
        approvedBy: 'School Administrator',
        approvedAt: new Date().toISOString(),
        dateAdded: new Date().toISOString(),
        uploadedAt: new Date().toISOString()
      };

      if (materialInfo) {
        resource.materialKey = materialInfo.materialKey;
        resource.fileName = materialInfo.fileName;
        resource.fileSize = materialInfo.fileSize;
        resource.mimeType = materialInfo.mimeType;
        resource.videoUrl = '';
      } else if (typeId === 'video' && videoUrl) {
        resource.videoUrl = videoUrl;
        resource.fileName = '';
        resource.fileSize = '';
        resource.mimeType = '';
      }

      if (adminThumbnailDataUrl) {
        resource.thumbnail = adminThumbnailDataUrl;
      }

      if (!appState.resources) appState.resources = [];
      appState.resources.unshift(resource);
      saveAppData(appState);

      const modalEl = document.getElementById('adminUploadMaterialModal');
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();

      resetAdminUploadFormState();
      renderAdminKPIs();
      renderAdminResources();
      renderAdminApprovalQueue();
      refreshStaffDashboardViews();

      showToast('success', 'Material Published',
        `"${title}" (${subject}, ${cls}) was uploaded successfully and is now available to students.`);
    } finally {
      setAdminResourceUploadBusy(false);
    }
  };

  if (isNewFile) {
    const file = adminMaterialFile.file;
    const materialKey = `material_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setAdminMaterialProgressVisible(true);
    FileStore.readWithProgress(file, setAdminMaterialProgress)
      .then(() => FileStore.saveMaterial(materialKey, file))
      .then(() => {
        setAdminMaterialProgressVisible(false);
        finishSave({
          materialKey,
          fileName: file.name,
          fileSize: FileStore.formatSize(file.size),
          mimeType: file.type || 'application/octet-stream'
        });
      })
      .catch(err => {
        setAdminMaterialProgressVisible(false);
        FileStore.deleteMaterial(materialKey);
        setAdminResourceUploadBusy(false);
        showToast('error', 'Upload failed. Please try again.', err.message || 'The material could not be stored.');
      });
  } else {
    finishSave(null);
  }
}

// Live-enable the submit button as the admin fills the form.
document.addEventListener('input', (e) => {
  if (document.getElementById('admin-upload-resource-submit') &&
      e.target && e.target.closest && e.target.closest('#form-admin-upload-material')) {
    updateAdminResourceSubmitState();
  }
});

/**
 * 10. Toast Notification System
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
 * Sidebar sections — Classes, Subjects, Assignments & Announcements.
 * All read-only views over the existing school catalogue and resources.
 */
function escapeHtmlAdmin(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAdminSidebarSections() {
  // ── Classes catalogue with live enrolment counts ──
  const classesEl = document.getElementById('admin-classes-list');
  if (classesEl) {
    const classes = appState.classes || [];
    classesEl.innerHTML = classes.length === 0
      ? '<p class="text-sm text-muted mb-0">No classes configured.</p>'
      : `<div class="row g-2">${classes.map(c => {
          const count = (appState.students || []).filter(s => s.class === c.name).length;
          return `
            <div class="col-6 col-md-4 col-lg-3">
              <div class="p-3 h-100 rounded" style="background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.16);">
                <div class="fw-bold text-sm text-white">${escapeHtmlAdmin(c.name)}</div>
                <div class="text-xs text-muted mt-1"><i class="bi bi-mortarboard me-1"></i>${count} student${count === 1 ? '' : 's'}</div>
              </div>
            </div>
          `;
        }).join('')}</div>`;
  }

  // ── Subjects catalogue grouped by level ──
  const subjectsEl = document.getElementById('admin-subjects-list');
  if (subjectsEl) {
    const levelSubjects = appState.levelSubjects || {};
    const levelNames = { jss: 'Junior Secondary (JSS)', sss: 'Senior Secondary (SSS)' };
    subjectsEl.innerHTML = Object.keys(levelSubjects).map(levelId => `
      <div class="mb-3">
        <div class="text-xs text-teal fw-bold text-uppercase mb-2">${escapeHtmlAdmin(levelNames[levelId] || levelId)}</div>
        <div class="d-flex flex-wrap gap-2">
          ${(levelSubjects[levelId] || []).map(s => `
            <span class="badge text-light" style="background:${s.color || '#334155'};">${escapeHtmlAdmin(s.name)}</span>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // ── Assignments overview (published assignment resources across teachers) ──
  const assignmentsEl = document.getElementById('admin-assignments-list');
  if (assignmentsEl) {
    const assignments = (appState.resources || []).filter(r =>
      r.status === 'published' && r.approved !== false && r.isAssignment);
    if (assignments.length === 0) {
      assignmentsEl.innerHTML = `
        <div class="text-center py-4">
          <i class="bi bi-journal-check fs-1 text-muted d-block mb-2"></i>
          <p class="text-sm text-muted mb-0">No assignments published yet. Teachers' assignment materials will appear here.</p>
        </div>
      `;
    } else {
      assignmentsEl.innerHTML = assignments.map(a => `
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 p-3 mb-2 rounded" style="background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.16);">
          <div>
            <div class="fw-bold text-sm text-white">${escapeHtmlAdmin(a.title || 'Untitled assignment')}</div>
            <div class="text-xs text-muted mt-1">
              ${a.subject ? `<span class="me-2"><i class="bi bi-book me-1"></i>${escapeHtmlAdmin(a.subject)}</span>` : ''}
              ${a.class ? `<span class="me-2"><i class="bi bi-people me-1"></i>${escapeHtmlAdmin(a.class)}</span>` : ''}
              ${a.uploadedBy ? `<span><i class="bi bi-person me-1"></i>${escapeHtmlAdmin(a.uploadedBy)}</span>` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }
  }
}

/**
 * Announcements display + live refresh after settings are saved.
 * Called at init and again by saveSchoolSettings() so the sidebar
 * section always matches what students and teachers see.
 */
function refreshAdminAnnouncementDisplays() {
  const el = document.getElementById('admin-announcement-display');
  if (!el) return;
  const announcement = (localStorage.getItem('learnbridge_announcement') || '').trim();
  el.innerHTML = announcement
    ? `
      <div class="p-3 rounded d-flex align-items-start gap-3" style="background:rgba(13,148,136,0.1);border:1px solid rgba(13,148,136,0.3);">
        <i class="bi bi-megaphone-fill text-teal fs-4 mt-1"></i>
        <div>
          <strong class="text-white text-sm d-block mb-1">Principal's Notice (live broadcast)</strong>
          <span class="text-light text-sm">${escapeHtmlAdmin(announcement)}</span>
        </div>
      </div>
    `
    : `
      <div class="text-center py-4">
        <i class="bi bi-megaphone fs-1 text-muted d-block mb-2"></i>
        <p class="text-sm text-muted mb-0">No announcement is being broadcast. Configure one under Settings above.</p>
      </div>
    `;
}
