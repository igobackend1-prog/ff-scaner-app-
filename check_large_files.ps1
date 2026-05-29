$reportFile = "d:\ff-scanner-app\large_files_report.txt"
$utf8 = New-Object System.Text.UTF8Encoding($false)

$output = @()
$output += "=== Top 20 Largest Files in Downloads ==="

if (Test-Path "C:\Users\Buddy\Downloads") {
    $files = Get-ChildItem -Path "C:\Users\Buddy\Downloads" -File -Recurse -ErrorAction SilentlyContinue |
             Sort-Object Length -Descending | Select-Object -First 20
    foreach ($f in $files) {
        $sizeMB = [Math]::Round($f.Length / 1MB, 2)
        $output += "$($f.FullName) - $sizeMB MB"
    }
} else {
    $output += "Downloads folder not found"
}

$output += ""
$output += "=== Top 20 Largest Files in .gemini ==="
if (Test-Path "C:\Users\Buddy\.gemini") {
    $files = Get-ChildItem -Path "C:\Users\Buddy\.gemini" -File -Recurse -ErrorAction SilentlyContinue |
             Sort-Object Length -Descending | Select-Object -First 20
    foreach ($f in $files) {
        $sizeMB = [Math]::Round($f.Length / 1MB, 2)
        $output += "$($f.FullName) - $sizeMB MB"
    }
}

[System.IO.File]::WriteAllLines($reportFile, $output, $utf8)
