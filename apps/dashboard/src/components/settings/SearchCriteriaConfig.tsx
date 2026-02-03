import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Save,
  MapPin,
  Tag,
  Star,
  Gauge,
  Check,
} from "lucide-react";

// Business categories
const BUSINESS_CATEGORIES = [
  "Dentist",
  "Attorney",
  "Restaurant",
  "Plumber",
  "Electrician",
  "Auto Repair",
  "HVAC",
  "Real Estate",
  "Chiropractor",
  "Veterinarian",
  "Salon",
  "Gym",
  "Accountant",
  "Insurance",
] as const;

interface SearchPreset {
  id: string;
  name: string;
  location: string;
  radius: number; // miles
  categories: string[];
  maxRating: number;
  minReviews: number;
  maxPerformanceScore: number;
  createdAt: string;
}

interface SearchCriteriaConfigProps {
  presets?: SearchPreset[];
  onSavePreset?: (preset: Omit<SearchPreset, "id" | "createdAt">) => void;
  onDeletePreset?: (id: string) => void;
  onApplyPreset?: (preset: SearchPreset) => void;
}

const DEFAULT_PRESETS: SearchPreset[] = [
  {
    id: "1",
    name: "Low-Performing Dentists",
    location: "Austin, TX",
    radius: 25,
    categories: ["Dentist"],
    maxRating: 4.0,
    minReviews: 10,
    maxPerformanceScore: 60,
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Local Service Businesses",
    location: "Dallas, TX",
    radius: 15,
    categories: ["Plumber", "Electrician", "HVAC"],
    maxRating: 4.5,
    minReviews: 5,
    maxPerformanceScore: 70,
    createdAt: new Date().toISOString(),
  },
];

export function SearchCriteriaConfig({
  presets: propPresets,
  onSavePreset,
  onDeletePreset,
  onApplyPreset,
}: SearchCriteriaConfigProps): React.ReactElement {
  const [presets, setPresets] = useState<SearchPreset[]>(propPresets ?? DEFAULT_PRESETS);
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Current criteria form
  const [criteria, setCriteria] = useState({
    name: "",
    location: "",
    radius: 25,
    categories: [] as string[],
    maxRating: 4.0,
    minReviews: 10,
    maxPerformanceScore: 60,
  });

  const handleCategoryToggle = useCallback((category: string) => {
    setCriteria((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  }, []);

  const handleSavePreset = useCallback(() => {
    if (!criteria.name.trim() || !criteria.location.trim()) {
      return;
    }

    const newPreset: SearchPreset = {
      id: `preset-${Date.now()}`,
      ...criteria,
      createdAt: new Date().toISOString(),
    };

    setPresets((prev) => [...prev, newPreset]);
    onSavePreset?.(criteria);

    // Reset form
    setCriteria({
      name: "",
      location: "",
      radius: 25,
      categories: [],
      maxRating: 4.0,
      minReviews: 10,
      maxPerformanceScore: 60,
    });
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [criteria, onSavePreset]);

  const handleLoadPreset = useCallback((preset: SearchPreset) => {
    setCriteria({
      name: preset.name,
      location: preset.location,
      radius: preset.radius,
      categories: [...preset.categories],
      maxRating: preset.maxRating,
      minReviews: preset.minReviews,
      maxPerformanceScore: preset.maxPerformanceScore,
    });
    setIsEditing(true);
    onApplyPreset?.(preset);
  }, [onApplyPreset]);

  const handleDeletePreset = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
    onDeletePreset?.(id);
  }, [onDeletePreset]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Search Criteria</h2>
          <p className="text-sm text-gray-500">
            Configure default search parameters and save presets for quick access
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Preset
          </button>
        )}
      </div>

      {/* Saved Presets */}
      {!isEditing && presets.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Saved Presets</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="group rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{preset.name}</h4>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {preset.location} ({preset.radius}mi)
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        &lt; {preset.maxRating} stars
                      </span>
                      <span className="flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        Score &lt; {preset.maxPerformanceScore}
                      </span>
                    </div>
                    {preset.categories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {preset.categories.slice(0, 3).map((cat) => (
                          <span
                            key={cat}
                            className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {cat}
                          </span>
                        ))}
                        {preset.categories.length > 3 && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            +{preset.categories.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleLoadPreset(preset)}
                      className="rounded p-1.5 text-gray-400 hover:bg-blue-100 hover:text-blue-600"
                      title="Load preset"
                    >
                      <Tag className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePreset(preset.id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-600"
                      title="Delete preset"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor Form */}
      {isEditing && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-medium text-gray-900">
            {criteria.name ? "Edit Preset" : "New Search Preset"}
          </h3>

          <div className="space-y-6">
            {/* Preset Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Preset Name
              </label>
              <input
                type="text"
                value={criteria.name}
                onChange={(e) =>
                  setCriteria((prev) => ({ ...prev, name: e.target.value }))
                }
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., Austin Dentists"
              />
            </div>

            {/* Location */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={criteria.location}
                    onChange={(e) =>
                      setCriteria((prev) => ({ ...prev, location: e.target.value }))
                    }
                    className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="City, State"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Radius: {criteria.radius} miles
                </label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={criteria.radius}
                  onChange={(e) =>
                    setCriteria((prev) => ({ ...prev, radius: Number(e.target.value) }))
                  }
                  className="mt-2 w-full"
                />
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>5 mi</span>
                  <span>100 mi</span>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Business Categories
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {BUSINESS_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategoryToggle(category)}
                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      criteria.categories.includes(category)
                        ? "bg-blue-100 text-blue-700 ring-1 ring-blue-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {criteria.categories.includes(category) && (
                      <Check className="mr-1 h-3 w-3" />
                    )}
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Qualification Thresholds */}
            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Max Rating: {criteria.maxRating.toFixed(1)} stars
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={criteria.maxRating}
                  onChange={(e) =>
                    setCriteria((prev) => ({
                      ...prev,
                      maxRating: Number(e.target.value),
                    }))
                  }
                  className="mt-2 w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Only show businesses rated below this
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Min Reviews: {criteria.minReviews}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={criteria.minReviews}
                  onChange={(e) =>
                    setCriteria((prev) => ({
                      ...prev,
                      minReviews: Number(e.target.value),
                    }))
                  }
                  className="mt-2 w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Filter out businesses with few reviews
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Max Performance Score: {criteria.maxPerformanceScore}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={criteria.maxPerformanceScore}
                  onChange={(e) =>
                    setCriteria((prev) => ({
                      ...prev,
                      maxPerformanceScore: Number(e.target.value),
                    }))
                  }
                  className="mt-2 w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Only show sites scoring below this
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setCriteria({
                    name: "",
                    location: "",
                    radius: 25,
                    categories: [],
                    maxRating: 4.0,
                    minReviews: 10,
                    maxPerformanceScore: 60,
                  });
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={!criteria.name.trim() || !criteria.location.trim()}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                  saveSuccess
                    ? "bg-green-600"
                    : !criteria.name.trim() || !criteria.location.trim()
                    ? "cursor-not-allowed bg-gray-300"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {saveSuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Preset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isEditing && presets.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <Tag className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-sm font-medium text-gray-900">No presets saved</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create search presets to quickly run common discovery queries.
          </p>
          <button
            onClick={() => setIsEditing(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Preset
          </button>
        </div>
      )}
    </div>
  );
}
