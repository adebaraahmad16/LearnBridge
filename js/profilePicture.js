/**
 * LearnBridge — Profile Picture Manager (shared helpers)
 *
 * Replaces the removed preset "Choose Avatar" system. There are NO default
 * pictures and NO avatar pickers: every account starts with a clean
 * initials placeholder, and each user can upload their own photo only after
 * login, only into their own account.
 *
 * Each dashboard renders ONE unified sidebar profile section (picture /
 * initials + name + role + "Add Profile Picture") via initDashboardProfilePicture.
 * There is no separate identity/avatar block anywhere else in the sidebar.
 *
 * Storage: IndexedDB via FileStore (key `profile_<accountId>`, 256×256 JPEG).
 * Metadata (hasProfilePicture flag) lives on the account record in localStorage
 * so dashboards can render instantly on load.
 *
 * Requires: js/data.js, js/auth.js, js/filestore.js
 */

const ProfilePicture = (() => {

  /** Initials from a name — used while no picture has been uploaded. */
  function getInitials(name) {
    const clean = (name || '').trim();
    if (!clean) return '?';
    // Drop common Nigerian/English honorifics before extracting initials.
    const words = clean
      .replace(/\b(mr|mrs|miss|ms|dr|alhaji|alh|chief|eng|prof|mallam)\b\.?/gi, '')
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  /**
   * Validate ownership: a signed-in user may only manage their own picture.
   * Returns the account id to use, or null when the request is not permitted.
   */
  function resolveOwnAccountId(requestedId) {
    const session = typeof Auth !== 'undefined' ? Auth.getSession() : null;
    if (!session || !session.user) return null;

    const user = session.user;
    const selfId = user.id;

    // Requesting one's own picture is always allowed.
    if (!requestedId || requestedId === selfId) return selfId;

    // Managing someone else's picture requires an admin session.
    if (session.role === 'admin') {
      const data = getAppData();
      const target = (data.students || []).find(s => s.id === requestedId) ||
                     (data.staff || []).find(st => st.id === requestedId);
      return target ? requestedId : null;
    }
    return null;
  }

  /** Common save pipeline used by all three dashboards. */
  function saveForCurrentUser(file) {
    const session = (typeof Auth !== 'undefined') ? Auth.getSession() : null;
    if (!session || !session.user) {
      return Promise.reject(new Error('You must be signed in to add a profile picture.'));
    }

    const validationError = FileStore.validateProfileImage(file);
    if (validationError) {
      return Promise.reject(new Error(validationError));
    }

    const accountId = session.user.id;

    return FileStore.downscaleImage(file, 'cover').then(dataUrl =>
      FileStore.saveProfilePicture(accountId, dataUrl).then(() => {
        // Persist a lightweight flag + timestamp on the account record.
        const data = getAppData();
        const lists = ['students', 'staff'];
        for (const listName of lists) {
          const list = data[listName] || [];
          const idx = list.findIndex(x => x.id === accountId);
          if (idx !== -1) {
            list[idx].hasProfilePicture = true;
            list[idx].profileUpdatedAt = new Date().toISOString();
            saveAppData(data);
            break;
          }
        }

        // Keep the session user copy in sync too.
        const session2 = Auth.getSession();
        if (session2 && session2.user && session2.user.id === accountId) {
          session2.user.hasProfilePicture = true;
          localStorage.setItem('learnbridge_session', JSON.stringify(session2));
        }

        return dataUrl;
      })
    );
  }

  /** Common remove pipeline used by all three dashboards. */
  function removeForCurrentUser() {
    const session = (typeof Auth !== 'undefined') ? Auth.getSession() : null;
    if (!session || !session.user) {
      return Promise.reject(new Error('You must be signed in to remove a profile picture.'));
    }
    const accountId = session.user.id;

    return FileStore.deleteProfilePicture(accountId).then(() => {
      const data = getAppData();
      const lists = ['students', 'staff'];
      for (const listName of lists) {
        const list = data[listName] || [];
        const idx = list.findIndex(x => x.id === accountId);
        if (idx !== -1) {
          delete list[idx].hasProfilePicture;
          delete list[idx].profileUpdatedAt;
          saveAppData(data);
          break;
        }
      }

      const session2 = Auth.getSession();
      if (session2 && session2.user && session2.user.id === accountId) {
        delete session2.user.hasProfilePicture;
        localStorage.setItem('learnbridge_session', JSON.stringify(session2));
      }
    });
  }

  /**
   * HTML for the SINGLE unified profile section shown on a dashboard after login.
   * One place only: the picture (or clean initials placeholder) + the user's
   * name/role + the "Add Profile Picture" / Replace / Remove actions.
   * Never a preset avatar. When no picture exists the whole section is
   * clickable so tapping anywhere opens the file picker.
   */
  function renderPanelHtml(opts) {
    const has = !!opts.pictureUrl;
    const initials = getInitials(opts.name);
    const sizeClass = opts.compact ? 'pp-panel pp-panel-sm' : 'pp-panel';

    return `
      <div class="${sizeClass}" id="${opts.panelId}" ${has ? '' : `role="button" tabindex="0" title="Add Profile Picture" onclick="${opts.ns}.panelClick(event)"`}>
        <div class="pp-preview-wrap">
          ${has
            ? `<img id="${opts.imgId}" src="${opts.pictureUrl}" alt="Profile picture" class="pp-preview-img">`
            : `<div id="${opts.imgId}" class="pp-initials-badge"><span>${initials}</span></div>`}
        </div>
        ${opts.sublabel !== undefined ? `
        <div class="pp-id-text">
          <div class="pp-id-name">${opts.name || 'User'}</div>
          <div class="pp-id-sub">${opts.sublabel}</div>
        </div>` : ''}
        <div class="pp-actions">
          ${has
            ? `<button type="button" class="btn btn-sm btn-hub-outline" onclick="${opts.ns}.triggerFileSelect()">
                 <i class="bi bi-arrow-repeat me-1"></i> Replace
               </button>
               <button type="button" class="btn btn-sm btn-outline-danger" onclick="${opts.ns}.removePicture()">
                 <i class="bi bi-trash me-1"></i> Remove
               </button>
               <div class="pp-type-hint"><i class="bi bi-person-check me-1"></i>Profile Picture</div>`
            : `<button type="button" class="btn btn-sm btn-teal text-dark fw-bold" onclick="${opts.ns}.triggerFileSelect()">
                 <i class="bi bi-person-plus me-1"></i> Add Profile Picture
               </button>`}
          <div class="text-xs text-muted mt-1 pp-size-hint">JPG, PNG, WebP or GIF &bull; max 5 MB</div>
        </div>
      </div>
      <input type="file" id="${opts.inputId}" class="d-none" accept="image/jpeg,image/png,image/webp,image/gif">
    `;
  }

  /** Bind change/click handlers for a rendered panel (call after injecting HTML). */
  function bindPanel(ns, inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) {
        window[ns].handleFileSelected(input.files[0]);
        input.value = ''; // allow re-selecting the same file later
      }
    });
  }

  /**
   * Per-dashboard engine. Called from each dashboard's header renderer with:
   *   { namespace, panelId, accountId, name, sublabel, onChange }
   * Creates window.<namespace> with triggerFileSelect()/panelClick()/
   * handleFileSelected()/removePicture(), renders the SINGLE unified profile
   * panel, and loads the stored picture. Only the signed-in user's own
   * account is touched.
   */
  function initDashboardProfilePicture(cfg) {
    const ns = cfg.namespace;

    // Ownership guard: the dashboard must be managing the signed-in user's own account.
    const selfId = resolveOwnAccountId(cfg.accountId);
    if (!selfId || selfId !== cfg.accountId) {
      // Not the signed-in user's own account — render nothing.
      return;
    }

    const api = {
      _file: null,

      triggerFileSelect() {
        const input = document.getElementById(`${ns}-input`);
        if (input) input.click();
      },

      // Whole-section tap-to-upload (only when no picture exists yet).
      // Ignore clicks that land on the inner button so the picker opens once.
      panelClick(e) {
        if (!e || (e.target && e.target.closest && e.target.closest('button'))) return;
        this.triggerFileSelect();
      },

      handleFileSelected(file) {
        const err = FileStore.validateProfileImage(file);
        if (err) {
          showToast('error', 'Invalid Image', err);
          return;
        }
        saveForCurrentUser(file)
          .then(dataUrl => {
            applyPictureToUI(cfg, dataUrl);
            showToast('success', 'Profile Picture Updated', 'Your profile picture has been saved to your account.');
            if (typeof cfg.onChange === 'function') cfg.onChange();
          })
          .catch(e => showToast('error', 'Upload Failed', e.message || 'Could not save the image.'));
      },

      removePicture() {
        if (!confirm('Remove your profile picture?')) return;
        removeForCurrentUser()
          .then(() => {
            applyPictureToUI(cfg, null);
            showToast('info', 'Profile Picture Removed', 'Your initials badge is shown again.');
            if (typeof cfg.onChange === 'function') cfg.onChange();
          })
          .catch(e => showToast('error', 'Remove Failed', e.message || 'Could not remove the image.'));
      }
    };
    window[ns] = api;

    const slot = document.getElementById(cfg.panelId);
    if (!slot) return;

    // Render instantly with the initials placeholder, then swap in the stored
    // picture if this account has one (IndexedDB is async).
    slot.innerHTML = renderPanelHtml({
      ns,
      panelId: `${ns}-panel`,
      imgId: `${ns}-img`,
      inputId: `${ns}-input`,
      name: cfg.name,
      sublabel: cfg.sublabel,
      pictureUrl: null
    });
    bindPanel(ns, `${ns}-input`);

    FileStore.getProfilePicture(cfg.accountId).then(url => {
      if (url && window[ns] === api) {
        applyPictureToUI(cfg, url);
      }
    });
  }

  /** Swap the panel and nav badge between initials placeholder and picture. */
  function applyPictureToUI(cfg, pictureUrl) {
    const ns = cfg.namespace;
    const imgEl = document.getElementById(`${ns}-img`);
    const slot = document.getElementById(cfg.panelId);

    if (!pictureUrl) {
      // Back to the clean initials placeholder.
      if (slot) {
        slot.innerHTML = renderPanelHtml({
          ns,
          panelId: `${ns}-panel`,
          imgId: `${ns}-img`,
          inputId: `${ns}-input`,
          name: cfg.name,
          sublabel: cfg.sublabel,
          pictureUrl: null
        });
        bindPanel(ns, `${ns}-input`);
      }
    } else if (imgEl && imgEl.tagName === 'IMG') {
      imgEl.src = pictureUrl;
    } else {
      // Panel currently shows the initials badge — re-render with the picture.
      if (slot) {
        slot.innerHTML = renderPanelHtml({
          ns,
          panelId: `${ns}-panel`,
          imgId: `${ns}-img`,
          inputId: `${ns}-input`,
          name: cfg.name,
          sublabel: cfg.sublabel,
          pictureUrl
        });
        bindPanel(ns, `${ns}-input`);
      }
    }

    // Keep any legacy nav badge in sync (only when one exists).
    if (cfg.navBadgeId) renderNavProfileBadge(cfg.navBadgeId, cfg.name, pictureUrl);
  }

  /**
   * Navbar badge: shows the initials by default, or the uploaded picture.
   * Works with both old <img> badges (only when a picture exists) and the
   * new initials <div> badge. No preset/default image is ever used.
   */
  function renderNavProfileBadge(elId, name, pictureUrl) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (pictureUrl) {
      el.innerHTML = `<img src="${pictureUrl}" alt="Profile picture" class="pp-nav-img">`;
      el.classList.remove('pp-nav-initials');
    } else {
      el.innerHTML = `<span>${getInitials(name)}</span>`;
      el.classList.add('pp-nav-initials');
    }
  }

  /**
   * Synchronous table/list badge: a clean initials circle for any account.
   * A MutationObserver (below) automatically swaps in the stored picture
   * when the badge enters the DOM, so renders stay synchronous.
   */
  function accountBadgeHtml(account, sizePx) {
    const s = sizePx || 30;
    return `<div class="pp-table-initials" data-pp-account-id="${account && account.id ? account.id : ''}" style="width:${s}px;height:${s}px;font-size:${Math.max(10, Math.round(s * 0.38))}px;"><span>${getInitials(account && account.name)}</span></div>`;
  }
  // Convenience alias used by student listings.
  function studentBadgeHtml(account, sizePx) { return accountBadgeHtml(account, sizePx); }

  /** Swap one badge element from initials to its stored picture (if any). */
  function upgradeBadgeElement(el) {
    if (!el || el.dataset.ppUpgraded === '1') return;
    const id = el.dataset.ppAccountId;
    if (!id) return;
    el.dataset.ppUpgraded = '1';
    FileStore.getProfilePicture(id).then(url => {
      if (url && document.body.contains(el)) {
        el.innerHTML = `<img src="${url}" alt="Profile picture" class="pp-nav-img">`;
      }
    });
  }

  /**
   * Render the sidebar identity block: initials/photo badge + name + sublabel.
   * Called by each dashboard's header renderer before the profile-picture panel
   * is initialised inside the sidebar bottom section. When `badgeId` is given,
   * the badge keeps the legacy nav-badge id so picture updates stay in sync;
   * `accountId` lets the MutationObserver upgrade initials to the stored photo.
   */
  function renderSidebarIdentity(elId, name, sublabel, accountId, badgeId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = `
      <div class="pp-nav-initials" ${badgeId ? `id="${badgeId}"` : ''} data-pp-account-id="${accountId || ''}"><span>${getInitials(name)}</span></div>
      <div class="sidebar-id-text">
        <div class="sidebar-id-name">${name || 'User'}</div>
        <div class="sidebar-id-sub">${sublabel || ''}</div>
      </div>
    `;
    const badge = el.querySelector('.pp-nav-initials');
    if (badge) upgradeBadgeElement(badge);
  }

  // Watch the DOM: any initials badge that appears (tables, report cards,
  // toasts…) is upgraded to the account's picture when one exists.
  document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('[data-pp-account-id]')) {
            upgradeBadgeElement(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('[data-pp-account-id]').forEach(upgradeBadgeElement);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Upgrade anything already present at load time.
    document.querySelectorAll('[data-pp-account-id]').forEach(upgradeBadgeElement);
  });

  return {
    getInitials,
    resolveOwnAccountId,
    saveForCurrentUser,
    removeForCurrentUser,
    renderPanelHtml,
    bindPanel,
    initDashboardProfilePicture,
    renderNavProfileBadge,
    accountBadgeHtml,
    studentBadgeHtml,
    renderSidebarIdentity
  };
})();

// Expose shared helpers as globals — dashboard scripts call them directly.
window.initDashboardProfilePicture = ProfilePicture.initDashboardProfilePicture;
window.renderNavProfileBadge = ProfilePicture.renderNavProfileBadge;
window.accountBadgeHtml = ProfilePicture.accountBadgeHtml;
window.studentBadgeHtml = ProfilePicture.studentBadgeHtml;
window.renderSidebarIdentity = ProfilePicture.renderSidebarIdentity;
