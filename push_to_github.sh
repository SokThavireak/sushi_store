#!/bin/bash

echo "========================================================"
echo "Connecting and Pushing sushi_store to GitHub:"
echo "https://github.com/anhahseven/sushi-store"
echo "========================================================"

# Navigate to script directory
cd "$(dirname "$0")"

# 1. Initialize git if not already initialized
if [ ! -d ".git" ]; then
    echo "[*] Initializing git repository..."
    git init
fi

# 2. Rename branch to main
git branch -M main

# 3. Set remote origin
git remote remove origin 2>/dev/null
git remote add origin https://github.com/anhahseven/sushi-store.git

echo "[*] Current remote URL:"
git remote -v

# 4. Stage all files
echo "[*] Staging files..."
git add .

# 5. Commit
echo "[*] Committing changes..."
git commit -m "Security audit fixes: IDOR patch, rate limiting, and POS audit logs"

# 6. Push to main
echo "[*] Pushing to main branch..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo "========================================================"
    echo "[SUCCESS] Project successfully connected and pushed!"
    echo "Check: https://github.com/anhahseven/sushi-store"
    echo "========================================================"
else
    echo "[!] If remote has existing files, run: git pull origin main --rebase && git push origin main"
fi
