# JankenpoVision

JankenpoVision adalah aplikasi permainan Batu-Gunting-Kertas berbasis web yang menggunakan teknologi Computer Vision (MediaPipe) untuk mendeteksi gestur tangan pemain secara real-time melalui kamera web. Aplikasi ini dibangun dengan Vanilla JavaScript tanpa kerangka kerja tambahan untuk logika utama.

## Fitur Utama

1. Mode Webcam (Vs AI)
   Bermain melawan sistem komputer. Aplikasi menghitung mundur (3, 2, 1) dan membaca gestur tangan dari kamera menggunakan model MediaPipe Hand Landmarker.
   
2. Mode Upload
   Pemain dapat mengunggah gambar tangan (JPG/PNG/WebP), kemudian sistem akan mendeteksi apakah gambar tersebut adalah gestur Batu, Gunting, atau Kertas beserta penempatan anotasi visual pada gambar.

3. Mode Multiplayer Online
   Bermain bersama pemain lain secara real-time.
   - Menggunakan Firebase Realtime Database.
   - Menyediakan sistem Room Code dan Direct Link Sharing.
   - Memiliki sinkronisasi status dan pilihan gestur untuk menjaga keadilan permainan.

4. End-to-End Testing (E2E)
   Pengujian otomatis menggunakan Jest dan Puppeteer untuk memverifikasi logika permainan dan alur multiplayer.

## Panduan Instalasi dan Menjalankan Aplikasi

Aplikasi ini beroperasi sepenuhnya pada sisi klien (Client-Side). Node.js digunakan sebatas untuk pengujian dan penyediaan server lokal.

### Prasyarat
- Node.js (versi 14 atau lebih baru) disarankan untuk testing.
- Browser web (Chrome, Edge, Firefox) dengan dukungan WebGL.

### Langkah-langkah
1. Klon repositori ini:
   ```bash
   git clone https://github.com/AgustarAlfonso/Jankenpo.git
   cd Jankenpo
   ```

2. Jalankan Aplikasi:
   Jalankan file `run.bat` (Windows) atau gunakan perintah berikut di terminal:
   ```bash
   npx live-server frontend --port=3000
   ```
   Aplikasi dapat diakses di `http://127.0.0.1:3000`.

## Konfigurasi Firebase (Untuk Multiplayer)

Fungsi multiplayer memerlukan konfigurasi proyek Firebase:
1. Buat proyek di Firebase Console.
2. Aktifkan Realtime Database dan pilih lokasi server terdekat.
3. Ubah aturan (Rules) database menjadi:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Salin Firebase Config proyek Anda dan tempelkan ke dalam variabel `firebaseConfig` pada file `frontend/app.js`.

## Menjalankan Pengujian

Aplikasi ini memiliki rangkaian pengujian terotomatisasi.

1. Pasang dependensi pengujian:
   ```bash
   cd frontend
   npm install
   ```
2. Jalankan seluruh pengujian:
   Pastikan aplikasi sedang berjalan di port 3000 (`npx live-server frontend --port=3000`), kemudian jalankan:
   ```bash
   npm run test
   ```

## Struktur Folder

```text
Jankenpo/
├── frontend/
│   ├── js/
│   │   ├── core/         # Modul inti: constants, domRefs, navigation, toast
│   │   ├── detection/    # Logika MediaPipe: handDetection
│   │   ├── game/         # Logika permainan: singlePlayer, particles
│   │   └── multiplayer/  # Logika jaringan: multiplayer, afkTimer, rematchManager, dll.
│   ├── app.js            # Entry point aplikasi
│   ├── index.html        # Struktur antarmuka
│   ├── style.css         # Gaya tampilan
│   ├── tests/            # Kumpulan skrip pengujian E2E (Puppeteer & Jest)
│   ├── package.json      # Dependensi NPM untuk pengujian
│   └── jest.config.js
├── README.md
├── run.bat               # Skrip eksekusi lokal (Windows)
└── .gitignore
```

## Teknologi yang Digunakan
- Frontend: HTML5, CSS3, Vanilla JavaScript
- Computer Vision: MediaPipe Tasks Vision (Hand Landmarker)
- Database: Firebase Realtime Database
- Testing: Jest & Puppeteer

---
Dibuat untuk keperluan tugas kuliah dan portofolio pengembangan web.
