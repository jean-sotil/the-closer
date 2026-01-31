#!/usr/bin/env node

/**
 * MCP Lead Storage Server
 *
 * Handles all Supabase database operations for
 * lead profiles and campaign data.
 */

export { LeadStorageServer } from "./server.js";
export { LeadRepository } from "./lead-repository.js";
export type { LeadQuery, LeadUpdateInput } from "./types.js";

// Lead repository types
export type {
  LeadFilters,
  PaginationOptions,
  SortOptions,
  PaginatedResult,
  BatchUpdateItem,
  LeadInput,
} from "./lead-repository.js";

// Supabase client
export {
  SupabaseClient,
  SupabaseError,
  mapSupabaseError,
  isSupabaseError,
  isRetriableError,
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
} from "./supabase/index.js";
