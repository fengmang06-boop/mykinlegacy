export const productSeed = {
  code: "family_legacy_collection",
  productType: "digital",
  status: "active",
  defaultLocale: "en-US",
  translation: {
    locale: "en-US",
    name: "Family Legacy Collection",
    shortDescription:
      "A personalized, heritage-inspired symbolic family identity collection.",
    descriptionJson: {
      attributes: [
        "personalized",
        "heritage-inspired",
        "symbolic",
        "private download vault"
      ],
      disclaimer:
        "This is not an official, legally granted, or historically certified coat of arms."
    }
  }
} as const;

export const packageSeed = {
  code: "premium",
  status: "active",
  priceCents: 4900n,
  currency: "USD",
  sortOrder: 1,
  generationConfigJson: {
    generation_candidate_count: 3,
    transparent_png: false,
    required_pdf_count: 3,
    zip_required: true,
    text_strategy: {
      include_text_in_image: false,
      render_text_server_side: true,
      text_fields: ["house_name", "motto"],
      text_render_targets: ["certificate_pdf", "poster_pdf", "social_kit", "wallpaper"]
    }
  },
  metadataJson: {
    mvp: true,
    digital_delivery: true,
    physical_shipping: false,
    refund_policy_note: "digital_product"
  }
} as const;

export const deliverableTypeSeeds = [
  {
    code: "crest_variant_png",
    category: "image",
    defaultFileExt: "png",
    defaultMimeType: "image/png",
    isDigital: true
  },
  {
    code: "transparent_crest_png",
    category: "image",
    defaultFileExt: "png",
    defaultMimeType: "image/png",
    isDigital: true
  },
  {
    code: "heritage_certificate_pdf",
    category: "pdf",
    defaultFileExt: "pdf",
    defaultMimeType: "application/pdf",
    isDigital: true
  },
  {
    code: "family_story_pdf",
    category: "pdf",
    defaultFileExt: "pdf",
    defaultMimeType: "application/pdf",
    isDigital: true
  },
  {
    code: "symbol_explanation_pdf",
    category: "pdf",
    defaultFileExt: "pdf",
    defaultMimeType: "application/pdf",
    isDigital: true
  },
  {
    code: "download_package_zip",
    category: "archive",
    defaultFileExt: "zip",
    defaultMimeType: "application/zip",
    isDigital: true
  }
] as const;

const crestVariantConfig = {
  aspect_ratio: "1:1",
  min_width: 2048,
  min_height: 2048,
  text_in_image_allowed: false
} as const;

export const packageDeliverableSeeds = [
  {
    deliverableCode: "crest_variant_1_png",
    deliverableTypeCode: "crest_variant_png",
    quantity: 1,
    required: true,
    sortOrder: 10,
    configJson: crestVariantConfig
  },
  {
    deliverableCode: "crest_variant_2_png",
    deliverableTypeCode: "crest_variant_png",
    quantity: 1,
    required: true,
    sortOrder: 20,
    configJson: crestVariantConfig
  },
  {
    deliverableCode: "crest_variant_3_png",
    deliverableTypeCode: "crest_variant_png",
    quantity: 1,
    required: true,
    sortOrder: 30,
    configJson: crestVariantConfig
  },
  {
    deliverableCode: "heritage_certificate_pdf",
    deliverableTypeCode: "heritage_certificate_pdf",
    quantity: 1,
    required: true,
    sortOrder: 40,
    configJson: {
      server_side_text_rendering: true,
      positioning: "clean_private_archive_keepsake_document",
      heritage_disclaimer_required: true
    }
  },
  {
    deliverableCode: "family_story_pdf",
    deliverableTypeCode: "family_story_pdf",
    quantity: 1,
    required: true,
    sortOrder: 50,
    configJson: {
      server_side_text_rendering: true,
      heritage_disclaimer_required: true
    }
  },
  {
    deliverableCode: "symbol_explanation_pdf",
    deliverableTypeCode: "symbol_explanation_pdf",
    quantity: 1,
    required: true,
    sortOrder: 60,
    configJson: {
      server_side_text_rendering: true,
      approved_symbol_knowledge_only: true,
      heritage_disclaimer_required: true
    }
  },
  {
    deliverableCode: "download_package_zip",
    deliverableTypeCode: "download_package_zip",
    quantity: 1,
    required: true,
    sortOrder: 70,
    configJson: {
      include_all_required_assets: true,
      zip_structure: ["crest-artwork", "pdfs", "read-me"]
    }
  }
] as const;

