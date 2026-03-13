#!/bin/bash

# Configuration
REPO_URL="https://github.com/yasserelalfy/yasserelalfy.github.io.git"
USER_NAME="Yasser El-Alfy"
USER_EMAIL="yas.alfy@gmail.com"

echo "--- GitHub Sync Started ---"

# --- NEW: Google Drive Conflict Cleanup ---
# Google Drive often creates "conflict" files like "index (1)" inside .git
# which breaks git operations. This cleans them up automatically.
if [ -d ".git" ]; then
    echo "Checking for Google Drive conflict files in .git..."
    CONFLICTS=$(find .git -name "*(*)*")
    if [ ! -z "$CONFLICTS" ]; then
        echo "Found conflict files. Cleaning up..."
        find .git -name "*(*)*" -delete
        echo "Cleanup done."
    fi
fi

# Check if this is a git repo
if [ ! -d ".git" ]; then
    echo "Initializing Git Repository..."
    git init || { echo "Failed to init git"; exit 1; }
    git remote add origin "$REPO_URL" || { echo "Failed to add remote"; exit 1; }
    git branch -M main || { echo "Failed to set branch"; exit 1; }
fi

# Set local identity
git config user.name "$USER_NAME"
git config user.email "$USER_EMAIL"

# Add all changes
echo "Adding changes..."
git add . || { echo "Failed to add changes"; exit 1; }

# Prompt for a commit message
DEFAULT_MSG="Update: $(date +'%Y-%m-%d %H:%M')"
read -p "Enter commit message (Press Enter for '$DEFAULT_MSG'): " msg

if [ -z "$msg" ]; then
    msg="$DEFAULT_MSG"
fi

# Commit
echo "Committing..."
git commit -m "$msg" || { echo "Nothing to commit or commit failed."; }

# Push
echo "Pushing to GitHub..."
git push -u origin main -f || { echo "Push failed. Check your internet or GitHub permissions."; exit 1; }

echo "✅ Sync Complete!"
read -p "Press any key to close..."
