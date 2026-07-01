import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { orchestrationRepositoryProvider } from "../database/orchestration.provider";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AdminController],
  providers: [orchestrationRepositoryProvider, AdminService],
  exports: [AdminService]
})
export class AdminModule {}
