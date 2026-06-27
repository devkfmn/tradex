import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  List,
  PlusCircle,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Calculator,
  Settings,
  LogOut,
  TrendingUp,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/trades", label: "Trades", icon: List },
  { to: "/trades/new", label: "Add Trade", icon: PlusCircle },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/playbook", label: "Playbook", icon: BookOpen },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/review", label: "Review", icon: ClipboardCheck },
  { to: "/calculator", label: "Calculator", icon: Calculator },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo">
            <TrendingUp size={18} />
          </span>
          <span className="sidebar-brand-name">Tradex</span>
          <button className="btn-ghost sidebar-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/trades"}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="avatar" />
            ) : (
              <span className="avatar avatar-fallback">
                {(user?.displayName || user?.email || "?")
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {user?.displayName || "Trader"}
              </div>
              <div className="sidebar-user-email">{user?.email}</div>
            </div>
          </div>
          <button className="btn btn-ghost sidebar-logout" onClick={() => logout()}>
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
