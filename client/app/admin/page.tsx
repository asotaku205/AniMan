import { AdminRoute } from "./components/AdminRoute";
import DashboardClient from "./dashboard/DashboardClient";

export default function AdminPage() {
  return <AdminRoute module="dashboard"><DashboardClient /></AdminRoute>;
}
