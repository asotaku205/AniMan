import { AdminRoute } from "../components/AdminRoute";
import RolesClient from "./RolesClient";

export default function RolesAdminPage() {
  return <AdminRoute module="roles"><RolesClient /></AdminRoute>;
}
