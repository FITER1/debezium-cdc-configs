# =============================================================================
# Extract k6 HTML & JSON reports from in-cluster Job logs
# =============================================================================
# The k6 script embeds base64-encoded reports in stdout when EMBED_REPORTS=true.
# This script extracts them from the pod logs and saves to local files.
#
# Usage:
#   .\load-tests\scripts\extract-reports.ps1
#   .\load-tests\scripts\extract-reports.ps1 -Namespace access -JobName k6-api-load-test
#   .\load-tests\scripts\extract-reports.ps1 -OutputDir .\my-reports
# =============================================================================

param(
    [string]$Namespace = "access",
    [string]$JobName = "k6-api-load-test",
    [string]$OutputDir = "load-tests\reports\in-cluster"
)

$ErrorActionPreference = "Stop"

# Ensure output directory exists
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

Write-Host "Fetching logs from job/$JobName in namespace $Namespace..." -ForegroundColor Cyan
$logs = kubectl -n $Namespace logs "job/$JobName" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to fetch logs: $logs"
    exit 1
}

$logText = $logs -join "`n"

# Generate timestamp for filenames
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ss") + "Z"

# Extract HTML report
$htmlMatch = [regex]::Match($logText, '===BEGIN_REPORT_HTML===\s*([\s\S]*?)\s*===END_REPORT_HTML===')
if ($htmlMatch.Success) {
    $htmlB64 = $htmlMatch.Groups[1].Value.Trim()
    $htmlBytes = [Convert]::FromBase64String($htmlB64)
    $htmlPath = Join-Path $OutputDir "api-load-test-${timestamp}.html"
    [IO.File]::WriteAllBytes($htmlPath, $htmlBytes)
    Write-Host "HTML report saved: $htmlPath" -ForegroundColor Green
} else {
    Write-Warning "No HTML report found in logs. Ensure EMBED_REPORTS=true is set."
}

# Extract JSON report
$jsonMatch = [regex]::Match($logText, '===BEGIN_REPORT_JSON===\s*([\s\S]*?)\s*===END_REPORT_JSON===')
if ($jsonMatch.Success) {
    $jsonB64 = $jsonMatch.Groups[1].Value.Trim()
    $jsonBytes = [Convert]::FromBase64String($jsonB64)
    $jsonPath = Join-Path $OutputDir "api-load-test-${timestamp}.json"
    [IO.File]::WriteAllBytes($jsonPath, $jsonBytes)
    Write-Host "JSON report saved: $jsonPath" -ForegroundColor Green
} else {
    Write-Warning "No JSON report found in logs. Ensure EMBED_REPORTS=true is set."
}

if ($htmlMatch.Success) {
    Write-Host "`nDone! Open the HTML report in your browser." -ForegroundColor Cyan
}
