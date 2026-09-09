$ErrorActionPreference = 'Stop'

$stagingProjectRef = 'jzairzwgvkgbsizlamlv'
$privateDirectory = Join-Path $PSScriptRoot '..\private'
$passwordFile = Join-Path $privateDirectory 'staging-db-password.xml'

New-Item -ItemType Directory -Path $privateDirectory -Force | Out-Null
$securePassword = Read-Host '请输入 shiseji-staging 的数据库密码（输入不会显示）' -AsSecureString

[pscustomobject]@{
  ProjectRef = $stagingProjectRef
  Password = $securePassword
} | Export-Clixml -LiteralPath $passwordFile

Write-Host '已使用当前 Windows 账户加密保存 staging 数据库密码。'
Write-Host '密码不会写入 Git，也不会显示在终端。'
