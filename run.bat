@echo off
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     JankenpoVision — Starting Server     ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Menjalankan static server...
echo  Buka browser di: http://localhost:3000
echo  Tekan Ctrl+C untuk berhenti.
echo.

cd frontend
npx live-server --port=3000

pause
