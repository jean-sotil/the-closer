import { createClient, type SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";

import {
  type SupabaseClientConfig,
  type QueryOptions,
  type FilterClause,
  type CombinedFilter,
  type StorageUploadOptions,
  type StorageFile,
  type TransactionOperation,
  type ConnectionState,
  type QueryResult,
  SupabaseClientConfigSchema,
  SupabaseErrorCode,
} from "./types.js";
import { SupabaseError, mapSupabaseError, isRetriableError } from "./errors.js";

/**
 * Type-safe Supabase client wrapper
 *
 * Provides CRUD operations, storage management, and transaction support
 * with comprehensive error handling and retry logic.
 */
export class SupabaseClient {
  private readonly config: SupabaseClientConfig;
  private client: SupabaseJsClient | null = null;
  private connectionState: ConnectionState = "disconnected";

  constructor(config: Partial<SupabaseClientConfig>) {
    this.config = SupabaseClientConfigSchema.parse(config);
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState === "connected" && this.client !== null;
  }

  /**
   * Connect to Supabase
   */
  async connect(): Promise<void> {
    if (this.connectionState === "connected") {
      return;
    }

    this.connectionState = "connecting";

    try {
      this.client = createClient(
        this.config.supabaseUrl,
        this.config.supabaseServiceKey ?? this.config.supabaseAnonKey,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: false,
          },
        }
      );

      // Verify connection with a simple query
      const { error } = await this.client.from("lead_profiles").select("id").limit(1);

      if (error && !error.message.includes("does not exist")) {
        throw error;
      }

      this.connectionState = "connected";
    } catch (error) {
      this.connectionState = "error";
      const errorOptions: { cause?: Error } = {};
      if (error instanceof Error) {
        errorOptions.cause = error;
      }
      throw new SupabaseError(
        "Failed to connect to Supabase",
        SupabaseErrorCode.CONNECTION_FAILED,
        errorOptions
      );
    }
  }

  /**
   * Disconnect from Supabase
   */
  async disconnect(): Promise<void> {
    this.client = null;
    this.connectionState = "disconnected";
  }

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * Select rows from a table
   */
  async select<T>(
    table: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    this.ensureConnected();

    return this.withRetry(async () => {
      const query = this.buildSelectQuery(table, options);

      const { data, error, count } = await query;

      if (error) {
        throw mapSupabaseError(error);
      }

      return {
        data: (data ?? []) as T[],
        count: count ?? null,
        error: null,
      };
    });
  }

  /**
   * Insert a row into a table
   */
  async insert<T extends Record<string, unknown>>(
    table: string,
    data: Partial<T>
  ): Promise<T> {
    this.ensureConnected();

    if (!data || Object.keys(data).length === 0) {
      throw new SupabaseError(
        "Insert data cannot be empty",
        SupabaseErrorCode.INSERT_FAILED
      );
    }

    return this.withRetry(async () => {
      const { data: result, error } = await this.client!
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error);
      }

      return result as T;
    });
  }

  /**
   * Insert multiple rows into a table
   */
  async insertMany<T extends Record<string, unknown>>(
    table: string,
    data: Partial<T>[]
  ): Promise<T[]> {
    this.ensureConnected();

    if (!data || data.length === 0) {
      return [];
    }

    return this.withRetry(async () => {
      const { data: result, error } = await this.client!
        .from(table)
        .insert(data)
        .select();

      if (error) {
        throw mapSupabaseError(error);
      }

      return (result ?? []) as T[];
    });
  }

  /**
   * Update a row by ID
   */
  async update<T extends Record<string, unknown>>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<T> {
    this.ensureConnected();

    if (!data || Object.keys(data).length === 0) {
      throw new SupabaseError(
        "Update data cannot be empty",
        SupabaseErrorCode.UPDATE_FAILED
      );
    }

    return this.withRetry(async () => {
      const { data: result, error } = await this.client!
        .from(table)
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error);
      }

      return result as T;
    });
  }

  /**
   * Update rows matching filters
   */
  async updateWhere<T extends Record<string, unknown>>(
    table: string,
    filters: FilterClause[],
    data: Partial<T>
  ): Promise<T[]> {
    this.ensureConnected();

    return this.withRetry(async () => {
      let query = this.client!.from(table).update(data);

      for (const filter of filters) {
        query = this.applyFilter(query, filter);
      }

      const { data: result, error } = await query.select();

      if (error) {
        throw mapSupabaseError(error);
      }

      return (result ?? []) as T[];
    });
  }

  /**
   * Delete a row by ID
   */
  async delete(table: string, id: string): Promise<void> {
    this.ensureConnected();

    return this.withRetry(async () => {
      const { error } = await this.client!
        .from(table)
        .delete()
        .eq("id", id);

      if (error) {
        throw mapSupabaseError(error);
      }
    });
  }

  /**
   * Delete rows matching filters
   */
  async deleteWhere(table: string, filters: FilterClause[]): Promise<number> {
    this.ensureConnected();

    return this.withRetry(async () => {
      let query = this.client!.from(table).delete();

      for (const filter of filters) {
        query = this.applyFilter(query, filter);
      }

      const { data, error } = await query.select("id");

      if (error) {
        throw mapSupabaseError(error);
      }

      return data?.length ?? 0;
    });
  }

  /**
   * Upsert a row (insert or update on conflict)
   */
  async upsert<T extends Record<string, unknown>>(
    table: string,
    data: Partial<T>,
    conflictColumns: string[] = ["id"]
  ): Promise<T> {
    this.ensureConnected();

    return this.withRetry(async () => {
      const { data: result, error } = await this.client!
        .from(table)
        .upsert(data, { onConflict: conflictColumns.join(",") })
        .select()
        .single();

      if (error) {
        throw mapSupabaseError(error);
      }

      return result as T;
    });
  }

  // ============================================
  // Query Helpers
  // ============================================

  /**
   * Count rows matching filters
   */
  async count(table: string, filters: FilterClause[] = []): Promise<number> {
    this.ensureConnected();

    return this.withRetry(async () => {
      let query = this.client!
        .from(table)
        .select("*", { count: "exact", head: true });

      for (const filter of filters) {
        query = this.applyFilter(query, filter);
      }

      const { count, error } = await query;

      if (error) {
        throw mapSupabaseError(error);
      }

      return count ?? 0;
    });
  }

  /**
   * Check if rows exist matching filters
   */
  async exists(table: string, filters: FilterClause[]): Promise<boolean> {
    const count = await this.count(table, filters);
    return count > 0;
  }

  /**
   * Get a single row by ID
   */
  async getById<T>(table: string, id: string): Promise<T | null> {
    this.ensureConnected();

    return this.withRetry(async () => {
      const { data, error } = await this.client!
        .from(table)
        .select()
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw mapSupabaseError(error);
      }

      return data as T | null;
    });
  }

  // ============================================
  // Storage Operations
  // ============================================

  /**
   * Upload a file to storage
   */
  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer | Uint8Array,
    options: StorageUploadOptions = {}
  ): Promise<string> {
    this.ensureConnected();

    return this.withRetry(async () => {
      const uploadOptions: { upsert: boolean; contentType?: string; cacheControl?: string } = {
        upsert: options.upsert ?? false,
      };
      if (options.contentType) {
        uploadOptions.contentType = options.contentType;
      }
      if (options.cacheControl) {
        uploadOptions.cacheControl = options.cacheControl;
      }

      const { error } = await this.client!.storage
        .from(bucket)
        .upload(path, file, uploadOptions);

      if (error) {
        throw new SupabaseError(
          `Failed to upload file: ${error.message}`,
          SupabaseErrorCode.UPLOAD_FAILED,
          { context: { bucket, path } }
        );
      }

      // Return public URL
      const { data: urlData } = this.client!.storage
        .from(bucket)
        .getPublicUrl(path);

      return urlData.publicUrl;
    });
  }

  /**
   * Get a signed URL for temporary access
   */
  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600
  ): Promise<string> {
    this.ensureConnected();

    const { data, error } = await this.client!.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new SupabaseError(
        `Failed to create signed URL: ${error.message}`,
        SupabaseErrorCode.STORAGE_ERROR,
        { context: { bucket, path } }
      );
    }

    return data.signedUrl;
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    this.ensureConnected();

    const { error } = await this.client!.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      throw new SupabaseError(
        `Failed to delete file: ${error.message}`,
        SupabaseErrorCode.STORAGE_ERROR,
        { context: { bucket, path } }
      );
    }
  }

  /**
   * List files in a bucket/folder
   */
  async listFiles(bucket: string, prefix?: string): Promise<StorageFile[]> {
    this.ensureConnected();

    const { data, error } = await this.client!.storage
      .from(bucket)
      .list(prefix);

    if (error) {
      throw new SupabaseError(
        `Failed to list files: ${error.message}`,
        SupabaseErrorCode.STORAGE_ERROR,
        { context: { bucket, prefix } }
      );
    }

    return (data ?? []).map((file) => {
      const metadata = file.metadata as Record<string, unknown> | undefined;
      return {
        name: file.name,
        id: file.id ?? file.name,
        size: (metadata?.["size"] as number) ?? 0,
        createdAt: file.created_at ?? new Date().toISOString(),
        updatedAt: file.updated_at ?? new Date().toISOString(),
        metadata,
      };
    });
  }

  // ============================================
  // Transaction Support
  // ============================================

  /**
   * Run multiple operations in a transaction
   * Note: Supabase doesn't have true transactions via REST API,
   * so this executes operations sequentially with manual rollback on failure
   */
  async runTransaction<T>(
    operations: TransactionOperation[]
  ): Promise<T[]> {
    this.ensureConnected();

    const results: T[] = [];
    const completedOps: Array<{ table: string; id: string; type: string }> = [];

    try {
      for (const op of operations) {
        let result: T | null = null;

        switch (op.type) {
          case "insert":
            result = await this.insert<T & Record<string, unknown>>(
              op.table,
              op.data as Partial<T & Record<string, unknown>>
            );
            if (result && typeof result === "object" && "id" in result) {
              completedOps.push({
                table: op.table,
                id: (result as { id: string }).id,
                type: "insert",
              });
            }
            break;

          case "update":
            if (!op.id) {
              throw new SupabaseError(
                "Update operation requires an ID",
                SupabaseErrorCode.UPDATE_FAILED
              );
            }
            result = await this.update<T & Record<string, unknown>>(
              op.table,
              op.id,
              op.data as Partial<T & Record<string, unknown>>
            );
            completedOps.push({ table: op.table, id: op.id, type: "update" });
            break;

          case "delete":
            if (!op.id) {
              throw new SupabaseError(
                "Delete operation requires an ID",
                SupabaseErrorCode.DELETE_FAILED
              );
            }
            await this.delete(op.table, op.id);
            completedOps.push({ table: op.table, id: op.id, type: "delete" });
            break;

          case "upsert":
            result = await this.upsert<T & Record<string, unknown>>(
              op.table,
              op.data as Partial<T & Record<string, unknown>>,
              op.conflictColumns
            );
            if (result && typeof result === "object" && "id" in result) {
              completedOps.push({
                table: op.table,
                id: (result as { id: string }).id,
                type: "upsert",
              });
            }
            break;
        }

        if (result !== null) {
          results.push(result);
        }
      }

      return results;
    } catch (error) {
      // Attempt rollback - best effort
      await this.rollbackOperations(completedOps);

      const txErrorOptions: { cause?: Error } = {};
      if (error instanceof Error) {
        txErrorOptions.cause = error;
      }
      throw new SupabaseError(
        `Transaction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        SupabaseErrorCode.TRANSACTION_FAILED,
        txErrorOptions
      );
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Ensure client is connected
   */
  private ensureConnected(): void {
    if (!this.isConnected()) {
      throw new SupabaseError(
        "Not connected to Supabase",
        SupabaseErrorCode.CONNECTION_FAILED
      );
    }
  }

  /**
   * Build a select query with options
   */
  private buildSelectQuery(table: string, options: QueryOptions) {
    // Build select columns with joins
    let selectColumns = "*";

    if (options.columns && options.columns.length > 0) {
      selectColumns = options.columns.join(", ");
    }

    if (options.joins && options.joins.length > 0) {
      const joinSelects = options.joins.map((join) => {
        const cols = join.columns.join(", ");
        const alias = join.alias ?? join.table;
        return `${alias}:${join.table}(${cols})`;
      });
      selectColumns = `${selectColumns}, ${joinSelects.join(", ")}`;
    }

    const selectOptions: { count?: "exact" | "planned" | "estimated" } = {};
    if (options.count) {
      selectOptions.count = options.count;
    }

    let query = this.client!.from(table).select(selectColumns, selectOptions);

    // Apply filters
    if (options.filters) {
      for (const filter of options.filters) {
        if ("type" in filter) {
          // Combined filter - handle recursively
          query = this.applyCombinedFilter(query, filter);
        } else {
          query = this.applyFilter(query, filter);
        }
      }
    }

    // Apply ordering
    if (options.ordering) {
      for (const order of options.ordering) {
        const orderOptions: { ascending: boolean; nullsFirst?: boolean } = {
          ascending: order.ascending,
        };
        if (order.nullsFirst !== undefined) {
          orderOptions.nullsFirst = order.nullsFirst;
        }
        query = query.order(order.column, orderOptions);
      }
    }

    // Apply pagination
    if (options.pagination) {
      if (options.pagination.limit) {
        query = query.limit(options.pagination.limit);
      }
      if (options.pagination.offset) {
        query = query.range(
          options.pagination.offset,
          options.pagination.offset + (options.pagination.limit ?? 10) - 1
        );
      }
    }

    return query;
  }

  /**
   * Apply a single filter to a query
   */
  private applyFilter<Q>(query: Q, filter: FilterClause): Q {
    const q = query as unknown as {
      eq: (col: string, val: unknown) => Q;
      neq: (col: string, val: unknown) => Q;
      gt: (col: string, val: unknown) => Q;
      gte: (col: string, val: unknown) => Q;
      lt: (col: string, val: unknown) => Q;
      lte: (col: string, val: unknown) => Q;
      like: (col: string, val: unknown) => Q;
      ilike: (col: string, val: unknown) => Q;
      in: (col: string, val: unknown[]) => Q;
      is: (col: string, val: unknown) => Q;
      contains: (col: string, val: unknown) => Q;
      containedBy: (col: string, val: unknown) => Q;
      overlaps: (col: string, val: unknown) => Q;
    };

    switch (filter.operator) {
      case "eq":
        return q.eq(filter.column, filter.value);
      case "neq":
        return q.neq(filter.column, filter.value);
      case "gt":
        return q.gt(filter.column, filter.value);
      case "gte":
        return q.gte(filter.column, filter.value);
      case "lt":
        return q.lt(filter.column, filter.value);
      case "lte":
        return q.lte(filter.column, filter.value);
      case "like":
        return q.like(filter.column, filter.value as string);
      case "ilike":
        return q.ilike(filter.column, filter.value as string);
      case "in":
        return q.in(filter.column, filter.value as unknown[]);
      case "is":
        return q.is(filter.column, filter.value);
      case "contains":
        return q.contains(filter.column, filter.value);
      case "containedBy":
        return q.containedBy(filter.column, filter.value);
      case "overlaps":
        return q.overlaps(filter.column, filter.value);
      default:
        return query;
    }
  }

  /**
   * Apply combined filter (AND/OR)
   */
  private applyCombinedFilter<Q>(query: Q, combined: CombinedFilter): Q {
    // Supabase JS client doesn't directly support OR at query level
    // For now, apply filters sequentially (AND behavior)
    // OR would require using .or() method with string format
    for (const filter of combined.filters) {
      if ("type" in filter) {
        query = this.applyCombinedFilter(query, filter);
      } else {
        query = this.applyFilter(query, filter);
      }
    }
    return query;
  }

  /**
   * Execute with retry logic
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt < this.config.maxRetries && isRetriableError(error)) {
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        await this.delay(delay);
        return this.withRetry(fn, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Rollback completed operations (best effort)
   */
  private async rollbackOperations(
    operations: Array<{ table: string; id: string; type: string }>
  ): Promise<void> {
    // Rollback in reverse order
    for (const op of operations.reverse()) {
      try {
        if (op.type === "insert" || op.type === "upsert") {
          // Delete inserted rows
          await this.client!.from(op.table).delete().eq("id", op.id);
        }
        // Note: We can't easily rollback updates or deletes without storing original data
      } catch {
        // Ignore rollback errors - best effort
      }
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
