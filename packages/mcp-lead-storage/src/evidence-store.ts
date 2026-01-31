import { z } from "zod";

import { ValidationError, AppError, ErrorCode } from "@the-closer/shared";

import { SupabaseClient } from "./supabase/client.js";
import { SupabaseError } from "./supabase/errors.js";
import type { LeadRepository } from "./lead-repository.js";

// ============================================
// Constants
// ============================================

/**
 * Storage bucket name for evidence files
 */
export const EVIDENCE_BUCKET = "evidence";

/**
 * Maximum file size in bytes (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Signed URL expiration time in seconds (7 days)
 */
export const SIGNED_URL_EXPIRY = 7 * 24 * 60 * 60;

/**
 * Supported file formats by evidence type
 */
export const SUPPORTED_FORMATS: Record<EvidenceType, string[]> = {
  screenshot: [".png", ".jpeg", ".jpg", ".webp"],
  video: [".webm", ".mp4"],
  report: [".pdf"],
};

/**
 * Content type mapping for common extensions
 */
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
};

// ============================================
// Types and Schemas
// ============================================

/**
 * Evidence type enum
 */
export const EvidenceTypeSchema = z.enum(["screenshot", "video", "report"]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

/**
 * Evidence URL with metadata
 */
export const EvidenceUrlSchema = z.object({
  path: z.string(),
  url: z.string().url(),
  type: EvidenceTypeSchema,
  expiresAt: z.date(),
  filename: z.string(),
  size: z.number().optional(),
});

export type EvidenceUrl = z.infer<typeof EvidenceUrlSchema>;

/**
 * File input for batch uploads
 */
export interface EvidenceFile {
  buffer: Buffer;
  type: EvidenceType;
  filename: string;
}

/**
 * Evidence store error codes
 */
export const EvidenceErrorCode = {
  FILE_TOO_LARGE: "EVIDENCE_FILE_TOO_LARGE",
  INVALID_FORMAT: "EVIDENCE_INVALID_FORMAT",
  UPLOAD_FAILED: "EVIDENCE_UPLOAD_FAILED",
  NOT_FOUND: "EVIDENCE_NOT_FOUND",
  CLEANUP_FAILED: "EVIDENCE_CLEANUP_FAILED",
} as const;

export type EvidenceErrorCodeType = (typeof EvidenceErrorCode)[keyof typeof EvidenceErrorCode];

/**
 * Evidence-specific error class
 */
export class EvidenceError extends AppError {
  public readonly evidenceCode: EvidenceErrorCodeType;

  constructor(
    message: string,
    evidenceCode: EvidenceErrorCodeType,
    options?: {
      statusCode?: number;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, {
      code: mapEvidenceCodeToAppCode(evidenceCode),
      statusCode: options?.statusCode ?? 400,
      isOperational: true,
      context: options?.context,
      cause: options?.cause,
    });

    this.evidenceCode = evidenceCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      evidenceCode: this.evidenceCode,
    };
  }
}

/**
 * Map evidence error codes to application error codes
 */
