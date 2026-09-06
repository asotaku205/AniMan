import { AdminRoute } from "../components/AdminRoute";
import AnimeAdminClient from "./AnimeAdminClient";

export default function AnimeAdminPage() {
  return <AdminRoute module="anime"><AnimeAdminClient /></AdminRoute>;
}
