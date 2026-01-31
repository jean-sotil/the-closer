// Client
export { SupabaseClient } from "./client.js";

// Errors
export {
  SupabaseError,
  mapSupabaseError,
  isSupabaseError,
  isRetriableError,
} from "./errors.js";

// Types
export {
  type SupabaseClientConfig,
  type FilterOperator,
  type FilterClause,
  type CombinedFilter,
  type OrderConfig,
  type PaginationConfig,
  type JoinConfig,
  type QueryOptions,
  type StorageUploadOptions,
  type StorageFile,
  type TransactionOperationType,
  type TransactionOperation,
  type SupabaseErrorCodeType,
  type QueryResult,
  type InsertResult,
  type UpdateResult,
  type DeleteResult,
  type ConnectionState,
  SupabaseClientConfigSchema,
  FilterOperatorSchema,
  SupabaseErrorCode,
} from "./types.js";
