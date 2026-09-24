/**
 * LearnBridge — Authentication & Session Guard Module
 * Enforces role-based authentication and separates Student, Staff, and School Administrator access.
 * No demo or quick-login credentials are used. All users must register before logging in.
 */

const SESSION_KEY = 'learnbridge_session';

const Auth = {

  // ─── Session Management ────────────────────────────────────────────────────

  /** Get the currently active session object */
  getSession() {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Failed to parse session:', e);
      return null;
    }
  },

  /** Clear the active session */
  clearSession() {
    localStorage.removeItem(SESSION_KEY);
  },

  // ─── Role Checks ───────────────────────────────────────────────────────────

  isStudent() {
    const s = this.getSession();
    return !!(s && s.role === 'student' && s.user);
  },

  isStaff() {
    const s = this.getSession();
    return !!(s && (s.role === 'staff' || s.role === 'admin') && s.user);
  },

  isAdmin() {
    const s = this.getSession();
    return !!(s && s.role === 'admin' && s.user);
  },

  // ─── Login Methods ─────────────────────────────────────────────────────────

  /** Login as Student — sets session and redirects to student dashboard */
  loginStudent(studentData) {
    const session = {
      role: 'student',
      user: studentData,
      loginTime: new Date().toISOString(),
      token: `std_${Date.now()}`
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Update appState active student
    if (typeof getAppData === 'function') {
      const appState = getAppData();
      appState.currentStudentId = studentData.id;
      appState.userStats = {
        name:                    studentData.name,
        admissionNo:             studentData.admissionNo,
        class:                   studentData.class,
        level:                   studentData.level,
        streakDays:              studentData.streakDays || 1,
        points:                  studentData.points || 100,
        completedResourcesCount: studentData.completedResourcesCount || 0,
        quizzesTakenCount:       studentData.quizzesTakenCount || 0,
        cbtExamsTakenCount:      studentData.cbtExamsTakenCount || 0,
        cbtBestScore:            studentData.cbtBestScore || 0
      };
      saveAppData(appState);
    }

    window.location.replace('student.html');
  },

  /** Login as Staff/Teacher — sets session and redirects to staff dashboard */
  loginStaff(staffData) {
    if (staffData.role === 'admin') {
      this.loginAdmin(staffData);
      return;
    }

    const session = {
      role: 'staff',
      user: staffData,
      loginTime: new Date().toISOString(),
      token: `stf_${Date.now()}`
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.location.replace('staff.html');
  },

  /** Login as Administrator/Principal — sets session and redirects to admin dashboard */
  loginAdmin(adminData) {
    const session = {
      role: 'admin',
      user: adminData,
      loginTime: new Date().toISOString(),
      token: `adm_${Date.now()}`
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.location.replace('admin.html');
  },

  // ─── Logout ────────────────────────────────────────────────────────────────

  /** Logout current user, clear session, and redirect to login page */
  logout() {
    this.clearSession();
    // Replace history entry to prevent back-navigation into dashboard
    window.location.replace('login.html');
  },

  // ─── Route Guards ──────────────────────────────────────────────────────────

  /** Must be called at the top of student.html — redirects if not a student */
  requireStudent() {
    if (!this.isStudent()) {
      this.clearSession();
      window.location.replace('login.html?role=student');
      return false;
    }
    return true;
  },

  /** Must be called at the top of staff.html — redirects if not staff/admin */
  requireStaff() {
    if (!this.isStaff()) {
      this.clearSession();
      window.location.replace('login.html?role=staff');
      return false;
    }
    return true;
  },

  /** Must be called at the top of admin.html — redirects if not admin */
  requireAdmin() {
    if (!this.isAdmin()) {
      this.clearSession();
      window.location.replace('login.html?role=admin');
      return false;
    }
    return true;
  },

  // ─── Current User Helpers ──────────────────────────────────────────────────

  /** Returns the current user object from session */
  getUser() {
    const s = this.getSession();
    return s ? s.user : null;
  },

  /** Returns the current role string */
  getRole() {
    const s = this.getSession();
    return s ? s.role : null;
  }
};
