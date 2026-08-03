@echo off
setlocal EnableExtensions
chcp 65001 >nul

REM Sube a la raíz del repo (este .bat vive en /web)
cd /d "%~dp0.."
if errorlevel 1 (
  echo No se pudo cambiar al directorio del repositorio.
  pause
  exit /b 1
)

echo.
echo === Estado actual ===
git status --short
echo.

if errorlevel 1 (
  echo Git no disponible o esta carpeta no es un repositorio.
  pause
  exit /b 1
)

set /p MSG=Mensaje del commit: 
if "%MSG%"=="" (
  echo Cancelado: mensaje vacio.
  pause
  exit /b 1
)

echo.
echo Agregando todos los cambios...
git add -A
if errorlevel 1 (
  echo Fallo al hacer git add.
  pause
  exit /b 1
)

echo.
echo Creando commit...
git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo El commit no se creo. Revisa el mensaje de error arriba.
  echo Si no habia cambios, git no crea commit vacio.
  pause
  exit /b 1
)

echo.
echo === Listo ===
git status
echo.
echo Tip: para subir al remoto usa: git push
echo.
pause
endlocal
