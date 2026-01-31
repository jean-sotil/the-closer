import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeadProfile, ContactStatus } from "@the-closer/shared";
import { leadsApi, auditsApi, campaignsApi, type LeadQueryParams } from "../api";

/**
 * Hook for fetching leads with filtering, sorting, and pagination
 */
export function useLeadsQuery(params: LeadQueryParams = {}) {
  return useQuery({
    queryKey: ["leads", params],
    queryFn: () => leadsApi.getLeads(params),
  });
}

/**
 * Legacy hook for fetching leads (backward compatibility)
 */
export function useLeads(filters?: {
  status?: ContactStatus;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["leads", "legacy", filters],
    queryFn: () => leadsApi.getAllLeads(filters),
  });
}

/**
 * Hook for fetching a single lead
 */
export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ["lead", id],
    queryFn: () => (id ? leadsApi.getLeadById(id) : null),
    enabled: !!id,
  });
}

/**
 * Hook for updating a lead
 */
export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<LeadProfile> }) =>
      leadsApi.updateLead(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.setQueryData(["lead", data.id], data);
    },
  });
}

/**
 * Hook for bulk updating lead status
 */
export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: ContactStatus }) =>
      leadsApi.bulkUpdateStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadStats"] });
    },
  });
}

/**
 * Hook for bulk deleting leads
 */
export function useBulkDeleteLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => leadsApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leadStats"] });
    },
  });
}

/**
 * Hook for fetching lead categories
 */
export function useLeadCategories() {
  return useQuery({
    queryKey: ["leadCategories"],
    queryFn: () => leadsApi.getCategories(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook for lead statistics
 */
export function useLeadStats() {
  return useQuery({
    queryKey: ["leadStats"],
    queryFn: () => leadsApi.getStats(),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching audits
 */
export function useAudits(leadId: string | undefined) {
  return useQuery({
    queryKey: ["audits", leadId],
    queryFn: () => (leadId ? auditsApi.getAuditsForLead(leadId) : []),
    enabled: !!leadId,
  });
}

/**
 * Hook for fetching campaigns
 */
export function useCampaigns() {
  return useQuery({
    queryKey: ["campaigns"],
    queryFn: () => campaignsApi.getCampaigns(),
  });
}

/**
 * Combined hook for lead management state
 * Manages filters, sorting, pagination, and selection
 */
export function useLeadManagement(initialParams: LeadQueryParams = {}) {
  const queryClient = useQueryClient();

  // Fetch leads
  const leadsQuery = useLeadsQuery(initialParams);

  // Fetch categories for filters
  const categoriesQuery = useLeadCategories();

  // Fetch stats
  const statsQuery = useLeadStats();

  // Mutations
  const updateStatusMutation = useBulkUpdateStatus();
  const deleteMutation = useBulkDeleteLeads();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["leadStats"] });
  };

  return {
    // Queries
    leads: leadsQuery.data?.data ?? [],
    total: leadsQuery.data?.total ?? 0,
    isLoading: leadsQuery.isLoading,
    error: leadsQuery.error,
    categories: categoriesQuery.data ?? [],
    stats: statsQuery.data,

    // Mutations
    updateStatus: updateStatusMutation.mutateAsync,
    deleteLeads: deleteMutation.mutateAsync,
    isUpdating: updateStatusMutation.isPending,
    isDeleting: deleteMutation.isPending,

    // Utilities
    refetch: leadsQuery.refetch,
    invalidateAll,
  };
}

// Re-export auth hook
export { useAuth } from "../contexts/AuthContext";
