import { Injectable, OnModuleDestroy } from "@nestjs/common";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly client: Record<string, unknown>;

  constructor() {
    process.env.DATABASE_URL ??=
      "mysql://ai_heritage:ai_heritage_dev_password@localhost:3306/ai_heritage";
    const requireDatabase = eval("require") as (specifier: string) => { prisma: Record<string, unknown> };
    this.client = requireDatabase("@ai-heritage/database").prisma;
  }

  get db(): Record<string, unknown> {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    const disconnect = this.client.$disconnect;
    if (typeof disconnect === "function") {
      await disconnect.call(this.client);
    }
  }
}
