import type { AssetLifecycleStatus, AssetRepository, StoredAssetResult } from "./types";

export class InMemoryAssetRepository implements AssetRepository {
  public readonly assets: StoredAssetResult[] = [];
  public readonly links: Array<{ asset_id: string; deliverable_code: string }> = [];

  async createAssetRecord(input: StoredAssetResult): Promise<StoredAssetResult> {
    this.assets.push(input);
    return input;
  }

  async updateAssetStatus(assetId: string, status: AssetLifecycleStatus): Promise<StoredAssetResult> {
    const asset = this.assets.find((item) => item.asset_id === assetId);
    if (!asset) {
      throw new Error("asset_not_found");
    }
    asset.status = status;
    return asset;
  }

  async linkAssetToDeliverable(input: { asset_id: string; deliverable_code: string }): Promise<void> {
    this.links.push(input);
  }

  async getAssetsByOrder(orderId: string): Promise<StoredAssetResult[]> {
    return this.assets.filter((asset) => asset.order_id === orderId);
  }

  async getAssetsByOrderItem(orderItemId: string): Promise<StoredAssetResult[]> {
    return this.assets.filter((asset) => asset.order_item_id === orderItemId);
  }
}
