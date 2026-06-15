param(
  [string]$ComposeFile = "docker-compose.self-hosted.yml",
  [string]$Service = "image-studio-api",
  [string]$HealthUrl = "http://localhost:8787/healthz",
  [string]$Image = "ghcr.io/jellyliu-nuwen/image-studio-api",
  [string]$Tag = "latest",
  [int]$HealthTimeoutSeconds = 60
)

$ErrorActionPreference = "Stop"
$ComposeFile = (Resolve-Path -LiteralPath $ComposeFile).Path
$env:IMAGE_STUDIO_API_IMAGE = $Image
$env:IMAGE_STUDIO_API_TAG = $Tag

function Invoke-Compose {
  param([string[]]$Arguments)

  $dockerArgs = @("compose", "-f", $ComposeFile) + $Arguments
  & docker @dockerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "docker $($dockerArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Test-Health {
  try {
    $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

Write-Host "Image Studio host-side update"
Write-Host "Compose file: $ComposeFile"
Write-Host "Service: $Service"
Write-Host "Image: $Image"
Write-Host "Tag: $Tag"
Write-Host "Health URL: $HealthUrl"
Write-Host ""

Write-Host "Pulling latest Compose images..."
Invoke-Compose @("pull", $Service)

Write-Host "Restarting service..."
Invoke-Compose @("up", "-d", "--no-deps", $Service)

Write-Host "Waiting for health check..."
$deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
do {
  if (Test-Health) {
    Write-Host "Health check passed."
    exit 0
  }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

Write-Error "Health check failed before timeout. Inspect logs with: docker compose -f $ComposeFile logs --tail=100 $Service"
exit 1
