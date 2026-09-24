/**
 * LearnBridge — Sidebar Controller (shared)
 * Left-side role-specific navigation with a bottom-pinned identity block:
 * identity badge → "Add Profile Picture" (only one) → Logout (only one).
 *
 * Mobile: the sidebar goes off-canvas; the hamburger toggle opens it and the
 * backdrop (or a link tap) closes it. On desktop (≥ 992px) it stays visible.
 *
 * Requires: Bootstrap 5 bundle, js/auth.js
 */

const Sidebar = (() => {

  let backdropEl = null;

  /** Close the mobile off-canvas sidebar. */
  function closeMobile() {
    const sb = document.getElementById('hubSidebar');
    if (backdropEl) backdropEl.classList.remove('show');
    if (sb) sb.classList.remove('sidebar-open');
  }

  /** Highlight the sidebar link matching the section in view. */
  function updateActiveLink() {
    const links = [...document.querySelectorAll('.hub-sidebar .sidebar-link[href^="#section-"]')];
    const sections = links
      .map(l => document.getElementById(l.getAttribute('href').slice(1)))
      .filter(Boolean);
    if (sections.length === 0) return;

    const fromTop = window.scrollY + 120;
    let current = sections[0].id;
    for (const sec of sections) {
      if (sec.offsetTop <= fromTop) current = sec.id;
    }

    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === `#section-${current}`));
  }

  /** Wire up toggle, backdrop, smooth scrolling and scroll-spy. */
  function init() {
    const sidebar = document.getElementById('hubSidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    backdropEl = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-open');
        if (backdropEl) backdropEl.classList.toggle('show', sidebar.classList.contains('sidebar-open'));
      });
    }

    if (backdropEl) {
      backdropEl.addEventListener('click', closeMobile);
    }

    // Smooth-scroll in-page links; close the drawer on mobile after tapping.
    sidebar.querySelectorAll('a.sidebar-link[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const id = link.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          history.replaceState(null, '', link.getAttribute('href'));
          closeMobile();
        }
      });
    });

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActiveLink();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
    updateActiveLink();
  }

  return { init, closeMobile };
})();

document.addEventListener('DOMContentLoaded', () => Sidebar.init());
