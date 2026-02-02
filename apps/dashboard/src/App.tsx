import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import {
  Search,
  FileCheck,
  Mail,
  Users,
  Settings as SettingsIcon,
} from "lucide-react";

import { Discovery } from "./pages/Discovery";
import { Audits } from "./pages/Audits";
import { Outreach } from "./pages/Outreach";
import { Leads } from "./pages/Leads";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ProtectedRoute, UserMenu } from "./components/auth";

const navItems = [
  { path: "/", label: "Discovery", icon: Search },
  { path: "/leads", label: "Leads", icon: Users },
  { path: "/audits", label: "Audits", icon: FileCheck },
  { path: "/outreach", label: "Outreach", icon: Mail },
  { path: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * Main application layout with sidebar navigation
 */
function AppLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-primary-600">The Closer</h1>
            <p className="text-sm text-gray-500">Revenue Engine</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <p className="text-xs text-gray-400">v0.1.0</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="ml-64">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center justify-end h-16 px-8">
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}

export function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Discovery />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/audits" element={<Audits />} />
                  <Route path="/outreach" element={<Outreach />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
