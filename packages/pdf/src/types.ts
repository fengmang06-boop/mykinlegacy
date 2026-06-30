export interface PdfGenerationInput {
  deliverable_code: "heritage_certificate_pdf" | "family_story_pdf" | "symbol_explanation_pdf";
  title: string;
  house_name: string;
  body_text: string;
  disclaimer: string;
  output_file_path: string;
}

export interface PdfGenerationOutput {
  candidate_ref: string;
  file_path: string;
  deliverable_code: string;
  mime_type: "application/pdf";
  size_bytes: number;
  checksum_sha256: string;
}
