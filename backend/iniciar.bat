@echo off
chcp 65001 >nul
title Agendai - API
cd /d "%~dp0"
echo ============================================
echo   Agendai - iniciando a API (back-end)
echo ============================================
echo.

set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY python --version >nul 2>nul && set "PY=python"
if not defined PY goto :sem_python
echo [ok] Python encontrado:
%PY% --version

if exist .venv\Scripts\activate.bat goto :venv_ok
echo.
echo Criando ambiente virtual .venv ...
%PY% -m venv .venv
if errorlevel 1 goto :erro
:venv_ok
call .venv\Scripts\activate.bat

echo.
echo Instalando dependencias - na primeira vez leva alguns minutos...
python -m pip install --upgrade pip -q
pip install -r requirements.txt
if errorlevel 1 goto :erro

if not exist .env copy .env.example .env >nul

if exist agendai.db goto :rodar
echo.
echo Criando a barbearia de demonstracao...
python -m app.seed
if errorlevel 1 goto :erro

:rodar
echo.
echo ============================================
echo   API no ar: http://localhost:8000/docs
echo   Deixe esta janela aberta.
echo ============================================
python -m uvicorn app.main:app --reload
echo.
echo A API parou. Veja a mensagem acima.
pause
exit /b

:sem_python
echo [ERRO] Python nao foi encontrado neste computador.
echo.
echo 1. Vou abrir a pagina de download do Python.
echo 2. Na instalacao, MARQUE a opcao "Add python.exe to PATH".
echo 3. Depois de instalar, feche esta janela e rode o iniciar.bat de novo.
start https://www.python.org/downloads/
pause
exit /b 1

:erro
echo.
echo [ERRO] Algo deu errado. Tire um print desta janela e mande para o Claude.
pause
exit /b 1
