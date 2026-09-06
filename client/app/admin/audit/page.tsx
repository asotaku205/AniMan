import { AdminRoute } from "../components/AdminRoute";
import AuditClient from "./AuditClient";

export default function AuditAdminPage() {
  return (
    <AdminRoute module="audit">
      <AuditClient />
    </AdminRoute>
  );
}
