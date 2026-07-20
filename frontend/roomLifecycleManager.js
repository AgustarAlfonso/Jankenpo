/**
 * RoomLifecycleManager
 * Mengelola status lifecycle room multiplayer (penghapusan, disconnect).
 */
class RoomLifecycleManager {
  /**
   * @param {Function} updateFirebaseFn 
   * @param {Function} removeFirebaseFn 
   * @param {Function} showPopupFn - (title, message, callback) => void
   * @param {Function} onRoomDeadFn - Dipanggil saat room sudah mati
   */
  constructor(updateFirebaseFn, removeFirebaseFn, showPopupFn, onRoomDeadFn) {
    this.updateFirebaseFn = updateFirebaseFn;
    this.removeFirebaseFn = removeFirebaseFn;
    this.showPopupFn = showPopupFn;
    this.onRoomDeadFn = onRoomDeadFn;
    this.p2WasJoined = false;
  }

  /**
   * Pemain dengan sengaja meninggalkan room.
   */
  async leaveRoom(roomRef, slot) {
    if (slot === 'player1') {
      await this.removeFirebaseFn(roomRef);
    } else if (slot === 'player2') {
      await this.updateFirebaseFn(roomRef, {
        "players/player2/joined": false,
        "players/player2/name": "",
        "state": "WAITING"
      });
    }
    this.p2WasJoined = false;
  }

  /**
   * Mengecek snapshot Firebase setiap kali ada perubahan.
   * Mengembalikan `true` jika room mati dan listener harus dilepas.
   */
  async checkRoomStatus(snapshot, roomRef, slot) {
    if (!snapshot.exists()) {
      const msg = slot === 'player2' ? 'Room telah dihapus oleh Host.' : 'Room telah dihapus.';
      
      // Jika showPopupFn didefinisikan (di web), panggil popup
      if (typeof this.showPopupFn === 'function') {
        this.showPopupFn('🚨 GAME OVER', msg, () => {
          if (typeof this.onRoomDeadFn === 'function') this.onRoomDeadFn();
        });
      } else {
        // Fallback untuk testing jika popup tdk didefinisikan dgn benar
        if (typeof this.onRoomDeadFn === 'function') this.onRoomDeadFn();
      }
      
      this.p2WasJoined = false;
      return true; 
    }

    const roomState = snapshot.val();

    if (slot === 'player1') {
      const p2 = roomState.players && roomState.players.player2;
      const isP2Joined = p2 ? !!p2.joined : false;
      
      if (this.p2WasJoined && !isP2Joined) {
        if (typeof this.showPopupFn === 'function') {
          this.showPopupFn('🏃 LAWAN KABUR', 'Pemain 2 telah keluar dari room.', () => {
            if (typeof this.onRoomDeadFn === 'function') this.onRoomDeadFn();
          });
        } else {
          if (typeof this.onRoomDeadFn === 'function') this.onRoomDeadFn();
        }

        // Host menghapus room karena player 2 kabur
        await this.removeFirebaseFn(roomRef);
        this.p2WasJoined = false;
        return true; 
      }
      this.p2WasJoined = isP2Joined;
    }
    
    return false; // Room masih aktif
  }
}

export { RoomLifecycleManager };

if (typeof window !== 'undefined') {
  window.RoomLifecycleManager = RoomLifecycleManager;
}
