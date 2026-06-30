import { HttpStatus, Injectable } from "@nestjs/common";
import Stripe from "stripe";
import { ulid } from "ulid";

import { ApiException } from "../common/api-error";
import { PrismaService } from "../database/prisma.service";
import type { PaymentIntentRecord, PaymentOrderRecord, WebhookRecord } from "./payment-types";
import { StripeAdapter } from "./stripe.adapter";

type WebhookClient = {
  paymentWebhookEvent: {
    findUnique: (args: unknown) => Promise<WebhookRecord | null>;
    create: (args: unknown) => Promise<WebhookRecord>;
    update: (args: unknown) => Promise<WebhookRecord>;
  };
  order: {
    findUnique: (args: unknown) => Promise<PaymentOrderRecord | null>;
    update: (args: unknown) => Promise<PaymentOrderRecord>;
  };
  paymentIntent: {
    findUnique: (args: unknown) => Promise<PaymentIntentRecord | null>;
    upsert: (args: unknown) => Promise<PaymentIntentRecord>;
  };
  paymentTransaction: {
    findUnique: (args: unknown) => Promise<unknown | null>;
    create: (args: unknown) => Promise<unknown>;
  };
  orderStatusHistory: { create: (args: unknown) => Promise<unknown> };
  refund: { create: (args: unknown) => Promise<unknown> };
  outboxEvent: { create: (args: unknown) => Promise<unknown> };
  $transaction: <T>(fn: (client: WebhookClient) => Promise<T>) => Promise<T>;
};

@Injectable()
export class StripeWebhookService {
  private readonly prisma: WebhookClient;

  constructor(
    prismaService: PrismaService,
    private readonly stripeAdapter: StripeAdapter
  ) {
    this.prisma = prismaService.db as unknown as WebhookClient;
  }

