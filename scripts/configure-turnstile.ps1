# Run privately under your ordinary Windows account. Both prompts are hidden.
# Saves only three CAPTCHA settings to ignored .env.local. No network action.
$ErrorActionPreference = 'Stop'
$taskSiteKey = $null
$taskSecretKey = $null
$taskSitePointer = [IntPtr]::Zero
$taskSecretPointer = [IntPtr]::Zero
$taskProcess = $null
try {
    $taskSiteKey = Read-Host 'Mitsa - Development site key (hidden)' -AsSecureString
    $taskSecretKey = Read-Host 'Mitsa - Development secret key (hidden)' -AsSecureString
    $taskSitePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSiteKey)
    $taskSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecretKey)
    $taskPayload = @{
        siteKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskSitePointer)
        secretKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskSecretPointer)
    } | ConvertTo-Json -Compress
    $taskInfo = [Diagnostics.ProcessStartInfo]::new()
    $taskInfo.FileName = 'node.exe'
    $taskInfo.Arguments = '"' + (Join-Path $PSScriptRoot 'configure-turnstile.mjs') + '"'
    $taskInfo.WorkingDirectory = Split-Path $PSScriptRoot -Parent
    $taskInfo.UseShellExecute = $false
    $taskInfo.CreateNoWindow = $true
    $taskInfo.RedirectStandardInput = $true
    $taskInfo.RedirectStandardOutput = $true
    $taskInfo.RedirectStandardError = $true
    $taskProcess = [Diagnostics.Process]::Start($taskInfo)
    $taskProcess.StandardInput.Write($taskPayload)
    $taskProcess.StandardInput.Close()
    $taskOutput = $taskProcess.StandardOutput.ReadToEnd()
    $null = $taskProcess.StandardError.ReadToEnd()
    $taskProcess.WaitForExit()
    if ($taskProcess.ExitCode -ne 0) { throw 'Private setup failed.' }
    Write-Host 'Private Turnstile configuration saved. Registration remains isolated-test. No network or Supabase change was made.'
} catch {
    Write-Host 'Turnstile setup did not complete. No private details were printed. Check local mode, Git exclusions and widget keys.'
    exit 1
} finally {
    if ($taskSitePointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskSitePointer) }
    if ($taskSecretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskSecretPointer) }
    if ($taskSiteKey) { $taskSiteKey.Dispose() }
    if ($taskSecretKey) { $taskSecretKey.Dispose() }
    if ($taskProcess) { $taskProcess.Dispose() }
    $taskPayload = $null
    $taskOutput = $null
}
