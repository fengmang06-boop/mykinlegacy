import { PrismaService } from "./prisma.service";

export const ORCHESTRATION_REPOSITORY = Symbol("ORCHESTRATION_REPOSITORY");

export const orchestrationRepositoryProvider = {
  provide: ORCHESTRATION_REPOSITORY,
  useFactory: (prismaService: PrismaService) => {
    const databaseModule = requireDatabaseModule();
    return new databaseModule.PrismaOrchestrationRepository(prismaService.db);
  },
  inject: [PrismaService]
};

function requireDatabaseModule(): {
  PrismaOrchestrationRepository: new (db: unknown) => unknown;
} {
  const requirePackage = eval("require") as (specifier: string) => {
    PrismaOrchestrationRepository: new (db: unknown) => unknown;
  };
  return requirePackage("@ai-heritage/database");
}
