#!/bin/bash

# Configuration
REPO_URL="https://github.com/yasserelalfy/yasserelalfy.github.io.git"
USER_NAME="Yasser El-Alfy"
USER_EMAIL="yas.alfy@gmail.com"

echo "--- GitHub Sync Started ---"

# Check if this is a git repo
if [ ! -d ".git" ]; then
    echo "Initializing Git Repository..."
    git init
    git remote add origin "$REPO_URL"
    git branch -M main
fi

# Set local identity
git config user.name "$USER_NAME"
git config user.email "$USER_EMAIL"

# Add all changes
echo "Adding changes..."
git add .

# Prompt for a commit message
DEFAULT_MSG="Update: $(date +'%Y-%m-%d %H:%M')"
read -p "Enter commit message (Press Enter for '$DEFAULT_MSG'): " msg

if [ -z "$msg" ]; then
    msg="$DEFAULT_MSG"
fi

# Commit
echo "Committing..."
git commit -m "$msg"

# Push
echo "Pushing to GitHub..."
git push -u origin main -f

echo "✅ Sync Complete!"
read -p "Press any key to close..."
