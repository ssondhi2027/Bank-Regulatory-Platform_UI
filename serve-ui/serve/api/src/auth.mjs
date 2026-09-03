// The API runs on Cloud Run, in the same cloud as BigQuery, so it never needs
// to exchange one cloud's credentials for another's. Application Default
// Credentials cover both places it runs:
//
//   - Cloud Run: the service account attached to the revision, fetched from
//     the metadata server. No key material exists anywhere.
//   - Local dev: a GOOGLE_APPLICATION_CREDENTIALS keyfile, or the cache left
//     by `gcloud auth application-default login`.
//
// Passing {} to the BigQuery client lets it resolve whichever of these is
// available on its own.
export async function getBigQueryAuthOptions() {
  return {};
}
