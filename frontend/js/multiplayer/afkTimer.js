/**
 * Kelas AFKManager untuk mengatur timer AFK pada mode Multiplayer.
 */
export class AFKManager {
  /**
   * @param {number} timeoutMs - Batas waktu AFK dalam milidetik (misalnya 300000 untuk 5 menit).
   * @param {Function} onTimeout - Callback yang dijalankan ketika waktu AFK habis.
   */
  constructor(timeoutMs, onTimeout) {
    this.timeoutMs = timeoutMs;
    this.onTimeout = onTimeout;
    this.timer = null;
  }

  /**
   * Mereset (memulai ulang) timer AFK.
   * Dipanggil setiap kali ada aktivitas baru yang terdeteksi di dalam room.
   */
  reset() {
    this.clear();
    this.timer = setTimeout(() => {
      if (typeof this.onTimeout === 'function') {
        this.onTimeout();
      }
    }, this.timeoutMs);
  }

  /**
   * Menghentikan timer AFK secara manual (misalnya ketika user sudah keluar room).
   */
  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// Attach to window for testing purposes
if (typeof window !== 'undefined') {
  window.AFKManager = AFKManager;
}
