import { AdminRoute } from "../components/AdminRoute";
import BillingClient from "./BillingClient";

export default function BillingAdminPage() {
  return <AdminRoute module="billing"><BillingClient /></AdminRoute>;
}
