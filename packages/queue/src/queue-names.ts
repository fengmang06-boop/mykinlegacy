export const QUEUE_NAMES = {
  paymentConfirmation: "payment-confirmation",
  generationManifest: "generation-manifest",
  generation: "generation",
  promptRendering: "prompt-rendering",
  aiImageGeneration: "ai-image-generation",
  aiTextGeneration: "ai-text-generation",
  aiOutputValidation: "ai-output-validation",
  imagePostprocess: "image-postprocess",
  pdfGeneration: "pdf-generation",
  zipPackaging: "zip-packaging",
  assetStorage: "asset-storage",
  downloadToken: "download-token",
  emailDelivery: "email-delivery",
  cleanup: "cleanup",
  deadLetter: "dead-letter"
} as const;

export const ALL_QUEUE_NAMES = Object.values(QUEUE_NAMES);

export type QueueName = (typeof ALL_QUEUE_NAMES)[number];
