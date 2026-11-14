@echo off
REM Abre a API e o site em duas janelas e depois abre o navegador.
cd /d "%~dp0"
start "Agendai - API" cmd /k ""%~dp0backend\iniciar.bat""
start "Agendai - Site" cmd /k ""%~dp0frontend\iniciar.bat""
echo Aguardando os servidores subirem...
echo Na primeira vez a instalacao demora alguns minutos. Acompanhe as outras duas janelas.
timeout /t 25 >nul
start http://localhost:5173
