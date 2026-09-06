import { AdminRoute } from "../components/AdminRoute";
import ReportsClient from "./ReportsClient";

export default function ReportsAdminPage() {
  return <AdminRoute module="reports"><ReportsClient /></AdminRoute>;
}
