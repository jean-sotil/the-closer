import { useState, useCallback } from "react";
import {
  Check,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

type ConnectionStatus = "connected" | "disconnected" | "error" | "testing";

interface Integration {
  id: string;
  name: string;
  description: string;
  status: ConnectionStatus;
  icon: string;
  lastChecked?: string;
  errorMessage?: string;
}

interface ApiKeyField {
  key: string;
  label: string;
  value: string;
  masked: boolean;
  required: boolean;
  helpUrl?: string;
}

interface IntegrationSettingsProps {
  onTestConnection?: (integrationId: string) => Promise<boolean>;
  onSaveApiKey?: (key: string, value: string) => Promise<void>;
  onConnectOAuth?: (provider: string) => void;
}

const DEFAULT_INTEGRATIONS: Integration[] = [
  {
    id: "supabase",
    name: "Supabase",
    description: "Database and authentication",
    status: "connected",
    icon: "🗃️",
    lastChecked: new Date().toISOString(),
  },
  {
    id: "mailgun",
    name: "Mailgun",
    description: "Email delivery service",
    status: "connected",
    icon: "📧",
    lastChecked: new Date().toISOString(),
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Meeting scheduling",
    status: "disconnected",
    icon: "📅",
  },
  {
    id: "browserbase",
    name: "Browserbase",
    description: "Cloud browser automation (optional)",
    status: "disconnected",
    icon: "🌐",
  },
];

const DEFAULT_API_KEYS: ApiKeyField[] = [
  {
    key: "MAILGUN_API_KEY",
    label: "Mailgun API Key",
    value: "key-xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    masked: true,
    required: true,
    helpUrl: "https://documentation.mailgun.com/en/latest/api-intro.html#authentication",
  },
  {
    key: "MAILGUN_DOMAIN",
    label: "Mailgun Domain",
    value: "mail.example.com",
    masked: false,
    required: true,
  },
  {
    key: "BROWSERBASE_API_KEY",
    label: "Browserbase API Key",
    value: "",
    masked: true,
    required: false,
    helpUrl: "https://www.browserbase.com/docs",
  },
  {
    key: "BROWSERBASE_PROJECT_ID",
    label: "Browserbase Project ID",
    value: "",
    masked: false,
    required: false,
  },
];

function maskValue(value: string): string {
  if (value.length <= 8) return "••••••••";
  return value.slice(0, 4) + "••••••••" + value.slice(-4);
}

function formatLastChecked(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function StatusBadge({ status }: { status: ConnectionStatus }): React.ReactElement {
  const configs: Record<ConnectionStatus, { color: string; icon: React.ReactElement; text: string }> = {
    connected: {
      color: "bg-green-100 text-green-700",
      icon: <CheckCircle className="h-3.5 w-3.5" />,
      text: "Connected",
    },
    disconnected: {
      color: "bg-gray-100 text-gray-600",
      icon: <X className="h-3.5 w-3.5" />,
      text: "Not Connected",
    },
    error: {
      color: "bg-red-100 text-red-700",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      text: "Error",
    },
    testing: {
      color: "bg-blue-100 text-blue-700",
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: "Testing...",
    },
  };

  const config = configs[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.color}`}
    >
      {config.icon}
      {config.text}
    </span>
  );
}

export function IntegrationSettings({
  onTestConnection,
  onSaveApiKey,
  onConnectOAuth,
}: IntegrationSettingsProps): React.ReactElement {
  const [integrations, setIntegrations] = useState<Integration[]>(DEFAULT_INTEGRATIONS);
  const [apiKeys, setApiKeys] = useState<ApiKeyField[]>(DEFAULT_API_KEYS);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const toggleKeyVisibility = useCallback((key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleTestConnection = useCallback(
    async (integrationId: string) => {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === integrationId ? { ...i, status: "testing" as ConnectionStatus } : i
        )
      );

      try {
        // Simulate API call
        const success = onTestConnection
          ? await onTestConnection(integrationId)
          : await new Promise<boolean>((resolve) =>
              setTimeout(() => resolve(Math.random() > 0.2), 1500)
            );

        setIntegrations((prev) =>
          prev.map((i): Integration =>
            i.id === integrationId
              ? {
                  ...i,
                  status: success ? "connected" : "error",
                  lastChecked: new Date().toISOString(),
                  ...(success ? {} : { errorMessage: "Connection test failed" }),
                }
              : i
          )
        );
      } catch {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.id === integrationId
              ? {
                  ...i,
                  status: "error",
                  errorMessage: "Connection test failed",
                }
              : i
          )
        );
      }
    },
    [onTestConnection]
  );

  const handleStartEdit = useCallback((key: string, currentValue: string) => {
    setEditingKey(key);
    setTempValue(currentValue);
  }, []);

  const handleSaveKey = useCallback(
    async (key: string) => {
      setSavingKey(key);
      try {
        await onSaveApiKey?.(key, tempValue);
        setApiKeys((prev) =>
          prev.map((k) => (k.key === key ? { ...k, value: tempValue } : k))
        );
        setEditingKey(null);
        setTempValue("");
      } finally {
        setSavingKey(null);
      }
    },
    [tempValue, onSaveApiKey]
  );

  const handleConnectGoogle = useCallback(() => {
    // In a real app, this would initiate OAuth flow
    onConnectOAuth?.("google-calendar");
    // Simulate OAuth success after delay
    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.id === "google-calendar"
            ? { ...i, status: "connected", lastChecked: new Date().toISOString() }
            : i
        )
      );
    }, 2000);
  }, [onConnectOAuth]);

  return (
    <div className="space-y-8">
      {/* Service Connections */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Service Connections</h2>
          <p className="text-sm text-gray-500">
            Manage connections to external services
          </p>
        </div>

        <div className="space-y-3">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{integration.icon}</span>
                <div>
                  <h3 className="font-medium text-gray-900">{integration.name}</h3>
                  <p className="text-sm text-gray-500">{integration.description}</p>
                  {integration.lastChecked && integration.status === "connected" && (
                    <p className="mt-1 text-xs text-gray-400">
                      Last verified: {formatLastChecked(integration.lastChecked)}
                    </p>
                  )}
                  {integration.errorMessage && (
                    <p className="mt-1 text-xs text-red-600">{integration.errorMessage}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <StatusBadge status={integration.status} />

                {integration.id === "google-calendar" &&
                integration.status === "disconnected" ? (
                  <button
                    onClick={handleConnectGoogle}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Connect
                  </button>
                ) : (
                  <button
                    onClick={() => handleTestConnection(integration.id)}
                    disabled={integration.status === "testing"}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${integration.status === "testing" ? "animate-spin" : ""}`}
                    />
                    Test
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Keys */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
          <p className="text-sm text-gray-500">
            Configure API credentials for external services
          </p>
        </div>

        <div className="space-y-3">
          {apiKeys.map((field) => (
            <div
              key={field.key}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-900">
                      {field.label}
                    </label>
                    {field.required && (
                      <span className="text-xs text-red-500">Required</span>
                    )}
                    {field.helpUrl && (
                      <a
                        href={field.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  {editingKey === field.key ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        type={field.masked && !visibleKeys.has(field.key) ? "password" : "text"}
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder={`Enter ${field.label}`}
                      />
                      <button
                        onClick={() => handleSaveKey(field.key)}
                        disabled={savingKey === field.key}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {savingKey === field.key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingKey(null);
                          setTempValue("");
                        }}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 rounded bg-gray-100 px-3 py-2 font-mono text-sm text-gray-700">
                        {field.value
                          ? field.masked && !visibleKeys.has(field.key)
                            ? maskValue(field.value)
                            : field.value
                          : "Not configured"}
                      </code>
                      {field.masked && field.value && (
                        <button
                          onClick={() => toggleKeyVisibility(field.key)}
                          className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title={visibleKeys.has(field.key) ? "Hide" : "Show"}
                        >
                          {visibleKeys.has(field.key) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleStartEdit(field.key, field.value)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Security Notice</p>
              <p className="mt-1">
                API keys are encrypted at rest. Never share your API keys or commit them
                to version control. For production, use environment variables.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
