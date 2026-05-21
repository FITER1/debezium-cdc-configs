# access-cdc

Self-contained Access CDC side stack for opt-in clusters only. It runs an in-cluster Oracle XE stand-in, a dedicated Strimzi KafkaConnect cluster, and the Access Debezium Oracle connectors.

This stack is disposable PoC infrastructure. Oracle runs as a single replica with retained PVCs so restarts do not delete data, but there is no HA or backup lifecycle here.

ARCHIVELOG is enabled by a first-boot Oracle container init script. If an older PVC was created before that script existed, recreate the Oracle PVC or run the same init script manually before allowing the prep job to run.

Oracle credentials are sourced from the configured ExternalSecret remote key. The remote secret must provide:

- `ORACLE_PASSWORD`
- `APP_USER_PASSWORD`
- `ABFCUBSLIVE_PASSWORD`
- `NIPSYSTEM_PASSWORD`
- `WEBSERVE_PASSWORD`

KafkaConnect uses `EnvVarConfigProvider`, so connector configs in this single-tenant Connect cluster can reference environment variables present on the Connect pod. Do not multiplex unrelated tenants into this Connect cluster without moving credentials to mounted secret files and `FileConfigProvider`.

## Deployment

```bash
helm install access-cdc ./kubernetes/helm/access-cdc -n access-cdc --create-namespace
```

Or with ArgoCD, point an Application at `kubernetes/helm/access-cdc/` with values from `values.yaml`.

## Key Configuration

| Parameter | Description |
|-----------|-------------|
| `oracle.enabled` | Enable the in-cluster Oracle XE StatefulSet (disable for remote Oracle) |
| `oracle.appUser` | Common CDC user (default: `C##CDC`) |
| `connectors.coreBanking.pov` | Optional Groovy SMT account filter for load testing |
| `externalSecret.enabled` | Pull credentials from AWS Secrets Manager |
| `kafkaConnect.image` | Custom Kafka Connect image with Debezium + Groovy |
