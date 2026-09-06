import { AdminRoute } from "../components/AdminRoute";
import StudioAdminClient from "./StudioAdminClient";

export default function StudioAdminPage() {
  return <AdminRoute module="studio"><StudioAdminClient /></AdminRoute>;
}
