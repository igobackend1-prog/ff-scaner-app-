$targets = [ordered]@{
    "Antigravity Folder" = "C:\Users\Buddy\.gemini\antigravity"
    "Antigravity IDE Folder" = "C:\Users\Buddy\.gemini\antigravity-ide"
    "npm Cache" = "C:\Users\Buddy\AppData\Local\npm-cache"
    "Temp Folder" = "C:\Users\Buddy\AppData\Local\Temp"
    "pip Cache" = "C:\Users\Buddy\AppData\Local\pip"
    "Chrome Cache" = "C:\Users\Buddy\AppData\Local\Google\Chrome\User Data\Default\Cache"
    "Edge Cache" = "C:\Users\Buddy\AppData\Local\Microsoft\Edge\User Data\Default\Cache"
    "pnpm Store" = "C:\Users\Buddy\AppData\Local\pnpm-store"
    "Gradle Cache" = "C:\Users\Buddy\.gradle"
    "Maven Cache" = "C:\Users\Buddy\.m2"
    "Cargo Cache" = "C:\Users\Buddy\.cargo"
    "Rustup" = "C:\Users\Buddy\.rustup"
    "Docker folder" = "C:\Users\Buddy\.docker"
    ".cache Folder" = "C:\Users\Buddy\.cache"
    "Gemini Folder" = "C:\Users\Buddy\.gemini"
    "Android SDK" = "C:\Users\Buddy\AppData\Local\Android\Sdk"
}

$reportFile = "d:\ff-scanner-app\targeted_space_report.txt"

# Initialize file
Set-Content -Path $reportFile -Value "=== Targeted Cache and Folder Space Report ===" -Encoding UTF8

foreach ($key in $targets.Keys) {
    $dirPath = $targets[$key]
    if (Test-Path $dirPath) {
        Add-Content -Path $reportFile -Value "Scanning $key ($dirPath)..." -Encoding UTF8
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
        Add-Content -Path $reportFile -Value "$key ($dirPath) : $sizeGB GB ($size bytes)" -Encoding UTF8
    } else {
        Add-Content -Path $reportFile -Value "$key ($dirPath) : NOT FOUND" -Encoding UTF8
    }
}

Add-Content -Path $reportFile -Value "Report complete." -Encoding UTF8
