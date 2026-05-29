$folders = @(
    ".antigravity",
    ".antigravity-ide",
    ".bun",
    ".cache",
    ".cagent",
    ".claude",
    ".codex",
    ".config",
    ".copilot",
    ".docker",
    ".expo",
    ".gemini",
    ".npm",
    ".ollama",
    ".vscode",
    "AppData",
    "Documents",
    "Downloads",
    "farmersfactory-",
    "OneDrive",
    "npm-cache",
    "WorkPlannerApp",
    "PycharmProjects"
)

$reportFile = "d:\ff-scanner-app\space_report.txt"

# Initialize file with UTF-8 encoding
Set-Content -Path $reportFile -Value "Starting targeted space scan of C:\Users\Buddy at $(Get-Date)" -Encoding UTF8

foreach ($folderName in $folders) {
    $dirPath = "C:\Users\Buddy\$folderName"
    if (Test-Path $dirPath) {
        Add-Content -Path $reportFile -Value "Scanning $folderName..." -Encoding UTF8
        $size = 0
        try {
            $files = Get-ChildItem -Path $dirPath -Recurse -File -Attributes !ReparsePoint -ErrorAction SilentlyContinue
            if ($files) {
                $size = ($files | Measure-Object -Property Length -Sum).Sum
            }
        } catch {
            # ignore errors
        }
        $sizeGB = [Math]::Round($size / 1GB, 2)
        Add-Content -Path $reportFile -Value "$folderName : $sizeGB GB ($size bytes)" -Encoding UTF8
    } else {
        Add-Content -Path $reportFile -Value "$folderName : NOT FOUND" -Encoding UTF8
    }
}

Add-Content -Path $reportFile -Value "Scan complete at $(Get-Date)" -Encoding UTF8
