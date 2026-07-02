import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";

import { IdempotencyService } from "../common/idempotency.service";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly idempotencyService: IdempotencyService
  ) {}

  @Post()
  createOrder(@Body() body: unknown, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.idempotencyService.run({
      idempotencyKey,
      requestBody: body,
      handler: () => this.ordersService.createOrder(body)
    });
  }

  @Get(":orderNumber/artifacts")
  getArtifacts(@Param("orderNumber") orderNumber: string) {
    return this.ordersService.getArtifacts(orderNumber);
  }

  @Get(":orderNumber/pdf")
  getPdfArtifacts(@Param("orderNumber") orderNumber: string) {
    return this.ordersService.getPdfArtifacts(orderNumber);
  }

  @Get(":orderNumber/vault")
  getVaultSummary(@Param("orderNumber") orderNumber: string) {
    return this.ordersService.getVaultSummary(orderNumber);
  }

  @Get(":orderNumber")
  getOrder(@Param("orderNumber") orderNumber: string) {
    return this.ordersService.getOrder(orderNumber);
  }

  @Post(":orderNumber/consent")
  createConsent(
    @Param("orderNumber") orderNumber: string,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.idempotencyService.run({
      idempotencyKey,
      requestBody: { orderNumber, body },
      handler: () => this.ordersService.createConsent(orderNumber, body)
    });
  }
}
