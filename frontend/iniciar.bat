@echo off
chcp 65001 >nul
title Agendai - Site
cd /d "%~dp0"
echo ============================================
echo   Agendai - iniciando o site (front-end)
echo ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 goto :sem_node
echo [ok] Node.js encontrado:
node --version

if exist node_modules goto :rodar
echo.
echo Instalando dependencias - na primeira vez leva 1 ou 2 minutos...
call npm install
if errorlevel 1 goto :erro

:rodar
echo.
echo ============================================
echo   Site no ar: http://localhost:5173
echo   Deixe esta janela aberta.
echo ============================================
call npm run dev
echo.
echo O site parou. Veja a mensagem acima.
pause
exit /b

:sem_node
echo [ERRO] Node.js nao foi encontrado neste computador.
echo.
echo 1. Vou abrir a pagina de download do Node.js. Baixe a versao LTS.
echo 2. Instale com as opcoes padrao.
echo 3. Depois de instalar, feche esta janela e rode o iniciar.bat de novo.
start https://nodejs.org/pt
pause
exit /b 1

:erro
echo.
echo [ERRO] Algo deu errado. Tire um print desta janela e mande para o Claude.
pause
exit /b 1
