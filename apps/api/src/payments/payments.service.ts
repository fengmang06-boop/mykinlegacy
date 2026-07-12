import { HttpStatus, Injectable } from "@nestjs/common";
import { ulid } from "ulid";

import { ApiException } from "../common/api-error";
import { IdempotencyService } from "../common/idempotency.service";
import { rejectFields, requireDataEnvelope, requireString } from "../common/validation";
import { PrismaService } from "../database/prisma.service";
import type { CheckoutSessionResult } from "./stripe.adapter";
import { StripeAdapter } from "./stripe.adapter";
import type { PaymentOrderRecord } from "./payment-types";

type PaymentsClient = {
  order: {
    findUnique: (args: unknown) => Promise<PaymentOrderRecord | null>;
    findMany: (args: unknown) => Promise<Array<{ metadataJson: unknown }>>;
  };
  paymentIntent: {
    upsert: (args: unknown) => Promise<{ id: string; providerIntentId: string }>;
  };
};

@Injectable()
export class PaymentsService {
  private readonly prisma: PaymentsClient;

  constructor(
    prismaService: PrismaService,
    private readonly stripeAdapter: StripeAdapter,
    private readonly idempotencyService: IdempotencyService
  ) {
    this.prisma = prismaService.db as unknown as PaymentsClient;
  }

  async createStripeCheckoutSession(body: unknown, idempotencyKey?: string) {
    return this.idempotencyService.run({
      idempotencyKey,
      requestBody: body,
      handler: () => this.createStripeCheckoutSessionUnsafe(body)
    });
  }

  private async createStripeCheckoutSessionUnsafe(body: unknown) {
    assertCheckoutOpen();
    const data = requireDataEnvelope(body);
    rejectFields(data, ["amount", "amount_cents", "price", "price_cents", "currency"]);
    const orderNumber = requireString(data, "order_number");
    const successUrl = validateUrl(requireString(data, "success_url"), "success_url");
    const cancelUrl = validateUrl(requireString(data, "cancel_url"), "cancel_url");
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        orderItems: {
          include: {
            product: { include: { translations: true } },
            package: true
          }
        },
        consentRecords: { orderBy: { createdAt: "desc" }, take: 1 }
      }
    });

    if (!order) {
      throw new ApiException({
        errorCode: "order_not_found",
        message: `Order not found: ${orderNumber}`,
        userMessage: "The order could not be found.",
        status: HttpStatus.NOT_FOUND,
        affectedField: "order_number"
      });
    }
    assertOrderCanCheckout(order);
    await this.assertFounderEditionCapacity(order);

    const orderItem = order.orderItems[0];
    if (!orderItem) {
      throw new ApiException({
        errorCode: "internal_error",
        message: "Order has no order item.",
        userMessage: "The order is not ready for checkout.",
        status: HttpStatus.CONFLICT
      });
    }

    const amountCents = Number(order.totalCents);
    const productName = orderItem.product.translations[0]?.name ?? orderItem.product.code;
    const session = await this.stripeAdapter.createCheckoutSession({
      orderNumber: order.orderNumber,
      amountCents,
      currency: order.currency,
      productName,
      successUrl,
      cancelUrl,
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber,
        product_code: orderItem.product.code,
        package_code: orderItem.package.code
      }
    });

    await this.upsertPaymentIntent(order, session, orderItem.product.code, orderItem.package.code);

    return {
      provider: "stripe",
      checkout_session_id: session.id,
      checkout_url: session.url,
      expires_at: session.expiresAt.toISOString()
    };
  }

  private async assertFounderEditionCapacity(order: PaymentOrderRecord) {
    const metadata = recordValue(order.metadataJson);
    if (metadata.founder_edition !== true) return;

    const limit = positiveInteger(process.env.FOUNDER_EDITION_ORDER_LIMIT, 25);
    const launchStart = validDate(process.env.FOUNDER_EDITION_START_AT);
    const paidOrders = await this.prisma.order.findMany({
      where: {
        paymentStatus: "paid",
        ...(launchStart ? { createdAt: { gte: launchStart } } : {})
      },
      select: { metadataJson: true }
    });
    const founderEditionPaid = paidOrders.filter(
      (candidate) => recordValue(candidate.metadataJson).founder_edition === true
    ).length;

    if (founderEditionPaid >= limit) {
      throw new ApiException({
        errorCode: "founder_edition_full",
        message: `Founder Edition order limit reached: ${founderEditionPaid}/${limit}.`,
        userMessage: "Founder Edition is currently full. Please contact support for availability.",
        status: HttpStatus.CONFLICT,
        affectedField: "order_number"
      });
    }
  }

  private async upsertPaymentIntent(
    order: PaymentOrderRecord,
    session: CheckoutSessionResult,
    productCode: string,
    packageCode: string
  ) {
    const timestamp = new Date();
    await this.prisma.paymentIntent.upsert({
      where: {
        provider_providerIntentId: {
          provider: "stripe",
          providerIntentId: session.id
        }
      },
      create: {
        id: ulid(),
        orderId: order.id,
        provider: "stripe",
        providerIntentId: session.id,
        status: "created",
        amountCents: BigInt(order.totalCents),
        currency: order.currency,
        checkoutUrl: session.url,
        metadataJson: {
          order_number: order.orderNumber,
          product_code: productCode,
          package_code: packageCode
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        expiresAt: session.expiresAt
      },
      update: {
        status: "pending",
        checkoutUrl: session.url,
        updatedAt: timestamp,
        expiresAt: session.expiresAt
      }
    });
  }
}

