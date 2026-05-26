# CDC AWS EKS Deployment — Outstanding Requirements

The following items must be resolved before the Debezium Oracle XStream CDC workload can be deployed to the Access Bank EKS cluster (`accessbank-euw1-neobank-dev`, eu-west-1). The CDC service captures change events from Oracle Flexcube (on-prem) and streams them to AWS MSK (Kafka), where Synapse consumes them within the same EKS cluster. The deployment uses the Strimzi Operator to manage Kafka Connect via `KafkaConnect` and `KafkaConnector` custom resources, with ArgoCD performing GitOps-based continuous delivery from the `access-eks-workloads-render` repository.

## Architecture Overview

```
Oracle Flexcube (on-prem) ──[VPN/DirectConnect]──▶ EKS Pod (Kafka Connect / Strimzi)
                                                        │
                                                        ▼
                                                   AWS MSK (mTLS, port 9094)
                                                        │
                                                        ▼
                                                   Synapse Consumer (EKS)
```

## Requirements

| # | Requirement | Purpose | How to Obtain / Resolve |
|---|-------------|---------|-------------------------|
| 1 | **MSK Bootstrap Servers** | Kafka broker address that the EKS Kafka Connect pod uses to produce CDC events. Configured in the `KafkaConnect` CR `bootstrapServers` field and each `KafkaConnector` CR's `schema.history.internal.kafka.bootstrap.servers` config. Currently set to `PLACEHOLDER-msk-bootstrap:9094`. | AWS Console → Amazon MSK → Cluster → "View client information" → copy the "Private endpoint" under TLS. Format: `b-1.xxx.kafka.eu-west-1.amazonaws.com:9094,b-2.xxx...`. Update `workloads/cdc/overlays/dev/values.yaml` → `connect.bootstrapServers`. |
| 2 | **Oracle CDB Name** | Debezium XStream requires the Container Database name to establish the OCI capture connection. Maps to `database.dbname` in each `KafkaConnector` CR config. Currently set to `PLACEHOLDER_CDB`. | DBA runs: `SELECT NAME FROM V$DATABASE;` while connected to the CDB root (not the PDB). Update `workloads/cdc/overlays/dev/values.yaml` → `oracle.cdbName`. |
| 3 | **MSK mTLS Certificates (JKS)** | Kafka Connect authenticates to MSK using mutual TLS. The JKS files are stored in a manually-created K8s Secret (`cdc-msk-certs`) in namespace `cdc` and mounted via Strimzi's `externalConfiguration` at `/opt/kafka/external-configuration/msk-certs/`. | 1. Generate a Private CA in AWS Certificate Manager (ACM PCA) or use an existing one. 2. Issue a client certificate. 3. Package into JKS: `keytool -importkeystore -srckeystore client.p12 -destkeystore keystore.jks` and `keytool -import -alias msk-ca -file msk-ca.pem -keystore truststore.jks`. 4. Create the K8s Secret: `kubectl create secret generic cdc-msk-certs -n cdc --from-file=truststore.jks --from-file=keystore.jks`. |
| 4 | **AWS Secrets Manager — Seed Secrets** | The ExternalSecret controller (via `ClusterSecretStore: aws-secrets-manager`) syncs these into K8s Secret `cdc-extsec`, which Strimzi mounts via `externalConfiguration` volumes. Without them, the pod will fail to start. Required keys: `CDC_ORACLE_PASSWORD`, `CDC_MSK_TRUSTSTORE_PASSWORD`, `CDC_MSK_KEYSTORE_PASSWORD`, `CDC_MSK_KEY_PASSWORD`. | Create secrets in account `228736141087`, region `eu-west-1`: `aws secretsmanager create-secret --name "cdc/oracle-credentials" --secret-string '{"password":"<oracle_pw>"}' --region eu-west-1` and `aws secretsmanager create-secret --name "cdc/msk-credentials" --secret-string '{"truststore_password":"...","keystore_password":"...","key_password":"..."}' --region eu-west-1` |
| 5 | **VPN / Direct Connect — Oracle Reachability from EKS** | XStream uses a persistent OCI connection from the EKS pod to Oracle on-prem (`AB02DWDB-SCAN3.accessbankplc.com:6655`). If the network path is broken or firewalls kill idle connections, the connector will crash and may require a full re-snapshot. | 1. Confirm VPN/DirectConnect tunnel is UP (AWS VPN Console → Status or DX Console). 2. Ensure EKS pod CIDR / NAT Gateway IPs are permitted through on-prem firewall to Oracle SCAN listener on port 6655. 3. Set firewall idle timeout ≥ 30 min or disable idle-timeout for this flow. 4. Test from a pod in `cdc` namespace: `nc -zv AB02DWDB-SCAN3.accessbankplc.com 6655`. 5. Verify DNS resolves: `nslookup AB02DWDB-SCAN3.accessbankplc.com` (may require custom CoreDNS forwarding to on-prem DNS). |
| 6 | **EKS → MSK Network Path** | CDC events flow from the EKS Kafka Connect pod to MSK brokers on port 9094 (TLS). If security groups or routing are misconfigured, connectors will fail with `BrokerNotAvailableException`. | 1. Ensure the EKS worker node security group has an outbound rule allowing TCP 9094 to the MSK broker security group. 2. Confirm the MSK security group has an inbound rule from the EKS node/pod CIDR on port 9094. 3. Verify MSK is in the same VPC or a peered VPC with correct route tables. 4. Test from a pod: `openssl s_client -connect <msk-broker>:9094`. |
| 7 | **Strimzi Operator on EKS** | The Strimzi Cluster Operator manages the Kafka Connect lifecycle via `KafkaConnect` and `KafkaConnector` CRDs. It creates the Deployment, handles connector registration, autoRestart, and status reporting. Must be installed cluster-wide or watching the `cdc` namespace. | Install via Helm (or ArgoCD Application): `helm install strimzi-cluster-operator oci://quay.io/strimzi-helm/strimzi-kafka-operator --namespace strimzi --create-namespace --set watchNamespaces="{cdc}"`. Verify: `kubectl get crd kafkaconnects.kafka.strimzi.io`. If using ArgoCD, add an Application in `fiter-argo-apps/environments/dev/` pointing to the Strimzi Helm chart. |
| 8 | **External Secrets Operator + ClusterSecretStore** | The `ExternalSecret` CR references `ClusterSecretStore: aws-secrets-manager`. The operator must be installed and the store must be configured with IAM credentials or IRSA to read from Secrets Manager in account `228736141087`. | 1. Verify operator is running: `kubectl get pods -n external-secrets`. 2. Verify store exists: `kubectl get clustersecretstore aws-secrets-manager`. 3. If using IRSA, ensure the ServiceAccount used by the operator has the annotation `eks.amazonaws.com/role-arn` pointing to a role with `secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:eu-west-1:228736141087:secret:cdc/*`. |
| 9 | **ECR Image Pull Access** | The CDC image (`228736141087.dkr.ecr.eu-west-1.amazonaws.com/accessbank-euw1-neobank-shared-kafkaconnect:11c8be6a`) must be pullable by EKS worker nodes. Since both EKS and ECR are in the same account (`228736141087`), this should work by default — but cross-account or restrictive ECR policies can block it. | 1. Verify the EKS node IAM role has `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`. 2. If using a private endpoint, ensure the VPC endpoint for ECR is configured. 3. Test: `kubectl run test --image=228736141087.dkr.ecr.eu-west-1.amazonaws.com/accessbank-euw1-neobank-shared-kafkaconnect:11c8be6a --restart=Never -- sleep 5` and check pod status. |
| 10 | **Karpenter NodePool — `synapse` label** | The CDC workload is scheduled on nodes with label `karpenter.sh/nodepool: synapse` (configured via `nodeSelector` in the chart values). If this NodePool does not exist or has insufficient capacity, the pod will remain Pending. | 1. Verify NodePool exists: `kubectl get nodepool synapse`. 2. Ensure it supports the resource requests (cpu: 500m–2000m, memory: 1Gi–4Gi). 3. Confirm instance types in the NodePool can accommodate the JVM heap (`-Xmx 2g`) plus overhead. |
| 11 | **CoreDNS — On-prem Oracle DNS Resolution** | The pod must resolve `AB02DWDB-SCAN3.accessbankplc.com` to the Oracle SCAN listener IP. EKS CoreDNS won't resolve on-prem hostnames by default. | Add a conditional forwarder in the CoreDNS ConfigMap: `accessbankplc.com:53 { forward . <on-prem-dns-ip> }`. Alternatively, use Route 53 Resolver inbound/outbound endpoints to forward `.accessbankplc.com` queries to on-prem DNS over VPN. Verify: `kubectl exec -n cdc <pod> -- nslookup AB02DWDB-SCAN3.accessbankplc.com`. |
| 12 | **ArgoCD Application for CDC Workload** | ArgoCD must be configured to deploy the CDC workload from the `access-eks-workloads-render` repo, path `workloads/cdc/overlays/dev/`, to the EKS cluster. Without this, changes to the Helm chart or values won't be applied automatically. | Create an ArgoCD `Application` or `ApplicationSet` in `fiter-argo-apps/environments/dev/` targeting: repo `access-eks-workloads-render`, path `workloads/cdc/overlays/dev/`, destination namespace `cdc`, cluster `accessbank-euw1-neobank-dev`. Enable `automated.selfHeal` and `automated.prune`. |
| 13 | **Namespace Creation** | The `cdc` namespace must exist before any resources are deployed. The workload includes a `namespace.yaml` in `workloads/cdc/base/` but ArgoCD must apply it first or the namespace must be pre-created. | Verify: `kubectl get ns cdc`. If using ArgoCD, ensure `CreateNamespace=true` sync option is set, or include the namespace manifest in the Kustomize base (already present in `workloads/cdc/base/kustomization.yaml`). |

