$ErrorActionPreference = 'Stop'

$stagingProjectRef = 'jzairzwgvkgbsizlamlv'
$privateDirectory = Join-Path $PSScriptRoot '..\private'
$passwordFile = Join-Path $privateDirectory 'staging-db-password.xml'

New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null

do {
  $securePassword = Read-Host 'Right-click to paste the FULL shiseji-staging database password, then press Enter' -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    $length = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Length
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
  if ($length -lt 12) {
    Write-Host 'Password was too short or incomplete. Please paste it again.' -ForegroundColor Yellow
  }
} while ($length -lt 12)

[pscustomobject]@{
  ProjectRef = $stagingProjectRef
  Password = $securePassword
} | Export-Clixml -LiteralPath $passwordFile

Write-Host 'Saved with Windows user encryption. You may close this window.' -ForegroundColor Green
