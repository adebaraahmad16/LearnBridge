/**
 * LearnBridge — Learning Material File Store (IndexedDB)
 * Stores actual uploaded learning materials (PDF documents, videos, Word documents,
 * PowerPoint presentations, images and other educational files) as binary Blobs.
 *
 * localStorage only holds small JSON records — file bytes live in IndexedDB so
 * large PDFs and videos can be uploaded and streamed back without quota errors.
 *
 * Public API:
 *   FileStore.saveMaterial(key, fileOrBlob)  → Promise<void>
 *   FileStore.getMaterial(key)               → Promise<{blob, name, type, size} | null>
 *   FileStore.deleteMaterial(key)            → Promise<void>
 *   FileStore.readWithProgress(file, onProgress) → Promise<File>  (progress feedback while reading)
 *   FileStore.fileToDataUrl(file)            → Promise<string>   (for small thumbnails only)
 *
 * Profile pictures (added per account after login):
 *   FileStore.validateProfileImage(file)     → null | error message
 *   FileStore.downscaleImage(file, mode)     → Promise<dataUrl> (256×256 JPEG)
 *   FileStore.saveProfilePicture(accountId, dataUrl) / getProfilePicture(accountId)
 *   FileStore.deleteProfilePicture(accountId)
 */

const FileStore = (() => {
  const DB_NAME = 'learnbridge_files';
  const DB_VERSION = 1;
  const STORE = 'materials';

  let dbPromise = null;

  /** Open (and upgrade) the IndexedDB database. */
  function openDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported in this browser.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open file storage.'));
    });

    return dbPromise;
  }

  /** Run one operation against the materials store. */
  function withStore(mode, action) {
    return openDb().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const request = action(store);

      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error || new Error('File storage transaction failed.'));
      tx.onabort = () => reject(tx.error || new Error('File storage transaction aborted.'));
    }));
  }

  return {
    /** Persist an uploaded material (File or Blob) under a unique key. */
    saveMaterial(key, blob) {
      const record = {
        key,
        blob,
        name: blob && blob.name ? blob.name : key,
        type: blob && blob.type ? blob.type : 'application/octet-stream',
        size: blob ? blob.size : 0,
        savedAt: new Date().toISOString()
      };
      return withStore('readwrite', store => store.put(record));
    },

    /** Retrieve a stored material by key (returns null when missing). */
    getMaterial(key) {
      return withStore('readonly', store => store.get(key)).then(record => {
        if (!record) return null;
        return { blob: record.blob, name: record.name, type: record.type, size: record.size };
      }).catch(() => null);
    },

    /** Delete a stored material (used when a resource is removed). */
    deleteMaterial(key) {
      return withStore('readwrite', store => store.delete(key)).catch(() => undefined);
    },

    /**
     * Read the file once to give honest upload progress feedback, then hand back
     * the original File object (which is stored directly in IndexedDB as a Blob).
     */
    readWithProgress(file, onProgress) {
      return new Promise((resolve, reject) => {
        if (!file) { reject(new Error('No file selected.')); return; }

        // Small files: a quick simulated step is enough.
        if (file.size <= 512 * 1024) {
          if (onProgress) onProgress(100);
          setTimeout(() => resolve(file), 250);
          return;
        }

        const reader = new FileReader();
        reader.onprogress = (event) => {
          if (onProgress && event.lengthComputable) {
            onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
          }
        };
        reader.onload = () => {
          if (onProgress) onProgress(100);
          resolve(file);
        };
        reader.onerror = () => reject(new Error('The selected file could not be read. It may be corrupted.'));
        reader.readAsArrayBuffer(file);
      });
    },

    /** Convert a small file (e.g. a thumbnail image) to a data URL string. */
    fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the selected image.'));
        reader.readAsDataURL(file);
      });
    },

    /** Human-readable file size. */
    formatSize(bytes) {
      if (!bytes && bytes !== 0) return '';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    },

    /**
     * Fetch a stored material and hand it to the browser as a download.
     * `res` needs { materialKey, fileName }; falls back to a safe name.
     */
    downloadMaterial(res) {
      if (!res || !res.materialKey) {
        return Promise.reject(new Error('This material has no downloadable file.'));
      }
      return this.getMaterial(res.materialKey).then(material => {
        if (!material) throw new Error('The material file could not be found in local storage.');
        const url = URL.createObjectURL(material.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.fileName || material.name || 'learning_material';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      });
    },

    /**
     * ─── Profile Pictures ───────────────────────────────────────────────
     * Stored per-account under `profile_<accountId>`. The picture is
     * downscaled to 256×256 JPEG so it stays light in localStorage.
     */

    /** Validate a candidate profile picture by type and size. */
    validateProfileImage(file) {
      if (!file) return 'No image selected.';
      const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!okTypes.includes((file.type || '').toLowerCase())) {
        return 'Unsupported image. Please choose a JPG, PNG, WebP or GIF file.';
      }
      if (file.size > 5 * 1024 * 1024) {
        return 'Image is too large. Please choose an image under 5 MB.';
      }
      if (file.size === 0) {
        return 'The selected file is empty and may be corrupted.';
      }
      return null; // valid
    },

    /**
     * Downscale an image to a square 256×256 JPEG data-URL.
     * `cropMode`: 'cover' (fill square, crop overflow — default) or 'contain'
     * (fit whole image on a dark canvas).
     */
    downscaleImage(file, cropMode) {
      const mode = cropMode || 'cover';
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the selected image.'));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('That file could not be decoded as an image.'));
          img.onload = () => {
            const size = 256;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, size, size);
            if (mode === 'cover') {
              const scale = Math.max(size / img.width, size / img.height);
              const w = img.width * scale, h = img.height * scale;
              ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
            } else {
              const scale = Math.min(size / img.width, size / img.height);
              const w = img.width * scale, h = img.height * scale;
              ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
            }
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    },

    /** Save the picture for one account id. Returns the stored data-URL. */
    saveProfilePicture(accountId, dataUrl) {
      return withStore('readwrite', store => store.put({
        key: `profile_${accountId}`,
        blob: dataUrl,
        name: `profile_${accountId}.jpg`,
        type: 'image/jpeg',
        size: Math.round((dataUrl.length * 3) / 4),
        savedAt: new Date().toISOString()
      })).then(() => dataUrl);
    },

    /** Get the stored profile picture data-URL for one account id (or null). */
    getProfilePicture(accountId) {
      return this.getMaterial(`profile_${accountId}`).then(rec => rec ? rec.blob : null);
    },

    /** Remove the stored profile picture for one account id. */
    deleteProfilePicture(accountId) {
      return this.deleteMaterial(`profile_${accountId}`);
    }
  };
})();
