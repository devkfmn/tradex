import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import AddTrade from "./pages/AddTrade";
import Reports from "./pages/Reports";
import Playbook from "./pages/Playbook";
import Calendar from "./pages/Calendar";
import Review from "./pages/Review";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/trades/new" element={<AddTrade />} />
          <Route path="/trades/:id/edit" element={<AddTrade />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/playbook" element={<Playbook />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/review" element={<Review />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
