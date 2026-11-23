# Run privately as your ordinary Windows user. No network or database operation.
# Stores only DPAPI ciphertext outside the repository, never an environment file.
$ErrorActionPreference = 'Stop'
$taskSender = Read-Host 'Dedicated Gmail sender (kept private)'
if ($taskSender -cnotmatch '^[a-z0-9][a-z0-9.+_-]*@gmail\.com$') {
    throw 'Enter the dedicated Gmail address in lowercase. No configuration saved.'
}
$taskSecurePassword = Read-Host 'New Google App Password (hidden; spaces are removed)' -AsSecureString
$taskPointer = [IntPtr]::Zero
try {
    $taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecurePassword)
    $taskPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer).Replace(' ', '')
    if ($taskPassword -cnotmatch '^[a-zA-Z]{16}$') { throw 'Expected a 16-letter Google App Password. No configuration saved.' }
    $taskDirectory = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Mitsa\Private'))
    $taskCheckout = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
    if ($taskDirectory.StartsWith($taskCheckout + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Credential storage must stay outside the checkout.'
    }
    [IO.Directory]::CreateDirectory($taskDirectory) | Out-Null
    $taskAcl = [Security.AccessControl.DirectorySecurity]::new()
    $taskSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $taskAcl.SetOwner($taskSid)
    $taskAcl.SetAccessRuleProtection($true, $false)
    $taskRule = [Security.AccessControl.FileSystemAccessRule]::new($taskSid, [Security.AccessControl.FileSystemRights]::FullControl, ([Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit), [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
    $taskAcl.AddAccessRule($taskRule)
    Set-Acl -LiteralPath $taskDirectory -AclObject $taskAcl
    Add-Type -AssemblyName System.Security
    $taskPayload = @{ version = 1; sender = $taskSender; appPassword = $taskPassword } | ConvertTo-Json -Compress
    $taskPlainBytes = [Text.Encoding]::UTF8.GetBytes($taskPayload)
    $taskEntropy = [Text.Encoding]::UTF8.GetBytes('Mitsa Gmail SMTP v1')
    $taskEncrypted = [Security.Cryptography.ProtectedData]::Protect($taskPlainBytes, $taskEntropy, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes((Join-Path $taskDirectory 'gmail-smtp.dpapi'), $taskEncrypted)
    [Array]::Clear($taskPlainBytes, 0, $taskPlainBytes.Length)
    Write-Host 'Protected SMTP configuration saved outside the repository. No connection or email was attempted.'
} finally {
    if ($taskPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer) }
    $taskPassword = $null
    $taskPayload = $null
    if ($taskSecurePassword) { $taskSecurePassword.Dispose() }
}