const globalDisclaimer =
  "This output is a personalized, heritage-inspired symbolic design and is not an official, legally granted, or historically certified coat of arms.";

const forbiddenTerms =
  "Forbidden terms and claims: official coat of arms, legally granted arms, historically certified crest, verified noble lineage, guaranteed ancestry, royal entitlement, trademarked logo, copyrighted emblem.";

export const promptTemplateSeeds = [
  {
    code: "image_crest_variant_prompt",
    promptType: "image",
    status: "active",
    description: "Initial image prompt placeholder for crest variants.",
    version: {
      version: 1,
      status: "active",
      templateBody: [
        "Create a heritage-inspired symbolic family crest image for {{house_name}}.",
        "Use surname: {{surname}}, heritage country: {{heritage_country}}, family values: {{family_values}}, animal symbols: {{animal_symbols}}, colors: {{colors}}, style: {{style}}.",
        "No-text image rule: do not render names, motto text, initials, readable letters, words, signatures, watermarks, seals with text, or typography in the image.",
        "Server-side compositor will render house name and motto after image generation.",
        globalDisclaimer,
        forbiddenTerms
      ].join("\n"),
      variablesSchemaJson: {
        required: [
          "house_name",
          "surname",
          "heritage_country",
          "family_values",
          "animal_symbols",
          "colors",
          "style"
        ],
        optional: ["motto", "locale", "output_language"]
      },
      negativePrompt:
        "text, letters, words, typography, watermark, signature, official legal seal, copyrighted logo, trademark",
      paramsJson: {
        placeholder: true,
        text_in_image_allowed: false
      }
    }
  },
  {
    code: "story_prompt",
    promptType: "story",
    status: "active",
    description: "Initial story prompt placeholder.",
    version: {
      version: 1,
      status: "active",
      templateBody: [
        "Write a warm symbolic family story for {{house_name}} using the provided surname, heritage country, values, symbols, colors, motto, and style.",
        "Keep the tone meaningful, respectful, and clearly heritage-inspired rather than historically certified.",
        globalDisclaimer,
        forbiddenTerms
      ].join("\n"),
      variablesSchemaJson: {
        required: ["house_name", "surname", "heritage_country", "family_values"],
        optional: ["animal_symbols", "colors", "motto", "style", "locale", "output_language"]
      },
      paramsJson: {
        placeholder: true
      }
    }
  },
  {
    code: "certificate_text_prompt",
    promptType: "certificate",
    status: "active",
    description: "Initial certificate text prompt placeholder.",
    version: {
      version: 1,
      status: "active",
      templateBody: [
        "Draft certificate copy for {{house_name}} using server-side rendered fields for house name and motto.",
        "Do not claim official heraldic authority, legal grant, verified nobility, or certified ancestry.",
        globalDisclaimer,
        forbiddenTerms
      ].join("\n"),
      variablesSchemaJson: {
        required: ["house_name", "surname"],
        optional: ["heritage_country", "motto", "locale", "output_language"]
      },
      paramsJson: {
        placeholder: true
      }
    }
  },
  {
    code: "symbol_explanation_prompt",
    promptType: "explanation",
    status: "active",
    description: "Initial symbol explanation prompt placeholder.",
    version: {
      version: 1,
      status: "active",
      templateBody: [
        "Explain the symbolic meaning of approved animals, colors, shapes, and motifs selected for {{house_name}}.",
        "Use approved internal symbol knowledge only. Label interpretations as symbolic and heritage-inspired.",
        globalDisclaimer,
        forbiddenTerms
      ].join("\n"),
      variablesSchemaJson: {
        required: ["house_name", "animal_symbols", "colors"],
        optional: ["heritage_country", "family_values", "style", "locale", "output_language"]
      },
      paramsJson: {
        placeholder: true,
        approved_symbol_knowledge_only: true
      }
    }
  }
] as const;

