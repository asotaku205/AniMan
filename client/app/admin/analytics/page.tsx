import { AdminRoute } from "../components/AdminRoute";
import AnalyticsClient from "./AnalyticsClient";

export default function AnalyticsPage() {
  return <AdminRoute module="analytics"><AnalyticsClient /></AdminRoute>;
}
