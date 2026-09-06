import { AdminRoute } from "../components/AdminRoute";
import NovelAdminClient from "./NovelAdminClient";

export default function NovelAdminPage() {
  return <AdminRoute module="novel"><NovelAdminClient /></AdminRoute>;
}
