import { Fragment, useState } from "react";
import { Menu, Transition, Dialog } from "@headlessui/react";
import {
  CheckSquare,
  Square,
  ChevronDown,
  RefreshCw,
  Users,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { ContactStatus } from "@the-closer/shared";
import type { BulkActionsProps } from "./types";

const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "emailed", label: "Emailed" },
  { value: "called", label: "Called" },
  { value: "booked", label: "Booked" },
  { value: "converted", label: "Converted" },
  { value: "declined", label: "Declined" },
];

/**
 * Bulk actions toolbar for selected leads
 */
export function BulkActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkStatusChange,
  onAddToCampaign,
  onBulkDelete,
}: BulkActionsProps): React.ReactElement {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const allSelected = selectedCount === totalCount && totalCount > 0;
  const someSelected = selectedCount > 0;

  const handleDeleteConfirm = () => {
    onBulkDelete();
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-4">
          {/* Select all checkbox */}
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {allSelected ? (
              <CheckSquare className="w-5 h-5 text-primary-600" />
            ) : someSelected ? (
              <div className="relative">
                <Square className="w-5 h-5" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary-600 rounded-sm" />
                </div>
              </div>
            ) : (
              <Square className="w-5 h-5" />
            )}
            {allSelected ? "Deselect all" : "Select all"}
          </button>

          {/* Selected count */}
          <span className="text-sm text-gray-500">
            {selectedCount > 0 ? (
              <>
                <span className="font-medium text-gray-900">{selectedCount}</span>{" "}
                of {totalCount} selected
              </>
            ) : (
              `${totalCount} leads`
            )}
          </span>
        </div>

        {/* Action buttons - only show when items selected */}
        {someSelected && (
          <div className="flex items-center gap-2">
            {/* Change status dropdown */}
            <Menu as="div" className="relative">
              <Menu.Button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                <RefreshCw className="w-4 h-4" />
                Change Status
                <ChevronDown className="w-4 h-4" />
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="py-1">
                    {STATUS_OPTIONS.map((option) => (
                      <Menu.Item key={option.value}>
                        {({ active }) => (
                          <button
                            onClick={() => onBulkStatusChange(option.value)}
                            className={`${
                              active ? "bg-gray-100" : ""
                            } block w-full text-left px-4 py-2 text-sm text-gray-700`}
                          >
                            {option.label}
                          </button>
                        )}
                      </Menu.Item>
                    ))}
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>

            {/* Add to campaign button */}
            <button
              onClick={onAddToCampaign}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Users className="w-4 h-4" />
              Add to Campaign
            </button>

            {/* Delete button */}
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Transition appear show={deleteDialogOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setDeleteDialogOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      Delete {selectedCount} lead{selectedCount > 1 ? "s" : ""}?
                    </Dialog.Title>
                  </div>

                  <p className="text-sm text-gray-500 mb-6">
                    This action cannot be undone. All selected leads and their
                    associated data will be permanently removed.
                  </p>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                      onClick={() => setDeleteDialogOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      onClick={handleDeleteConfirm}
                    >
                      Delete
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
