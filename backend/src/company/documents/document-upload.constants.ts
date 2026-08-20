// Reasonable allowlist for a knowledge-base upload — not exhaustive by
// design; broadening this later (images, spreadsheets, ...) is a one-line
// change here, not a rethink of the upload path.
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
