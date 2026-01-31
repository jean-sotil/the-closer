import { useLeads, useLeadStats } from "../hooks";

export function Leads(): JSX.Element {
  const { data: leads, isLoading, error } = useLeads({ limit: 50 });
  const { data: stats } = useLeadStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card bg-red-50 border-red-200">
        <p className="text-red-700">Failed to load leads: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1>Leads</h1>
        <button className="btn-primary">
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

      {/* Leads table */}
      <div className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Business
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rating
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Website
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads?.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{lead.businessName}</div>
                  <div className="text-sm text-gray-500">{lead.businessCategory}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {lead.rating ? (
                    <span className={lead.rating < 4 ? "text-yellow-600" : "text-gray-600"}>
                      ⭐ {lead.rating.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      lead.contactStatus === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : lead.contactStatus === "converted"
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {lead.contactStatus}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.websiteUrl ? (
                    <a
                      href={lead.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline"
                    >
                      Visit
                    </a>
                  ) : (
                    <span className="text-gray-400">No website</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!leads || leads.length === 0) && (
          <div className="p-8 text-center text-gray-500">
            No leads found. Start a discovery to find prospects.
          </div>
        )}
      </div>
    </div>
  );
}
