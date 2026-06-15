# Operations

## Secrets

Do not put `UPSTREAM_API_KEY` into skills, client scripts, screenshots, issue comments, or public docs.

## Recommended Self-Use Settings

| Setting | Value |
|---|---|
| `MAX_CONCURRENT_REQUESTS` | `1` or `2` |
| `RATE_LIMIT_PER_MINUTE` | `5` to `10` |
| `REQUEST_TIMEOUT_SECONDS` | `120` to `300` |

## Logs

Runtime logs are stored under `/data/logs` when Docker Compose is used.

## Health

Use:

```bash
curl http://SERVER_IP:8787/healthz
```

The health check does not call the paid upstream model API.
