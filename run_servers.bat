@echo off
echo Starting Nano-Banana Image Editor servers...

REM Start Flask backend
start /b cmd /c "cd backend && venv\Scripts\activate && python app.py"

REM Wait a bit for backend to start
timeout /t 5 /nobreak > nul

REM Start React frontend
start /b cmd /c "cd frontend && npm start"

echo Servers started!
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
pause