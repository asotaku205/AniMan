import { AdminRoute } from "../components/AdminRoute";
import AnnouncementsAdminClient from "./AnnouncementsAdminClient";

export default function AnnouncementsAdminPage() {
  return <AdminRoute module="announcements"><AnnouncementsAdminClient /></AdminRoute>;
}
