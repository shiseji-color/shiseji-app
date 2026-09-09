$ErrorActionPreference = 'Stop'

$stagingProjectRef = 'jzairzwgvkgbsizlamlv'
$passwordFile = Join-Path $PSScriptRoot '..\private\staging-db-password.xml'

if (-not (Test-Path -LiteralPath $passwordFile)) {
  throw '尚未保存 staging 数据库密码。请先运行 npm run staging:set-db-password。'
}

$saved = Import-Clixml -LiteralPath $passwordFile
if ($saved.ProjectRef -ne $stagingProjectRef) {
  throw '加密密码文件不属于允许的 staging 项目，已拒绝执行。'
}

$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($saved.Password)
try {
  $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  node --env-file=.env.staging.local scripts/staging-bootstrap.js
  if ($LASTEXITCODE -ne 0) {
    throw "staging 初始化失败，退出码：$LASTEXITCODE"
  }
} finally {
  Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
