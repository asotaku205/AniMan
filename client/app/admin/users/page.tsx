import { AdminRoute } from "../components/AdminRoute";
import UsersAdminClient from "./UsersAdminClient";

export default function UsersAdminPage() {
  return <AdminRoute module="users"><UsersAdminClient /></AdminRoute>;
}
