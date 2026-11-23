# Prepared Stage A supervisor. No task is installed and no control is enabled.
# Run only after separately approved persistent delivery activation.
param([switch]$Check,[switch]$Run)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskWorker = Join-Path $taskRoot 'scripts\persistent-registration-worker.mjs'
$taskNode = (Get-Command node.exe -ErrorAction Stop).Source
if ($Check) {
    Set-Location -LiteralPath $taskRoot
    & $taskNode --conditions=react-server $taskWorker --check
    exit $LASTEXITCODE
}
if (-not $Run) { throw 'Choose Check, or Run only after Stage D activation approval.' }
Set-Location -LiteralPath $taskRoot
$taskDelay = 5
while ($true) {
    & $taskNode --conditions=react-server $taskWorker --run
    if ($LASTEXITCODE -eq 0) { break } # Revoked/closed controls stay stopped.
    Write-Output 'Mitsa worker unavailable. Retrying without changing activation controls.'
    Start-Sleep -Seconds $taskDelay
    $taskDelay = [Math]::Min(30, $taskDelay * 2)
}
