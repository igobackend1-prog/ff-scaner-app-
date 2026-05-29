$reportFile = "d:\ff-scanner-app\large_files_report.txt"
$utf8 = New-Object System.Text.UTF8Encoding($false)

$output = @()
$output += "=== Files Larger than 50 MB in C:\Users\Buddy (excluding AppData/Gemini/Antigravity) ==="

$userFolders = Get-ChildItem -Path "C:\Users\Buddy" -Directory -ErrorAction SilentlyContinue | 
               Where-Object { $_.Name -notin "AppData", ".gemini", ".antigravity", ".antigravity-ide", ".antigravity-backup" }

foreach ($folder in $userFolders) {
    try {
        $files = Get-ChildItem -Path $folder.FullName -Recurse -File -Attributes !ReparsePoint -ErrorAction SilentlyContinue |
                 Where-Object { $_.Length -gt 50MB }
        foreach ($f in $files) {
            $sizeMB = [Math]::Round($f.Length / 1MB, 2)
            $output += "$($f.FullName) - $sizeMB MB"
        }
    } catch {
        # ignore errors
    }
}

[System.IO.File]::WriteAllLines($reportFile, $output, $utf8)
