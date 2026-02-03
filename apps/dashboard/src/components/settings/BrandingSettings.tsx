import { useState, useCallback, useRef } from "react";
import { Upload, Palette, Type, Check, Save, X } from "lucide-react";

interface BrandingConfig {
  logo: string | null;
  companyName: string;
  emailSignature: string;
  primaryColor: string;
  accentColor: string;
}

interface BrandingSettingsProps {
  config?: Partial<BrandingConfig>;
  onSave?: (config: BrandingConfig) => void;
}

const DEFAULT_CONFIG: BrandingConfig = {
  logo: null,
  companyName: "Your Company",
  emailSignature: `Best regards,
{{your_name}}
{{your_company}}

---
This email was sent by The Closer
Unsubscribe: {{unsubscribe_link}}`,
  primaryColor: "#2563eb",
  accentColor: "#059669",
};

const PRESET_COLORS = [
  "#2563eb", // Blue
  "#7c3aed", // Purple
  "#059669", // Green
  "#dc2626", // Red
  "#ea580c", // Orange
  "#0891b2", // Cyan
  "#4f46e5", // Indigo
  "#be185d", // Pink
];

export function BrandingSettings({
  config: propConfig,
  onSave,
}: BrandingSettingsProps): React.ReactElement {
  const [config, setConfig] = useState<BrandingConfig>({
    ...DEFAULT_CONFIG,
    ...propConfig,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    // Convert to base64 for preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setConfig((prev) => ({
        ...prev,
        logo: event.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveLogo = useCallback(() => {
    setConfig((prev) => ({ ...prev, logo: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave?.(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  }, [config, onSave]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
          <p className="text-sm text-gray-500">
            Customize your company branding and email appearance
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
            saveSuccess ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"
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
              Save Changes
            </>
          )}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Logo Upload */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="h-5 w-5 text-gray-400" />
            <h3 className="font-medium text-gray-900">Company Logo</h3>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />

          {config.logo ? (
            <div className="relative">
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4">
                <img
                  src={config.logo}
                  alt="Company logo"
                  className="max-h-24 max-w-full object-contain"
                />
              </div>
              <button
                onClick={handleRemoveLogo}
                className="absolute -right-2 -top-2 rounded-full bg-red-100 p-1 text-red-600 hover:bg-red-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 hover:border-gray-400"
            >
              <Upload className="h-8 w-8 text-gray-400" />
              <span className="mt-2 text-sm font-medium text-gray-600">
                Click to upload logo
              </span>
              <span className="mt-1 text-xs text-gray-500">
                PNG, JPG up to 2MB
              </span>
            </button>
          )}
        </div>

        {/* Company Name */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Type className="h-5 w-5 text-gray-400" />
            <h3 className="font-medium text-gray-900">Company Details</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Company Name
            </label>
            <input
              type="text"
              value={config.companyName}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, companyName: e.target.value }))
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Your Company Name"
            />
            <p className="mt-1 text-xs text-gray-500">
              Used in email signatures and branding
            </p>
          </div>
        </div>

        {/* Color Theme */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-gray-400" />
            <h3 className="font-medium text-gray-900">Color Theme</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Primary Color
              </label>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex gap-2">
                  {PRESET_COLORS.slice(0, 4).map((color) => (
                    <button
                      key={color}
                      onClick={() =>
                        setConfig((prev) => ({ ...prev, primaryColor: color }))
                      }
                      className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        config.primaryColor === color
                          ? "border-gray-900 ring-2 ring-offset-2 ring-gray-400"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={config.primaryColor}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, primaryColor: e.target.value }))
                  }
                  className="h-8 w-8 cursor-pointer rounded border-0"
                />
                <input
                  type="text"
                  value={config.primaryColor}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, primaryColor: e.target.value }))
                  }
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Accent Color
              </label>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex gap-2">
                  {PRESET_COLORS.slice(4).map((color) => (
                    <button
                      key={color}
                      onClick={() =>
                        setConfig((prev) => ({ ...prev, accentColor: color }))
                      }
                      className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        config.accentColor === color
                          ? "border-gray-900 ring-2 ring-offset-2 ring-gray-400"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={config.accentColor}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, accentColor: e.target.value }))
                  }
                  className="h-8 w-8 cursor-pointer rounded border-0"
                />
                <input
                  type="text"
                  value={config.accentColor}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, accentColor: e.target.value }))
                  }
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="mt-4 rounded-lg border border-gray-200 p-4">
              <p className="mb-2 text-xs font-medium text-gray-500 uppercase">Preview</p>
              <div className="flex gap-3">
                <button
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  Primary Button
                </button>
                <button
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: config.accentColor }}
                >
                  Accent Button
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Email Signature */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <Type className="h-5 w-5 text-gray-400" />
            <h3 className="font-medium text-gray-900">Email Signature</h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Default Signature
            </label>
            <textarea
              value={config.emailSignature}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, emailSignature: e.target.value }))
              }
              rows={6}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Your email signature..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Use {"{{your_name}}"}, {"{{your_company}}"}, {"{{unsubscribe_link}}"} for dynamic values
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
