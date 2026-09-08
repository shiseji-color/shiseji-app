$ErrorActionPreference = 'Stop'

$stagingProjectRef = 'jzairzwgvkgbsizlamlv'
$privateDirectory = Join-Path $PSScriptRoot '..\private'
$passwordFile = Join-Path $privateDirectory 'staging-db-password.xml'
$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%_-'
$bytes = New-Object byte[] 32

[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$characters = for ($index = 0; $index -lt $bytes.Length; $index++) {
  $alphabet[$bytes[$index] % $alphabet.Length]
}
$plainPassword = -join $characters
$securePassword = ConvertTo-SecureString $plainPassword -AsPlainText -Force

New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null
[pscustomobject]@{
  ProjectRef = $stagingProjectRef
  Password = $securePassword
} | Export-Clixml -LiteralPath $passwordFile

Set-Clipboard -Value $plainPassword
$plainPassword = $null
[Array]::Clear($bytes, 0, $bytes.Length)

Write-Host 'A new strong staging password is encrypted locally and copied to the clipboard.'
Write-Host 'Paste it into Supabase Reset database password, then click Reset password.'
