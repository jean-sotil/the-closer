import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import type { LeadProfile, ContactStatus } from "@the-closer/shared";
import {
  useLeadsQuery,
  useLeadStats,
  useLeadCategories,
  useBulkUpdateStatus,
  useBulkDeleteLeads,
} from "../hooks";
import {
  LeadTable,
  LeadFilters,
  BulkActions,
  EmptyState,
  Pagination,
  DEFAULT_FILTER_STATE,
  DEFAULT_SORT_CONFIG,
  DEFAULT_PAGINATION,
  type LeadFilterState,
  type SortConfig,
  type PaginationState,
} from "../components/leads";

export function Leads(): JSX.Element {
  const navigate = useNavigate();

  // State for filters, sorting, pagination, and selection
  const [filters, setFilters] = useState<LeadFilterState>(DEFAULT_FILTER_STATE);
  const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT_CONFIG);
  const [pagination, setPagination] = useState<PaginationState>(DEFAULT_PAGINATION);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);

  // Fetch data
  const {
    data: leadsResult,
    isLoading,
    error,
  } = useLeadsQuery({
    filters,
    sort: sortConfig,
    pagination: { page: pagination.page, pageSize: pagination.pageSize },
  });

  const { data: stats } = useLeadStats();
  const { data: categories = [] } = useLeadCategories();

  // Mutations
  const bulkUpdateStatus = useBulkUpdateStatus();
  const bulkDelete = useBulkDeleteLeads();

  // Computed values
  const leads = useMemo(() => leadsResult?.data ?? [], [leadsResult?.data]);
  const total = leadsResult?.total ?? 0;

  // Update pagination total when data changes
  useMemo(() => {
    if (leadsResult?.total !== undefined && leadsResult.total !== pagination.total) {
      setPagination((prev) => ({ ...prev, total: leadsResult.total }));
    }
  }, [leadsResult?.total, pagination.total]);

  // Handlers
  const handleFilterChange = useCallback((newFilters: LeadFilterState) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handleSortChange = useCallback((newSort: SortConfig) => {
    setSortConfig(newSort);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
    setSelectedIds(new Set()); // Clear selection on page change
  }, []);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setPagination((prev) => ({ ...prev, pageSize, page: 1 }));
    setSelectedIds(new Set());
  }, []);

  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
  }, []);

  const handleExpandToggle = useCallback((id: string | undefined) => {
    setExpandedId(id);
  }, []);

  const handleLeadClick = useCallback(
    (lead: LeadProfile) => {
      // Navigate to lead detail page (future implementation)
      console.log("Navigate to lead:", lead.id);
    },
    []
  );

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(leads.map((l) => l.id)));
  }, [leads]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkStatusChange = useCallback(
    async (status: ContactStatus) => {
      if (selectedIds.size === 0) return;
      try {
        await bulkUpdateStatus.mutateAsync({
          ids: Array.from(selectedIds),
          status,
        });
        setSelectedIds(new Set());
      } catch (err) {
        console.error("Failed to update status:", err);
      }
    },
    [selectedIds, bulkUpdateStatus]
  );

  const handleAddToCampaign = useCallback(() => {
    // Navigate to campaign selection modal/page
    console.log("Add to campaign:", Array.from(selectedIds));
  }, [selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkDelete.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Failed to delete leads:", err);
    }
  }, [selectedIds, bulkDelete]);

  const handleDiscoverLeads = useCallback(() => {
    navigate("/");
  }, [navigate]);

  // Error state
  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <p className="text-red-700">Failed to load leads: {(error as Error).message}</p>
      </div>
    );
  }

  // Check if there are any leads at all (ignoring current filters)
  const hasNoLeadsAtAll = !isLoading && total === 0 &&
    filters.search === "" &&
    filters.status.length === 0 &&
    filters.categories.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1>Leads</h1>
        <button
          onClick={handleDiscoverLeads}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Discover Leads
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500">Total Leads</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Contacted</p>
            <p className="text-2xl font-bold text-blue-600">{stats.contacted}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Converted</p>
            <p className="text-2xl font-bold text-green-600">{stats.converted}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <LeadFilters
        filters={filters}
        availableCategories={categories}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Empty state or table */}
      {hasNoLeadsAtAll ? (
        <EmptyState
          title="No leads yet"
          description="Start discovering leads to build your pipeline. Run a discovery to find local businesses with website opportunities."
          actionLabel="Discover Leads"
          onAction={handleDiscoverLeads}
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          {/* Bulk actions */}
          <BulkActions
            selectedCount={selectedIds.size}
            totalCount={leads.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onBulkStatusChange={handleBulkStatusChange}
            onAddToCampaign={handleAddToCampaign}
            onBulkDelete={handleBulkDelete}
          />

          {/* Table */}
          <LeadTable
            leads={leads}
            isLoading={isLoading}
            selectedIds={selectedIds}
            expandedId={expandedId}
            sortConfig={sortConfig}
            onSelectionChange={handleSelectionChange}
            onExpandToggle={handleExpandToggle}
            onSortChange={handleSortChange}
            onLeadClick={handleLeadClick}
          />

          {/* No results with filters */}
          {!isLoading && leads.length === 0 && !hasNoLeadsAtAll && (
            <div className="p-8 text-center text-gray-500">
              No leads match your filters. Try adjusting your search criteria.
            </div>
          )}

          {/* Pagination */}
          <Pagination
            pagination={{ ...pagination, total }}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
