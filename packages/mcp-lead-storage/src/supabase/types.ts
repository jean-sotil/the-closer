import { z } from "zod";

/**
 * Supabase client configuration
 */
export const SupabaseClientConfigSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseAnonKey: z.string().min(1),
  supabaseServiceKey: z.string().optional(),
  defaultTimeout: z.number().int().positive().default(30000),
  maxRetries: z.number().int().nonnegative().default(3),
  retryDelay: z.number().int().positive().default(1000),
});

export type SupabaseClientConfig = z.output<typeof SupabaseClientConfigSchema>;

/**
 * Filter operators for queries
 */
export const FilterOperatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "in",
  "is",
  "contains",
  "containedBy",
  "overlaps",
]);

export type FilterOperator = z.output<typeof FilterOperatorSchema>;

/**
 * Single filter clause
 */
export interface FilterClause {
  column: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Combined filter with AND/OR logic
 */
export interface CombinedFilter {
  type: "and" | "or";
  filters: Array<FilterClause | CombinedFilter>;
}

/**
 * Ordering configuration
 */
export interface OrderConfig {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  limit: number;
  offset?: number;
  cursor?: string;
}

/**
 * Join configuration for foreign keys
 */
export interface JoinConfig {
  table: string;
  foreignKey: string;
  columns: string[];
  alias?: string;
}

/**
 * Query options for select operations
 */
export interface QueryOptions {
  columns?: string[];
  filters?: Array<FilterClause | CombinedFilter>;
  ordering?: OrderConfig[];
  pagination?: PaginationConfig;
  joins?: JoinConfig[];
  count?: "exact" | "planned" | "estimated";
}

/**
 * Storage upload options
 */
export interface StorageUploadOptions {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

/**
 * Storage file metadata
 */
export interface StorageFile {
  name: string;
  id: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | undefined;
}

/**
 * Transaction operation types
 */
export type TransactionOperationType = "insert" | "update" | "delete" | "upsert";

/**
 * Transaction operation
 */
export interface TransactionOperation<T = unknown> {
  type: TransactionOperationType;
  table: string;
  data?: Partial<T>;
  id?: string;
  filters?: FilterClause[];
  conflictColumns?: string[];
}

/**
 * Supabase error codes
 */
export const SupabaseErrorCode = {
  CONNECTION_FAILED: "CONNECTION_FAILED",
  QUERY_FAILED: "QUERY_FAILED",
  INSERT_FAILED: "INSERT_FAILED",
  UPDATE_FAILED: "UPDATE_FAILED",
  DELETE_FAILED: "DELETE_FAILED",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
  STORAGE_ERROR: "STORAGE_ERROR",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  BUCKET_NOT_FOUND: "BUCKET_NOT_FOUND",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  UNIQUE_VIOLATION: "UNIQUE_VIOLATION",
  FOREIGN_KEY_VIOLATION: "FOREIGN_KEY_VIOLATION",
  NOT_NULL_VIOLATION: "NOT_NULL_VIOLATION",
  CHECK_VIOLATION: "CHECK_VIOLATION",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type SupabaseErrorCodeType =
  (typeof SupabaseErrorCode)[keyof typeof SupabaseErrorCode];

/**
 * Query result with count
 */
export interface QueryResult<T> {
  data: T[];
  count: number | null;
  error: string | null;
}

/**
 * Insert result
 */
export interface InsertResult<T> {
  data: T;
  error: string | null;
}

/**
 * Update result
 */
export interface UpdateResult<T> {
  data: T;
  error: string | null;
}

/**
 * Delete result
 */
export interface DeleteResult {
  success: boolean;
  error: string | null;
}

/**
 * Connection state
 */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";
