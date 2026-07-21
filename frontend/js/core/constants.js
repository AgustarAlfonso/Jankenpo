// ⚠️ PASTE KONFIGURASI FIREBASE KAMU DI SINI ⚠️
export const firebaseConfig = {
  apiKey: "AIzaSyCfpPj8sIZ-pBYPkjdiDk3rYJGe4JQwEsU",
  authDomain: "jankenpo-comvi.firebaseapp.com",
  databaseURL: "https://jankenpo-comvi-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jankenpo-comvi",
  storageBucket: "jankenpo-comvi.firebasestorage.app",
  messagingSenderId: "1081721792251",
  appId: "1:1081721792251:web:fea162c87fbfd715a2b25e",
  measurementId: "G-MBGEN5B5BR"
};

// ── API ───────────────────────────────────────────────────────
export const API = {
  detect: '/api/detect',
  play: '/api/play',
  reset: '/api/reset',
  health: '/api/health',
  createRoom: '/api/room/create',
  checkRoom: '/api/room/check/'
};

// ── Emojis & Results ──────────────────────────────────────────
export const G_EMOJI = { BATU: '✊', GUNTING: '✌️', KERTAS: '🖐️', TIDAK_TERDETEKSI: '❓' };
export const RESULTS = {
  MENANG: { badge: '🏆', title: 'MENANG!', cls: 'win', banner: '🏆 MENANG' },
  KALAH: { badge: '💀', title: 'KALAH...', cls: 'lose', banner: '💀 KALAH' },
  SERI: { badge: '🤝', title: 'SERI!', cls: 'draw', banner: '🤝 SERI' },
};

// ── Page order ────────────────────────────────────────────────
export const PAGES = ['page-home', 'page-howto', 'page-mode', 'page-game', 'page-mp-lobby', 'page-mp-game', 'page-result'];
