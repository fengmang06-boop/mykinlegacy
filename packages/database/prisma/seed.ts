import { ulid } from "ulid";

import {
  PrismaClient,
  type AiCapability,
  type AiModelStatus,
  type AiProviderStatus,
  type BindingStatus,
  type DeliverableCategory,
  type ProductStatus,
  type ProductType,
  type PromptTemplateStatus,
  type PromptType,
  type PromptVersionStatus,
  type EmailTemplateStatus
} from "../generated/client";

import {
  adminPermissionSeeds,
  adminRoleSeeds,
  aiModelSeeds,
  aiProviderSeed,
  deliverableTypeSeeds,
  emailTemplateSeed,
  packageDeliverableSeeds,
  packageSeed,
  productPromptBindingSeeds,
  productSeed,
  promptTemplateSeeds,
  rolePermissionMatrix
} from "./seed-data";

const prisma = new PrismaClient();

const now = () => new Date();
const createId = () => ulid();

async function seedProduct() {
  const timestamp = now();
  const product = await prisma.product.upsert({
    where: { code: productSeed.code },
    create: {
      id: createId(),
      code: productSeed.code,
      productType: productSeed.productType as ProductType,
      status: productSeed.status as ProductStatus,
      defaultLocale: productSeed.defaultLocale,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    update: {
      productType: productSeed.productType as ProductType,
      status: productSeed.status as ProductStatus,
      defaultLocale: productSeed.defaultLocale,
      updatedAt: timestamp
    }
  });

  await prisma.productTranslation.upsert({
    where: {
      productId_locale: {
        productId: product.id,
        locale: productSeed.translation.locale
      }
    },
    create: {
      id: createId(),
      productId: product.id,
      locale: productSeed.translation.locale,
      name: productSeed.translation.name,
      shortDescription: productSeed.translation.shortDescription,
      descriptionJson: productSeed.translation.descriptionJson,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    update: {
      name: productSeed.translation.name,
      shortDescription: productSeed.translation.shortDescription,
      descriptionJson: productSeed.translation.descriptionJson,
      updatedAt: timestamp
    }
  });

  const productPackage = await prisma.productPackage.upsert({
    where: {
      productId_code: {
        productId: product.id,
        code: packageSeed.code
      }
    },
    create: {
      id: createId(),
      productId: product.id,
      code: packageSeed.code,
      status: packageSeed.status as ProductStatus,
      priceCents: packageSeed.priceCents,
      currency: packageSeed.currency,
      sortOrder: packageSeed.sortOrder,
      generationConfigJson: packageSeed.generationConfigJson,
      metadataJson: packageSeed.metadataJson,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    update: {
      status: packageSeed.status as ProductStatus,
      priceCents: packageSeed.priceCents,
      currency: packageSeed.currency,
      sortOrder: packageSeed.sortOrder,
      generationConfigJson: packageSeed.generationConfigJson,
      metadataJson: packageSeed.metadataJson,
      updatedAt: timestamp
    }
  });

  return { product, productPackage };
}

async function seedDeliverables(productPackageId: string) {
  const deliverableTypes = new Map<string, string>();

  for (const deliverableTypeSeed of deliverableTypeSeeds) {
    const timestamp = now();
    const deliverableType = await prisma.deliverableType.upsert({
      where: { code: deliverableTypeSeed.code },
      create: {
        id: createId(),
        code: deliverableTypeSeed.code,
        category: deliverableTypeSeed.category as DeliverableCategory,
        defaultFileExt: deliverableTypeSeed.defaultFileExt,
        defaultMimeType: deliverableTypeSeed.defaultMimeType,
        isDigital: deliverableTypeSeed.isDigital,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      update: {
        category: deliverableTypeSeed.category as DeliverableCategory,
        defaultFileExt: deliverableTypeSeed.defaultFileExt,
        defaultMimeType: deliverableTypeSeed.defaultMimeType,
        isDigital: deliverableTypeSeed.isDigital,
        updatedAt: timestamp
      }
    });
    deliverableTypes.set(deliverableTypeSeed.code, deliverableType.id);
  }

  for (const packageDeliverableSeed of packageDeliverableSeeds) {
    const deliverableTypeId = deliverableTypes.get(packageDeliverableSeed.deliverableTypeCode);
    if (!deliverableTypeId) {
      throw new Error(`Missing deliverable type: ${packageDeliverableSeed.deliverableTypeCode}`);
    }

    await prisma.packageDeliverable.upsert({
      where: {
        packageId_deliverableCode: {
          packageId: productPackageId,
          deliverableCode: packageDeliverableSeed.deliverableCode
        }
      },
      create: {
        id: createId(),
        packageId: productPackageId,
        deliverableTypeId,
        deliverableCode: packageDeliverableSeed.deliverableCode,
        quantity: packageDeliverableSeed.quantity,
        required: packageDeliverableSeed.required,
        sortOrder: packageDeliverableSeed.sortOrder,
        configJson: packageDeliverableSeed.configJson,
        createdAt: now()
      },
      update: {
        deliverableTypeId,
        quantity: packageDeliverableSeed.quantity,
        required: packageDeliverableSeed.required,
        sortOrder: packageDeliverableSeed.sortOrder,
        configJson: packageDeliverableSeed.configJson
      }
    });
  }

  return deliverableTypes;
}

async function seedPromptTemplates() {
  const promptVersionIds = new Map<string, string>();

  for (const promptTemplateSeed of promptTemplateSeeds) {
    const timestamp = now();
    const template = await prisma.promptTemplate.upsert({
      where: { code: promptTemplateSeed.code },
      create: {
        id: createId(),
        code: promptTemplateSeed.code,
        promptType: promptTemplateSeed.promptType as PromptType,
        status: promptTemplateSeed.status as PromptTemplateStatus,
        description: promptTemplateSeed.description,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      update: {
        promptType: promptTemplateSeed.promptType as PromptType,
        status: promptTemplateSeed.status as PromptTemplateStatus,
        description: promptTemplateSeed.description,
        updatedAt: timestamp
      }
    });

    const version = await prisma.promptTemplateVersion.upsert({
      where: {
        promptTemplateId_version: {
          promptTemplateId: template.id,
          version: promptTemplateSeed.version.version
        }
      },
      create: {
        id: createId(),
        promptTemplateId: template.id,
        version: promptTemplateSeed.version.version,
        status: promptTemplateSeed.version.status as PromptVersionStatus,
        templateBody: promptTemplateSeed.version.templateBody,
        variablesSchemaJson: promptTemplateSeed.version.variablesSchemaJson,
        negativePrompt: "negativePrompt" in promptTemplateSeed.version ? promptTemplateSeed.version.negativePrompt : null,
        paramsJson: promptTemplateSeed.version.paramsJson,
        createdAt: timestamp,
        activatedAt: timestamp
      },
      update: {
        status: promptTemplateSeed.version.status as PromptVersionStatus,
        templateBody: promptTemplateSeed.version.templateBody,
        variablesSchemaJson: promptTemplateSeed.version.variablesSchemaJson,
        negativePrompt: "negativePrompt" in promptTemplateSeed.version ? promptTemplateSeed.version.negativePrompt : null,
        paramsJson: promptTemplateSeed.version.paramsJson,
        activatedAt: timestamp
      }
    });

    promptVersionIds.set(promptTemplateSeed.code, version.id);
  }

  return promptVersionIds;
}

async function seedEmailTemplate() {
  const timestamp = now();
  await prisma.emailTemplate.upsert({
    where: {
      code_locale_version: {
        code: emailTemplateSeed.code,
        locale: emailTemplateSeed.locale,
        version: emailTemplateSeed.version
      }
    },
    create: {
      id: createId(),
      code: emailTemplateSeed.code,
      locale: emailTemplateSeed.locale,
      version: emailTemplateSeed.version,
      status: emailTemplateSeed.status as EmailTemplateStatus,
      subjectTemplate: emailTemplateSeed.subjectTemplate,
      bodyTemplate: emailTemplateSeed.bodyTemplate,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    update: {
      status: emailTemplateSeed.status as EmailTemplateStatus,
      subjectTemplate: emailTemplateSeed.subjectTemplate,
      bodyTemplate: emailTemplateSeed.bodyTemplate,
      updatedAt: timestamp
    }
  });
}

async function seedAdminRbac() {
  const roleIds = new Map<string, string>();
  const permissionIds = new Map<string, string>();

  for (const roleSeed of adminRoleSeeds) {
    const role = await prisma.adminRole.upsert({
      where: { code: roleSeed.code },
      create: {
        id: createId(),
        code: roleSeed.code,
        name: roleSeed.name,
        createdAt: now()
      },
      update: {
        name: roleSeed.name
      }
    });
    roleIds.set(roleSeed.code, role.id);
  }

  for (const permissionCode of adminPermissionSeeds) {
    const permission = await prisma.adminPermission.upsert({
      where: { code: permissionCode },
      create: {
        id: createId(),
        code: permissionCode,
        description: `Allows ${permissionCode.replaceAll("_", " ")}.`,
        createdAt: now()
      },
      update: {
        description: `Allows ${permissionCode.replaceAll("_", " ")}.`
      }
    });
    permissionIds.set(permissionCode, permission.id);
  }

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMatrix)) {
    const roleId = roleIds.get(roleCode);
    if (!roleId) {
      throw new Error(`Missing admin role: ${roleCode}`);
    }

    for (const permissionCode of permissionCodes) {
      const permissionId = permissionIds.get(permissionCode);
      if (!permissionId) {
        throw new Error(`Missing admin permission: ${permissionCode}`);
      }

      await prisma.adminRolePermission.upsert({
        where: {
          adminRoleId_adminPermissionId: {
            adminRoleId: roleId,
            adminPermissionId: permissionId
          }
        },
        create: {
          id: createId(),
          adminRoleId: roleId,
          adminPermissionId: permissionId,
          createdAt: now()
        },
        update: {}
      });
    }
  }
}

async function seedAiPlaceholders() {
  const timestamp = now();
  const provider = await prisma.aiProvider.upsert({
    where: { code: aiProviderSeed.code },
    create: {
      id: createId(),
      code: aiProviderSeed.code,
      status: aiProviderSeed.status as AiProviderStatus,
      configJson: aiProviderSeed.configJson,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    update: {
      status: aiProviderSeed.status as AiProviderStatus,
      configJson: aiProviderSeed.configJson,
      updatedAt: timestamp
    }
  });

  const modelIds = new Map<string, string>();

  for (const aiModelSeed of aiModelSeeds) {
    const model = await prisma.aiModel.upsert({
      where: {
        providerId_modelCode: {
          providerId: provider.id,
          modelCode: aiModelSeed.modelCode
        }
      },
      create: {
        id: createId(),
        providerId: provider.id,
        modelCode: aiModelSeed.modelCode,
        capability: aiModelSeed.capability as AiCapability,
        status: aiModelSeed.status as AiModelStatus,
        defaultParamsJson: {
          placeholder: true
        },
        createdAt: timestamp,
        updatedAt: timestamp
      },
      update: {
        capability: aiModelSeed.capability as AiCapability,
        status: aiModelSeed.status as AiModelStatus,
        defaultParamsJson: {
          placeholder: true
        },
        updatedAt: timestamp
      }
    });
    modelIds.set(aiModelSeed.modelCode, model.id);
  }

  return modelIds;
}

async function seedProductPromptBindings({
  productId,
  packageId,
  deliverableTypeIds,
  promptVersionIds,
  aiModelIds
}: {
  productId: string;
  packageId: string;
  deliverableTypeIds: Map<string, string>;
  promptVersionIds: Map<string, string>;
  aiModelIds: Map<string, string>;
}) {
  for (const bindingSeed of productPromptBindingSeeds) {
    const deliverableTypeId = deliverableTypeIds.get(bindingSeed.deliverableTypeCode);
    const promptTemplateVersionId = promptVersionIds.get(bindingSeed.promptTemplateCode);
    const aiModelId = aiModelIds.get(bindingSeed.aiModelCode);

    if (!deliverableTypeId) {
      throw new Error(`Missing binding deliverable type: ${bindingSeed.deliverableTypeCode}`);
    }
    if (!promptTemplateVersionId) {
      throw new Error(`Missing binding prompt template version: ${bindingSeed.promptTemplateCode}`);
    }
    if (!aiModelId) {
      throw new Error(`Missing binding AI model: ${bindingSeed.aiModelCode}`);
    }

    const existing = await prisma.productPromptBinding.findFirst({
      where: {
        productId,
        packageId,
        deliverableTypeId,
        promptTemplateVersionId,
        aiModelId
      },
      orderBy: { createdAt: "asc" }
    });

    if (existing) {
      await prisma.productPromptBinding.update({
        where: { id: existing.id },
        data: {
          status: bindingSeed.status as BindingStatus,
          priority: bindingSeed.priority,
          configJson: {
            seed_managed: true
          }
        }
      });
      continue;
    }

    await prisma.productPromptBinding.create({
      data: {
        id: createId(),
        productId,
        packageId,
        deliverableTypeId,
        promptTemplateVersionId,
        aiModelId,
        status: bindingSeed.status as BindingStatus,
        priority: bindingSeed.priority,
        configJson: {
          seed_managed: true
        },
        createdAt: now()
      }
    });
  }
}

async function verifySeed() {
  const product = await prisma.product.findUnique({
    where: { code: productSeed.code },
    include: {
      packages: {
        where: { code: packageSeed.code },
        include: { packageDeliverables: true }
      }
    }
  });

  if (!product) {
    throw new Error("Seed verification failed: family_legacy_collection is missing.");
  }

  const premiumPackage = product.packages[0];
  if (!premiumPackage) {
    throw new Error("Seed verification failed: premium package is missing.");
  }
  if (premiumPackage.priceCents !== packageSeed.priceCents) {
    throw new Error("Seed verification failed: premium price_cents is not 4900.");
  }
  if (premiumPackage.packageDeliverables.length !== packageDeliverableSeeds.length) {
    throw new Error("Seed verification failed: package deliverable count mismatch.");
  }
  if (premiumPackage.packageDeliverables.some((deliverable) => !deliverable.required)) {
    throw new Error("Seed verification failed: all MVP package deliverables must be required.");
  }

  const promptTemplateCount = await prisma.promptTemplate.count({
    where: { code: { in: promptTemplateSeeds.map((seed) => seed.code) } }
  });
  if (promptTemplateCount !== promptTemplateSeeds.length) {
    throw new Error("Seed verification failed: prompt templates are missing.");
  }

  const emailTemplate = await prisma.emailTemplate.findUnique({
    where: {
      code_locale_version: {
        code: emailTemplateSeed.code,
        locale: emailTemplateSeed.locale,
        version: emailTemplateSeed.version
      }
    }
  });
  if (!emailTemplate) {
    throw new Error("Seed verification failed: delivery_ready email template is missing.");
  }

  const adminRoleCount = await prisma.adminRole.count({
    where: { code: { in: adminRoleSeeds.map((seed) => seed.code) } }
  });
  const adminPermissionCount = await prisma.adminPermission.count({
    where: { code: { in: [...adminPermissionSeeds] } }
  });
  if (adminRoleCount !== adminRoleSeeds.length || adminPermissionCount !== adminPermissionSeeds.length) {
    throw new Error("Seed verification failed: admin roles or permissions are missing.");
  }

  const aiProvider = await prisma.aiProvider.findUnique({
    where: { code: aiProviderSeed.code }
  });
  if (!aiProvider || aiProvider.status !== "disabled") {
    throw new Error("Seed verification failed: AI provider placeholder must exist and remain disabled.");
  }

  const bindingCount = await prisma.productPromptBinding.count({
    where: {
      productId: product.id,
      packageId: premiumPackage.id,
      status: "active"
    }
  });
  if (bindingCount < productPromptBindingSeeds.length) {
    throw new Error("Seed verification failed: product prompt bindings are missing.");
  }
}

async function main() {
  const { product, productPackage } = await seedProduct();
  const deliverableTypeIds = await seedDeliverables(productPackage.id);
  const promptVersionIds = await seedPromptTemplates();
  await seedEmailTemplate();
  await seedAdminRbac();
  const aiModelIds = await seedAiPlaceholders();
  await seedProductPromptBindings({
    productId: product.id,
    packageId: productPackage.id,
    deliverableTypeIds,
    promptVersionIds,
    aiModelIds
  });
  await verifySeed();

  console.log("Database seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
