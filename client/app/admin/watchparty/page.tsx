import { AdminRoute } from "../components/AdminRoute";
import WatchPartyAdminClient from "./WatchPartyAdminClient";

export default function WatchPartyAdminPage() {
  return <AdminRoute module="watchparty"><WatchPartyAdminClient /></AdminRoute>;
}
