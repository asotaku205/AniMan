import { AdminRoute } from "../components/AdminRoute";
import SettingsClient from "./SettingsClient";

export default function SettingsAdminPage() {
  return <AdminRoute module="settings"><SettingsClient /></AdminRoute>;
}
