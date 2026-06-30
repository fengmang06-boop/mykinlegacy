import { createHash } from "node:crypto";

import type {
  OrchestrationAsset,
  OrchestrationDownloadToken,
  OrchestrationEmailLog,
  OrchestrationGenerationJob,
  OrchestrationManifest,
  OrchestrationOrder,
  OrchestrationOrderItem,
  OrchestrationOutboxEvent,
  OrchestrationRepository
} from "./types";

export class InMemoryOrchestrationRepository implements OrchestrationRepository {
  public readonly orders = new Map<string, OrchestrationOrder>();
  public readonly orderItems = new Map<string, OrchestrationOrderItem>();
  public readonly outboxEvents = new Map<string, OrchestrationOutboxEvent>();
  public readonly manifests = new Map<string, OrchestrationManifest>();
  public readonly generationJobs = new Map<string, OrchestrationGenerationJob>();
  public readonly assets = new Map<string, OrchestrationAsset>();
  public readonly downloadTokens = new Map<string, OrchestrationDownloadToken>();
  public readonly emailLogs = new Map<string, OrchestrationEmailLog>();

  constructor(input: {
    orders?: OrchestrationOrder[];
    orderItems?: OrchestrationOrderItem[];
    outboxEvents?: OrchestrationOutboxEvent[];
  } = {}) {
    for (const order of input.orders ?? []) this.orders.set(order.id, order);
    for (const item of input.orderItems ?? []) this.orderItems.set(item.id, item);
    for (const event of input.outboxEvents ?? []) this.outboxEvents.set(event.id, event);
  }

  async findOrder(orderId: string): Promise<OrchestrationOrder | null> {
    return this.orders.get(orderId) ?? null;
  }

  async findOrderItem(orderItemId: string): Promise<OrchestrationOrderItem | null> {
    return this.orderItems.get(orderItemId) ?? null;
  }

  async listOrderItemsByOrder(orderId?: string): Promise<OrchestrationOrderItem[]> {
    const items = [...this.orderItems.values()];
    return orderId ? items.filter((item) => item.order_id === orderId) : items;
  }

  async findManifestById(manifestId: string): Promise<OrchestrationManifest | null> {
    return this.manifests.get(manifestId) ?? null;
  }

  async findManifestByOrderItem(
    orderId: string,
    orderItemId: string
  ): Promise<OrchestrationManifest | null> {
    return (
      [...this.manifests.values()].find(
        (manifest) => manifest.order_id === orderId && manifest.order_item_id === orderItemId
      ) ?? null
    );
  }

  async createManifest(input: OrchestrationManifest): Promise<OrchestrationManifest> {
    const existing = await this.findManifestByOrderItem(input.order_id, input.order_item_id);
    if (existing) return existing;
    this.manifests.set(input.id, input);
    return input;
  }

  async updateManifest(input: OrchestrationManifest): Promise<OrchestrationManifest> {
    this.manifests.set(input.id, input);
    return input;
  }

  async findGenerationJobByOrderItem(
    orderId: string,
    orderItemId: string
  ): Promise<OrchestrationGenerationJob | null> {
    return (
      [...this.generationJobs.values()].find(
        (job) => job.order_id === orderId && job.order_item_id === orderItemId
      ) ?? null
    );
  }

  async createGenerationJob(
    input: OrchestrationGenerationJob
  ): Promise<OrchestrationGenerationJob> {
    const existing = await this.findGenerationJobByOrderItem(input.order_id, input.order_item_id);
    if (existing) return existing;
    this.generationJobs.set(input.id, input);
    return input;
  }

  async updateGenerationJob(
    input: OrchestrationGenerationJob
  ): Promise<OrchestrationGenerationJob> {
    this.generationJobs.set(input.id, input);
    return input;
  }

  async createAsset(input: OrchestrationAsset): Promise<OrchestrationAsset> {
    const existing = [...this.assets.values()].find(
      (asset) =>
        asset.order_id === input.order_id && asset.deliverable_code === input.deliverable_code
    );
    if (existing) return existing;
    this.assets.set(input.id, input);
    return input;
  }

  async listAssetsByOrder(orderId: string): Promise<OrchestrationAsset[]> {
    return [...this.assets.values()].filter((asset) => asset.order_id === orderId);
  }

  async createDownloadToken(input: OrchestrationDownloadToken): Promise<OrchestrationDownloadToken> {
    const existing = await this.findDownloadTokenByOrder(input.order_id);
    if (existing) return existing;
    this.downloadTokens.set(input.id, input);
    return input;
  }

  async findDownloadTokenByOrder(orderId: string): Promise<OrchestrationDownloadToken | null> {
    return [...this.downloadTokens.values()].find((token) => token.order_id === orderId) ?? null;
  }

  async createEmailLog(input: OrchestrationEmailLog): Promise<OrchestrationEmailLog> {
    const existing = [...this.emailLogs.values()].find(
      (log) => log.order_id === input.order_id && log.payload_json.download_token_id === input.payload_json.download_token_id
    );
    if (existing) return existing;
    this.emailLogs.set(input.id, input);
    return input;
  }

  async listEmailLogsByOrder(orderId: string): Promise<OrchestrationEmailLog[]> {
    return [...this.emailLogs.values()].filter((log) => log.order_id === orderId);
  }

  async updateOrderStatus(input: {
    order_id: string;
    order_status?: string;
    fulfillment_status?: string;
    completed_at?: string | null;
  }): Promise<OrchestrationOrder> {
    const order = this.orders.get(input.order_id);
    if (!order) throw new Error("order_not_found");
    const updated = {
      ...order,
      order_status: input.order_status ?? order.order_status,
      fulfillment_status: input.fulfillment_status ?? order.fulfillment_status,
      completed_at: input.completed_at === undefined ? order.completed_at : input.completed_at
    };
    this.orders.set(order.id, updated);
    return updated;
  }

  async markOutboxPublished(outboxEventId: string, nowIso: string): Promise<void> {
    const event = this.outboxEvents.get(outboxEventId);
    if (event) {
      this.outboxEvents.set(outboxEventId, {
        ...event,
        status: "published",
        published_at: nowIso
      });
    }
  }
}

export function hashForStorage(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
