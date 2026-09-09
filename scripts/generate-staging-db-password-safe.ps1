$ErrorActionPreference = 'Stop'

$projectRef = 'jzairzwgvkgbsizlamlv'
$privateDir = Join-Path $PSScriptRoot '..\private'
$passwordFile = Join-Path $privateDir 'staging-db-password.xml'

$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+'
$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $rng.GetBytes($bytes)
} finally {
  $rng.Dispose()
}

$chars = for ($i = 0; $i -lt 32; $i++) {
  $alphabet[$bytes[$i] % $alphabet.Length]
}
$plain = -join $chars
$secure = ConvertTo-SecureString -String $plain -AsPlainText -Force

New-Item -ItemType Directory -Force -Path $privateDir | Out-Null
[pscustomobject]@{
  ProjectRef = $projectRef
  Password = $secure
} | Export-Clixml -LiteralPath $passwordFile -Force

Set-Clipboard -Value $plain
$plain = $null
$bytes = $null

Write-Output 'A strong staging database password was encrypted locally and copied to the clipboard.'
Write-Output 'Paste it into Supabase Reset database password, then confirm the reset.'
