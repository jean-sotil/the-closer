#!/usr/bin/env node

/**
 * MCP Lead Storage Server
 *
 * Handles all Supabase database operations for
 * lead profiles and campaign data.
 */

export { LeadStorageServer } from "./server.js";
export { LeadRepository } from "./lead-repository.js";
export {
  StatusTracker,
  isValidTransition,
  getAllowedTransitions,
  isTerminalStatus,
} from "./status-tracker.js";
export type { LeadQuery, LeadUpdateInput } from "./types.js";

// Evidence storage
export {
  EvidenceStore,
  EvidenceError,
  EvidenceErrorCode,
  EvidenceTypeSchema,
  EVIDENCE_BUCKET,
  MAX_FILE_SIZE,
  SIGNED_URL_EXPIRY,
  SUPPORTED_FORMATS,
} from "./evidence-store.js";
export type {
  EvidenceType,
  EvidenceUrl,
  EvidenceFile,
  EvidenceErrorCodeType,
} from "./evidence-store.js";

// Analytics
export {
  AnalyticsService,
  DateRangeSchema,
} from "./analytics.js";
export type {
  DateRange,
  TimeInterval,
  FunnelCounts,
  ConversionRates,
  FunnelMetrics,
  CampaignMetrics,
  OverallMetrics,
  TimeSeriesData,
  CategoryMetrics,
  ScoreBucket,
  ScoreDistribution,
} from "./analytics.js";

// Lead repository types
export type {
  LeadFilters,
  PaginationOptions,
  SortOptions,
  PaginatedResult,
  BatchUpdateItem,
  LeadInput,
} from "./lead-repository.js";

// Status tracker types
export type {
  StatusHistoryEntry,
  StatusWebhookCallback,
  StatusUpdateOptions,
  BulkStatusUpdateResult,
} from "./status-tracker.js";

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
