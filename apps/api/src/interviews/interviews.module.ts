import { Module } from "@nestjs/common";

import { CommonModule } from "../common/common.module";
import { DatabaseModule } from "../database/database.module";
import { InterviewsController } from "./interviews.controller";
import { InterviewsService } from "./interviews.service";

@Module({
  imports: [CommonModule, DatabaseModule],
  controllers: [InterviewsController],
  providers: [InterviewsService],
  exports: [InterviewsService]
})
export class InterviewsModule {}