## Post-Deployment Validation

Once all requirements are satisfied and the workload is deployed:

1. **Verify KafkaConnect is Ready:**
   ```bash
   kubectl get kafkaconnect cdc -n cdc -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'
   # Expected: True
   ```

2. **Verify Connectors are Running:**
   ```bash
   kubectl get kafkaconnector -n cdc
   # Expected: access-core-banking, access-nip-system, access-webserve — all RUNNING
   ```

3. **Check Connector Status:**
   ```bash
   kubectl get kafkaconnector access-core-banking -n cdc -o jsonpath='{.status.connectorStatus.connector.state}'
   # Expected: RUNNING
   ```

4. **Verify Topics Created on MSK:**
   ```bash
   # From a pod with kafka CLI tools:
   kafka-topics.sh --bootstrap-server <msk-bootstrap>:9094 --command-config client-ssl.properties --list | grep accessbank
   # Expected: accessbank-core.*, accessbank-nip.*, accessbank-webserve.*
   ```

5. **Confirm End-to-End CDC Flow:**
   - Insert/update a row in one of the tracked Oracle tables.
   - Consume from the corresponding Kafka topic and verify the change event arrives.
   - Confirm Synapse consumer processes the event (check Synapse logs or metrics).

## Rollback & Disaster Recovery

| Scenario | Action |
|----------|--------|
| Connector enters FAILED state | Check `kubectl describe kafkaconnector <name> -n cdc` for error. Fix root cause. `autoRestart` (max 10) handles transient failures. |
| Full re-snapshot needed | Set `snapshot.mode: initial` and delete the connector's offset from `access-connect-offsets` topic, then recreate the `KafkaConnector` CR. |
| MSK certificate expiry | Regenerate client cert from ACM PCA, rebuild JKS, update `cdc-msk-certs` Secret. Pod will restart automatically (Stakater Reloader annotation is set). |
| Oracle password rotation | Update `cdc/oracle-credentials` in AWS Secrets Manager. ExternalSecret will resync within `refreshInterval: 1h`. Force immediate sync: `kubectl annotate externalsecret cdc-extsec -n cdc force-sync=$(date +%s) --overwrite`. |
