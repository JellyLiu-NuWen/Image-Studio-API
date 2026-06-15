# Docker Release Updates

The recommended update model is host-side:

1. Check the latest GitHub Release.
2. Pull the matching Docker image.
3. Restart with Docker Compose.
4. Call `/healthz`.
5. Roll back to the previous image tag if health fails.

The container does not replace itself by default because mounting the Docker socket into the API container gives that container broad host control.
