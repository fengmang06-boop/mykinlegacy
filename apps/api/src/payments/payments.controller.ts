import { Body, Controller, Headers, Post, Req } from "@nestjs/common";
import type { Request } from "express";

import { PaymentsService } from "./payments.service";
import { StripeWebhookService } from "./stripe-webhook.service";

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeWebhookService: StripeWebhookService
  ) {}

  @Post("payments/stripe/create-checkout-session")
  createCheckoutSession(@Body() body: unknown, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.paymentsService.createStripeCheckoutSession(body, idempotencyKey);
  }

  @Post("webhooks/stripe")
  handleStripeWebhook(@Req() request: RawBodyRequest, @Headers("stripe-signature") signature?: string) {
    return this.stripeWebhookService.handleWebhook({
      rawBody: request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {})),
      signature: signature ?? ""
    });
  }
}
