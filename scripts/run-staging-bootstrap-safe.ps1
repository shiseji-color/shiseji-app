$ErrorActionPreference = 'Stop'

$stagingProjectRef = 'jzairzwgvkgbsizlamlv'
$passwordFile = Join-Path $PSScriptRoot '..\private\staging-db-password.xml'

if (-not (Test-Path -LiteralPath $passwordFile)) {
  throw 'The encrypted staging database password is missing.'
}

$saved = Import-Clixml -LiteralPath $passwordFile
if ($saved.ProjectRef -ne $stagingProjectRef) {
  throw 'Safety block: the encrypted password is not bound to staging.'
}

$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($saved.Password)
try {
  $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  node --env-file=.env.staging.local scripts/staging-bootstrap.js
  if ($LASTEXITCODE -ne 0) {
    throw "Staging bootstrap failed with exit code $LASTEXITCODE."
  }
} finally {
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
