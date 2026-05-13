param(
    [string[]]$Namespaces = @("access", "access-cdc", "kafka"),
    [string]$OutputFile = "load-tests\reports\cdc-pipeline-resources.csv",
    [int]$IntervalSeconds = 10,
    [string]$StopFile = "load-tests\reports\.stop-cdc-monitor"
)

$ErrorActionPreference = "Continue"

# Resolve to absolute
$OutputFile = [System.IO.Path]::GetFullPath($OutputFile)
$StopFile = [System.IO.Path]::GetFullPath($StopFile)

# Clean up previous stop file
if (Test-Path $StopFile) { Remove-Item $StopFile -Force }

# CSV header
"timestamp,namespace,pod,cpu_millicores,memory_mib" | Out-File -FilePath $OutputFile -Encoding utf8

Write-Host "[Monitor] Started sampling every ${IntervalSeconds}s across namespaces: $($Namespaces -join ', ')"
Write-Host "[Monitor] Writing to $OutputFile"
Write-Host "[Monitor] Create '$StopFile' to stop monitoring."

$sampleCount = 0

while ($true) {
    if (Test-Path $StopFile) {
        Write-Host "[Monitor] Stopped after $sampleCount samples."
        Remove-Item $StopFile -Force -ErrorAction SilentlyContinue
        break
    }

    $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

    foreach ($ns in $Namespaces) {
        try {
            $raw = kubectl -n $ns top pods --no-headers 2>&1
            if ($LASTEXITCODE -ne 0) { continue }

            foreach ($line in ($raw -split "`n")) {
                $line = $line.Trim()
                if (-not $line) { continue }

                $parts = $line -split '\s+'
                if ($parts.Count -lt 3) { continue }

                $pod = $parts[0]
                $cpu = $parts[1] -replace 'm$', ''
                $mem = $parts[2] -replace 'Mi$', ''

                "$ts,$ns,$pod,$cpu,$mem" | Out-File -FilePath $OutputFile -Append -Encoding utf8
                $sampleCount++
            }
        } catch {
            Write-Host "[Monitor] Error sampling $ns : $_"
        }
    }

    # Progress every 6 samples (~1 minute)
    if ($sampleCount % 60 -eq 0 -and $sampleCount -gt 0) {
        Write-Host "[Monitor] $sampleCount samples collected ($ts)"
    }

    Start-Sleep -Seconds $IntervalSeconds
}
