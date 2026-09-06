import { AdminRoute } from "../components/AdminRoute";
import ScheduleAdminClient from "./ScheduleAdminClient";

export default function ScheduleAdminPage() {
  return <AdminRoute module="schedule"><ScheduleAdminClient /></AdminRoute>;
}