  async handleWebhook(input: { rawBody: Buffer; signature: string }) {
    let event: Stripe.Event;
    try {
      event = this.stripeAdapter.constructWebhookEvent(input.rawBody, input.signature);
    } catch {
      throw new ApiException({
        errorCode: "payment_webhook_invalid",
        message: "Stripe webhook signature verification failed.",
        userMessage: "Invalid webhook signature.",
        status: HttpStatus.BAD_REQUEST,
        affectedField: "stripe-signature"
      });
    }

    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: "stripe",
          providerEventId: event.id
        }
      }
    });
    if (existing) {
      return {
        received: true,
        duplicate: true,
        processed: existing.processingStatus === "processed",
        event_id: event.id
      };
    }

    const webhookRecord = await this.prisma.paymentWebhookEvent.create({
      data: {
        id: ulid(),
        provider: "stripe",
        providerEventId: event.id,
        eventType: event.type,
        signatureVerified: true,
        processingStatus: "received",
        payloadJson: event as unknown as Record<string, unknown>,
        receivedAt: new Date(),
        processedAt: null
      }
    });

    try {
      const result = await this.processVerifiedEvent(event, webhookRecord.id);
      await this.prisma.paymentWebhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          processingStatus: result.processed ? "processed" : "ignored",
          processedAt: new Date()
        }
      });
      return {
        received: true,
        duplicate: false,
        event_id: event.id,
        ...result
      };
    } catch (error) {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          processingStatus: "failed",
          errorMessage: error instanceof Error ? error.message : "Webhook processing failed.",
          processedAt: new Date()
        }
      });
      return {
        received: true,
        duplicate: false,
        processed: false,
        event_id: event.id
      };
    }
  }

  private async processVerifiedEvent(event: Stripe.Event, webhookRecordId: string) {
    switch (event.type) {
      case "checkout.session.completed":
        return this.handleCheckoutSessionCompleted(event, webhookRecordId);
      case "payment_intent.succeeded":
        return this.handlePaymentIntentSucceeded(event, webhookRecordId);
      case "charge.refunded":
        return this.handleChargeRefunded(event, webhookRecordId);
      case "charge.dispute.created":
        return this.handleChargeDisputeCreated(event, webhookRecordId);
      default:
        return { processed: false, reason: "unsupported_event_type" };
    }
  }

  private async handleCheckoutSessionCompleted(event: Stripe.Event, webhookRecordId: string) {
    const session = event.data.object as Stripe.Checkout.Session;
    const order = await this.findOrderFromMetadata(session.metadata, session.client_reference_id ?? null);
    if (!order) {
      return { processed: false, reason: "order_not_found" };
    }

    const amountTotal = session.amount_total ?? 0;
    const currency = (session.currency ?? "").toUpperCase();
    if (amountTotal !== Number(order.totalCents) || currency !== order.currency.toUpperCase()) {
      throw new Error("Stripe checkout amount or currency does not match order.");
    }

    const paymentIntentId = await this.upsertStripePaymentIntent(
      order,
      session.id,
      session.url ?? null,
      session.expires_at ? new Date(session.expires_at * 1000) : null
    );
    const providerTransactionId = normalizeStripeId(session.payment_intent) ?? session.id;

    await this.prisma.$transaction(async (transaction) => {
      await markOrderPaid(transaction, order, webhookRecordId);
      await createPaymentTransactionIfMissing(transaction, {
        order,
        paymentIntentId,
        webhookRecordId,
        providerTransactionId,
        transactionType: "sale",
        amountCents: BigInt(order.totalCents),
        currency: order.currency
      });
      await createOrderPaidOutbox(transaction, order);
    });

    return { processed: true, order_number: order.orderNumber };
  }

  private async handlePaymentIntentSucceeded(event: Stripe.Event, webhookRecordId: string) {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const order = await this.findOrderFromMetadata(paymentIntent.metadata, null);
    if (!order) {
      return { processed: false, reason: "order_not_found" };
    }

    const paymentIntentRecord = await this.prisma.paymentIntent.findUnique({
      where: {
        provider_providerIntentId: {
          provider: "stripe",
          providerIntentId: paymentIntent.id
        }
      }
    });

    if (paymentIntentRecord) {
      await createPaymentTransactionIfMissing(this.prisma, {
        order,
        paymentIntentId: paymentIntentRecord.id,
        webhookRecordId,
        providerTransactionId: paymentIntent.id,
        transactionType: "capture",
        amountCents: BigInt(paymentIntent.amount_received ?? paymentIntent.amount),
        currency: paymentIntent.currency.toUpperCase()
      });
    }

    return { processed: true, order_number: order.orderNumber };
  }

  private async handleChargeRefunded(event: Stripe.Event, webhookRecordId: string) {
    const charge = event.data.object as Stripe.Charge;
    const order = await this.findOrderFromMetadata(charge.metadata, null);
    if (!order) {
      return { processed: false, reason: "order_not_found" };
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.order.update({
        where: { id: order.id },
        data: { paymentStatus: "refunded", updatedAt: new Date() }
      });
      await createStatusHistory(transaction, order.id, "payment", order.paymentStatus, "refunded", "stripe_refund");
      await transaction.outboxEvent.create({
        data: {
          id: ulid(),
          eventType: "order.refunded",
          aggregateType: "order",
          aggregateId: order.id,
          payloadJson: { order_id: order.id, order_number: order.orderNumber, raw_event_id: webhookRecordId },
          status: "pending",
          attempts: 0,
          nextAttemptAt: null,
          createdAt: new Date(),
          publishedAt: null
        }
      });
    });

    return { processed: true, order_number: order.orderNumber };
  }

  private async handleChargeDisputeCreated(event: Stripe.Event, webhookRecordId: string) {
    const dispute = event.data.object as Stripe.Dispute;
    const order = await this.findOrderFromMetadata(dispute.metadata, null);
    if (!order) {
      return { processed: false, reason: "order_not_found" };
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.order.update({
        where: { id: order.id },
        data: { paymentStatus: "disputed", updatedAt: new Date() }
      });
      await createStatusHistory(transaction, order.id, "payment", order.paymentStatus, "disputed", "stripe_dispute");
      await transaction.outboxEvent.create({
        data: {
          id: ulid(),
          eventType: "order.disputed",
          aggregateType: "order",
          aggregateId: order.id,
          payloadJson: { order_id: order.id, order_number: order.orderNumber, raw_event_id: webhookRecordId },
          status: "pending",
          attempts: 0,
          nextAttemptAt: null,
          createdAt: new Date(),
          publishedAt: null
        }
      });
    });

    return { processed: true, order_number: order.orderNumber };
  }

  private async findOrderFromMetadata(
    metadata: Stripe.Metadata | null | undefined,
    clientReferenceId: string | null
  ): Promise<PaymentOrderRecord | null> {
    const orderNumber = metadata?.order_number ?? clientReferenceId;
    if (!orderNumber) {
      return null;
    }
    return this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        orderItems: {
          include: {
            product: true,
            package: true
          }
        },
        consentRecords: true
      }
    });
  }

  private async upsertStripePaymentIntent(
    order: PaymentOrderRecord,
    checkoutSessionId: string,
    checkoutUrl: string | null,
    expiresAt: Date | null
  ): Promise<string> {
    const timestamp = new Date();
    const intent = await this.prisma.paymentIntent.upsert({
      where: {
        provider_providerIntentId: {
          provider: "stripe",
          providerIntentId: checkoutSessionId
        }
      },
      create: {
        id: ulid(),
        orderId: order.id,
        provider: "stripe",
        providerIntentId: checkoutSessionId,
        status: "succeeded",
        amountCents: BigInt(order.totalCents),
        currency: order.currency,
        checkoutUrl,
        metadataJson: { order_number: order.orderNumber },
        createdAt: timestamp,
        updatedAt: timestamp,
        expiresAt
      },
      update: {
        status: "succeeded",
        updatedAt: timestamp
      }
    });
    return intent.id;
  }
}

