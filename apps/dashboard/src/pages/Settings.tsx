import { useState } from "react";
import { Tab } from "@headlessui/react";
import {
  FileText,
  Search,
  Plug,
  Bell,
  Palette,
  Database,
} from "lucide-react";
import {
  TemplateEditor,
  SearchCriteriaConfig,
  IntegrationSettings,
  NotificationSettings,
  BrandingSettings,
  DataManagement,
} from "../components/settings";

const TABS = [
  { name: "Templates", icon: FileText },
  { name: "Search", icon: Search },
  { name: "Integrations", icon: Plug },
  { name: "Notifications", icon: Bell },
  { name: "Branding", icon: Palette },
  { name: "Data", icon: Database },
] as const;

export function Settings(): React.ReactElement {
  const [selectedTab, setSelectedTab] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Tabs */}
      <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
        <Tab.List className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {TABS.map((tab) => (
            <Tab
              key={tab.name}
              className={({ selected }) =>
                `flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none ${
                  selected
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-600 hover:text-gray-900"
                }`
              }
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.name}</span>
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="mt-6">
          {/* Templates Panel */}
          <Tab.Panel>
            <TemplateEditor />
          </Tab.Panel>

          {/* Search Criteria Panel */}
          <Tab.Panel>
            <SearchCriteriaConfig />
          </Tab.Panel>

          {/* Integrations Panel */}
          <Tab.Panel>
            <IntegrationSettings />
          </Tab.Panel>

          {/* Notifications Panel */}
          <Tab.Panel>
            <NotificationSettings />
          </Tab.Panel>

          {/* Branding Panel */}
          <Tab.Panel>
            <BrandingSettings />
          </Tab.Panel>

          {/* Data Management Panel */}
          <Tab.Panel>
            <DataManagement />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
