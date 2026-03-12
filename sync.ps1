$ErrorActionPreference = "Stop"

try {
    Write-Host "--- GitHub Sync Started ---`n" -ForegroundColor Cyan

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
