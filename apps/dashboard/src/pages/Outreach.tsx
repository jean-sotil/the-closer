import { useCampaigns } from "../hooks";

export function Outreach(): JSX.Element {
  const { data: campaigns, isLoading } = useCampaigns();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1>Email Outreach</h1>
        <button className="btn-primary">Create Campaign</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Emails Sent</p>
          <p className="text-2xl font-bold text-gray-900">0</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Opens</p>
          <p className="text-2xl font-bold text-blue-600">0</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Replies</p>
          <p className="text-2xl font-bold text-green-600">0</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Meetings Booked</p>
          <p className="text-2xl font-bold text-primary-600">0</p>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4">Active Campaigns</h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : campaigns && campaigns.length > 0 ? (
          <div className="space-y-4">
            {(campaigns as Array<{ id: string; name: string }>).map((campaign) => (
              <div
                key={campaign.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                {campaign.name}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No campaigns yet. Create your first email campaign to start outreach.
          </p>
        )}
      </div>

      <div className="card bg-green-50 border-green-200">
        <h3 className="text-green-800 mb-2">Outreach Tips</h3>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• Include audit evidence (screenshots, videos) in your emails</li>
          <li>• Personalize with specific pain points from the audit</li>
          <li>• Follow up 3-5 times over 2 weeks</li>
          <li>• Track opens and clicks to optimize your approach</li>
        </ul>
      </div>
    </div>
  );
}
