import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { AppController } from "./app.controller";
import { requestContextMiddleware } from "./common/request-context";
import { CommonModule } from "./common/common.module";
import { InterviewsModule } from "./interviews/interviews.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProductsModule } from "./products/products.module";
import { DownloadsModule } from "./downloads/downloads.module";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";

@Module({
  imports: [
    CommonModule,
    ProductsModule,
    InterviewsModule,
    OrdersModule,
    PaymentsModule,
    DownloadsModule,
    AdminModule,
    AnalyticsModule
  ],
  controllers: [AppController]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestContextMiddleware).forRoutes("*");
  }
}
