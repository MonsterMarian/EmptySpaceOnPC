@echo off
cd /d "%~dp0"
echo Startuji Vite Server...
start cmd /k "npm run dev"
timeout /t 3 /nobreak
echo Startuji Electron aplikaci...
start cmd /k "npm run electron-dev"