export function assertCheckoutOpen(): void {
  if (process.env.CHECKOUT_ENABLED?.trim().toLowerCase() === "false") {
    throw new ApiException({
      errorCode: "checkout_paused",
      message: "Checkout is paused by the operational kill switch.",
      userMessage: "Checkout is temporarily paused. Please contact support for availability.",
      status: HttpStatus.SERVICE_UNAVAILABLE
    });
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function assertOrderCanCheckout(order: PaymentOrderRecord): void {
  if (order.orderStatus !== "pending_payment") {
    throw new ApiException({
      errorCode: "validation_error",
      message: "Order must be pending_payment before checkout.",
      userMessage: "This order is not ready for payment.",
      status: HttpStatus.CONFLICT,
      affectedField: "order_status"
    });
  }
  if (!["unpaid", "failed"].includes(order.paymentStatus)) {
    throw new ApiException({
      errorCode: "validation_error",
      message: "Order payment_status must be unpaid or failed before checkout.",
      userMessage: "This order is not ready for payment.",
      status: HttpStatus.CONFLICT,
      affectedField: "payment_status"
    });
  }
  if (order.fulfillmentStatus !== "not_started") {
    throw new ApiException({
      errorCode: "validation_error",
      message: "Order fulfillment_status must be not_started before checkout.",
      userMessage: "This order is not ready for payment.",
      status: HttpStatus.CONFLICT,
      affectedField: "fulfillment_status"
    });
  }

  const consent = order.consentRecords[0];
  if (
    !consent?.termsAccepted ||
    !consent.privacyPolicyAccepted ||
    !consent.heritageDisclaimerAccepted ||
    !consent.aiGenerationConsent ||
    !consent.emailDeliveryConsent
  ) {
    throw new ApiException({
      errorCode: "consent_required",
      message: "Required consent is missing before Stripe checkout.",
      userMessage: "Please complete the required consent before payment.",
      status: HttpStatus.BAD_REQUEST,
      affectedField: "consent"
    });
  }
}

function validateUrl(value: string, field: string): string {
  try {
    return new URL(value).toString();
  } catch {
    throw new ApiException({
      errorCode: "validation_error",
      message: `${field} must be a valid URL.`,
      userMessage: "Please provide a valid checkout URL.",
      status: HttpStatus.BAD_REQUEST,
      affectedField: field
    });
  }
}