export const emailTemplateSeed = {
  code: "delivery_ready",
  locale: "en-US",
  version: 1,
  status: "active",
  subjectTemplate: "Your Family Legacy Collection is ready",
  bodyTemplate: [
    "Hello,",
    "",
    "Your Family Legacy Collection for order {{order_number}} is ready.",
    "",
    "Download your private vault here: {{download_vault_link}}",
    "",
    "This download link will expire according to the expiration notice shown in your download vault.",
    "",
    "If you need help, contact support and include your order number.",
    "",
    "Your collection is a personalized, heritage-inspired symbolic design and is not an official, legally granted, or historically certified coat of arms."
  ].join("\n")
} as const;

export const adminRoleSeeds = [
  { code: "super_admin", name: "Super Admin" },
  { code: "admin", name: "Admin" },
  { code: "support", name: "Support" },
  { code: "finance", name: "Finance" },
  { code: "viewer", name: "Viewer" }
] as const;

export const adminPermissionSeeds = [
  "view_orders",
  "view_private_family_data",
  "view_payment_status",
  "create_refund_request",
  "retry_generation",
  "retry_failed_assets",
  "resend_email",
  "create_download_token",
  "revoke_download_token",
  "revoke_asset",
  "view_assets",
  "view_prompt_templates",
  "create_prompt_version",
  "activate_prompt_version",
  "retire_prompt_version",
  "view_audit_logs",
  "manage_admin_users",
  "view_system_health",
  "manage_knowledge_library",
  "view_ai_costs"
] as const;

export const rolePermissionMatrix = {
  super_admin: adminPermissionSeeds,
  admin: [
    "view_orders",
    "view_private_family_data",
    "view_payment_status",
    "create_refund_request",
    "retry_generation",
    "retry_failed_assets",
    "resend_email",
    "create_download_token",
    "revoke_download_token",
    "revoke_asset",
    "view_assets",
    "view_prompt_templates",
    "create_prompt_version",
    "activate_prompt_version",
    "retire_prompt_version",
    "view_audit_logs",
    "view_system_health",
    "manage_knowledge_library",
    "view_ai_costs"
  ],
  support: [
    "view_orders",
    "view_private_family_data",
    "retry_generation",
    "retry_failed_assets",
    "resend_email",
    "create_download_token",
    "revoke_download_token",
    "view_assets",
    "view_system_health"
  ],
  finance: ["view_orders", "view_payment_status", "create_refund_request", "view_ai_costs"],
  viewer: ["view_orders", "view_assets", "view_prompt_templates", "view_system_health"]
} as const;

export const aiProviderSeed = {
  code: "openai",
  status: "disabled",
  configJson: {
    placeholder: true,
    requires_api_key: true
  }
} as const;

export const aiModelSeeds = [
  {
    code: "openai_image_model_placeholder",
    modelCode: "image-model-placeholder",
    capability: "image",
    status: "disabled"
  },
  {
    code: "openai_text_model_placeholder",
    modelCode: "text-model-placeholder",
    capability: "text",
    status: "disabled"
  }
] as const;

export const productPromptBindingSeeds = [
  {
    deliverableTypeCode: "crest_variant_png",
    promptTemplateCode: "image_crest_variant_prompt",
    aiModelCode: "image-model-placeholder",
    status: "active",
    priority: 1
  },
  {
    deliverableTypeCode: "family_story_pdf",
    promptTemplateCode: "story_prompt",
    aiModelCode: "text-model-placeholder",
    status: "active",
    priority: 1
  },
  {
    deliverableTypeCode: "heritage_certificate_pdf",
    promptTemplateCode: "certificate_text_prompt",
    aiModelCode: "text-model-placeholder",
    status: "active",
    priority: 1
  },
  {
    deliverableTypeCode: "symbol_explanation_pdf",
    promptTemplateCode: "symbol_explanation_prompt",
    aiModelCode: "text-model-placeholder",
    status: "active",
    priority: 1
  }
] as const;
