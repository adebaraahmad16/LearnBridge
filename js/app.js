/**
 * LearnBridge — Main Application Script
 * Clean, Simple & Modern EdTech Portal for Amule Government Secondary School
 * Features:
 *  - Clear Tabbed Navigation (Lessons, CBT Mock Exams, Student Profile, Staff Portal)
 *  - 1-Click Level & Dynamic Subject Filtering
 *  - Full-Featured CBT Mock Exam Engine (JAMB, WAEC, BECE, Common Entrance)
 *  - Clean Student Profile Management & Account Switcher
 *  - Zero Emojis throughout all views
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─── App State ─────────────────────────────────────────────────────────────
  let appState = getAppData();

  // Active CBT Exam runtime state
  let activeCbt = {
    examType: null,
    examData: null,
    currentIndex: 0,
    answers: {},       // { questionId: selectedOptionIndex }
    flags: {},         // { questionId: boolean }
    remainingSeconds: 0,
    timerInterval: null,
    isSubmitted: false
  };

  // Calculator State
  let calcExpression = '0';

  // ─── Initialise System ─────────────────────────────────────────────────────
  initStudentAuth();
  initDataSaverMode();
  initSearchAndFilters();
  initTeacherUploadForm();
  initCbtKeyboardShortcuts();
  renderSubjectTags(appState.userStats.level || 'jss');
  renderAllViews();

  // ════════════════════════════════════════════════════════════════════════════
  // 1. SIMPLE MAIN TAB SWITCHING
  // ════════════════════════════════════════════════════════════════════════════
  window.switchMainTab = function (tabName) {
    const validTabs = ['lessons', 'cbt', 'profile', 'staff'];
    if (!validTabs.includes(tabName)) tabName = 'lessons';

    // Hide all sections
    document.querySelectorAll('.main-section').forEach(sec => sec.classList.add('d-none'));

    // Show selected section
    const target = document.getElementById(`section-${tabName}`);
    if (target) target.classList.remove('d-none');

    // Update nav buttons
    document.querySelectorAll('.main-nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-tab-${tabName}`);
    if (activeBtn) activeBtn.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 2. TOAST NOTIFICATIONS
  // ════════════════════════════════════════════════════════════════════════════
  window.showToast = function (type = 'info', title = '', message = '', durationMs = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = {
      success: 'bi-check-circle-fill',
      info:    'bi-info-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      error:   'bi-x-circle-fill',
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
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 3. STUDENT PROFILE & AUTHENTICATION
  // ════════════════════════════════════════════════════════════════════════════
  function initStudentAuth() {
    renderQuickStudentList();
    syncCurrentStudentUI();
  }

  function renderQuickStudentList() {
    const listContainers = [
      document.getElementById('student-quick-list'),
      document.getElementById('modal-quick-student-list')
    ];

    listContainers.forEach(list => {
      if (!list) return;

      list.innerHTML = (appState.students || []).map(s => {
        const isActive = s.id === appState.currentStudentId;
        return `
          <div class="col-md-6">
            <div class="student-select-card ${isActive ? 'active-student' : ''}" onclick="switchStudent('${s.id}')">
              <div class="avatar-box">
                <img src="${s.avatar}" alt="${s.name}">
              </div>
              <div class="flex-grow-1 text-truncate">
                <div class="d-flex align-items-center justify-content-between">
                  <span class="fw-bold text-sm text-truncate">${s.name}</span>
                  ${isActive ? '<span class="badge" style="background:#059669;font-size:0.65rem;">Active</span>' : ''}
                </div>
                <div class="text-xs text-teal font-monospace">${s.admissionNo}</div>
                <div class="d-flex align-items-center gap-2 text-xs" style="color:var(--text-subtle);">
                  <span>${s.class}</span> &bull; <span>${s.points} pts</span> &bull; <span>${s.streakDays}d streak</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    });
  }

  window.switchStudent = function (studentId) {
    const student = appState.students.find(s => s.id === studentId);
    if (!student) return;

    appState.currentStudentId = student.id;
    appState.userStats = {
      name: student.name,
      admissionNo: student.admissionNo,
      class: student.class,
      level: student.level,
      streakDays: student.streakDays,
      points: student.points,
      completedResourcesCount: student.completedResourcesCount,
      quizzesTakenCount: student.quizzesTakenCount,
      cbtExamsTakenCount: student.cbtExamsTakenCount || 0,
      cbtBestScore: student.cbtBestScore || 0
    };

    saveAppData(appState);
    syncCurrentStudentUI();
    renderQuickStudentList();

    // Auto set level pill
    selectLevelPill(student.level || 'jss');

    // Close modal if open
    const modalEl = document.getElementById('studentLoginModal');
    if (modalEl) {
      const bsModal = bootstrap.Modal.getInstance(modalEl);
      if (bsModal) bsModal.hide();
    }

    renderAllViews();
    showToast('info', 'Switched Student Account', `Active: ${student.name} (${student.class})`);
  };

  function syncCurrentStudentUI() {
    const s = appState.userStats;
    const student = appState.students.find(st => st.id === appState.currentStudentId) || appState.students[0];

    // Navbar chip
    setText('nav-student-name', s.name);
    setText('nav-student-class', `${s.class} · Switch`);
    const avatar = document.getElementById('nav-student-avatar');
    if (avatar && student) avatar.src = student.avatar;

    // Hero Greetings
    setText('hero-student-greeting', `Welcome back, ${s.name.split(' ')[0]}`);
    setText('hero-student-class', `${s.class} Student`);
    setText('hero-student-streak', `${s.streakDays}-Day Streak`);

    // Profile Page Card
    setText('profile-card-name', s.name);
    setText('profile-card-adm', s.admissionNo || 'N/A');
    setText('profile-card-class', `${s.class} · ${getLevelFullName(s.level)}`);
    const profAvatar = document.getElementById('profile-card-avatar');
    if (profAvatar && student) profAvatar.src = student.avatar;

    // Stats
    setText('user-streak-text', s.streakDays);
    setText('user-points-text', s.points);
    setText('user-lessons-done', s.completedResourcesCount || 0);
  }

  function getLevelFullName(lvl) {
    const map = {
      jss: 'Junior Secondary (JSS 1–3)',
      sss: 'Senior Secondary (SS 1–3)'
    };
    return map[lvl] || 'Secondary School';
  }

  window.openStudentLoginModal = function () {
    renderQuickStudentList();
    new bootstrap.Modal(document.getElementById('studentLoginModal')).show();
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 4. 1-CLICK LEVEL PILLS & DYNAMIC SUBJECT TAGS
  // ════════════════════════════════════════════════════════════════════════════
  window.selectLevelPill = function (levelId) {
    document.querySelectorAll('.level-pill-item').forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-level') === levelId);
    });

    const hiddenLvl = document.getElementById('filter-level');
    if (hiddenLvl) hiddenLvl.value = levelId;

    // Reset subject filter to all
    const hiddenSub = document.getElementById('filter-subject');
    if (hiddenSub) hiddenSub.value = 'all';

    renderSubjectTags(levelId);
    renderLibraryResources();
  };

  window.selectSubjectTag = function (subjectId) {
    document.querySelectorAll('.subject-tag-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-subject') === subjectId);
    });

    const hiddenSub = document.getElementById('filter-subject');
    if (hiddenSub) hiddenSub.value = subjectId;

    renderLibraryResources();
  };

  function renderSubjectTags(levelId = 'all') {
    const container = document.getElementById('subject-tags-container');
    if (!container) return;

    let availableSubjects = [];
    if (levelId === 'all') {
      availableSubjects = appState.subjects || [];
    } else if (appState.levelSubjects && appState.levelSubjects[levelId]) {
      availableSubjects = appState.levelSubjects[levelId];
    } else {
      availableSubjects = appState.subjects || [];
    }

    const currentSubVal = document.getElementById('filter-subject')?.value || 'all';

    container.innerHTML = `
      <button class="subject-tag-btn ${currentSubVal === 'all' ? 'active' : ''}" data-subject="all" onclick="selectSubjectTag('all')">
        All Subjects (${availableSubjects.length})
      </button>
    ` + availableSubjects.map(sub => `
      <button class="subject-tag-btn ${currentSubVal === sub.id ? 'active' : ''}" data-subject="${sub.id}" onclick="selectSubjectTag('${sub.id}')">
        ${sub.name}
      </button>
    `).join('');
  }

  function initSearchAndFilters() {
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', renderLibraryResources);
    }

    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        selectLevelPill('all');
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 5. DATA SAVER MODE
  // ════════════════════════════════════════════════════════════════════════════
  function initDataSaverMode() {
    const btn = document.getElementById('toggle-data-saver');
    if (!btn) return;

    function apply(on) {
      document.body.classList.toggle('data-saver-enabled', on);
      btn.classList.toggle('active', on);
    }

    apply(appState.dataSaverMode);

    btn.addEventListener('click', () => {
      appState.dataSaverMode = !appState.dataSaverMode;
      saveAppData(appState);
      apply(appState.dataSaverMode);
      showToast(
        'info',
        appState.dataSaverMode ? 'Data Saver ON' : 'Data Saver OFF',
        appState.dataSaverMode
          ? 'Heavy media hidden. Text notes & offline worksheets available.'
          : 'Full multimedia restored.'
      );
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 6. MASTER RENDER
  // ════════════════════════════════════════════════════════════════════════════
  function renderAllViews() {
    syncCurrentStudentUI();
    renderLibraryResources();
    renderExamPreps();
    renderTeacherResources();
    renderAdminPendingQueue();
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── Digital Library Resource Grid ─────────────────────────────────────────
  function renderLibraryResources() {
    const container = document.getElementById('library-resource-grid');
    if (!container) return;

    const query   = (document.getElementById('global-search-input')?.value || '').toLowerCase().trim();
    const level   = document.getElementById('filter-level')?.value   || 'all';
    const subject = document.getElementById('filter-subject')?.value || 'all';

    let items = (appState.resources || []).filter(r => r.status === 'published');

    if (query) {
      items = items.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.topic.toLowerCase().includes(query) ||
        r.subject.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query)
      );
    }

    if (level   !== 'all') items = items.filter(r => r.level     === level);
    if (subject !== 'all') items = items.filter(r => r.subjectId === subject);

    if (items.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-5">
          <i class="bi bi-folder-x" style="font-size:2.5rem;color:var(--text-subtle);"></i>
          <h5 class="fw-bold mt-3">No Lessons Found</h5>
          <p class="text-sm" style="color:var(--text-muted);">Try selecting "All Levels" or clearing your search term.</p>
        </div>`;
      return;
    }

    container.innerHTML = items.map(res => `
      <div class="col-md-6 col-lg-4">
        <div class="hub-card d-flex flex-column justify-content-between" style="height:100%;">
          <div>
            <div class="d-flex flex-wrap align-items-center gap-1 mb-2">
              <span class="badge-level">${res.class}</span>
              <span class="badge-subject">${res.subject}</span>
              <span class="badge-difficulty difficulty-${res.difficulty.toLowerCase()}">${res.difficulty}</span>
            </div>
            <h5 class="fw-bold mb-2 text-clamp-2">${res.title}</h5>
            <p class="text-sm text-clamp-3 mb-3" style="color:var(--text-muted);">${res.description}</p>
          </div>
          <div>
            <div class="d-flex align-items-center justify-content-between text-xs mb-3" style="color:var(--text-subtle);border-top:1px solid var(--border-subtle);padding-top:0.75rem;">
              <span><i class="bi bi-person me-1"></i>${res.uploader}</span>
              <span><i class="bi bi-clock me-1"></i>${res.estimatedTime}</span>
            </div>
            <div class="d-flex gap-2">
              <button class="btn-hub-primary flex-grow-1 text-xs" onclick="openResourceModal('${res.id}')">
                <i class="bi bi-book-half me-1"></i> Read Lesson
              </button>
              ${res.quizId ? `
                <button class="btn-hub-outline text-xs" onclick="openQuizRunner('${res.quizId}')" title="Take Practice Quiz" style="padding:0.55rem 0.75rem;">
                  <i class="bi bi-question-circle" style="color:var(--clr-amber-400);"></i> Quiz
                </button>` : ''}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // ─── CBT Exam Center Grid ──────────────────────────────────────────────────
  function renderExamPreps() {
    const container = document.getElementById('exam-prep-grid');
    if (!container) return;

    const accentColors = {
      JAMB:    { bg: 'rgba(245,158,11,0.18)', color: '#fbbf24', border: 'rgba(245,158,11,0.4)', btn: '#d97706' },
      WAEC:    { bg: 'rgba(16,185,129,0.18)', color: '#34d399', border: 'rgba(16,185,129,0.4)', btn: '#059669' },
      BECE:    { bg: 'rgba(79,70,229,0.18)',  color: '#818cf8', border: 'rgba(79,70,229,0.4)', btn: '#4f46e5' },
      PRIMARY: { bg: 'rgba(13,148,136,0.18)', color: '#2dd4bf', border: 'rgba(13,148,136,0.4)', btn: '#0d9488' }
    };

    container.innerHTML = (appState.examPreps || []).map(exam => {
      const clr = accentColors[exam.examType] || accentColors.BECE;
      return `
        <div class="col-md-6 col-lg-3">
          <div class="hub-card exam-prep-card h-100 d-flex flex-column justify-content-between" style="border-color:${clr.border};">
            <div>
              <div class="d-flex align-items-center justify-content-between mb-3">
                <span class="status-badge" style="background:${clr.bg};color:${clr.color};border:1px solid ${clr.border};">${exam.examType} CBT</span>
                <span class="text-xs" style="color:var(--text-subtle);">${exam.practiceSetsCount} Mocks</span>
              </div>
              <h5 class="fw-bold mb-2">${exam.title}</h5>
              <p class="text-sm mb-3" style="color:var(--text-muted);">${exam.description}</p>
              <div class="mb-4">
                <span class="text-xs fw-bold mb-2 d-block" style="color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">Featured Subjects</span>
                <div class="d-flex flex-wrap gap-1">
                  ${exam.featuredTopics.slice(0, 4).map(t => `<span class="badge-dark text-xs">${t}</span>`).join('')}
                </div>
              </div>
            </div>
            <button class="btn-hub-primary w-100" style="background:${clr.btn};border-color:${clr.color};" onclick="startExamMock('${exam.examType}')">
              <i class="bi bi-pencil-square me-1"></i> Start CBT Mock Test
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 7. CBT MOCK EXAM ENGINE
  // ════════════════════════════════════════════════════════════════════════════
  window.startExamMock = function (examType) {
    const bank = (appState.cbtQuestionBanks && appState.cbtQuestionBanks[examType])
      ? appState.cbtQuestionBanks[examType]
      : appState.cbtQuestionBanks['JAMB'];

    if (!bank) {
      showToast('error', 'CBT Unavailable', 'Exam questions not found.');
      return;
    }

    activeCbt = {
      examType: examType,
      examData: bank,
      currentIndex: 0,
      answers: {},
      flags: {},
      remainingSeconds: (bank.durationMinutes || 15) * 60,
      timerInterval: null,
      isSubmitted: false
    };

    setText('cbt-exam-title', bank.examTitle);
    setText('cbt-candidate-name', `Candidate: ${appState.userStats.name} (${appState.userStats.admissionNo || 'N/A'})`);
    setText('cbt-candidate-class', appState.userStats.class);

    restoreCbtExamLayout();
    startCbtTimer();
    renderCbtQuestion();
    renderCbtPalette();

    new bootstrap.Modal(document.getElementById('cbtExamModal')).show();
    showToast('info', `${examType} CBT Exam Started`, `Duration: ${bank.durationMinutes} minutes.`);
  };

  function restoreCbtExamLayout() {
    const container = document.getElementById('cbt-modal-body-container');
    if (!container) return;

    container.innerHTML = `
      <div class="row g-3">
        <!-- Question Column -->
        <div class="col-lg-8">
          <div class="cbt-question-box h-100 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3 pb-2" style="border-bottom:1px solid var(--border-subtle);">
                <div class="d-flex align-items-center gap-2">
                  <span class="badge-subject" id="cbt-q-subject">Subject</span>
                  <span class="badge-dark" id="cbt-q-topic">Topic</span>
                </div>
                <div class="text-xs fw-bold" style="color:var(--clr-teal-400);" id="cbt-q-counter">
                  Question 1 of 10
                </div>
              </div>
              <div class="cbt-question-text mb-4" id="cbt-q-text" style="font-size:1.05rem;line-height:1.6;"></div>
              <div id="cbt-options-container"></div>
            </div>

            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 pt-3 mt-4" style="border-top:1px solid var(--border-subtle);">
              <div class="d-flex align-items-center gap-2">
                <button class="btn-hub-outline" id="cbt-btn-prev" onclick="prevCbtQuestion()" style="padding:0.45rem 1rem;font-size:0.85rem;">
                  <i class="bi bi-chevron-left me-1"></i> Previous
                </button>
                <button class="btn-hub-outline" id="cbt-btn-next" onclick="nextCbtQuestion()" style="padding:0.45rem 1rem;font-size:0.85rem;">
                  Next <i class="bi bi-chevron-right ms-1"></i>
                </button>
              </div>
              <div class="d-flex align-items-center gap-2">
                <button class="btn-hub-outline text-amber" id="cbt-btn-flag" onclick="toggleFlagCurrentQuestion()" style="padding:0.45rem 0.9rem;font-size:0.85rem;border-color:rgba(245,158,11,0.4);">
                  <i class="bi bi-flag me-1"></i> <span id="cbt-flag-text">Flag for Review</span>
                </button>
                <button class="btn-hub-outline" onclick="clearCurrentChoice()" style="padding:0.45rem 0.8rem;font-size:0.85rem;">
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation Palette Column -->
        <div class="col-lg-4">
          <div class="hub-card h-100 p-3" style="background:rgba(15,23,42,0.85);border:1px solid var(--border-subtle);">
            <h6 class="fw-bold mb-2 text-sm" style="color:var(--text-primary);">
              <i class="bi bi-grid-3x3-gap-fill me-1 text-teal"></i> Question Navigation
            </h6>
            <div class="d-flex flex-wrap justify-content-between text-xs mb-3 p-2 rounded" style="background:rgba(30,41,59,0.5);border:1px solid var(--border-subtle);">
              <div><span class="badge" style="background:#059669;width:10px;height:10px;display:inline-block;padding:0;border-radius:50%;margin-right:4px;"></span> <span id="cbt-stat-answered">0</span> Answered</div>
              <div><span class="badge" style="background:#d97706;width:10px;height:10px;display:inline-block;padding:0;border-radius:50%;margin-right:4px;"></span> <span id="cbt-stat-flagged">0</span> Flagged</div>
              <div><span class="badge" style="background:rgba(100,116,139,0.5);width:10px;height:10px;display:inline-block;padding:0;border-radius:50%;margin-right:4px;"></span> <span id="cbt-stat-unanswered">0</span> Left</div>
            </div>
            <div class="cbt-palette-grid mb-3" id="cbt-palette-grid"></div>
            <div class="p-2 rounded text-xs" style="background:rgba(13,148,136,0.08);border:1px dashed var(--border-teal);color:var(--text-muted);">
              <div class="fw-bold text-teal mb-1">Keyboard Shortcuts:</div>
              <span><strong>A, B, C, D:</strong> Select option &bull; <strong>N:</strong> Next &bull; <strong>P:</strong> Prev &bull; <strong>F:</strong> Flag</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function startCbtTimer() {
    if (activeCbt.timerInterval) clearInterval(activeCbt.timerInterval);

    const timerBadge = document.getElementById('cbt-timer-display');
    const timerText  = document.getElementById('cbt-timer-text');

    function updateDisplay() {
      const mins = Math.floor(activeCbt.remainingSeconds / 60);
      const secs = activeCbt.remainingSeconds % 60;
      if (timerText) {
        timerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }

      if (timerBadge) {
        if (activeCbt.remainingSeconds <= 120) {
          timerBadge.classList.add('cbt-timer-warning');
        } else {
          timerBadge.classList.remove('cbt-timer-warning');
        }
      }
    }

    updateDisplay();

    activeCbt.timerInterval = setInterval(() => {
      if (activeCbt.remainingSeconds > 0) {
        activeCbt.remainingSeconds--;
        updateDisplay();
      } else {
        clearInterval(activeCbt.timerInterval);
        showToast('warning', 'Time Expired', 'Submitting your examination automatically...');
        submitCbtExam();
      }
    }, 1000);
  }

  function renderCbtQuestion() {
    if (!activeCbt.examData) return;
    const questions = activeCbt.examData.questions;
    const q = questions[activeCbt.currentIndex];
    if (!q) return;

    setText('cbt-q-counter', `Question ${activeCbt.currentIndex + 1} of ${questions.length}`);
    setText('cbt-q-subject', q.subject);
    setText('cbt-q-topic', `Topic: ${q.topic}`);

    const qTextEl = document.getElementById('cbt-q-text');
    if (qTextEl) qTextEl.innerHTML = q.question;

    const optContainer = document.getElementById('cbt-options-container');
    if (optContainer) {
      const letters = ['A', 'B', 'C', 'D', 'E'];
      const selected = activeCbt.answers[q.id];

      optContainer.innerHTML = q.options.map((opt, idx) => `
        <div class="cbt-option-item ${selected === idx ? 'selected' : ''}" onclick="selectCbtOption(${q.id}, ${idx})">
          <div class="cbt-option-letter">${letters[idx]}</div>
          <div class="cbt-option-text flex-grow-1">${opt}</div>
        </div>
      `).join('');
    }

    const isFlagged = !!activeCbt.flags[q.id];
    const flagText = document.getElementById('cbt-flag-text');
    if (flagText) flagText.textContent = isFlagged ? 'Remove Flag' : 'Flag for Review';

    const prevBtn = document.getElementById('cbt-btn-prev');
    const nextBtn = document.getElementById('cbt-btn-next');
    if (prevBtn) prevBtn.disabled = activeCbt.currentIndex === 0;
    if (nextBtn) {
      if (activeCbt.currentIndex === questions.length - 1) {
        nextBtn.innerHTML = `Review &amp; Finish <i class="bi bi-check2 ms-1"></i>`;
      } else {
        nextBtn.innerHTML = `Next <i class="bi bi-chevron-right ms-1"></i>`;
      }
    }
  }

  function renderCbtPalette() {
    const paletteGrid = document.getElementById('cbt-palette-grid');
    if (!paletteGrid || !activeCbt.examData) return;

    const questions = activeCbt.examData.questions;
    let answeredCount = 0;
    let flaggedCount  = 0;

    paletteGrid.innerHTML = questions.map((q, idx) => {
      const isAnswered = activeCbt.answers[q.id] !== undefined;
      const isFlagged  = !!activeCbt.flags[q.id];
      const isCurrent  = idx === activeCbt.currentIndex;

      if (isAnswered) answeredCount++;
      if (isFlagged)  flaggedCount++;

      let statusClass = '';
      if (isAnswered) statusClass = 'answered';
      if (isFlagged)  statusClass = 'flagged';
      if (isCurrent)  statusClass += ' current';

      return `
        <button class="cbt-palette-btn ${statusClass}" onclick="jumpToCbtQuestion(${idx})">
          ${idx + 1}
        </button>
      `;
    }).join('');

    setText('cbt-stat-answered', answeredCount);
    setText('cbt-stat-flagged', flaggedCount);
    setText('cbt-stat-unanswered', questions.length - answeredCount);
  }

  window.selectCbtOption = function (qId, optIdx) {
    activeCbt.answers[qId] = optIdx;
    renderCbtQuestion();
    renderCbtPalette();
  };

  window.clearCurrentChoice = function () {
    const q = activeCbt.examData.questions[activeCbt.currentIndex];
    if (!q) return;
    delete activeCbt.answers[q.id];
    renderCbtQuestion();
    renderCbtPalette();
  };

  window.toggleFlagCurrentQuestion = function () {
    const q = activeCbt.examData.questions[activeCbt.currentIndex];
    if (!q) return;
    activeCbt.flags[q.id] = !activeCbt.flags[q.id];
    renderCbtQuestion();
    renderCbtPalette();
  };

  window.nextCbtQuestion = function () {
    const total = activeCbt.examData.questions.length;
    if (activeCbt.currentIndex < total - 1) {
      activeCbt.currentIndex++;
      renderCbtQuestion();
      renderCbtPalette();
    } else {
      confirmSubmitCbtExam();
    }
  };

  window.prevCbtQuestion = function () {
    if (activeCbt.currentIndex > 0) {
      activeCbt.currentIndex--;
      renderCbtQuestion();
      renderCbtPalette();
    }
  };

  window.jumpToCbtQuestion = function (idx) {
    activeCbt.currentIndex = idx;
    renderCbtQuestion();
    renderCbtPalette();
  };

  function initCbtKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const modal = document.getElementById('cbtExamModal');
      if (!modal || !modal.classList.contains('show') || activeCbt.isSubmitted) return;

      const key = e.key.toUpperCase();
      const q = activeCbt.examData?.questions[activeCbt.currentIndex];
      if (!q) return;

      if (['A', 'B', 'C', 'D'].includes(key)) {
        const idx = key.charCodeAt(0) - 65;
        if (q.options[idx]) selectCbtOption(q.id, idx);
      } else if (key === 'N') {
        nextCbtQuestion();
      } else if (key === 'P') {
        prevCbtQuestion();
      } else if (key === 'F') {
        toggleFlagCurrentQuestion();
      }
    });
  }

  window.confirmSubmitCbtExam = function () {
    if (activeCbt.isSubmitted) return;
    const questions = activeCbt.examData.questions;
    const answered  = Object.keys(activeCbt.answers).length;
    const unanswered = questions.length - answered;
    const flagged    = Object.keys(activeCbt.flags).filter(k => activeCbt.flags[k]).length;

    let warningMsg = `You have answered ${answered} of ${questions.length} questions.`;
    if (unanswered > 0) warningMsg += `\n- ${unanswered} question(s) remain unanswered.`;
    if (flagged > 0) warningMsg += `\n- ${flagged} question(s) are flagged for review.`;
    warningMsg += `\n\nDo you want to finalize and submit your test now?`;

    if (confirm(warningMsg)) {
      submitCbtExam();
    }
  };

  function submitCbtExam() {
    if (activeCbt.isSubmitted) return;
    activeCbt.isSubmitted = true;

    if (activeCbt.timerInterval) clearInterval(activeCbt.timerInterval);

    const questions = activeCbt.examData.questions;
    let correctCount = 0;
    let details = [];

    questions.forEach((q, idx) => {
      const userChoice = activeCbt.answers[q.id];
      const isCorrect = userChoice === q.correct;
      if (isCorrect) correctCount++;

      details.push({
        index: idx + 1,
        question: q.question,
        subject: q.subject,
        topic: q.topic,
        userChoice: userChoice,
        correctChoice: q.correct,
        isCorrect: isCorrect,
        options: q.options,
        explanation: q.explanation,
        isFlagged: !!activeCbt.flags[q.id]
      });
    });

    const total = questions.length;
    const pct = Math.round((correctCount / total) * 100);

    let gradeBadge = 'C4-C6 (Credit)';
    let gradeColor = '#fbbf24';

    if (pct >= 80) {
      gradeBadge = 'A1 (Distinction)';
      gradeColor = '#10b981';
    } else if (pct >= 70) {
      gradeBadge = 'B2 (Very Good)';
      gradeColor = '#2dd4bf';
    } else if (pct >= 65) {
      gradeBadge = 'B3 (Good)';
      gradeColor = '#38bdf8';
    } else if (pct >= 50) {
      gradeBadge = 'C4-C6 (Credit)';
      gradeColor = '#fbbf24';
    } else if (pct >= 40) {
      gradeBadge = 'D7-E8 (Pass)';
      gradeColor = '#f97316';
    } else {
      gradeBadge = 'F9 (Needs Support)';
      gradeColor = '#ef4444';
    }

    // Update stats
    appState.userStats.points += 100;
    appState.userStats.streakDays += 1;
    appState.userStats.cbtExamsTakenCount = (appState.userStats.cbtExamsTakenCount || 0) + 1;
    if (pct > (appState.userStats.cbtBestScore || 0)) {
      appState.userStats.cbtBestScore = pct;
    }

    const student = appState.students.find(s => s.id === appState.currentStudentId);
    if (student) {
      student.points = appState.userStats.points;
      student.streakDays = appState.userStats.streakDays;
      student.cbtExamsTakenCount = appState.userStats.cbtExamsTakenCount;
      student.cbtBestScore = appState.userStats.cbtBestScore;
    }

    saveAppData(appState);
    syncCurrentStudentUI();
    renderCbtResultScreen(correctCount, total, pct, gradeBadge, gradeColor, details);
  }

  function renderCbtResultScreen(correct, total, pct, gradeBadge, gradeColor, details) {
    const container = document.getElementById('cbt-modal-body-container');
    if (!container) return;

    const letters = ['A', 'B', 'C', 'D', 'E'];

    container.innerHTML = `
      <div class="py-2">
        <!-- Scorecard Summary -->
        <div class="hub-card mb-4 text-center p-4" style="background:linear-gradient(135deg,rgba(15,23,42,0.95) 0%,rgba(13,21,38,0.98) 100%);border:1px solid ${gradeColor};">
          <div class="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3" style="background:rgba(13,148,136,0.15);width:70px;height:70px;">
            <i class="bi bi-trophy-fill fs-2" style="color:${gradeColor};"></i>
          </div>
          <h3 class="fw-bold mb-1">${activeCbt.examData.examTitle} &mdash; Result</h3>
          <div class="fw-bold my-2" style="font-size:3.5rem;font-family:var(--font-heading);color:${gradeColor};line-height:1;">
            ${pct}%
          </div>
          <div class="d-inline-block px-3 py-1 rounded-pill fw-bold text-sm mb-3" style="background:rgba(255,255,255,0.06);border:1px solid ${gradeColor};color:${gradeColor};">
            Official Rating: ${gradeBadge}
          </div>
          
          <div class="row g-3 justify-content-center text-center mt-2 pt-3" style="border-top:1px solid var(--border-subtle);max-width:700px;margin:0 auto;">
            <div class="col-4 col-md-2">
              <div class="fw-bold text-teal fs-5">${correct}</div>
              <div class="text-xs" style="color:var(--text-muted);">Correct</div>
            </div>
            <div class="col-4 col-md-2">
              <div class="fw-bold text-danger fs-5">${total - correct}</div>
              <div class="text-xs" style="color:var(--text-muted);">Incorrect</div>
            </div>
            <div class="col-4 col-md-2">
              <div class="fw-bold text-amber fs-5">${Object.keys(activeCbt.flags).filter(k => activeCbt.flags[k]).length}</div>
              <div class="text-xs" style="color:var(--text-muted);">Flagged</div>
            </div>
            <div class="col-6 col-md-3">
              <div class="fw-bold text-indigo fs-5">+100 pts</div>
              <div class="text-xs" style="color:var(--text-muted);">Bonus Added</div>
            </div>
            <div class="col-6 col-md-3">
              <div class="fw-bold text-orange fs-5">${appState.userStats.streakDays} Days</div>
              <div class="text-xs" style="color:var(--text-muted);">Active Streak</div>
            </div>
          </div>

          <div class="mt-4 d-flex justify-content-center gap-2">
            <button class="btn-hub-primary" onclick="startExamMock('${activeCbt.examType}')">
              <i class="bi bi-arrow-clockwise me-1"></i> Retake Test
            </button>
            <button class="btn-hub-outline" data-bs-dismiss="modal">
              <i class="bi bi-check2-circle me-1"></i> Close Result
            </button>
          </div>
        </div>

        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h5 class="fw-bold mb-0">
            <i class="bi bi-card-checklist me-2 text-teal"></i> Step-by-Step Question Review &amp; Explanations
          </h5>
        </div>

        <div class="cbt-review-list">
          ${details.map(item => {
            const cardClass = item.userChoice === undefined
              ? 'unanswered-card'
              : item.isCorrect ? 'correct-card' : 'wrong-card';

            const statusText = item.userChoice === undefined
              ? '<span class="status-badge" style="background:rgba(245,158,11,0.2);color:#fbbf24;">Unattempted</span>'
              : item.isCorrect
                ? '<span class="status-badge status-published">Correct</span>'
                : '<span class="status-badge status-rejected">Incorrect</span>';

            return `
              <div class="cbt-review-card ${cardClass}">
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2 pb-2" style="border-bottom:1px solid var(--border-subtle);">
                  <div class="d-flex align-items-center gap-2">
                    <span class="fw-bold text-sm">Question ${item.index}</span>
                    <span class="badge-subject">${item.subject}</span>
                    <span class="badge-dark text-xs">${item.topic}</span>
                  </div>
                  <div>${statusText}</div>
                </div>

                <div class="fw-semibold mb-3 text-sm">${item.question}</div>

                <div class="row g-2 mb-3">
                  ${item.options.map((opt, oIdx) => {
                    let optStyle = 'background:rgba(30,41,59,0.5);border:1px solid var(--border-subtle);';
                    let icon = '';

                    if (oIdx === item.correctChoice) {
                      optStyle = 'background:rgba(16,185,129,0.18);border:1px solid #10b981;color:#34d399;font-weight:700;';
                      icon = '<i class="bi bi-check-circle-fill text-success ms-auto"></i>';
                    } else if (oIdx === item.userChoice && !item.isCorrect) {
                      optStyle = 'background:rgba(239,68,68,0.18);border:1px solid #ef4444;color:#fca5a5;';
                      icon = '<i class="bi bi-x-circle-fill text-danger ms-auto"></i>';
                    }

                    return `
                      <div class="col-md-6">
                        <div class="p-2 rounded d-flex align-items-center gap-2 text-xs" style="${optStyle}">
                          <span class="badge bg-dark">${letters[oIdx]}</span>
                          <span class="flex-grow-1">${opt}</span>
                          ${icon}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

                <div class="p-3 rounded text-xs" style="background:rgba(13,148,136,0.1);border:1px dashed var(--border-teal);">
                  <div class="fw-bold text-teal mb-1"><i class="bi bi-lightbulb me-1"></i> Solution Explanation:</div>
                  <div style="color:var(--text-secondary);">${item.explanation}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 8. ON-SCREEN CBT CALCULATOR
  // ════════════════════════════════════════════════════════════════════════════
  window.toggleCbtCalculator = function () {
    const calc = document.getElementById('cbt-floating-calc');
    if (calc) {
      calc.classList.toggle('d-none');
    }
  };

  window.calcInput = function (val) {
    const screen = document.getElementById('calc-screen');
    if (!screen) return;

    if (val === 'C') {
      calcExpression = '0';
    } else if (val === 'DEL') {
      calcExpression = calcExpression.length > 1 ? calcExpression.slice(0, -1) : '0';
    } else if (val === 'SQRT') {
      try {
        const evaluated = eval(calcExpression);
        calcExpression = String(Math.sqrt(parseFloat(evaluated)));
      } catch (e) {
        calcExpression = 'Error';
      }
    } else if (val === 'SQR') {
      try {
        const evaluated = eval(calcExpression);
        calcExpression = String(Math.pow(parseFloat(evaluated), 2));
      } catch (e) {
        calcExpression = 'Error';
      }
    } else if (val === '=') {
      try {
        const sanitized = calcExpression.replace(/[^0-9+\-*/.]/g, '');
        const res = Function(`'use strict'; return (${sanitized})`)();
        calcExpression = String(res);
      } catch (e) {
        calcExpression = 'Error';
      }
    } else {
      if (calcExpression === '0' || calcExpression === 'Error') {
        calcExpression = val;
      } else {
        calcExpression += val;
      }
    }

    screen.textContent = calcExpression;
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 9. TEACHER & ADMIN MANAGEMENT
  // ════════════════════════════════════════════════════════════════════════════
  function renderTeacherResources() {
    const tbody = document.getElementById('teacher-resources-table-body');
    if (!tbody) return;

    tbody.innerHTML = (appState.resources || []).map(res => `
      <tr>
        <td>
          <span class="fw-bold d-block" style="font-size:0.9rem;">${res.title}</span>
          <span class="text-xs" style="color:var(--text-subtle);">Topic: ${res.topic}</span>
        </td>
        <td>
          <span class="badge-subject d-inline-block mb-1">${res.subject}</span>
          <span class="text-xs d-block" style="color:var(--text-subtle);">${res.class}</span>
        </td>
        <td><span class="badge-dark">${res.visibility}</span></td>
        <td class="text-xs" style="color:var(--text-muted);">28 Aug 2026</td>
        <td><span class="status-badge status-${res.status}">${res.status.charAt(0).toUpperCase() + res.status.slice(1)}</span></td>
        <td>
          <button class="btn-hub-outline" style="padding:0.3rem 0.7rem;font-size:0.78rem;" onclick="openResourceModal('${res.id}')">
            <i class="bi bi-eye"></i> View
          </button>
        </td>
      </tr>
    `).join('');
  }

  function renderAdminPendingQueue() {
    const container = document.getElementById('admin-pending-container');
    if (!container) return;

    const pending = (appState.resources || []).filter(r => r.status === 'pending');

    if (pending.length === 0) {
      container.innerHTML = `
        <div class="text-center py-4" style="color:var(--text-muted);">
          <i class="bi bi-check-circle" style="font-size:2rem;color:#34d399;"></i>
          <h6 class="fw-bold mt-2">All Clear</h6>
          <p class="text-xs">No materials are currently awaiting approval.</p>
        </div>`;
      return;
    }

    container.innerHTML = pending.map(res => `
      <div class="approval-item mb-3">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <div class="d-flex flex-wrap gap-1 align-items-center">
            <span class="status-badge status-pending">Pending Review</span>
            <span class="badge-subject">${res.subject}</span>
            <span class="badge-level">${res.class}</span>
          </div>
          <span class="text-xs" style="color:var(--text-subtle);"><i class="bi bi-person me-1"></i>${res.uploader}</span>
        </div>
        <h6 class="fw-bold mb-1">${res.title}</h6>
        <p class="text-xs mb-3" style="color:var(--text-muted);">${res.description}</p>
        <div class="d-flex flex-wrap gap-2">
          <button class="btn-hub-primary" onclick="approveResource('${res.id}')">
            <i class="bi bi-check-lg me-1"></i> Approve &amp; Publish
          </button>
          <button class="btn-hub-outline" onclick="openResourceModal('${res.id}')">
            <i class="bi bi-eye me-1"></i> Review Content
          </button>
          <button class="btn-hub-danger" onclick="rejectResource('${res.id}')">
            <i class="bi bi-x-lg me-1"></i> Reject
          </button>
        </div>
      </div>
    `).join('');
  }

  function initTeacherUploadForm() {
    const form = document.getElementById('upload-resource-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const classVal = document.getElementById('upload-class').value;
      const subjVal  = document.getElementById('upload-subject').value;
      const typeVal  = document.getElementById('upload-type').value;

      const newRes = {
        id:          `res-${Date.now()}`,
        title:       document.getElementById('upload-title').value.trim(),
        level:       classVal.startsWith('JSS') ? 'jss' : 'sss',
        class:       classVal,
        subject:     subjVal,
        subjectId:   subjVal.toLowerCase().replace(/\s+/g, '').slice(0, 7),
        topic:       document.getElementById('upload-topic').value.trim(),
        type:        subjVal,
        typeId:      typeVal,
        difficulty:  document.getElementById('upload-difficulty').value,
        estimatedTime: '20 mins',
        uploader:    'Staff',
        status:      'pending',
        visibility:  document.getElementById('upload-visibility').value,
        learningObjectives: [
          'Understand key concepts of this topic',
          'Solve practical problems'
        ],
        description: document.getElementById('upload-description').value.trim(),
        content:     `<h3>${document.getElementById('upload-title').value}</h3><p>${document.getElementById('upload-description').value}</p>`,
        hasWorksheet: true,
        worksheetName: 'Practice_Worksheet.pdf',
        quizId:      null,
      };

      appState.resources.unshift(newRes);
      saveAppData(appState);

      const bsModal = bootstrap.Modal.getInstance(document.getElementById('uploadResourceModal'));
      if (bsModal) bsModal.hide();
      form.reset();

      renderAllViews();
      showToast('success', 'Material Submitted', 'Awaiting Admin review.');
    });
  }

  window.approveResource = function (resId) {
    const res = appState.resources.find(r => r.id === resId);
    if (!res) return;
    res.status = 'published';
    saveAppData(appState);
    renderAllViews();
    showToast('success', 'Material Approved', `"${res.title}" is now published.`);
  };

  window.rejectResource = function (resId) {
    const res = appState.resources.find(r => r.id === resId);
    if (!res) return;
    res.status = 'rejected';
    saveAppData(appState);
    renderAllViews();
    showToast('warning', 'Material Rejected', `"${res.title}" has been rejected.`);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 10. RESOURCE VIEWER & QUIZ
  // ════════════════════════════════════════════════════════════════════════════
  window.openResourceModal = function (resId) {
    const res = appState.resources.find(r => r.id === resId);
    if (!res) return;

    document.getElementById('modal-res-title').textContent   = res.title;
    document.getElementById('modal-res-subject').textContent = res.subject;
    document.getElementById('modal-res-level').textContent   = res.class;
    document.getElementById('modal-res-type').textContent    = res.type;

    document.getElementById('modal-res-body').innerHTML = `
      <div class="mb-4">
        <h6 class="fw-bold mb-2 text-teal">
          <i class="bi bi-bullseye me-1"></i> Learning Objectives
        </h6>
        <ul style="font-size:0.9rem;color:var(--text-secondary);padding-left:1.25rem;">
          ${(res.learningObjectives || ['Master core concepts']).map(o => `<li class="mb-1">${o}</li>`).join('')}
        </ul>
      </div>

      <div class="d-flex flex-wrap gap-2 mb-4 text-xs" style="color:var(--text-subtle);">
        <span><i class="bi bi-clock me-1"></i> Est. time: ${res.estimatedTime}</span>
        <span><i class="bi bi-person me-1"></i> By ${res.uploader}</span>
        <span><i class="bi bi-bar-chart me-1"></i> ${res.difficulty}</span>
      </div>

      <div class="lesson-content mb-4">${res.content}</div>

      ${res.hasWorksheet ? `
        <div class="worksheet-row">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-file-earmark-pdf text-amber" style="font-size:1.4rem;flex-shrink:0;"></i>
            <div>
              <div class="fw-bold text-sm">${res.worksheetName}</div>
              <div class="text-xs" style="color:var(--text-subtle);">Offline Practice Worksheet &bull; PDF</div>
            </div>
          </div>
          <button class="btn-hub-outline" style="padding:0.35rem 0.8rem;font-size:0.8rem;white-space:nowrap;"
            onclick="showToast('info','Downloading','Worksheet saved for offline access.')">
            <i class="bi bi-download me-1"></i> Download
          </button>
        </div>
      ` : ''}
    `;

    document.getElementById('btn-mark-complete').onclick = () => {
      appState.userStats.points += 25;
      appState.userStats.completedResourcesCount = (appState.userStats.completedResourcesCount || 0) + 1;
      
      const st = appState.students.find(s => s.id === appState.currentStudentId);
      if (st) {
        st.points = appState.userStats.points;
        st.completedResourcesCount = appState.userStats.completedResourcesCount;
      }

      saveAppData(appState);
      syncCurrentStudentUI();

      const modal = bootstrap.Modal.getInstance(document.getElementById('resourceDetailModal'));
      if (modal) modal.hide();
      showToast('success', 'Lesson Completed', 'You earned +25 Learning Points.');
    };

    new bootstrap.Modal(document.getElementById('resourceDetailModal')).show();
  };

  // ─── Quiz Runner ───────────────────────────────────────────────────────────
  window.openQuizRunner = function (quizId) {
    const quiz = appState.quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    document.getElementById('quiz-modal-title').textContent = quiz.title;
    const body   = document.getElementById('quiz-modal-body');
    const footer = document.getElementById('quiz-modal-footer');

    body.innerHTML = `
      <div class="d-flex flex-wrap gap-3 mb-4 text-xs" style="color:var(--text-muted);">
        <span><i class="bi bi-bookmark me-1"></i>Topic: <strong style="color:var(--text-primary);">${quiz.topic}</strong></span>
        <span><i class="bi bi-clock me-1"></i>Time Limit: <strong style="color:var(--text-primary);">${quiz.timeLimit}</strong></span>
        <span><i class="bi bi-patch-question me-1"></i>${quiz.questions.length} Questions</span>
      </div>
      <form id="quiz-runner-form">
        ${quiz.questions.map((q, i) => `
          <div class="quiz-question-block">
            <h6>Q${i + 1}: ${q.question}</h6>
            ${q.options.map((opt, idx) => `
              <div class="form-check-hub">
                <input type="radio" name="q_${q.id}" id="opt_${q.id}_${idx}" value="${idx}" required>
                <label for="opt_${q.id}_${idx}">${opt}</label>
              </div>
            `).join('')}
          </div>
        `).join('')}
        <button type="submit" class="btn-hub-primary w-100 mt-2">
          <i class="bi bi-send-check me-1"></i> Submit Answers
        </button>
      </form>
    `;

    footer.innerHTML = `<button class="btn-hub-outline" data-bs-dismiss="modal">Close</button>`;

    const bsModal = new bootstrap.Modal(document.getElementById('quizModal'));
    bsModal.show();

    document.getElementById('quiz-runner-form').addEventListener('submit', (e) => {
      e.preventDefault();

      let correct = 0;
      quiz.questions.forEach(q => {
        const sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (sel && parseInt(sel.value) === q.correct) correct++;
      });

      const pct = Math.round((correct / quiz.questions.length) * 100);

      appState.userStats.points += 50;
      appState.userStats.streakDays += 1;
      appState.userStats.quizzesTakenCount = (appState.userStats.quizzesTakenCount || 0) + 1;

      const st = appState.students.find(s => s.id === appState.currentStudentId);
      if (st) {
        st.points = appState.userStats.points;
        st.streakDays = appState.userStats.streakDays;
        st.quizzesTakenCount = appState.userStats.quizzesTakenCount;
      }

      saveAppData(appState);
      syncCurrentStudentUI();

      const scoreColor = pct >= 70 ? 'var(--clr-teal-400)' : pct >= 50 ? '#fbbf24' : '#f87171';

      body.innerHTML = `
        <div class="text-center py-3">
          <i class="bi bi-trophy-fill text-amber" style="font-size:3rem;"></i>
          <h3 class="fw-bold mt-3 mb-1">Quiz Completed</h3>
          <div class="fw-bold" style="font-size:3rem;font-family:var(--font-heading);color:${scoreColor};">${pct}%</div>
          <p class="text-sm mb-4" style="color:var(--text-muted);">${correct} / ${quiz.questions.length} correct</p>

          <div class="quiz-result-box text-start mb-4">
            <h6 class="fw-bold mb-2" style="color:var(--clr-teal-400);">Rewards Earned This Session</h6>
            <p class="text-sm mb-1">+50 Learning Points added to your profile</p>
            <p class="text-sm mb-0">Active streak now at <strong style="color:var(--clr-orange-500);">${appState.userStats.streakDays} days</strong></p>
          </div>

          <button class="btn-hub-primary" data-bs-dismiss="modal">Continue Learning</button>
        </div>
      `;
    });
  };

});
