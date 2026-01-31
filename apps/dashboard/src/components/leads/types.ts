import type { LeadProfile, ContactStatus } from "@the-closer/shared";

/**
 * Sort direction for table columns
 */
export type SortDirection = "asc" | "desc";

/**
 * Sort configuration for the table
 */
export interface SortConfig {
  field: keyof LeadProfile | "qualificationScore";
  direction: SortDirection;
}

/**
 * Filter state for lead filtering
 */
export interface LeadFilterState {
  search: string;
  status: ContactStatus[];
  categories: string[];
  ratingRange: [number, number];
  dateRange: {
    start: string | undefined;
    end: string | undefined;
  };
}

/**
 * Pagination state
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Bulk action types
 */
export type BulkActionType =
  | "changeStatus"
  | "addToCampaign"
  | "delete"
  | "runAudit"
  | "export";

/**
 * Props for LeadTable component
 */
export interface LeadTableProps {
  leads: LeadProfile[];
  isLoading: boolean;
  selectedIds: Set<string>;
  expandedId: string | undefined;
  sortConfig: SortConfig;
  onSelectionChange: (ids: Set<string>) => void;
  onExpandToggle: (id: string | undefined) => void;
  onSortChange: (config: SortConfig) => void;
  onLeadClick: (lead: LeadProfile) => void;
}

/**
 * Props for LeadFilters component
 */
export interface LeadFiltersProps {
  filters: LeadFilterState;
  availableCategories: string[];
  onFilterChange: (filters: LeadFilterState) => void;
  onReset: () => void;
}

/**
 * Props for LeadCard component
 */
export interface LeadCardProps {
  lead: LeadProfile;
  onAudit: (lead: LeadProfile) => void;
  onEmail: (lead: LeadProfile) => void;
  onArchive: (lead: LeadProfile) => void;
}

/**
 * Props for BulkActions component
 */
export interface BulkActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkStatusChange: (status: ContactStatus) => void;
  onAddToCampaign: () => void;
  onBulkDelete: () => void;
}

/**
 * Props for EmptyState component
 */
export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel: string | undefined;
  onAction: (() => void) | undefined;
}

/**
 * Default filter state
 */
export const DEFAULT_FILTER_STATE: LeadFilterState = {
  search: "",
  status: [],
  categories: [],
  ratingRange: [0, 5],
  dateRange: {
    start: undefined,
    end: undefined,
  },
};

/**
 * Default sort configuration
 */
export const DEFAULT_SORT_CONFIG: SortConfig = {
  field: "discoveredAt",
  direction: "desc",
};

/**
 * Default pagination state
 */
export const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  pageSize: 25,
  total: 0,
};