function mapEvidenceCodeToAppCode(evidenceCode: EvidenceErrorCodeType): (typeof ErrorCode)[keyof typeof ErrorCode] {
  switch (evidenceCode) {
    case EvidenceErrorCode.FILE_TOO_LARGE:
    case EvidenceErrorCode.INVALID_FORMAT:
      return ErrorCode.VALIDATION_ERROR;
    case EvidenceErrorCode.NOT_FOUND:
      return ErrorCode.NOT_FOUND;
    case EvidenceErrorCode.UPLOAD_FAILED:
    case EvidenceErrorCode.CLEANUP_FAILED:
      return ErrorCode.EXTERNAL_SERVICE_ERROR;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

// ============================================
// Evidence Store Class
// ============================================

/**
 * Evidence Store - Manages evidence file storage for leads
 *
 * Provides upload, retrieval, and cleanup operations for visual evidence
 * assets (screenshots, videos, reports) associated with lead audits.
 */
export class EvidenceStore {
  private readonly client: SupabaseClient;
  private readonly leadRepository: LeadRepository | undefined;

  /**
   * Create an EvidenceStore instance
   *
   * @param client - Supabase client for storage operations
   * @param leadRepository - Optional lead repository for orphan cleanup
   */
  constructor(client: SupabaseClient, leadRepository?: LeadRepository) {
    this.client = client;
    this.leadRepository = leadRepository;
  }

  // ============================================
  // Upload Operations
  // ============================================

  /**
   * Store evidence file for a lead
   *
   * @param leadId - Lead UUID
   * @param file - File buffer
   * @param type - Evidence type (screenshot, video, report)
   * @param filename - Original filename
   * @returns Evidence URL with metadata
   * @throws EvidenceError if validation fails or upload fails
   */
  async storeEvidence(
    leadId: string,
    file: Buffer,
    type: EvidenceType,
    filename: string
  ): Promise<EvidenceUrl> {
    // Validate file
    this.validateFileSize(file);
    this.validateFileFormat(filename, type);

    // Generate unique storage path
    const storagePath = this.generateUniquePath(leadId, type, filename);
    const extension = this.getFileExtension(filename);
    const contentType = CONTENT_TYPES[extension];

    try {
      // Upload to Supabase Storage
      const uploadOptions: { upsert: boolean; contentType?: string } = {
        upsert: false,
      };
      if (contentType) {
        uploadOptions.contentType = contentType;
      }
      await this.client.uploadFile(EVIDENCE_BUCKET, storagePath, file, uploadOptions);

      // Generate signed URL
      const signedUrl = await this.client.getSignedUrl(
        EVIDENCE_BUCKET,
        storagePath,
        SIGNED_URL_EXPIRY
      );

      const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY * 1000);

      return {
        path: storagePath,
        url: signedUrl,
        type,
        expiresAt,
        filename,
        size: file.length,
      };
    } catch (error) {
      if (error instanceof SupabaseError) {
        throw new EvidenceError(
          `Failed to upload evidence: ${error.message}`,
          EvidenceErrorCode.UPLOAD_FAILED,
          {
            context: { leadId, type, filename },
            cause: error,
          }
        );
      }
      throw error;
    }
  }

  /**
   * Store multiple evidence files for a lead
   *
   * @param leadId - Lead UUID
   * @param files - Array of evidence files
   * @returns Array of evidence URLs
   * @throws EvidenceError if any upload fails
   */
  async storeMultipleEvidence(
    leadId: string,
    files: EvidenceFile[]
  ): Promise<EvidenceUrl[]> {
    // Validate all files first
    for (const file of files) {
      this.validateFileSize(file.buffer);
      this.validateFileFormat(file.filename, file.type);
    }

    // Upload in parallel
    const results = await Promise.all(
      files.map((file) =>
        this.storeEvidence(leadId, file.buffer, file.type, file.filename)
      )
    );

    return results;
  }

  // ============================================
  // Retrieval Operations
  // ============================================

  /**
   * Get all evidence for a lead
   *
   * @param leadId - Lead UUID
   * @returns Array of evidence URLs with fresh signed URLs
   */
  async getEvidenceForLead(leadId: string): Promise<EvidenceUrl[]> {
    const results: EvidenceUrl[] = [];

    // List all subdirectories (evidence types)
    for (const type of ["screenshot", "video", "report"] as EvidenceType[]) {
      const prefix = `${leadId}/${type}`;

      try {
        const files = await this.client.listFiles(EVIDENCE_BUCKET, prefix);

        for (const file of files) {
          // Skip directories
          if (!file.name || file.name.endsWith("/")) {
            continue;
          }

          const fullPath = `${prefix}/${file.name}`;

          try {
            const signedUrl = await this.client.getSignedUrl(
              EVIDENCE_BUCKET,
              fullPath,
              SIGNED_URL_EXPIRY
            );

            const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY * 1000);

            results.push({
              path: fullPath,
              url: signedUrl,
              type,
              expiresAt,
              filename: file.name,
              size: file.size,
            });
          } catch {
            // Skip files we can't get URLs for
            continue;
          }
        }
      } catch {
        // Directory doesn't exist, skip
        continue;
      }
    }

    return results;
  }

  /**
   * Refresh a signed URL for an existing file
   *
   * @param path - Storage path of the file
   * @returns Fresh signed URL
   * @throws EvidenceError if file doesn't exist
   */
  async refreshSignedUrl(path: string): Promise<string> {
    try {
      const signedUrl = await this.client.getSignedUrl(
        EVIDENCE_BUCKET,
        path,
        SIGNED_URL_EXPIRY
      );

      return signedUrl;
    } catch (error) {
      const errorOptions: { context: Record<string, unknown>; cause?: Error } = {
        context: { path },
      };
      if (error instanceof Error) {
        errorOptions.cause = error;
      }
      throw new EvidenceError(
        `Failed to refresh signed URL for path: ${path}`,
        EvidenceErrorCode.NOT_FOUND,
        errorOptions
      );
    }
  }

  /**
   * Get evidence URL with refreshed signed URL
   *
   * @param path - Storage path of the file
   * @returns Evidence URL with fresh signed URL
   */
  async getEvidence(path: string): Promise<EvidenceUrl> {
    // Parse path to extract leadId, type, and filename
    const parts = path.split("/");
    if (parts.length < 3) {
      throw new EvidenceError(
        `Invalid evidence path format: ${path}`,
        EvidenceErrorCode.NOT_FOUND,
        { context: { path } }
      );
    }

    const type = parts[1] as EvidenceType;
    const filename = parts.slice(2).join("/");

    if (!EvidenceTypeSchema.safeParse(type).success) {
      throw new EvidenceError(
        `Invalid evidence type in path: ${type}`,
        EvidenceErrorCode.NOT_FOUND,
        { context: { path, type } }
      );
    }

    const signedUrl = await this.refreshSignedUrl(path);
    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY * 1000);

    return {
      path,
      url: signedUrl,
      type,
      expiresAt,
      filename,
    };
  }

  // ============================================
  // Cleanup Operations
  // ============================================

  /**
   * Delete all evidence for a lead
   *
   * @param leadId - Lead UUID
   * @throws EvidenceError if deletion fails
   */
  async deleteEvidenceForLead(leadId: string): Promise<void> {
    const filePaths: string[] = [];

    // Collect all file paths
    for (const type of ["screenshot", "video", "report"] as EvidenceType[]) {
      const prefix = `${leadId}/${type}`;

      try {
        const files = await this.client.listFiles(EVIDENCE_BUCKET, prefix);

        for (const file of files) {
          if (file.name && !file.name.endsWith("/")) {
            filePaths.push(`${prefix}/${file.name}`);
          }
        }
      } catch {
        // Directory doesn't exist, skip
        continue;
      }
    }

    // Delete all files
    for (const path of filePaths) {
      try {
        await this.client.deleteFile(EVIDENCE_BUCKET, path);
      } catch (error) {
        const errorOptions: { context: Record<string, unknown>; cause?: Error } = {
          context: { leadId, path },
        };
        if (error instanceof Error) {
          errorOptions.cause = error;
        }
        throw new EvidenceError(
          `Failed to delete evidence file: ${path}`,
          EvidenceErrorCode.CLEANUP_FAILED,
          errorOptions
        );
      }
    }
  }

  /**
   * Clean up orphaned evidence files
   *
   * Finds and removes evidence for leads that no longer exist in the database.
   * This is intended to be called by a cron job.
   *
   * @returns Number of files deleted
   * @throws EvidenceError if cleanup fails or lead repository not available
   */
  async cleanupOrphanedFiles(): Promise<number> {
    if (!this.leadRepository) {
      throw new EvidenceError(
        "Lead repository required for orphan cleanup",
        EvidenceErrorCode.CLEANUP_FAILED,
        { context: { reason: "missing_dependency" } }
      );
    }

    let deletedCount = 0;

    try {
      // List top-level directories (lead IDs)
      const topLevelItems = await this.client.listFiles(EVIDENCE_BUCKET);

      for (const item of topLevelItems) {
        // Each top-level folder should be a lead ID (UUID format)
        const leadId = item.name;

        if (!leadId || !this.isValidUUID(leadId)) {
          continue;
        }

        // Check if lead exists in database
        const lead = await this.leadRepository.getLeadById(leadId);

        if (!lead) {
          // Lead doesn't exist, delete all evidence
          const evidence = await this.getEvidenceForLead(leadId);

          for (const ev of evidence) {
            try {
              await this.client.deleteFile(EVIDENCE_BUCKET, ev.path);
              deletedCount++;
            } catch {
              // Log but continue
              continue;
            }
          }
        }
      }

      return deletedCount;
    } catch (error) {
      if (error instanceof EvidenceError) {
        throw error;
      }

      const errorOptions: { cause?: Error } = {};
      if (error instanceof Error) {
        errorOptions.cause = error;
      }
      throw new EvidenceError(
        "Failed to clean up orphaned files",
        EvidenceErrorCode.CLEANUP_FAILED,
        errorOptions
      );
    }
  }

  // ============================================
  // Private Validation Helpers
  // ============================================

  /**
   * Validate file size against maximum limit
   *
   * @param buffer - File buffer
   * @throws ValidationError if file exceeds size limit
   */
  private validateFileSize(buffer: Buffer): void {
    if (buffer.length > MAX_FILE_SIZE) {
      const actualMB = (buffer.length / (1024 * 1024)).toFixed(2);
      const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);

      throw new ValidationError(
        `File size ${actualMB}MB exceeds maximum allowed size of ${maxMB}MB`,
        {
          context: {
            actualSize: buffer.length,
            maxSize: MAX_FILE_SIZE,
          },
        }
      );
    }
  }

  /**
   * Validate file format matches evidence type
   *
   * @param filename - Original filename
   * @param type - Evidence type
   * @throws ValidationError if format is not supported
   */
  private validateFileFormat(filename: string, type: EvidenceType): void {
    const extension = this.getFileExtension(filename);
    const supportedFormats = SUPPORTED_FORMATS[type];

    if (!supportedFormats.includes(extension)) {
      throw new ValidationError(
        `Invalid file format "${extension}" for evidence type "${type}". Supported formats: ${supportedFormats.join(", ")}`,
        {
          context: {
            filename,
            type,
            extension,
            supportedFormats,
          },
        }
      );
    }
  }

  /**
   * Extract file extension from filename
   *
   * @param filename - Original filename
   * @returns Lowercase extension including dot (e.g., ".png")
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) {
      return "";
    }
    return filename.slice(lastDot).toLowerCase();
  }

  /**
   * Generate unique storage path for evidence file
   *
   * @param leadId - Lead UUID
   * @param type - Evidence type
   * @param filename - Original filename
   * @returns Storage path in format: {leadId}/{type}/{timestamp}_{filename}
   */
  private generateUniquePath(
    leadId: string,
    type: EvidenceType,
    filename: string
  ): string {
    const timestamp = Date.now();
    // Sanitize filename to prevent path traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${leadId}/${type}/${timestamp}_${sanitizedFilename}`;
  }

  /**
   * Check if string is a valid UUID
   */
  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }
}
