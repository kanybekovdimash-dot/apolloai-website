param(
  [Parameter(Mandatory = $true)]
  [string]$OllamaBaseUrl,

  [string]$Model = "qwen3.5:27b",

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

$content = Set-Or-AddEnvValue -Text $content -Key "CHAT_PROVIDER" -Value "ollama"
$content = Set-Or-AddEnvValue -Text $content -Key "OLLAMA_BASE_URL" -Value $OllamaBaseUrl.TrimEnd("/")
$content = Set-Or-AddEnvValue -Text $content -Key "OLLAMA_CHAT_MODEL" -Value $Model

Set-Content -Path $EnvFile -Value $content -NoNewline

Write-Host "Updated $EnvFile"
Write-Host "CHAT_PROVIDER=ollama"
Write-Host "OLLAMA_BASE_URL=$($OllamaBaseUrl.TrimEnd('/'))"
Write-Host "OLLAMA_CHAT_MODEL=$Model"
Write-Host
Write-Host "Next step:"
Write-Host "  cd `"$((Resolve-Path (Join-Path $PSScriptRoot "..")).Path)`""
Write-Host "  .\\deploy.ps1"