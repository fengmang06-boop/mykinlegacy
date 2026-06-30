import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { PrismaService } from "../database/prisma.service";
import { IdempotencyService } from "./idempotency.service";
import { RateLimitService } from "./rate-limit.service";

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: IdempotencyService,
      inject: [PrismaService],
      useFactory: (prismaService: PrismaService) => new IdempotencyService(prismaService.db as never)
    },
    RateLimitService
  ],
  exports: [IdempotencyService, RateLimitService]
})
export class CommonModule {}
