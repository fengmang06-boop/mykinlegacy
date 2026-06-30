import { Module } from "@nestjs/common";

import { CommonModule } from "../common/common.module";
import { DatabaseModule } from "../database/database.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { StripeAdapter } from "./stripe.adapter";
import { StripeWebhookService } from "./stripe-webhook.service";

@Module({
  imports: [CommonModule, DatabaseModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeAdapter, StripeWebhookService],
  exports: [PaymentsService, StripeWebhookService]
})
export class PaymentsModule {}
