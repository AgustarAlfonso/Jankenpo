/**
 * Kelas RematchManager untuk mengatur sinkronisasi tombol "Ulangi Game" pada mode Multiplayer.
 */
class RematchManager {
  /**
   * @param {Function} updateFirebaseFn - Callback fungsi untuk mengupdate data ke Firebase (mis. (ref, data) => update(ref, data)).
   * @param {Function} showToastFn - Callback fungsi untuk menampilkan toast di UI (mis. (msg) => showToast(msg)).
   */
  constructor(updateFirebaseFn, showToastFn) {
    this.updateFirebaseFn = updateFirebaseFn;
    this.showToastFn = showToastFn;
    this.toastShown = false;
  }

  /**
   * Dipanggil ketika pemain lokal menekan tombol "Ulangi Game".
   * Mengatur flag play_again miliknya menjadi true.
   * 
   * @param {Object} roomRef - Referensi database Firebase untuk room.
   * @param {String} slot - Slot pemain saat ini (mis. 'player1' atau 'player2').
   */
  async requestRematch(roomRef, slot) {
    const updateData = {};
    updateData[`players/${slot}/play_again`] = true;
    await this.updateFirebaseFn(roomRef, updateData);
  }

  /**
   * Dipanggil dari dalam onValue listener untuk memeriksa status "Ulangi Game" pemain dan lawan.
   * Jika keduanya telah menekan tombol, Host (player1) akan mereset state game.
   * 
   * @param {Object} roomState - Snapshot state room dari Firebase.
   * @param {Object} roomRef - Referensi database Firebase untuk room.
   * @param {String} localSlot - Slot pemain saat ini.
   */
  async checkRematchState(roomState, roomRef, localSlot) {
    if (!roomState || !roomState.players || !roomState.players.player1 || !roomState.players.player2) return;

    const p1 = roomState.players.player1;
    const p2 = roomState.players.player2;
    const opponentSlot = localSlot === 'player1' ? 'player2' : 'player1';
    
    const opp = roomState.players[opponentSlot];
    const local = roomState.players[localSlot];

    // Show toast if opponent wants to play again but we haven't clicked yet
    if (opp.play_again && !local.play_again) {
      if (!this.toastShown) {
        if (typeof this.showToastFn === 'function') {
          this.showToastFn(`🔄 Lawan meminta main lagi!`);
        }
        this.toastShown = true;
      }
    }

    // If both players want to play again, host resets the game state
    if (p1.play_again && p2.play_again && localSlot === 'player1') {
      await this.updateFirebaseFn(roomRef, {
        "players/player1/gesture": null,
        "players/player1/submitted": false,
        "players/player1/play_again": false,
        "players/player2/gesture": null,
        "players/player2/submitted": false,
        "players/player2/play_again": false,
        "round_result": null,
        "state": "READY"
      });
    }
  }

  /**
   * Mengembalikan status toastShown agar notifikasi bisa muncul kembali di match berikutnya.
   */
  resetToast() {
    this.toastShown = false;
  }
}

export { RematchManager };

// Attach to window for testing purposes via Puppeteer
if (typeof window !== 'undefined') {
  window.RematchManager = RematchManager;
}
