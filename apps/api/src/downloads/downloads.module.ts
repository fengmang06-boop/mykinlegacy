import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { downloadVaultRepositoryProvider } from "./download-vault.provider";
import { DownloadsController } from "./downloads.controller";
import { DownloadsService } from "./downloads.service";

@Module({
  imports: [DatabaseModule],
  controllers: [DownloadsController],
  providers: [downloadVaultRepositoryProvider, DownloadsService],
  exports: [DownloadsService]
})
export class DownloadsModule {}
