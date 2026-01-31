import { Fragment, useCallback } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { Search, ChevronDown, Check, X, RotateCcw } from "lucide-react";
import type { ContactStatus } from "@the-closer/shared";
import type { LeadFiltersProps } from "./types";

const STATUS_OPTIONS: { value: ContactStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "emailed", label: "Emailed", color: "bg-blue-100 text-blue-800" },
  { value: "called", label: "Called", color: "bg-purple-100 text-purple-800" },
  { value: "booked", label: "Booked", color: "bg-indigo-100 text-indigo-800" },
  { value: "converted", label: "Converted", color: "bg-green-100 text-green-800" },
  { value: "declined", label: "Declined", color: "bg-red-100 text-red-800" },
];

/**
 * Lead filters component with search, status, category, and rating filters
 */
export function LeadFilters({
  filters,
  availableCategories,
  onFilterChange,
  onReset,
}: LeadFiltersProps): React.ReactElement {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, search: e.target.value });
    },
    [filters, onFilterChange]
  );

  const handleStatusToggle = useCallback(
    (status: ContactStatus) => {
      const newStatuses = filters.status.includes(status)
        ? filters.status.filter((s) => s !== status)
        : [...filters.status, status];
      onFilterChange({ ...filters, status: newStatuses });
    },
    [filters, onFilterChange]
  );

  const handleCategoryToggle = useCallback(
    (category: string) => {
      const newCategories = filters.categories.includes(category)
        ? filters.categories.filter((c) => c !== category)
        : [...filters.categories, category];
      onFilterChange({ ...filters, categories: newCategories });
    },
    [filters, onFilterChange]
  );

  const handleRatingChange = useCallback(
    (index: 0 | 1, value: number) => {
      const newRange = [...filters.ratingRange] as [number, number];
      newRange[index] = value;
      // Ensure min <= max
      if (index === 0 && value > newRange[1]) {
        newRange[1] = value;
      } else if (index === 1 && value < newRange[0]) {
        newRange[0] = value;
      }
      onFilterChange({ ...filters, ratingRange: newRange });
    },
    [filters, onFilterChange]
  );

  const handleDateChange = useCallback(
    (field: "start" | "end", value: string) => {
      onFilterChange({
        ...filters,
        dateRange: { ...filters.dateRange, [field]: value || undefined },
      });
    },
    [filters, onFilterChange]
  );

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status.length > 0 ||
    filters.categories.length > 0 ||
    filters.ratingRange[0] !== 0 ||
    filters.ratingRange[1] !== 5 ||
    filters.dateRange.start !== undefined ||
    filters.dateRange.end !== undefined;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-4 items-end">
        {/* Search input */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Business name..."
              value={filters.search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Status multi-select */}
        <div className="min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <Listbox
            value={filters.status}
            onChange={(value) => onFilterChange({ ...filters, status: value })}
            multiple
          >
            <div className="relative">
              <Listbox.Button className="relative w-full py-2 pl-3 pr-10 text-left bg-white border border-gray-300 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm">
                <span className="block truncate">
                  {filters.status.length === 0
                    ? "All statuses"
                    : `${filters.status.length} selected`}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </span>
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 focus:outline-none text-sm">
                  {STATUS_OPTIONS.map((option) => (
                    <Listbox.Option
                      key={option.value}
                      value={option.value}
                      className={({ active }) =>
                        `cursor-pointer select-none relative py-2 pl-10 pr-4 ${
                          active ? "bg-gray-100" : ""
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs mr-2 ${option.color}`}
                            >
                              {option.label}
                            </span>
                          </span>
                          {selected && (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary-600">
                              <Check className="w-4 h-4" />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>
        </div>

        {/* Category multi-select */}
        {availableCategories.length > 0 && (
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <Listbox
              value={filters.categories}
              onChange={(value) =>
                onFilterChange({ ...filters, categories: value })
              }
              multiple
            >
              <div className="relative">
                <Listbox.Button className="relative w-full py-2 pl-3 pr-10 text-left bg-white border border-gray-300 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm">
                  <span className="block truncate">
                    {filters.categories.length === 0
                      ? "All categories"
                      : `${filters.categories.length} selected`}
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </span>
                </Listbox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 focus:outline-none text-sm">
                    {availableCategories.map((category) => (
                      <Listbox.Option
                        key={category}
                        value={category}
                        className={({ active }) =>
                          `cursor-pointer select-none relative py-2 pl-10 pr-4 ${
                            active ? "bg-gray-100" : ""
                          }`
                        }
                      >
                        {({ selected }) => (
                          <>
                            <span
                              className={`block truncate ${
                                selected ? "font-medium" : "font-normal"
                              }`}
                            >
                              {category}
                            </span>
                            {selected && (
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary-600">
                                <Check className="w-4 h-4" />
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>
        )}

        {/* Rating range */}
        <div className="min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rating Range
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={filters.ratingRange[0]}
              onChange={(e) => handleRatingChange(0, parseFloat(e.target.value))}
              className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={filters.ratingRange[1]}
              onChange={(e) => handleRatingChange(1, parseFloat(e.target.value))}
              className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Date range */}
        <div className="min-w-[280px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discovered Date
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.dateRange.start ?? ""}
              onChange={(e) => handleDateChange("start", e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={filters.dateRange.end ?? ""}
              onChange={(e) => handleDateChange("end", e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        )}
      </div>

      {/* Active filter tags */}
      {hasActiveFilters && (
        <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
          {filters.status.map((status) => {
            const option = STATUS_OPTIONS.find((o) => o.value === status);
            return (
              <span
                key={status}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs"
              >
                <span className={`px-1.5 py-0.5 rounded-full ${option?.color}`}>
                  {option?.label}
                </span>
                <button
                  onClick={() => handleStatusToggle(status)}
                  className="hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          {filters.categories.map((category) => (
            <span
              key={category}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs"
            >
              {category}
              <button
                onClick={() => handleCategoryToggle(category)}
                className="hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
