/**
 * PopupManager
 * Mengelola pop-up UI bergaya Neo-Brutalism Arcade Cartoonic.
 */
class PopupManager {
  /**
   * Menginisialisasi Popup Manager
   * Membutuhkan elemen-elemen DOM spesifik.
   * 
   * @param {HTMLElement} overlay - Elemen overlay dari popup
   * @param {HTMLElement} titleEl - Elemen tempat judul popup (mis. h2)
   * @param {HTMLElement} msgEl - Elemen tempat pesan popup (mis. p)
   * @param {HTMLElement} btnEl - Elemen tombol OK pada popup
   */
  constructor(overlay, titleEl, msgEl, btnEl) {
    this.overlay = overlay;
    this.titleEl = titleEl;
    this.msgEl = msgEl;
    this.btnEl = btnEl;
    this.onOkCallback = null;

    if (this.btnEl) {
      this.btnEl.addEventListener('click', () => {
        this.hidePopup();
        if (typeof this.onOkCallback === 'function') {
          this.onOkCallback();
          this.onOkCallback = null; // Clear callback setelah dijalankan
        }
      });
    }
  }

  /**
   * Menampilkan popup
   * 
   * @param {String} title - Judul besar popup
   * @param {String} message - Isi pesan popup
   * @param {Function} onOk - Fungsi yang dijalankan saat tombol OK ditekan
   */
  showPopup(title, message, onOk) {
    if (!this.overlay || !this.titleEl || !this.msgEl) return;
    
    this.titleEl.textContent = title;
    this.msgEl.textContent = message;
    this.onOkCallback = onOk;
    
    this.overlay.classList.add('active');
  }

  hidePopup() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
    }
  }
}

export { PopupManager };

if (typeof window !== 'undefined') {
  window.PopupManager = PopupManager;
}
