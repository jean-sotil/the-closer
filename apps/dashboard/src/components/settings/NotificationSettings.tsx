import { useState, useCallback } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Calendar,
  TrendingUp,
  Check,
  Save,
} from "lucide-react";

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

interface NotificationSettingsProps {
  onSave?: (settings: NotificationSetting[]) => void;
}

const DEFAULT_NOTIFICATIONS: NotificationSetting[] = [
  {
    id: "new_lead",
    label: "New Lead Discovered",
    description: "When a new lead is found during discovery",
    icon: <TrendingUp className="h-5 w-5" />,
    emailEnabled: false,
    inAppEnabled: true,
  },
  {
    id: "email_opened",
    label: "Email Opened",
    description: "When a recipient opens your email",
    icon: <Mail className="h-5 w-5" />,
    emailEnabled: false,
    inAppEnabled: true,
  },
  {
    id: "email_replied",
    label: "Email Reply Received",
    description: "When a lead replies to your email",
    icon: <MessageSquare className="h-5 w-5" />,
    emailEnabled: true,
    inAppEnabled: true,
  },
  {
    id: "meeting_booked",
    label: "Meeting Booked",
    description: "When a lead books a meeting",
    icon: <Calendar className="h-5 w-5" />,
    emailEnabled: true,
    inAppEnabled: true,
  },
  {
    id: "daily_digest",
    label: "Daily Digest",
    description: "Summary of activity from the past 24 hours",
    icon: <Bell className="h-5 w-5" />,
    emailEnabled: true,
    inAppEnabled: false,
  },
];

export function NotificationSettings({
  onSave,
}: NotificationSettingsProps): React.ReactElement {
  const [notifications, setNotifications] = useState<NotificationSetting[]>(
    DEFAULT_NOTIFICATIONS
  );
  const [slackWebhook, setSlackWebhook] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleToggle = useCallback(
    (id: string, type: "email" | "inApp") => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                [type === "email" ? "emailEnabled" : "inAppEnabled"]:
                  type === "email" ? !n.emailEnabled : !n.inAppEnabled,
              }
            : n
        )
      );
    },
    []
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave?.(notifications);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  }, [notifications, onSave]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500">
            Configure how and when you want to be notified
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
            saveSuccess
              ? "bg-green-600"
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
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Notification Settings Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[1fr,100px,100px] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
          <div>Notification</div>
          <div className="text-center">Email</div>
          <div className="text-center">In-App</div>
        </div>

        <div className="divide-y divide-gray-200">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="grid grid-cols-[1fr,100px,100px] gap-4 px-4 py-4 items-center"
            >
              <div className="flex items-center gap-3">
                <div className="text-gray-400">{notification.icon}</div>
                <div>
                  <div className="font-medium text-gray-900">{notification.label}</div>
                  <div className="text-sm text-gray-500">{notification.description}</div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => handleToggle(notification.id, "email")}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    notification.emailEnabled ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      notification.emailEnabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => handleToggle(notification.id, "inApp")}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    notification.inAppEnabled ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      notification.inAppEnabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Slack Integration */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-purple-100 p-2">
            <svg
              className="h-6 w-6 text-purple-600"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">Slack Integration</h3>
            <p className="mt-1 text-sm text-gray-500">
              Send notifications to a Slack channel via webhook
            </p>
            <div className="mt-3">
              <input
                type="url"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Create an incoming webhook in your Slack workspace settings
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
