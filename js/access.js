/**
 * LearnBridge — Teacher Class Assignment & Access Control Module (shared)
 *
 * Establishes the single source of truth for the school's class catalogue and
 * enforces the relationship the whole portal is built on:
 *
 *   Teacher → Department → Assigned Classes → Authorized Students → Authorized Results/Resources
 *
 * Every student, result and resource lookup MUST go through this module so that a
 * teacher can never read data for a class they do not teach (even by editing a
 * student id, a URL or a query parameter in the browser console).
 *
 * Requires: nothing. Load after js/data.js and before the page logic script.
 */

const Access = (() => {

  // ─── Class catalogue ───────────────────────────────────────────────────────

  /**
   * The complete set of classes a teacher may be assigned to.
   * Junior secondary classes carry class arms A–E; senior secondary classes
   * are split into Science, Arts and Commercial sections.
   */
  const CLASS_CATALOGUE = [
    { name: 'JSS 1A',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 1B',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 1C',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 1D',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 1E',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 2A',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 2B',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 2C',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 2D',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 2E',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 3A',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 3B',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 3C',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 3D',          level: 'jss', department: 'Junior Secondary' },
    { name: 'JSS 3E',          level: 'jss', department: 'Junior Secondary' },
    { name: 'SS 1 Science',    level: 'sss', department: 'Science' },
    { name: 'SS 1 Arts',       level: 'sss', department: 'Arts' },
    { name: 'SS 1 Commercial', level: 'sss', department: 'Commercial' },
    { name: 'SS 2 Science',    level: 'sss', department: 'Science' },
    { name: 'SS 2 Arts',       level: 'sss', department: 'Arts' },
    { name: 'SS 2 Commercial', level: 'sss', department: 'Commercial' },
    { name: 'SS 3 Science',    level: 'sss', department: 'Science' },
    { name: 'SS 3 Arts',       level: 'sss', department: 'Arts' },
    { name: 'SS 3 Commercial', level: 'sss', department: 'Commercial' }
  ];

  /** Departments a teacher account can be attached to. */
  const DEPARTMENT_ORDER = ['Junior Secondary', 'Science', 'Arts', 'Commercial'];

  const LEVEL_LABELS = {
    jss:     'Junior Secondary (JSS)',
    sss:     'Senior Secondary (SSS)'
  };

  const ALL_CLASSES_LABEL = 'All Classes';

  // ─── Small helpers ─────────────────────────────────────────────────────────

  function clean(value) {
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  }

  /**
   * Normalise a class name to its canonical form.
   * JSS class arms (A–E) are real classes, so "jss1a"/"JSS 1 a" → "JSS 1A".
   * A bare "JSS 1" (a legacy record without an arm) stays "JSS 1".
   */
  function baseClassName(cls) {
    const s = clean(cls);
    if (!s) return '';
    const m = s.match(/^(jss)\s*(\d+)\s*([a-e])?$/i);
    if (m) {
      return m[3] ? `JSS ${m[2]}${m[3].toUpperCase()}` : `JSS ${m[2]}`;
    }
    return s;
  }

  /** True when the value is a school-wide selector such as "All Classes". */
  function isAllClasses(cls) {
    return /^all\b/i.test(clean(cls));
  }

  /** Department/section derived from a class name ("SS 2 Science" → "Science"). */
  function departmentOf(cls) {
    const s = clean(cls).toLowerCase();
    if (!s) return '';
    if (s.startsWith('jss')) return 'Junior Secondary';
    if (s.includes('science')) return 'Science';
    if (s.includes('arts')) return 'Arts';
    if (s.includes('commercial')) return 'Commercial';
    return '';
  }

  /** Educational level derived from a class name ("SS 2 Science" → "sss"). */
  function levelOf(cls) {
    const s = clean(cls).toLowerCase();
    if (s.startsWith('jss')) return 'jss';
    if (s.startsWith('ss')) return 'sss';
    return '';
  }

  function levelLabel(level) {
    return LEVEL_LABELS[level] || level || '';
  }

  /**
   * True when two class names refer to the same class.
   * Legacy fallback: a bare "JSS 1" assignment matches every "JSS 1A–E" arm
   * (and vice versa) so pre-arm records keep working.
   */
  function classMatches(a, b) {
    const x = baseClassName(a);
    const y = baseClassName(b);
    if (!x || !y) return false;
    if (x === y) return true;
    const armRe = /^(JSS \d)([A-E])$/;
    const mx = x.match(armRe);
    const my = y.match(armRe);
    return !!(mx && my && mx[1] === my[1] && (!mx[2] || !my[2]));
  }

  function classesForDepartment(department) {
    return CLASS_CATALOGUE.filter(c => c.department === department).map(c => c.name);
  }

  // ─── Teacher identity & authorization ──────────────────────────────────────

  /** Administrators (and legacy "All Classes" accounts) are school-wide. */
  function isSchoolWide(teacher) {
    if (!teacher) return false;
    return teacher.role === 'admin' || (Array.isArray(teacher.classes) && teacher.classes.some(isAllClasses));
  }

  /** The classes a teacher is authorized to teach (base names). */
  function assignedClasses(teacher) {
    if (!teacher) return [];
    if (isSchoolWide(teacher)) return CLASS_CATALOGUE.map(c => c.name);
    return (teacher.classes || [])
      .filter(c => clean(c) && !isAllClasses(c))
      .map(baseClassName);
  }

  /** The departments the teacher's assigned classes fall into. */
  function assignedDepartments(teacher) {
    const out = [];
    assignedClasses(teacher).forEach(c => {
      const d = departmentOf(c);
      if (d && !out.includes(d)) out.push(d);
    });
    return DEPARTMENT_ORDER.filter(d => out.includes(d));
  }

  /**
   * Core guard: may this teacher work with the given class?
   * A class qualifies only when it is one of the teacher's assigned classes AND,
   * for senior-secondary classes, the teacher's department matches the section.
   */
  function canTeachClass(teacher, cls) {
    const target = baseClassName(cls);
    if (!teacher || !target) return false;
    if (isSchoolWide(teacher)) return true;

    if (!assignedClasses(teacher).includes(target)) return false;

    const teacherDept = clean(teacher.department);
    const classDept = departmentOf(target);
    if (teacherDept && classDept && classDept !== 'Junior Secondary' &&
        teacherDept !== 'Junior Secondary' && teacherDept !== classDept) {
      return false;
    }
    return true;
  }

  /** Core guard for a student record. */
  function canAccessStudent(teacher, student) {
    return !!(student && canTeachClass(teacher, student.class));
  }

  /**
   * The class this teacher monitors as Class Teacher ("" when none assigned).
   * Stored separately from the subject-teaching assignment (see §4 of the
   * school rules) — e.g. Teacher → Class Teacher → JSS 1A.
   */
  function classTeacherOfClass(teacher) {
    const assigned = clean(teacher && teacher.classTeacherOf);
    return assigned || '';
  }

  /** True when this teacher is the Class Teacher of the given class. */
  function isClassTeacherOf(teacher, cls) {
    const assigned = classTeacherOfClass(teacher);
    return !!assigned && !!clean(cls) && classMatches(assigned, cls);
  }

  /** Every student the teacher is authorized to see. */
  function authorizedStudents(teacher, students) {
    return (students || []).filter(s => canAccessStudent(teacher, s));
  }

  /**
   * Look a student up by id, returning null unless the teacher is authorized
   * for that student's class. Never read appState.students directly in the
   * teacher portal — always resolve through here.
   */
  function findStudentForTeacher(teacher, students, studentId) {
    if (!studentId) return null;
    const student = (students || []).find(s => s.id === studentId) || null;
    return canAccessStudent(teacher, student) ? student : null;
  }

  /** Core guard for a curriculum resource (class + department). */
  function canAccessResource(teacher, resource) {
    if (!teacher || !resource) return false;
    if (isSchoolWide(teacher)) return true;
    if (!resource.class) return false;
    if (isAllClasses(resource.class)) return true; // level-wide material
    if (!canTeachClass(teacher, resource.class)) return false;
    if (resource.department) {
      const teacherDept = clean(teacher.department);
      if (teacherDept && teacherDept !== 'Junior Secondary' && teacherDept !== resource.department) return false;
    }
    return true;
  }

  /**
   * Student-portal guard: a resource is visible only to students matching its
   * class, department and level (the subject is handled by the subject filter).
   */
  function resourceVisibleToStudent(resource, student) {
    if (!resource || !student) return false;

    if (resource.level && student.level && resource.level !== student.level) return false;

    if (resource.class) {
      if (isAllClasses(resource.class)) {
        const resLevel = resource.level || levelOf(resource.class.replace(/^all\s*/i, ''));
        if (resLevel && student.level && resLevel !== student.level) return false;
      } else if (!classMatches(resource.class, student.class)) {
        return false;
      }
    }

    if (resource.department) {
      const studentDept = departmentOf(student.class);
      if (resource.department !== studentDept) return false;
    }

    return true;
  }

  // ─── Class picker UI helpers (registration forms) ──────────────────────────

  function pickerPrefix(containerId) {
    return String(containerId || 'picker').replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Render grouped class checkboxes into a container.
   * @param {string} containerId  element that receives the markup
   * @param {string[]} selected   class names to pre-tick
   */
  function renderClassPicker(containerId, selected) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const chosen = (selected || []).map(baseClassName);
    const prefix = pickerPrefix(containerId);

    el.innerHTML = DEPARTMENT_ORDER.map(dept => {
      const classes = CLASS_CATALOGUE.filter(c => c.department === dept);
      if (classes.length === 0) return '';
      return `
        <div class="class-picker-group">
          <div class="class-picker-group-label">${dept}</div>
          <div class="d-flex flex-wrap gap-3">
            ${classes.map(c => {
              const id = `${prefix}-${c.name.replace(/[^a-zA-Z0-9]/g, '')}`;
              const checked = chosen.includes(c.name) ? ' checked' : '';
              return `
                <div class="form-check form-check-inline m-0">
                  <input class="form-check-input class-picker-box" type="checkbox"
                         id="${id}" value="${c.name}" data-department="${c.department}"${checked}
                         onchange="if (window.Access) Access.onPickerChanged('${containerId}')">
                  <label class="form-check-label text-sm text-light" for="${id}">${c.name}</label>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  /** Values currently ticked in a class picker. */
  function readClassPicker(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return [];
    return [...el.querySelectorAll('input.class-picker-box:checked')].map(i => i.value);
  }

  /** Clear every tick in a class picker. */
  function clearClassPicker(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.querySelectorAll('input.class-picker-box').forEach(i => { i.checked = false; });
  }

  /** Used by the picker markup to keep the department select in step. */
  function onPickerChanged(containerId) {
    const deptSelect = document.getElementById('reg-staff-department')
      || document.getElementById('add-staff-department');
    if (!deptSelect) return;

    const depts = [...new Set(readClassPicker(containerId).map(departmentOf).filter(Boolean))];
    // Never silently overwrite a deliberate senior-secondary choice.
    if (deptSelect.value && depts.includes(deptSelect.value)) return;
    if (depts.length === 1) deptSelect.value = depts[0];
  }

  const api = {
    CLASS_CATALOGUE,
    DEPARTMENT_ORDER,
    LEVEL_LABELS,
    ALL_CLASSES_LABEL,
    baseClassName,
    isAllClasses,
    departmentOf,
    levelOf,
    levelLabel,
    classMatches,
    classesForDepartment,
    classTeacherOfClass,
    isClassTeacherOf,
    assignedClasses,
    assignedDepartments,
    isSchoolWide,
    canTeachClass,
    canAccessStudent,
    authorizedStudents,
    findStudentForTeacher,
    canAccessResource,
    resourceVisibleToStudent,
    renderClassPicker,
    readClassPicker,
    clearClassPicker,
    onPickerChanged
  };

  // Exposed for the inline handlers rendered by the class picker markup.
  if (typeof window !== 'undefined') window.Access = api;

  return api;
})();
