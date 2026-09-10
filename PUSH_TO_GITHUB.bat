@echo off
title Push Virtualengine to GitHub
color 0A
echo ====================================================================
echo  BHARAT AEROTWIN - PUSHING ALL LATEST COMMITS TO GITHUB REPO
echo ====================================================================
echo.
cd /d "C:\Users\dhyan\OneDrive\Desktop\Virtualengine"

echo Current Git Status:
"C:\Users\dhyan\.mingit\cmd\git.exe" log -n 3 --oneline
echo.
echo Starting Push to https://github.com/roaringrebel/Virtualengine.git ...
echo (If a browser window appears, please authorize your GitHub login)
echo.

"C:\Users\dhyan\.mingit\cmd\git.exe" push origin main

echo.
echo ====================================================================
if %errorlevel% equ 0 (
    echo  [SUCCESS] All commits pushed to GitHub successfully!
    echo  View them at: https://github.com/roaringrebel/Virtualengine/commits/main
) else (
    echo  [ERROR] Git push encountered an issue. Please review the output above.
)
echo ====================================================================
echo.
pause