async function markOrderPaid(client: WebhookClient, order: PaymentOrderRecord, webhookRecordId: string) {
  if (order.paymentStatus === "paid" && order.orderStatus === "paid") {
    return;
  }
  const timestamp = new Date();
  await client.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "paid",
      orderStatus: "paid",
      paidAt: timestamp,
      updatedAt: timestamp
    }
  });
  await createStatusHistory(client, order.id, "payment", order.paymentStatus, "paid", "stripe_verified_payment");
  await createStatusHistory(client, order.id, "order", order.orderStatus, "paid", "stripe_verified_payment");
  void webhookRecordId;
}

async function createPaymentTransactionIfMissing(
  client: WebhookClient,
  input: {
    order: PaymentOrderRecord;
    paymentIntentId: string;
    webhookRecordId: string;
    providerTransactionId: string;
    transactionType: "sale" | "capture" | "refund";
    amountCents: bigint;
    currency: string;
  }
) {
  const existing = await client.paymentTransaction.findUnique({
    where: {
      provider_providerTransactionId: {
        provider: "stripe",
        providerTransactionId: input.providerTransactionId
      }
    }
  });
  if (existing) {
    return;
  }

  await client.paymentTransaction.create({
    data: {
      id: ulid(),
      orderId: input.order.id,
      paymentIntentId: input.paymentIntentId,
      provider: "stripe",
      providerTransactionId: input.providerTransactionId,
      transactionType: input.transactionType,
      status: "succeeded",
      amountCents: input.amountCents,
      currency: input.currency,
      rawEventId: input.webhookRecordId,
      processedAt: new Date(),
      createdAt: new Date()
    }
  });
}

async function createOrderPaidOutbox(client: WebhookClient, order: PaymentOrderRecord) {
  const orderItem = order.orderItems[0];
  const metadata = isRecord(order.metadataJson) ? order.metadataJson : {};
  await client.outboxEvent.create({
    data: {
      id: ulid(),
      eventType: "order.paid",
      aggregateType: "order",
      aggregateId: order.id,
      payloadJson: {
        order_id: order.id,
        order_number: order.orderNumber,
        order_item_id: orderItem?.id ?? null,
        house_id: typeof metadata.house_id === "string" ? metadata.house_id : null,
        identity_version_id:
          typeof metadata.identity_version_id === "string" ? metadata.identity_version_id : null,
        product_code: orderItem?.product.code ?? null,
        package_code: orderItem?.package.code ?? null,
        amount_cents: Number(order.totalCents),
        currency: order.currency,
        paid_at: new Date().toISOString()
      },
      status: "pending",
      attempts: 0,
      nextAttemptAt: null,
      createdAt: new Date(),
      publishedAt: null
    }
  });
}

async function createStatusHistory(
  client: WebhookClient,
  orderId: string,
  statusType: "order" | "payment" | "fulfillment",
  fromStatus: string,
  toStatus: string,
  reasonCode: string
) {
  await client.orderStatusHistory.create({
    data: {
      id: ulid(),
      orderId,
      statusType,
      fromStatus,
      toStatus,
      reasonCode,
      message: "Updated by verified Stripe webhook.",
      actorType: "webhook",
      actorId: null,
      createdAt: new Date()
    }
  });
}

function normalizeStripeId(value: string | Stripe.PaymentIntent | null): string | null {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
