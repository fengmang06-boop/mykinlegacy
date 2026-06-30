import { describe, expect, it } from "vitest";

import { PrismaClient, prisma } from "./index";

describe("database package", () => {
  it("exports Prisma client references", () => {
    expect(typeof PrismaClient).toBe("function");
    expect(typeof prisma.$connect).toBe("function");
    expect(typeof prisma.$disconnect).toBe("function");
  });
});
