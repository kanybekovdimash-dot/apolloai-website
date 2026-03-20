param(
  [switch]$SkipSecrets
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Parse-DotEnv([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  foreach ($line in Get-Content $path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $idx = $trimmed.IndexOf('=')
    if ($idx -lt 1) { continue }
    $key = $trimmed.Substring(0, $idx).Trim()
    $value = $trimmed.Substring($idx + 1)
    $map[$key] = $value
  }
  return $map
}

function Require-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Command not found: $name"
  }
}

Require-Command npx

$cloudflareEnvFile = Join-Path $root '.cloudflare.env'
$cfEnv = Parse-DotEnv $cloudflareEnvFile
if ($cfEnv.ContainsKey('CLOUDFLARE_API_TOKEN') -and -not [string]::IsNullOrWhiteSpace($cfEnv['CLOUDFLARE_API_TOKEN'])) {
  $env:CLOUDFLARE_API_TOKEN = [string]$cfEnv['CLOUDFLARE_API_TOKEN']
}
if ($cfEnv.ContainsKey('CLOUDFLARE_ACCOUNT_ID') -and -not [string]::IsNullOrWhiteSpace($cfEnv['CLOUDFLARE_ACCOUNT_ID'])) {
  $env:CLOUDFLARE_ACCOUNT_ID = [string]$cfEnv['CLOUDFLARE_ACCOUNT_ID']
}
if ($cfEnv.ContainsKey('CLOUDFLARE_API_KEY') -and -not [string]::IsNullOrWhiteSpace($cfEnv['CLOUDFLARE_API_KEY'])) {
  $env:CLOUDFLARE_API_KEY = [string]$cfEnv['CLOUDFLARE_API_KEY']
}
if ($cfEnv.ContainsKey('CLOUDFLARE_EMAIL') -and -not [string]::IsNullOrWhiteSpace($cfEnv['CLOUDFLARE_EMAIL'])) {
  $env:CLOUDFLARE_EMAIL = [string]$cfEnv['CLOUDFLARE_EMAIL']
}

Write-Host "Checking Cloudflare auth..."
try {
  if ($env:CLOUDFLARE_API_KEY -and $env:CLOUDFLARE_EMAIL) {
    npx wrangler whoami --json | Out-Host
  } else {
    npx wrangler whoami | Out-Host
  }
} catch {
  Write-Host "Cloudflare auth is missing. Put CLOUDFLARE_API_TOKEN into .cloudflare.env or use CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY." -ForegroundColor Yellow
  throw
}

$envFile = Join-Path $root '.dev.vars'
$envMap = Parse-DotEnv $envFile

if (-not $SkipSecrets) {
  $secretKeys = @(
    'GEMINI_API_KEY',
    'YANDEX_API_KEY',
    'YANDEX_FOLDER_ID',
    'YANDEX_TTS_VOICE',
    'YANDEX_TTS_FORMAT',
    'YANDEX_TTS_LANG',
    'AZURE_SPEECH_KEY',
    'AZURE_SPEECH_REGION',
    'AZURE_TTS_VOICE',
    'AZURE_TTS_FORMAT',
    'GROQ_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_STORAGE_BUCKET',
    'ADMIN_ACCESS_TOKEN',
    'ADMIN_EMAILS',
    'ALLOWED_ORIGINS',
    'OLLAMA_BASE_URL',
    'OLLAMA_CHAT_MODEL',
    'HF_CHAT_URL',
    'HF_STT_URL',
    'HUGGINGFACE_TOKEN',
    'AVATAR_PREVIEW_URL',
    'AVATAR_POSTER_URL',
    'AVATAR_VIDEO_URL',
    'AVATAR_STREAM_URL',
    'AVATAR_AUDIO_URL',
    'SPEECH_AUDIO_URL',
    'SPEECH_STREAM_URL'
  )

  foreach ($key in $secretKeys) {
    if (-not $envMap.ContainsKey($key)) { continue }
    $value = [string]$envMap[$key]
    if ([string]::IsNullOrWhiteSpace($value)) { continue }
    Write-Host "Uploading secret: $key"
    $value | npx wrangler secret put $key | Out-Host
  }
}

Write-Host "Deploying Worker to Cloudflare..."
npx wrangler deploy | Out-Host

Write-Host "Done. Expected custom domain: https://api.apolloai.biz" -ForegroundColor Green

