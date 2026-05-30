@echo off
echo ============================================
echo   KMJAVideo Build
echo ============================================
echo.

echo [1/3] Cleaning release directory...
if exist release rmdir /s /q release

echo [2/3] Building Vite frontend...
call npm run build:renderer
if %errorlevel% neq 0 (
    echo ERROR: Vite build failed!
    pause
    exit /b %errorlevel%
)

echo [3/3] Packaging to ZIP with electron-builder...
call npx electron-builder --win
if %errorlevel% neq 0 (
    echo ERROR: electron-builder packaging failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ============================================
echo   Build complete! ZIP output in ^.\release\
echo ============================================
pause