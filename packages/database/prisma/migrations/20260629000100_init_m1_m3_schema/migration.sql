-- CreateTable
CREATE TABLE `products` (
    `id` CHAR(26) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `product_type` ENUM('digital', 'physical', 'hybrid') NOT NULL,
    `status` ENUM('draft', 'active', 'archived') NOT NULL,
    `default_locale` VARCHAR(16) NOT NULL,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_code_key`(`code`),
    INDEX `products_status_idx`(`status`),
    INDEX `products_product_type_idx`(`product_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_translations` (
    `id` CHAR(26) NOT NULL,
    `product_id` CHAR(26) NOT NULL,
    `locale` VARCHAR(16) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `short_description` TEXT NULL,
    `description_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_translations_product_id_locale_key`(`product_id`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_packages` (
    `id` CHAR(26) NOT NULL,
    `product_id` CHAR(26) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `status` ENUM('draft', 'active', 'archived') NOT NULL,
    `price_cents` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `generation_config_json` JSON NULL,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_packages_status_idx`(`status`),
    INDEX `product_packages_price_cents_idx`(`price_cents`),
    UNIQUE INDEX `product_packages_product_id_code_key`(`product_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deliverable_types` (
    `id` CHAR(26) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `category` ENUM('image', 'pdf', 'archive', 'preview', 'physical') NOT NULL,
    `default_file_ext` VARCHAR(16) NOT NULL,
    `default_mime_type` VARCHAR(128) NOT NULL,
    `is_digital` BOOLEAN NOT NULL,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `deliverable_types_code_key`(`code`),
    INDEX `deliverable_types_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `package_deliverables` (
    `id` CHAR(26) NOT NULL,
    `package_id` CHAR(26) NOT NULL,
    `deliverable_type_id` CHAR(26) NOT NULL,
    `deliverable_code` VARCHAR(64) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `required` BOOLEAN NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `config_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `package_deliverables_package_id_idx`(`package_id`),
    INDEX `package_deliverables_deliverable_type_id_idx`(`deliverable_type_id`),
    UNIQUE INDEX `package_deliverables_package_id_deliverable_code_key`(`package_id`, `deliverable_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(26) NOT NULL,
    `status` ENUM('active', 'disabled', 'deleted') NOT NULL,
    `primary_email_hash` CHAR(64) NULL,
    `email_verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_primary_email_hash_key`(`primary_email_hash`),
    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_profiles` (
    `id` CHAR(26) NOT NULL,
    `user_id` CHAR(26) NULL,
    `preferred_locale` VARCHAR(16) NULL,
    `preferred_currency` CHAR(3) NULL,
    `marketing_opt_in` BOOLEAN NOT NULL,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customer_profiles_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_pii` (
    `id` CHAR(26) NOT NULL,
    `user_id` CHAR(26) NULL,
    `email_encrypted` VARBINARY(1024) NULL,
    `name_encrypted` VARBINARY(1024) NULL,
    `phone_encrypted` VARBINARY(1024) NULL,
    `country_code` CHAR(2) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customer_pii_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `houses` (
    `id` CHAR(26) NOT NULL,
    `status` ENUM('active', 'archived', 'deleted') NOT NULL,
    `owner_user_id` CHAR(26) NULL,
    `primary_customer_profile_id` CHAR(26) NULL,
    `display_name` VARCHAR(255) NOT NULL,
    `default_locale` VARCHAR(16) NOT NULL,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `houses_status_idx`(`status`),
    INDEX `houses_owner_user_id_idx`(`owner_user_id`),
    INDEX `houses_primary_customer_profile_id_idx`(`primary_customer_profile_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `house_identities` (
    `id` CHAR(26) NOT NULL,
    `house_id` CHAR(26) NOT NULL,
    `active_version_id` CHAR(26) NULL,
    `status` ENUM('draft', 'confirmed', 'archived') NOT NULL,
    `current_house_dna_json` JSON NULL,
    `privacy_preferences_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `house_identities_active_version_id_key`(`active_version_id`),
    INDEX `house_identities_house_id_idx`(`house_id`),
    INDEX `house_identities_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `house_identity_versions` (
    `id` CHAR(26) NOT NULL,
    `house_id` CHAR(26) NOT NULL,
    `identity_id` CHAR(26) NOT NULL,
    `identity_version` INTEGER NOT NULL,
    `version_reason` ENUM('initial_create', 'user_edit', 'regeneration', 'product_upgrade', 'admin_edit') NOT NULL,
    `previous_version_id` CHAR(26) NULL,
    `active_version` BOOLEAN NOT NULL,
    `generated_from_order_id` CHAR(26) NULL,
    `generated_from_interview_id` CHAR(26) NULL,
    `generated_from_admin_edit` BOOLEAN NOT NULL,
    `house_dna_snapshot_json` JSON NOT NULL,
    `changed_fields_json` JSON NULL,
    `contract_version` VARCHAR(16) NOT NULL,
    `schema_version` VARCHAR(16) NOT NULL,
    `source` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `house_identity_versions_house_id_idx`(`house_id`),
    INDEX `house_identity_versions_identity_id_idx`(`identity_id`),
    INDEX `house_identity_versions_previous_version_id_idx`(`previous_version_id`),
    INDEX `house_identity_versions_generated_from_order_id_idx`(`generated_from_order_id`),
    INDEX `house_identity_versions_generated_from_interview_id_idx`(`generated_from_interview_id`),
    INDEX `house_identity_versions_active_version_idx`(`active_version`),
    UNIQUE INDEX `house_identity_versions_identity_id_identity_version_key`(`identity_id`, `identity_version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `house_identity_memory` (
    `id` CHAR(26) NOT NULL,
    `house_id` CHAR(26) NOT NULL,
    `identity_version_id` CHAR(26) NULL,
    `memory_json` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `house_identity_memory_house_id_idx`(`house_id`),
    INDEX `house_identity_memory_identity_version_id_idx`(`identity_version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `house_interviews` (
    `id` CHAR(26) NOT NULL,
    `house_id` CHAR(26) NULL,
    `status` ENUM('in_progress', 'needs_confirmation', 'confirmed', 'expired', 'cancelled') NOT NULL,
    `current_step` VARCHAR(128) NOT NULL,
    `locale` VARCHAR(16) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `answers_json` JSON NOT NULL,
    `house_dna_draft_json` JSON NULL,
    `normalized_input_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `house_interviews_house_id_idx`(`house_id`),
    INDEX `house_interviews_status_idx`(`status`),
    INDEX `house_interviews_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consent_records` (
    `id` CHAR(26) NOT NULL,
    `house_id` CHAR(26) NULL,
    `order_id` CHAR(26) NULL,
    `terms_accepted` BOOLEAN NOT NULL,
    `terms_accepted_at` DATETIME(3) NULL,
    `privacy_policy_accepted` BOOLEAN NOT NULL,
    `privacy_policy_accepted_at` DATETIME(3) NULL,
    `heritage_disclaimer_accepted` BOOLEAN NOT NULL,
    `heritage_disclaimer_accepted_at` DATETIME(3) NULL,
    `ai_generation_consent` BOOLEAN NOT NULL,
    `email_delivery_consent` BOOLEAN NOT NULL,
    `marketing_opt_in` BOOLEAN NOT NULL,
    `gallery_opt_in` BOOLEAN NOT NULL,
    `ip_hash` CHAR(64) NULL,
    `user_agent_hash` CHAR(64) NULL,
    `consent_version` VARCHAR(32) NOT NULL,
    `contract_version` VARCHAR(16) NOT NULL,
    `schema_version` VARCHAR(16) NOT NULL,
    `source` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `consent_records_house_id_idx`(`house_id`),
    INDEX `consent_records_order_id_idx`(`order_id`),
    INDEX `consent_records_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` CHAR(26) NOT NULL,
    `order_number` VARCHAR(32) NOT NULL,
    `user_id` CHAR(26) NULL,
    `customer_profile_id` CHAR(26) NULL,
    `order_status` ENUM('draft', 'pending_payment', 'paid', 'processing', 'completed', 'failed', 'cancelled') NOT NULL,
    `payment_status` ENUM('unpaid', 'authorized', 'paid', 'failed', 'refunded', 'disputed') NOT NULL,
    `fulfillment_status` ENUM('not_started', 'queued', 'generating', 'completed', 'partially_completed', 'failed') NOT NULL,
    `subtotal_cents` BIGINT NOT NULL,
    `discount_cents` BIGINT NOT NULL,
    `tax_cents` BIGINT NOT NULL,
    `total_cents` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `locale` VARCHAR(16) NOT NULL,
    `source` VARCHAR(64) NOT NULL,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `orders_order_number_key`(`order_number`),
    INDEX `orders_user_id_idx`(`user_id`),
    INDEX `orders_customer_profile_id_idx`(`customer_profile_id`),
    INDEX `orders_order_status_idx`(`order_status`),
    INDEX `orders_payment_status_idx`(`payment_status`),
    INDEX `orders_fulfillment_status_idx`(`fulfillment_status`),
    INDEX `orders_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `product_id` CHAR(26) NOT NULL,
    `package_id` CHAR(26) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price_cents` BIGINT NOT NULL,
    `total_price_cents` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `product_snapshot_json` JSON NULL,
    `status` ENUM('pending', 'active', 'fulfilled', 'failed', 'refunded') NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_product_id_idx`(`product_id`),
    INDEX `order_items_package_id_idx`(`package_id`),
    INDEX `order_items_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_customer_pii` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `email_encrypted` VARBINARY(1024) NOT NULL,
    `email_hash` CHAR(64) NOT NULL,
    `name_encrypted` VARBINARY(1024) NULL,
    `billing_country` CHAR(2) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `order_customer_pii_order_id_key`(`order_id`),
    INDEX `order_customer_pii_email_hash_idx`(`email_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_inputs` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `order_item_id` CHAR(26) NOT NULL,
    `product_id` CHAR(26) NOT NULL,
    `input_schema_version` VARCHAR(32) NOT NULL,
    `input_json` JSON NOT NULL,
    `normalized_input_json` JSON NULL,
    `locale` VARCHAR(16) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `order_inputs_order_id_idx`(`order_id`),
    INDEX `order_inputs_order_item_id_idx`(`order_item_id`),
    INDEX `order_inputs_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_history` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `status_type` ENUM('order', 'payment', 'fulfillment') NOT NULL,
    `from_status` VARCHAR(32) NULL,
    `to_status` VARCHAR(32) NOT NULL,
    `reason_code` VARCHAR(64) NULL,
    `message` TEXT NULL,
    `actor_type` ENUM('system', 'admin', 'customer', 'webhook') NOT NULL,
    `actor_id` CHAR(26) NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `order_status_history_order_id_created_at_idx`(`order_id`, `created_at`),
    INDEX `order_status_history_status_type_to_status_idx`(`status_type`, `to_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_notes` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `admin_user_id` CHAR(26) NULL,
    `note_type` ENUM('internal', 'customer_visible', 'system') NOT NULL,
    `body` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `order_notes_order_id_idx`(`order_id`),
    INDEX `order_notes_admin_user_id_idx`(`admin_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_intents` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `provider` ENUM('stripe', 'paypal') NOT NULL,
    `provider_intent_id` VARCHAR(255) NOT NULL,
    `status` ENUM('created', 'pending', 'succeeded', 'failed', 'cancelled') NOT NULL,
    `amount_cents` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `checkout_url` TEXT NULL,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NULL,

    INDEX `payment_intents_order_id_idx`(`order_id`),
    INDEX `payment_intents_status_idx`(`status`),
    UNIQUE INDEX `payment_intents_provider_provider_intent_id_key`(`provider`, `provider_intent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_transactions` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `payment_intent_id` CHAR(26) NOT NULL,
    `provider` ENUM('stripe', 'paypal') NOT NULL,
    `provider_transaction_id` VARCHAR(255) NOT NULL,
    `transaction_type` ENUM('authorization', 'capture', 'sale', 'refund') NOT NULL,
    `status` ENUM('pending', 'succeeded', 'failed') NOT NULL,
    `amount_cents` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `raw_event_id` CHAR(26) NULL,
    `processed_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `payment_transactions_order_id_idx`(`order_id`),
    INDEX `payment_transactions_payment_intent_id_idx`(`payment_intent_id`),
    INDEX `payment_transactions_status_idx`(`status`),
    INDEX `payment_transactions_raw_event_id_idx`(`raw_event_id`),
    UNIQUE INDEX `payment_transactions_provider_provider_transaction_id_key`(`provider`, `provider_transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_webhook_events` (
    `id` CHAR(26) NOT NULL,
    `provider` ENUM('stripe', 'paypal') NOT NULL,
    `provider_event_id` VARCHAR(255) NOT NULL,
    `event_type` VARCHAR(128) NOT NULL,
    `signature_verified` BOOLEAN NOT NULL,
    `processing_status` ENUM('received', 'processed', 'ignored', 'failed') NOT NULL,
    `payload_json` JSON NOT NULL,
    `error_message` TEXT NULL,
    `received_at` DATETIME(3) NOT NULL,
    `processed_at` DATETIME(3) NULL,

    INDEX `payment_webhook_events_event_type_idx`(`event_type`),
    INDEX `payment_webhook_events_processing_status_idx`(`processing_status`),
    INDEX `payment_webhook_events_received_at_idx`(`received_at`),
    UNIQUE INDEX `payment_webhook_events_provider_provider_event_id_key`(`provider`, `provider_event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refunds` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `payment_transaction_id` CHAR(26) NULL,
    `provider` ENUM('stripe', 'paypal') NOT NULL,
    `provider_refund_id` VARCHAR(255) NULL,
    `status` ENUM('requested', 'succeeded', 'failed') NOT NULL,
    `amount_cents` BIGINT NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `created_by_admin_id` CHAR(26) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `processed_at` DATETIME(3) NULL,

    INDEX `refunds_order_id_idx`(`order_id`),
    INDEX `refunds_status_idx`(`status`),
    INDEX `refunds_payment_transaction_id_idx`(`payment_transaction_id`),
    INDEX `refunds_created_by_admin_id_idx`(`created_by_admin_id`),
    UNIQUE INDEX `refunds_provider_provider_refund_id_key`(`provider`, `provider_refund_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_providers` (
    `id` CHAR(26) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `status` ENUM('active', 'disabled') NOT NULL,
    `config_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_providers_code_key`(`code`),
    INDEX `ai_providers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_models` (
    `id` CHAR(26) NOT NULL,
    `provider_id` CHAR(26) NOT NULL,
    `model_code` VARCHAR(128) NOT NULL,
    `capability` ENUM('image', 'text', 'vision', 'embedding') NOT NULL,
    `status` ENUM('active', 'disabled', 'deprecated') NOT NULL,
    `cost_config_json` JSON NULL,
    `default_params_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ai_models_capability_idx`(`capability`),
    INDEX `ai_models_status_idx`(`status`),
    UNIQUE INDEX `ai_models_provider_id_model_code_key`(`provider_id`, `model_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompt_templates` (
    `id` CHAR(26) NOT NULL,
    `code` VARCHAR(128) NOT NULL,
    `prompt_type` ENUM('image', 'story', 'certificate', 'explanation') NOT NULL,
    `status` ENUM('active', 'archived') NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prompt_templates_code_key`(`code`),
    INDEX `prompt_templates_prompt_type_idx`(`prompt_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prompt_template_versions` (
    `id` CHAR(26) NOT NULL,
    `prompt_template_id` CHAR(26) NOT NULL,
    `version` INTEGER NOT NULL,
    `status` ENUM('draft', 'active', 'retired') NOT NULL,
    `template_body` MEDIUMTEXT NOT NULL,
    `variables_schema_json` JSON NULL,
    `negative_prompt` TEXT NULL,
    `params_json` JSON NULL,
    `created_by_admin_id` CHAR(26) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `activated_at` DATETIME(3) NULL,

    INDEX `prompt_template_versions_status_idx`(`status`),
    INDEX `prompt_template_versions_created_by_admin_id_idx`(`created_by_admin_id`),
    UNIQUE INDEX `prompt_template_versions_prompt_template_id_version_key`(`prompt_template_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_prompt_bindings` (
    `id` CHAR(26) NOT NULL,
    `product_id` CHAR(26) NOT NULL,
    `package_id` CHAR(26) NULL,
    `deliverable_type_id` CHAR(26) NULL,
    `prompt_template_version_id` CHAR(26) NOT NULL,
    `ai_model_id` CHAR(26) NULL,
    `status` ENUM('active', 'disabled') NOT NULL,
    `priority` INTEGER NOT NULL,
    `config_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `product_prompt_bindings_product_id_idx`(`product_id`),
    INDEX `product_prompt_bindings_package_id_idx`(`package_id`),
    INDEX `product_prompt_bindings_deliverable_type_id_idx`(`deliverable_type_id`),
    INDEX `product_prompt_bindings_status_idx`(`status`),
    INDEX `product_prompt_bindings_prompt_template_version_id_idx`(`prompt_template_version_id`),
    INDEX `product_prompt_bindings_ai_model_id_idx`(`ai_model_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generation_jobs` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `order_item_id` CHAR(26) NOT NULL,
    `product_id` CHAR(26) NOT NULL,
    `status` ENUM('queued', 'processing', 'completed', 'failed', 'cancelled') NOT NULL,
    `priority` INTEGER NOT NULL,
    `attempts` INTEGER NOT NULL,
    `max_attempts` INTEGER NOT NULL,
    `error_code` VARCHAR(64) NULL,
    `error_message` TEXT NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `generation_jobs_order_id_idx`(`order_id`),
    INDEX `generation_jobs_order_item_id_idx`(`order_item_id`),
    INDEX `generation_jobs_status_created_at_idx`(`status`, `created_at`),
    INDEX `generation_jobs_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generation_steps` (
    `id` CHAR(26) NOT NULL,
    `generation_job_id` CHAR(26) NOT NULL,
    `step_type` ENUM('prompt', 'image', 'pdf', 'postprocess', 'package') NOT NULL,
    `status` ENUM('pending', 'processing', 'completed', 'failed', 'skipped') NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `attempts` INTEGER NOT NULL,
    `error_message` TEXT NULL,
    `input_json` JSON NULL,
    `output_json` JSON NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `generation_steps_generation_job_id_idx`(`generation_job_id`),
    INDEX `generation_steps_step_type_idx`(`step_type`),
    INDEX `generation_steps_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_generation_runs` (
    `id` CHAR(26) NOT NULL,
    `generation_job_id` CHAR(26) NOT NULL,
    `generation_step_id` CHAR(26) NULL,
    `ai_provider_id` CHAR(26) NOT NULL,
    `ai_model_id` CHAR(26) NOT NULL,
    `prompt_template_version_id` CHAR(26) NULL,
    `rendered_prompt` MEDIUMTEXT NOT NULL,
    `negative_prompt` TEXT NULL,
    `input_payload_json` JSON NULL,
    `output_payload_json` JSON NULL,
    `status` ENUM('pending', 'succeeded', 'failed') NOT NULL,
    `provider_request_id` VARCHAR(255) NULL,
    `cost_cents_estimated` BIGINT NULL,
    `latency_ms` INTEGER NULL,
    `error_code` VARCHAR(64) NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,

    INDEX `ai_generation_runs_generation_job_id_idx`(`generation_job_id`),
    INDEX `ai_generation_runs_ai_provider_id_idx`(`ai_provider_id`),
    INDEX `ai_generation_runs_ai_model_id_idx`(`ai_model_id`),
    INDEX `ai_generation_runs_prompt_template_version_id_idx`(`prompt_template_version_id`),
    INDEX `ai_generation_runs_status_idx`(`status`),
    INDEX `ai_generation_runs_provider_request_id_idx`(`provider_request_id`),
    INDEX `ai_generation_runs_generation_step_id_idx`(`generation_step_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `order_item_id` CHAR(26) NULL,
    `generation_job_id` CHAR(26) NULL,
    `deliverable_type_id` CHAR(26) NOT NULL,
    `asset_type` ENUM('image', 'pdf', 'archive', 'preview') NOT NULL,
    `asset_kind` ENUM('generated', 'uploaded', 'packaged', 'preview', 'physical_mockup') NOT NULL,
    `status` ENUM('pending', 'available', 'failed', 'deleted') NOT NULL,
    `storage_provider` ENUM('s3', 'r2') NOT NULL,
    `storage_bucket` VARCHAR(255) NOT NULL,
    `storage_key` VARCHAR(1024) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(128) NOT NULL,
    `file_ext` VARCHAR(16) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `checksum_sha256` CHAR(64) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `locale` VARCHAR(16) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `assets_order_id_idx`(`order_id`),
    INDEX `assets_order_item_id_idx`(`order_item_id`),
    INDEX `assets_generation_job_id_idx`(`generation_job_id`),
    INDEX `assets_deliverable_type_id_idx`(`deliverable_type_id`),
    INDEX `assets_status_idx`(`status`),
    INDEX `assets_asset_kind_idx`(`asset_kind`),
    UNIQUE INDEX `assets_storage_provider_storage_bucket_storage_key_key`(`storage_provider`, `storage_bucket`, `storage_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_metadata` (
    `id` CHAR(26) NOT NULL,
    `asset_id` CHAR(26) NOT NULL,
    `metadata_json` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `asset_metadata_asset_id_key`(`asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_deliverable_links` (
    `id` CHAR(26) NOT NULL,
    `asset_id` CHAR(26) NOT NULL,
    `package_deliverable_id` CHAR(26) NULL,
    `deliverable_type_id` CHAR(26) NOT NULL,
    `variant_number` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `asset_deliverable_links_asset_id_idx`(`asset_id`),
    INDEX `asset_deliverable_links_deliverable_type_id_idx`(`deliverable_type_id`),
    INDEX `asset_deliverable_links_package_deliverable_id_idx`(`package_deliverable_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `download_tokens` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `status` ENUM('active', 'expired', 'revoked') NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `max_downloads` INTEGER NULL,
    `download_count` INTEGER NOT NULL,
    `created_by` ENUM('system', 'admin') NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,

    UNIQUE INDEX `download_tokens_token_hash_key`(`token_hash`),
    INDEX `download_tokens_order_id_idx`(`order_id`),
    INDEX `download_tokens_status_idx`(`status`),
    INDEX `download_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `download_token_assets` (
    `id` CHAR(26) NOT NULL,
    `download_token_id` CHAR(26) NOT NULL,
    `asset_id` CHAR(26) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `download_token_assets_asset_id_idx`(`asset_id`),
    UNIQUE INDEX `download_token_assets_download_token_id_asset_id_key`(`download_token_id`, `asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `download_events` (
    `id` CHAR(26) NOT NULL,
    `download_token_id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NOT NULL,
    `asset_id` CHAR(26) NULL,
    `event_type` ENUM('page_view', 'file_download', 'signed_url_created', 'denied') NOT NULL,
    `ip_hash` CHAR(64) NULL,
    `user_agent_hash` CHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `download_events_download_token_id_idx`(`download_token_id`),
    INDEX `download_events_order_id_idx`(`order_id`),
    INDEX `download_events_asset_id_idx`(`asset_id`),
    INDEX `download_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_templates` (
    `id` CHAR(26) NOT NULL,
    `code` VARCHAR(128) NOT NULL,
    `locale` VARCHAR(16) NOT NULL,
    `version` INTEGER NOT NULL,
    `status` ENUM('draft', 'active', 'retired') NOT NULL,
    `subject_template` TEXT NOT NULL,
    `body_template` MEDIUMTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_templates_status_idx`(`status`),
    UNIQUE INDEX `email_templates_code_locale_version_key`(`code`, `locale`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_logs` (
    `id` CHAR(26) NOT NULL,
    `order_id` CHAR(26) NULL,
    `email_template_id` CHAR(26) NULL,
    `provider` ENUM('resend', 'sendgrid', 'ses') NOT NULL,
    `provider_message_id` VARCHAR(255) NULL,
    `recipient_email_hash` CHAR(64) NOT NULL,
    `status` ENUM('queued', 'sent', 'delivered', 'bounced', 'failed') NOT NULL,
    `error_message` TEXT NULL,
    `payload_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,
    `sent_at` DATETIME(3) NULL,

    INDEX `email_logs_order_id_idx`(`order_id`),
    INDEX `email_logs_recipient_email_hash_idx`(`recipient_email_hash`),
    INDEX `email_logs_status_idx`(`status`),
    INDEX `email_logs_provider_message_id_idx`(`provider_message_id`),
    INDEX `email_logs_email_template_id_idx`(`email_template_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_users` (
    `id` CHAR(26) NOT NULL,
    `email_hash` CHAR(64) NOT NULL,
    `email_encrypted` VARBINARY(1024) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `status` ENUM('active', 'disabled') NOT NULL,
    `mfa_enabled` BOOLEAN NOT NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_users_email_hash_key`(`email_hash`),
    INDEX `admin_users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_roles` (
    `id` CHAR(26) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_permissions` (
    `id` CHAR(26) NOT NULL,
    `code` VARCHAR(128) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_user_roles` (
    `id` CHAR(26) NOT NULL,
    `admin_user_id` CHAR(26) NOT NULL,
    `admin_role_id` CHAR(26) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `admin_user_roles_admin_role_id_idx`(`admin_role_id`),
    UNIQUE INDEX `admin_user_roles_admin_user_id_admin_role_id_key`(`admin_user_id`, `admin_role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_role_permissions` (
    `id` CHAR(26) NOT NULL,
    `admin_role_id` CHAR(26) NOT NULL,
    `admin_permission_id` CHAR(26) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `admin_role_permissions_admin_permission_id_idx`(`admin_permission_id`),
    UNIQUE INDEX `admin_role_permissions_admin_role_id_admin_permission_id_key`(`admin_role_id`, `admin_permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(26) NOT NULL,
    `actor_type` ENUM('system', 'admin', 'customer', 'webhook') NOT NULL,
    `actor_id` CHAR(26) NULL,
    `action` VARCHAR(128) NOT NULL,
    `entity_type` VARCHAR(64) NOT NULL,
    `entity_id` CHAR(26) NULL,
    `ip_hash` CHAR(64) NULL,
    `before_json` JSON NULL,
    `after_json` JSON NULL,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL,

    INDEX `audit_logs_actor_type_actor_id_idx`(`actor_type`, `actor_id`),
    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbox_events` (
    `id` CHAR(26) NOT NULL,
    `event_type` VARCHAR(128) NOT NULL,
    `aggregate_type` VARCHAR(64) NOT NULL,
    `aggregate_id` CHAR(26) NOT NULL,
    `payload_json` JSON NOT NULL,
    `status` ENUM('pending', 'processing', 'published', 'failed') NOT NULL,
    `attempts` INTEGER NOT NULL,
    `next_attempt_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL,
    `published_at` DATETIME(3) NULL,

    INDEX `outbox_events_status_next_attempt_at_idx`(`status`, `next_attempt_at`),
    INDEX `outbox_events_aggregate_type_aggregate_id_idx`(`aggregate_type`, `aggregate_id`),
    INDEX `outbox_events_event_type_idx`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_keys` (
    `id` CHAR(26) NOT NULL,
    `scope` ENUM('api', 'webhook', 'job') NOT NULL,
    `idempotency_key` VARCHAR(255) NOT NULL,
    `request_hash` CHAR(64) NOT NULL,
    `response_json` JSON NULL,
    `status` ENUM('processing', 'completed', 'failed') NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idempotency_keys_expires_at_idx`(`expires_at`),
    INDEX `idempotency_keys_status_idx`(`status`),
    UNIQUE INDEX `idempotency_keys_scope_idempotency_key_key`(`scope`, `idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_translations` ADD CONSTRAINT `product_translations_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_packages` ADD CONSTRAINT `product_packages_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `package_deliverables` ADD CONSTRAINT `package_deliverables_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `product_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `package_deliverables` ADD CONSTRAINT `package_deliverables_deliverable_type_id_fkey` FOREIGN KEY (`deliverable_type_id`) REFERENCES `deliverable_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_profiles` ADD CONSTRAINT `customer_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_pii` ADD CONSTRAINT `customer_pii_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `houses` ADD CONSTRAINT `houses_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `houses` ADD CONSTRAINT `houses_primary_customer_profile_id_fkey` FOREIGN KEY (`primary_customer_profile_id`) REFERENCES `customer_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `house_identities` ADD CONSTRAINT `house_identities_house_id_fkey` FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `house_identities` ADD CONSTRAINT `house_identities_active_version_id_fkey` FOREIGN KEY (`active_version_id`) REFERENCES `house_identity_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `house_identity_versions` ADD CONSTRAINT `house_identity_versions_house_id_fkey` FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `house_identity_versions` ADD CONSTRAINT `house_identity_versions_identity_id_fkey` FOREIGN KEY (`identity_id`) REFERENCES `house_identities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `house_identity_versions` ADD CONSTRAINT `house_identity_versions_previous_version_id_fkey` FOREIGN KEY (`previous_version_id`) REFERENCES `house_identity_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `house_identity_versions` ADD CONSTRAINT `house_identity_versions_generated_from_order_id_fkey` FOREIGN KEY (`generated_from_order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `house_identity_versions` ADD CONSTRAINT `house_identity_versions_generated_from_interview_id_fkey` FOREIGN KEY (`generated_from_interview_id`) REFERENCES `house_interviews`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `house_identity_memory` ADD CONSTRAINT `house_identity_memory_house_id_fkey` FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `house_identity_memory` ADD CONSTRAINT `house_identity_memory_identity_version_id_fkey` FOREIGN KEY (`identity_version_id`) REFERENCES `house_identity_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `house_interviews` ADD CONSTRAINT `house_interviews_house_id_fkey` FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consent_records` ADD CONSTRAINT `consent_records_house_id_fkey` FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consent_records` ADD CONSTRAINT `consent_records_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_profile_id_fkey` FOREIGN KEY (`customer_profile_id`) REFERENCES `customer_profiles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `product_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_customer_pii` ADD CONSTRAINT `order_customer_pii_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_inputs` ADD CONSTRAINT `order_inputs_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_inputs` ADD CONSTRAINT `order_inputs_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_inputs` ADD CONSTRAINT `order_inputs_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_notes` ADD CONSTRAINT `order_notes_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_notes` ADD CONSTRAINT `order_notes_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_intents` ADD CONSTRAINT `payment_intents_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_payment_intent_id_fkey` FOREIGN KEY (`payment_intent_id`) REFERENCES `payment_intents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_transactions` ADD CONSTRAINT `payment_transactions_raw_event_id_fkey` FOREIGN KEY (`raw_event_id`) REFERENCES `payment_webhook_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_transaction_id_fkey` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_created_by_admin_id_fkey` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_models` ADD CONSTRAINT `ai_models_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `ai_providers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompt_template_versions` ADD CONSTRAINT `prompt_template_versions_prompt_template_id_fkey` FOREIGN KEY (`prompt_template_id`) REFERENCES `prompt_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prompt_template_versions` ADD CONSTRAINT `prompt_template_versions_created_by_admin_id_fkey` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_prompt_bindings` ADD CONSTRAINT `product_prompt_bindings_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_prompt_bindings` ADD CONSTRAINT `product_prompt_bindings_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `product_packages`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_prompt_bindings` ADD CONSTRAINT `product_prompt_bindings_deliverable_type_id_fkey` FOREIGN KEY (`deliverable_type_id`) REFERENCES `deliverable_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_prompt_bindings` ADD CONSTRAINT `product_prompt_bindings_prompt_template_version_id_fkey` FOREIGN KEY (`prompt_template_version_id`) REFERENCES `prompt_template_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_prompt_bindings` ADD CONSTRAINT `product_prompt_bindings_ai_model_id_fkey` FOREIGN KEY (`ai_model_id`) REFERENCES `ai_models`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_jobs` ADD CONSTRAINT `generation_jobs_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_jobs` ADD CONSTRAINT `generation_jobs_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_jobs` ADD CONSTRAINT `generation_jobs_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_steps` ADD CONSTRAINT `generation_steps_generation_job_id_fkey` FOREIGN KEY (`generation_job_id`) REFERENCES `generation_jobs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_generation_runs` ADD CONSTRAINT `ai_generation_runs_generation_job_id_fkey` FOREIGN KEY (`generation_job_id`) REFERENCES `generation_jobs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_generation_runs` ADD CONSTRAINT `ai_generation_runs_generation_step_id_fkey` FOREIGN KEY (`generation_step_id`) REFERENCES `generation_steps`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_generation_runs` ADD CONSTRAINT `ai_generation_runs_ai_provider_id_fkey` FOREIGN KEY (`ai_provider_id`) REFERENCES `ai_providers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_generation_runs` ADD CONSTRAINT `ai_generation_runs_ai_model_id_fkey` FOREIGN KEY (`ai_model_id`) REFERENCES `ai_models`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_generation_runs` ADD CONSTRAINT `ai_generation_runs_prompt_template_version_id_fkey` FOREIGN KEY (`prompt_template_version_id`) REFERENCES `prompt_template_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_generation_job_id_fkey` FOREIGN KEY (`generation_job_id`) REFERENCES `generation_jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_deliverable_type_id_fkey` FOREIGN KEY (`deliverable_type_id`) REFERENCES `deliverable_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_metadata` ADD CONSTRAINT `asset_metadata_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_deliverable_links` ADD CONSTRAINT `asset_deliverable_links_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_deliverable_links` ADD CONSTRAINT `asset_deliverable_links_package_deliverable_id_fkey` FOREIGN KEY (`package_deliverable_id`) REFERENCES `package_deliverables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asset_deliverable_links` ADD CONSTRAINT `asset_deliverable_links_deliverable_type_id_fkey` FOREIGN KEY (`deliverable_type_id`) REFERENCES `deliverable_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `download_tokens` ADD CONSTRAINT `download_tokens_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `download_token_assets` ADD CONSTRAINT `download_token_assets_download_token_id_fkey` FOREIGN KEY (`download_token_id`) REFERENCES `download_tokens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `download_token_assets` ADD CONSTRAINT `download_token_assets_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `download_events` ADD CONSTRAINT `download_events_download_token_id_fkey` FOREIGN KEY (`download_token_id`) REFERENCES `download_tokens`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `download_events` ADD CONSTRAINT `download_events_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `download_events` ADD CONSTRAINT `download_events_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_logs` ADD CONSTRAINT `email_logs_email_template_id_fkey` FOREIGN KEY (`email_template_id`) REFERENCES `email_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_user_roles` ADD CONSTRAINT `admin_user_roles_admin_role_id_fkey` FOREIGN KEY (`admin_role_id`) REFERENCES `admin_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_admin_role_id_fkey` FOREIGN KEY (`admin_role_id`) REFERENCES `admin_roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_role_permissions` ADD CONSTRAINT `admin_role_permissions_admin_permission_id_fkey` FOREIGN KEY (`admin_permission_id`) REFERENCES `admin_permissions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

