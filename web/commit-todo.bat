@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

REM Sube a la raíz del repo (este .bat vive en /web)
cd /d "%~dp0.."
if errorlevel 1 (
  echo No se pudo cambiar al directorio del repositorio.
  pause
  exit /b 1
)

echo.
echo === Repo ===
echo Carpeta: %CD%
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%b"
if not defined BRANCH (
  echo Git no disponible o esta carpeta no es un repositorio.
  pause
  exit /b 1
)
echo Rama: !BRANCH!
echo.

echo === Estado actual ===
git status --short
echo.

set "HAS_CHANGES=0"
for /f "delims=" %%L in ('git status --porcelain 2^>nul') do set "HAS_CHANGES=1"

if "!HAS_CHANGES!"=="0" (
  echo No hay cambios locales para commitear.
  echo.
  set /p SOLO_PUSH=Subir igual al remoto ^(push^)? [S/N]: 
  if /i "!SOLO_PUSH!"=="S" goto DO_PUSH
  echo Cancelado.
  pause
  exit /b 0
)

set /p MSG=Mensaje del commit: 
if "!MSG!"=="" (
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
git commit -m "!MSG!"
if errorlevel 1 (
  echo.
  echo El commit no se creo. Revisa el mensaje de error arriba.
  echo Si no habia cambios, git no crea commit vacio.
  pause
  exit /b 1
)

echo.
echo Commit creado en rama !BRANCH!.
echo.

set /p HACER_PUSH=Hacer git push ahora? [S/N]: 
if /i not "!HACER_PUSH!"=="S" (
  echo.
  echo Commit listo. Push omitido.
  echo Tip: vuelve a ejecutar el .bat o usa: git push
  echo.
  git status -sb
  pause
  exit /b 0
)

:DO_PUSH
echo.
echo === Push a remoto ===

git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >nul 2>&1
if errorlevel 1 (
  echo Sin upstream: git push -u origin !BRANCH!
  git push -u origin "!BRANCH!"
) else (
  git push
)

if errorlevel 1 (
  echo.
  echo Fallo el push. Revisa autenticacion / remoto / permisos.
  pause
  exit /b 1
)

echo.
echo === Listo ^(commit + push^) ===
git status -sb
echo.
pause
endlocal
