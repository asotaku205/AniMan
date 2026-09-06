import { AdminRoute } from "../components/AdminRoute";
import CategoriesAdminClient from "./CategoriesAdminClient";

export default function CategoriesAdminPage() {
  return <AdminRoute module="categories"><CategoriesAdminClient /></AdminRoute>;
}
