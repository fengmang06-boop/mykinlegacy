export interface GenerationManifestLike {
  expected_assets: Array<{ deliverable_code: string; required: boolean }>;
  generated_assets: Array<{ deliverable_code: string; asset_id: string }>;
  missing_required_assets: string[];
  failed_assets: Array<{ deliverable_code: string; error: string }>;
  manifest_status: string;
}

export function markAssetGenerated(
  manifest: GenerationManifestLike,
  deliverableCode: string,
  assetId: string
): GenerationManifestLike {
  manifest.generated_assets.push({ deliverable_code: deliverableCode, asset_id: assetId });
  manifest.missing_required_assets = computeMissingRequiredAssets(manifest);
  manifest.manifest_status = computeManifestCompletionStatus(manifest);
  return manifest;
}

export function markAssetFailed(
  manifest: GenerationManifestLike,
  deliverableCode: string,
  error: string
): GenerationManifestLike {
  manifest.failed_assets.push({ deliverable_code: deliverableCode, error });
  manifest.missing_required_assets = computeMissingRequiredAssets(manifest);
  manifest.manifest_status = "failed";
  return manifest;
}

export function computeMissingRequiredAssets(manifest: GenerationManifestLike): string[] {
  const generated = new Set(manifest.generated_assets.map((asset) => asset.deliverable_code));
  return manifest.expected_assets
    .filter((asset) => asset.required && !generated.has(asset.deliverable_code))
    .map((asset) => asset.deliverable_code);
}

export function computeZipReadiness(manifest: GenerationManifestLike): boolean {
  return computeMissingRequiredAssets(manifest).filter((code) => code !== "download_package_zip").length === 0;
}

export function computeManifestCompletionStatus(manifest: GenerationManifestLike): string {
  const missing = computeMissingRequiredAssets(manifest);
  if (missing.length === 0) {
    return "completed";
  }
  if (manifest.failed_assets.length > 0) {
    return "failed";
  }
  return "in_progress";
}
