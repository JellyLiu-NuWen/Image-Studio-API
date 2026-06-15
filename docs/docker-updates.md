# Docker Release Updates

The recommended update model is host-side:

1. Check the latest GitHub Release.
2. Pull the matching Docker image.
3. Restart with Docker Compose.
4. Call `/healthz`.
5. Roll back to the previous image tag if health fails.

The container does not replace itself by default because mounting the Docker socket into the API container gives that container broad host control.

## Release Check

Set `IMAGE_STUDIO_VERSION` to the running release tag and `IMAGE_STUDIO_GITHUB_REPOSITORY` to the GitHub repository, for example `owner/repo`. The admin dashboard can then call `/api/update/check` with `ADMIN_TOKEN` and compare the running version with the latest GitHub Release.

If the repository is not configured, the update check reports `unconfigured`. If GitHub cannot be reached or returns an error, the update check reports `error` without crashing the admin API.

## Host Script

From the repository root on the host:

```powershell
.\scripts\update-compose-image.ps1 `
  -ComposeFile .\docker-compose.self-hosted.yml `
  -Service image-studio-api `
  -Image ghcr.io/jellyliu-nuwen/image-studio-api `
  -Tag v1.2.5 `
  -HealthUrl http://localhost:8787/healthz
```

`docker-compose.self-hosted.yml` reads `IMAGE_STUDIO_API_IMAGE` and `IMAGE_STUDIO_API_TAG`. The script sets those environment variables for the current run, pulls the requested image, restarts the service, and health checks it.

For persistent pinning, set these variables in your shell profile, CI job, or a host-side `.env` before running Compose:

```powershell
$env:IMAGE_STUDIO_API_IMAGE="ghcr.io/jellyliu-nuwen/image-studio-api"
$env:IMAGE_STUDIO_API_TAG="v1.2.5"
docker compose -f .\docker-compose.self-hosted.yml up -d
```

The script runs `docker compose pull`, `docker compose up -d --no-deps`, and polls `/healthz`. It exits non-zero if the service does not become healthy before the timeout so host automation can stop the rollout or trigger its own rollback flow.
