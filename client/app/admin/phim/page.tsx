import { AdminRoute } from "../components/AdminRoute";
import FilmAdminClient from "./FilmAdminClient";

export default function FilmAdminPage() {
  return <AdminRoute module="phim"><FilmAdminClient /></AdminRoute>;
}
