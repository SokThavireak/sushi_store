@echo off
echo ========================================================
echo Connecting and Pushing sushi_store to GitHub:
echo https://github.com/anhahseven/sushi-store
echo ========================================================
echo.

cd /d "%~dp0"

REM 1. Initialize git if not already initialized
if not exist ".git" (
    echo [*] Initializing git repository...
    git init
)

REM 2. Rename branch to main
git branch -M main 2>nul

REM 3. Set remote origin
git remote remove origin 2>nul
git remote add origin https://github.com/anhahseven/sushi-store.git

echo [*] Current remote URL:
git remote -v
echo.

REM 4. Stage all changes
echo [*] Staging files...
git add .

REM 5. Commit
echo [*] Committing changes...
git commit -m "Security audit fixes: IDOR patch, rate limiting, and POS audit logs"

REM 6. Push to GitHub
echo [*] Pushing to main branch...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo [SUCCESS] Project successfully connected and pushed!
    echo Check: https://github.com/anhahseven/sushi-store
    echo ========================================================
) else (
    echo.
    echo [!] Standard push encountered an issue (remote may already contain commits).
    echo [!] Attempting pull --rebase or force push if needed...
    echo.
    echo To push with existing remote commits, run:
    echo   git pull origin main --rebase
    echo   git push origin main
)

pause
