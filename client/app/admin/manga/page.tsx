import { AdminRoute } from "../components/AdminRoute";
import MangaAdminClient from "./MangaAdminClient";

export default function MangaAdminPage() {
  return <AdminRoute module="manga"><MangaAdminClient /></AdminRoute>;
}
