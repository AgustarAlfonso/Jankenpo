@echo off
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║     JankenpoVision — Starting Server     ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Server berjalan di: http://localhost:8000
echo  Tekan Ctrl+C untuk berhenti.
echo.

python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

pause
