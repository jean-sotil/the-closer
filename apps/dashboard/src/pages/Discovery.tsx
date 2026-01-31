import { useState } from "react";
import { Search, MapPin } from "lucide-react";

export function Discovery(): JSX.Element {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!query || !location) return;

    setIsSearching(true);
    // TODO: Implement actual search via MCP
    setTimeout(() => setIsSearching(false), 2000);
  };

  return (
    <div className="space-y-6">
      <h1>Lead Discovery</h1>

      {/* Search form */}
      <div className="card">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Searching...
                </>
              ) : (
                "Search Google Maps"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Help text */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="text-blue-800 mb-2">How it works</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>1. Enter a business type and location to search</li>
          <li>2. We scrape Google Maps using network interception</li>
          <li>3. Businesses are filtered and qualified automatically</li>
          <li>4. Qualified leads are saved for auditing and outreach</li>
        </ul>
      </div>
    </div>
  );
}
