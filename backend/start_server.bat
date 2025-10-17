@echo off
echo Starting Clinic-AI Backend Server...
echo.

REM Set environment variables
set ENCRYPTION_KEY=f-4POHOQjHFQzaUIL20fCppAMg69aFmLMuaAD9CUuHc=
set OPENAI_API_KEY=sk-placeholder-key-for-development
set DEBUG=true

echo Environment variables set:
echo - ENCRYPTION_KEY: Set
echo - OPENAI_API_KEY: Set (placeholder)
echo - DEBUG: true
echo.

REM Start the server
echo Starting server...
uvicorn --app-dir src clinicai.app:app --reload --host 0.0.0.0 --port 8000

pause
