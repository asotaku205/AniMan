import { AdminRoute } from "../components/AdminRoute";
import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  return <AdminRoute module="dashboard"><DashboardClient /></AdminRoute>;
}
