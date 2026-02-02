import { Fragment, useState } from "react";
import { Menu, Transition } from "@headlessui/react";
import { LogOut, Settings, Key, ChevronDown, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/**
 * User dropdown menu for the header
 */
export function UserMenu(): React.ReactElement {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) return <></>;

  const displayEmail = user.email ?? "User";
  const initials = displayEmail
    .split("@")[0]
    ?.substring(0, 2)
    .toUpperCase() ?? "U";

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-sm font-medium text-primary-700">{initials}</span>
        </div>
        <span className="hidden md:block text-sm font-medium max-w-[150px] truncate">
          {displayEmail}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
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
        <Menu.Items className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {/* User info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm text-gray-500">Signed in as</p>
            <p className="text-sm font-medium text-gray-900 truncate">
              {displayEmail}
            </p>
          </div>

          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => navigate("/settings")}
                  className={`${
                    active ? "bg-gray-100" : ""
                  } flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              )}
            </Menu.Item>

            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => navigate("/settings?tab=security")}
                  className={`${
                    active ? "bg-gray-100" : ""
                  } flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700`}
                >
                  <Key className="w-4 h-4" />
                  Change password
                </button>
              )}
            </Menu.Item>
          </div>

          <div className="border-t border-gray-100 py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={`${
                    active ? "bg-gray-100" : ""
                  } flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 disabled:opacity-50`}
                >
                  {isLoggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  Sign out
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
