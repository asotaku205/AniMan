import { AdminRoute } from "../components/AdminRoute";
import ForumAdminClient from "./ForumAdminClient";

export default function ForumAdminPage() {
  return <AdminRoute module="forum"><ForumAdminClient /></AdminRoute>;
}
