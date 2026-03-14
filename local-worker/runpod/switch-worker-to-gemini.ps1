param(
  [string]$Model = "gemini-3-flash-preview",

  [string]$EnvFile = (Join-Path $PSScriptRoot "..\\.dev.vars")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

$content = Get-Content $EnvFile -Raw

function Set-Or-AddEnvValue {
  param(
    [string]$Text,
    [string]$Key,
    [string]$Value
  )

  $pattern = "(?m)^$([regex]::Escape($Key))=.*$"
  $replacement = "${Key}=${Value}"

  if ($Text -match $pattern) {
    return [regex]::Replace($Text, $pattern, $replacement)
  }

  $trimmed = $Text.TrimEnd("`r", "`n")
  return $trimmed + "`r`n" + $replacement + "`r`n"
}

$content = Set-Or-AddEnvValue -Text $content -Key "CHAT_PROVIDER" -Value "gemini"
$content = Set-Or-AddEnvValue -Text $content -Key "CHAT_MODEL" -Value $Model
$content = Set-Or-AddEnvValue -Text $content -Key "GEMINI_CHAT_MODEL" -Value $Model

Set-Content -Path $EnvFile -Value $content -NoNewline

Write-Host "Updated $EnvFile"
Write-Host "CHAT_PROVIDER=gemini"
Write-Host "CHAT_MODEL=$Model"
Write-Host "GEMINI_CHAT_MODEL=$Model"
Write-Host
Write-Host "Next step:"
Write-Host "  1. Add GEMINI_API_KEY to $EnvFile"
Write-Host ("  2. cd `"{0}`"" -f ((Resolve-Path (Join-Path $PSScriptRoot "..")).Path))
Write-Host "  3. .\\deploy.ps1"