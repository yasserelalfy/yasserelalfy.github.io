$ErrorActionPreference = "Stop"

try {
    Write-Host "--- GitHub Sync Started ---`n" -ForegroundColor Cyan

    # --- NEW: Google Drive Conflict Cleanup ---
    if (Test-Path .git) {
        Write-Host "Checking for Google Drive conflict files in .git..." -ForegroundColor Gray
        $conflicts = Get-ChildItem .git -Recurse -Filter "*(*)*" -ErrorAction SilentlyContinue
        if ($conflicts) {
            Write-Host "Found $($conflicts.Count) conflict files. Cleaning up..." -ForegroundColor Yellow
            $conflicts | Remove-Item -Force
            Write-Host "Cleanup done." -ForegroundColor Gray
        }
    }

    # Check if this is a git repo
    if (!(Test-Path .git)) {
        Write-Host "Initializing Git Repository..." -ForegroundColor Yellow
        git init
        git remote add origin https://github.com/yasserelalfy/yasserelalfy.github.io.git
        git branch -M main
    }

    # Ensure identity is set (local only)
    git config user.email "yas.alfy@gmail.com"
    git config user.name "Yasser El-Alfy"

    # --- Run Python Scripts Before Sync ---
    Write-Host "`n--- Running Pre-Sync Scripts ---`n" -ForegroundColor Yellow

    # 1. Update Scholar Data
    if (Test-Path "update_scholar.py") {
        Write-Host "Running update_scholar.py..." -ForegroundColor Gray
        try {
            python update_scholar.py
            Write-Host "Scholar data updated successfully." -ForegroundColor Green
        } catch {
            Write-Host "Warning: update_scholar.py failed: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host "Continuing with sync..." -ForegroundColor Gray
        }
    } else {
        Write-Host "update_scholar.py not found, skipping." -ForegroundColor Gray
    }

    # 2. Generate CV
    if (Test-Path "generate_cv.py") {
        Write-Host "Running generate_cv.py..." -ForegroundColor Gray
        try {
            python generate_cv.py
            Write-Host "CV generated successfully." -ForegroundColor Green
        } catch {
            Write-Host "Warning: generate_cv.py failed: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host "Continuing with sync..." -ForegroundColor Gray
        }
    } else {
        Write-Host "generate_cv.py not found, skipping." -ForegroundColor Gray
    }

    Write-Host "`n--- Pre-Sync Scripts Complete ---`n" -ForegroundColor Yellow

    # Add all changes
    Write-Host "Adding changes..." -ForegroundColor Gray
    git add .

    # Prompt for a commit message
    Write-Host "`n--- Git Commit ---" -ForegroundColor Yellow
    $defaultMsg = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    $msg = Read-Host "Enter commit message (Press Enter for '$defaultMsg')"
    if ([string]::IsNullOrWhiteSpace($msg)) { $msg = $defaultMsg }

    Write-Host "Committing..." -ForegroundColor Gray
    git commit -m "$msg"

    # Push to GitHub
    Write-Host "`nPushing to GitHub..." -ForegroundColor Cyan
    git push -u origin main -f

    Write-Host "`n✅ Sync Complete!" -ForegroundColor Green
}
catch {
    Write-Host "`n❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nIf this is your first time, you might need to login to GitHub in the window that pops up." -ForegroundColor Gray
}

Write-Host "`nPress any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
