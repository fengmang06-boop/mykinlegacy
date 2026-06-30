import { Module } from "@nestjs/common";

import { CommonModule } from "../common/common.module";
import { DatabaseModule } from "../database/database.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [CommonModule, DatabaseModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
