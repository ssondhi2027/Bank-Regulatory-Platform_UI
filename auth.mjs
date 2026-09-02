import { ExternalAccountClient } from "google-auth-library";
import { config } from "./config.mjs";

// Two credential paths, in order of preference:
//
//   1. Workload Identity Federation. The Lambda execution role is exchanged for
//      a short-lived Google access token. Nothing secret is ever stored. In
//      Lambda there is no IMDS endpoint, but google-auth-library reads the
//      AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN /
//      AWS_REGION variables the runtime injects, so the URLs below are only
//      ever a fallback for EC2.
//
//   2. A service account JSON key pulled from Secrets Manager. Simpler to set
//      up, but it is long-lived key material sitting in another cloud.

function federatedClient() {
  const { projectNumber, poolId, providerId, serviceAccountEmail } = config.auth;
  if (!projectNumber || !poolId || !providerId || !serviceAccountEmail) return null;

  return ExternalAccountClient.fromJSON({
    type: "external_account",
    audience:
      `//iam.googleapis.com/projects/${projectNumber}` +
      `/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    subject_token_type: "urn:ietf:params:aws:token-type:aws4_request",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
      `${serviceAccountEmail}:generateAccessToken`,
    credential_source: {
      environment_id: "aws1",
      region_url: "http://169.254.169.254/latest/meta-data/placement/availability-zone",
      url: "http://169.254.169.254/latest/meta-data/iam/security-credentials",
      regional_cred_verification_url:
        "https://sts.{region}.amazonaws.com?Action=GetCallerIdentity&Version=2011-06-15",
      imdsv2_session_token_url: "http://169.254.169.254/latest/api/token",
    },
  });
}

async function secretCredentials() {
  const { secretArn } = config.auth;
  if (!secretArn) return null;

  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    "@aws-sdk/client-secrets-manager"
  );
  const sm = new SecretsManagerClient({});
  const res = await sm.send(new GetSecretValueCommand({ SecretId: secretArn }));
  return JSON.parse(res.SecretString);
}

let cached;

export async function getBigQueryAuthOptions() {
  if (cached) return cached;

  const authClient = federatedClient();
  if (authClient) {
    cached = { authClient };
    return cached;
  }

  const credentials = await secretCredentials();
  if (credentials) {
    cached = { credentials };
    return cached;
  }

  throw new Error(
    "No GCP credentials configured. Set the GCP_WIF_* variables, or GCP_SA_KEY_SECRET_ARN."
  );
}
