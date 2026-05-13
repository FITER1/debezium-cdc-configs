# =============================================================================
# Monitor pod CPU/memory usage during k6 load test
# =============================================================================
# Samples kubectl top pods every N seconds and writes CSV output.
#
# Usage:
#   .\load-tests\scripts\monitor-resources.ps1 -OutputFile .\reports\resource-usage.csv
# =============================================================================

param(
    [string]$Namespace = "access",
    [string]$OutputFile = "load-tests\reports\resource-usage.csv",
    [int]$IntervalSeconds = 10,
    [string]$StopFile = "load-tests\reports\.stop-monitor"
)

$ErrorActionPreference = "SilentlyContinue"

# Ensure output directory exists
$dir = Split-Path $OutputFile -Parent
if ($dir) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

# Write CSV header
"timestamp,pod,cpu_millicores,memory_mib" | Out-File -FilePath $OutputFile -Encoding utf8

# Clean up any previous stop file
Remove-Item $StopFile -ErrorAction SilentlyContinue

Write-Host "[Monitor] Started sampling every ${IntervalSeconds}s. Writing to $OutputFile" -ForegroundColor Cyan
Write-Host "[Monitor] Create '$StopFile' to stop monitoring." -ForegroundColor Gray

$sampleCount = 0
while (-not (Test-Path $StopFile)) {
    $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    
    $lines = kubectl -n $Namespace top pods --no-headers 2>&1
    if ($LASTEXITCODE -eq 0 -and $lines) {
        foreach ($line in $lines) {
            if ($line -match '^\s*(\S+)\s+(\d+)m\s+(\d+)Mi') {
                $pod = $Matches[1]
                $cpu = $Matches[2]
                $mem = $Matches[3]
                "$ts,$pod,$cpu,$mem" | Out-File -FilePath $OutputFile -Encoding utf8 -Append
            }
        }
    }

    $sampleCount++
    if ($sampleCount % 6 -eq 0) {
        Write-Host "[Monitor] $sampleCount samples collected ($ts)" -ForegroundColor DarkGray
    }

    Start-Sleep -Seconds $IntervalSeconds
}

Write-Host "[Monitor] Stopped after $sampleCount samples." -ForegroundColor Cyan
Remove-Item $StopFile -ErrorAction SilentlyContinue
