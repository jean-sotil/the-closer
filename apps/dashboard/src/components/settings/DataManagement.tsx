import { useState, useCallback, useRef } from "react";
import {
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  Check,
  Loader2,
  FileSpreadsheet,
  Clock,
} from "lucide-react";

interface DataManagementProps {
  onExport?: () => Promise<Blob>;
  onImport?: (file: File) => Promise<{ success: number; errors: number }>;
  onDeleteAll?: () => Promise<void>;
}

export function DataManagement({
  onExport,
  onImport,
  onDeleteAll,
}: DataManagementProps): React.ReactElement {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: number;
  } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      if (onExport) {
        const blob = await onExport();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Mock export
        const mockData = [
          ["business_name", "email", "phone", "website", "rating", "status"],
          ["Joe's Plumbing", "joe@plumbing.com", "555-0123", "joesplumbing.com", "3.5", "pending"],
          ["Smith Dental", "info@smithdental.com", "555-0456", "smithdental.com", "4.0", "emailed"],
        ];
        const csv = mockData.map((row) => row.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExporting(false);
    }
  }, [onExport]);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.name.endsWith(".csv")) {
        setImportResult({ success: 0, errors: 1 });
        return;
      }

      setIsImporting(true);
      setImportResult(null);

      try {
        if (onImport) {
          const result = await onImport(file);
          setImportResult(result);
        } else {
          // Mock import
          await new Promise((resolve) => setTimeout(resolve, 1500));
          setImportResult({ success: 45, errors: 2 });
        }
      } catch {
        setImportResult({ success: 0, errors: 1 });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [onImport]
  );

  const handleDeleteAll = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDeleteAll?.();
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  }, [onDeleteAll]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Data Management</h2>
        <p className="text-sm text-gray-500">
          Export, import, and manage your lead data
        </p>
      </div>

      {/* Export/Import Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Export */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-green-100 p-2">
              <Download className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Export Leads</h3>
              <p className="text-sm text-gray-500">Download all leads as CSV</p>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                Export to CSV
              </>
            )}
          </button>

          <p className="mt-3 text-xs text-gray-500">
            Includes all lead data: business info, contact status, audit results, and notes.
          </p>
        </div>

        {/* Import */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-blue-100 p-2">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Import Leads</h3>
              <p className="text-sm text-gray-500">Upload leads from CSV file</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Choose CSV File
              </>
            )}
          </button>

          {importResult && (
            <div
              className={`mt-3 rounded-lg p-3 text-sm ${
                importResult.errors > 0
                  ? "bg-amber-50 text-amber-800"
                  : "bg-green-50 text-green-800"
              }`}
            >
              <div className="flex items-center gap-2">
                {importResult.errors > 0 ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>
                  Imported {importResult.success} leads
                  {importResult.errors > 0 && `, ${importResult.errors} errors`}
                </span>
              </div>
            </div>
          )}

          <p className="mt-3 text-xs text-gray-500">
            CSV must include: business_name, email or phone, website
          </p>
        </div>
      </div>

      {/* Data Retention */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-purple-100 p-2">
            <Clock className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Data Retention</h3>
            <p className="text-sm text-gray-500">
              Automatically delete old data after a set period
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Delete leads older than: {retentionDays} days
            </label>
            <input
              type="range"
              min="30"
              max="365"
              step="30"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>30 days</span>
              <span>1 year</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-delete"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="auto-delete" className="text-sm text-gray-700">
              Enable automatic deletion of old leads
            </label>
          </div>

          <p className="text-xs text-gray-500">
            Leads with status "converted" or "declined" will be deleted after {retentionDays} days
            to comply with data retention policies.
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-red-100 p-2">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-medium text-red-900">Danger Zone</h3>
            <p className="text-sm text-red-700">
              Permanently delete all data. This action cannot be undone.
            </p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Delete All Data
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-red-800">
              Are you absolutely sure? This will permanently delete:
            </p>
            <ul className="list-inside list-disc text-sm text-red-700">
              <li>All leads and contact history</li>
              <li>All audit results and evidence</li>
              <li>All campaign data and analytics</li>
              <li>All email templates</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Yes, Delete Everything
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
