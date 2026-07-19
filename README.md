# JankenpoVision ✌️✊🖐️

JankenpoVision adalah aplikasi permainan Batu-Gunting-Kertas modern berbasis web yang memanfaatkan teknologi **Computer Vision** (MediaPipe) untuk mendeteksi gestur tangan pemain secara *real-time* melalui kamera web. Aplikasi ini dibangun dengan Vanilla JavaScript dan memiliki antarmuka (UI) yang dinamis, interaktif, dan *glassmorphic*.

## 🌟 Fitur Utama

1. **🤖 Mode Webcam (Vs AI)**
   Bermain langsung melawan AI. Aplikasi akan menghitung mundur (3, 2, 1) dan secara otomatis membaca gestur tangan dari kamera menggunakan model AI *MediaPipe Hand Landmarker*.
   
2. **📁 Mode Upload**
   Pemain dapat mengunggah gambar tangan (JPG/PNG/WebP), lalu AI akan mendeteksi apakah gambar tersebut adalah gestur Batu, Gunting, atau Kertas. Lengkap dengan anotasi visual (titik-titik kerangka tangan) pada gambar.

3. **🌐 Mode Multiplayer Online**
   Bermain bersama temanmu dalam waktu nyata (real-time) melalui jaringan internet.
   - Menggunakan **Firebase Realtime Database**.
   - Sistem *Room Code* (6 huruf) dan *Direct Link Sharing*.
   - Sinkronisasi status siap (Ready) dan pilihan gestur pemain untuk memastikan permainan yang adil (tidak ada yang curang dengan melihat jawaban lawan).

4. **🧪 End-to-End Testing (E2E)**
   Mendukung pengujian otomatis menggunakan **Jest** dan **Puppeteer** untuk memverifikasi logika game dan alur multiplayer secara headless/otomatis.

## 🚀 Panduan Instalasi & Menjalankan Aplikasi

Aplikasi ini 100% Client-Side dan tidak memerlukan Node.js server-side untuk berjalan. Namun, Node.js digunakan untuk pengujian (testing) dan local server.

### Prasyarat
- [Node.js](https://nodejs.org) (v14 atau lebih baru)
- Browser modern (Chrome, Edge, Firefox) dengan dukungan WebGL.

### Langkah-langkah
1. **Clone repositori ini:**
   ```bash
   git clone https://github.com/AgustarAlfonso/Jankenpo.git
   cd Jankenpo
   ```

2. **Jalankan Aplikasi:**
   Karena aplikasi ini hanya menggunakan HTML, CSS, dan JS standar (serta CDN), Anda hanya perlu menjalankan *Live Server*.
   Klik ganda pada file **`run.bat`** (Windows) atau jalankan perintah berikut di terminal:
   ```bash
   npx live-server frontend --port=8000
   ```
   Aplikasi akan terbuka secara otomatis di `http://localhost:8000`.

## 🛠️ Konfigurasi Firebase (Untuk Multiplayer)

Untuk memastikan mode Multiplayer berfungsi, Anda perlu memiliki *Project* Firebase sendiri:
1. Buat proyek di [Firebase Console](https://console.firebase.google.com/).
2. Aktifkan **Realtime Database** dan atur region terdekat (misal: `asia-southeast1`).
3. Ubah aturan (*Rules*) database menjadi:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Dapatkan **Firebase Config** Anda, lalu tempelkan (replace) ke dalam variabel `firebaseConfig` yang ada di file `frontend/app.js` baris ke-5.

## 🧪 Menjalankan Pengujian (Unit & E2E Testing)

Aplikasi ini dilengkapi pengujian UI terotomatisasi.

1. **Install dependensi (hanya untuk testing):**
   ```bash
   cd frontend
   npm install
   ```
2. **Jalankan Uji Coba Logika Dasar (Unit Test):**
   ```bash
   npm run test
   ```
3. **Jalankan Uji Coba Multiplayer E2E (Puppeteer):**
   *(Pastikan aplikasi sedang berjalan di port 8000 menggunakan `live-server` sebelum mengeksekusi ini)*
   ```bash
   npx jest tests/multiplayer.test.js
   ```

## 🏗️ Struktur Folder

```text
Jankenpo/
├── frontend/
│   ├── app.js             # Logika utama aplikasi (MediaPipe, Game State, Firebase)
│   ├── index.html         # Struktur UI Aplikasi
│   ├── style.css          # Desain antarmuka (Glassmorphism & Animasi)
│   ├── tests/             # Kumpulan skrip pengujian E2E (Puppeteer)
│   │   ├── e2e.test.js
│   │   ├── logic.test.js
│   │   └── multiplayer.test.js
│   ├── package.json       # Dependensi NPM (hanya untuk testing)
│   └── jest.config.js
├── README.md
├── run.bat                # Skrip jalan pintas (Windows)
└── .gitignore             # Pengabaian file untuk Git
```

## 💡 Teknologi yang Digunakan
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Computer Vision:** [MediaPipe Tasks Vision (Hand Landmarker)](https://developers.google.com/mediapipe)
- **Backend/Database:** [Firebase Realtime Database](https://firebase.google.com/)
- **Testing:** Jest & Puppeteer

---
Dibuat untuk keperluan tugas kuliah dan portofolio pengembangan web masa depan.
