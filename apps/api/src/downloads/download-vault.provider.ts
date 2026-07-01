import { PrismaService } from "../database/prisma.service";
import { PrismaDownloadVaultRepository } from "./prisma-download-vault.repository";

export const DOWNLOAD_VAULT_REPOSITORY = Symbol("DOWNLOAD_VAULT_REPOSITORY");

export const downloadVaultRepositoryProvider = {
  provide: DOWNLOAD_VAULT_REPOSITORY,
  useFactory: (prismaService: PrismaService) =>
    new PrismaDownloadVaultRepository(prismaService.db as never),
  inject: [PrismaService]
};
