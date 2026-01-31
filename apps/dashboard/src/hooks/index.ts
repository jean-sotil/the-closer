import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LeadProfile, ContactStatus } from "@the-closer/shared";
import { leadsApi, auditsApi, campaignsApi } from "../api";

/**
 * Hook for fetching leads
 */
export function useLeads(filters?: {
  status?: ContactStatus;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["leads", filters],
    queryFn: () => leadsApi.getLeads(filters),
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

// Re-export auth hook
export { useAuth } from "../contexts/AuthContext";
