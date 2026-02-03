import { useState } from "react";
import { Search, MapPin, Globe, Phone, Star, AlertCircle, CheckCircle2 } from "lucide-react";

interface DiscoveredBusiness {
  businessName: string;
  address?: string;
  phoneNumber?: string;
  websiteUrl?: string;
  rating?: number;
  reviewCount?: number;
  businessCategory?: string;
}

interface DiscoveryResponse {
  success: boolean;
  leads: DiscoveredBusiness[];
  stats: {
    found: number;
    extracted: number;
    qualified: number;
    returned: number;
  };
  error?: string;
}

const API_URL = import.meta.env.VITE_DISCOVERY_API_URL || "http://localhost:3001";

export function Discovery(): JSX.Element {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DiscoveredBusiness[]>([]);
  const [stats, setStats] = useState<DiscoveryResponse["stats"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!query || !location) return;

    setIsSearching(true);
    setError(null);
    setResults([]);
    setStats(null);

    try {
      const response = await fetch(`${API_URL}/api/discover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          location,
          maxResults,
        }),
      });

      const data: DiscoveryResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Discovery failed");
      }

      setResults(data.leads);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search. Make sure the discovery server is running.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1>Lead Discovery</h1>

      {/* Search form */}
      <div className="card">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="query" className="label">
                Business Type
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="query"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., dentists, restaurants, lawyers"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="location" className="label">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Austin, TX"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="maxResults" className="label">
                Max Results
              </label>
              <input
                id="maxResults"
                type="number"
                min={1}
                max={100}
                value={maxResults}
                onChange={(e) => setMaxResults(parseInt(e.target.value) || 20)}
                className="input"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSearching || !query || !location}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Searching Google Maps...
                </>
              ) : (
                "Search Google Maps"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error message */}
      {error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <p className="text-sm text-red-600 mt-2">
            Make sure the discovery server is running: <code className="bg-red-100 px-1 rounded">pnpm --filter mcp-lead-discovery server</code>
          </p>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center gap-2 text-green-700 mb-2">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Search Complete</span>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Found:</span>{" "}
              <span className="font-medium">{stats.found}</span>
            </div>
            <div>
              <span className="text-gray-600">Extracted:</span>{" "}
              <span className="font-medium">{stats.extracted}</span>
            </div>
            <div>
              <span className="text-gray-600">Qualified:</span>{" "}
              <span className="font-medium">{stats.qualified}</span>
            </div>
            <div>
              <span className="text-gray-600">Returned:</span>{" "}
              <span className="font-medium text-green-700">{stats.returned}</span>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Discovered Leads ({results.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((business, index) => (
              <div key={index} className="card hover:shadow-md transition-shadow">
                <h3 className="font-medium text-gray-900 mb-2">{business.businessName}</h3>

                {business.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-600 mb-1">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{business.address}</span>
                  </div>
                )}

                {business.phoneNumber && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Phone className="w-4 h-4" />
                    <a href={`tel:${business.phoneNumber}`} className="hover:text-blue-600">
                      {business.phoneNumber}
                    </a>
                  </div>
                )}

                {business.websiteUrl && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                    <Globe className="w-4 h-4" />
                    <a
                      href={business.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-600 truncate"
                    >
                      {business.websiteUrl.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  {business.rating !== undefined && (
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span>{business.rating.toFixed(1)}</span>
                      {business.reviewCount !== undefined && (
                        <span className="text-gray-500">({business.reviewCount})</span>
                      )}
                    </div>
                  )}

                  {business.businessCategory && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {business.businessCategory}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help text - show when no results */}
      {results.length === 0 && !error && !isSearching && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-blue-800 mb-2">How it works</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1. Enter a business type and location to search</li>
            <li>2. We scrape Google Maps using Puppeteer with stealth mode</li>
            <li>3. Businesses are filtered and qualified automatically</li>
            <li>4. Qualified leads are displayed here for review</li>
          </ul>
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> The discovery server must be running separately:
            </p>
            <code className="block bg-blue-100 text-blue-800 px-3 py-2 rounded mt-2 text-sm">
              pnpm --filter mcp-lead-discovery server
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
