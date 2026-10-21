import { CustomRoutes } from "ra-core";
import { Route } from "react-router";
import fakeRestDataProvider from "ra-data-fakerest";
import { Admin } from "@/components/admin/admin";
import { WorkspaceProvider } from "./context";
import { Layout } from "./Layout";
import { Dashboard } from "./Dashboard";
import { LeadForm, LeadsList, LeadShow } from "./Leads";
import { ImportLeads } from "./ImportLeads";
import { IntakeQueue, Handover } from "./Operations";
import { Account } from "./Account";
import { AssignmentsList, AssignmentShow } from "./Assignments";
import { Appointments } from "./Appointments";
import { Reports } from "./Reports";
import { Settings } from "./Settings";
import { Empty } from "./shared";
import { CoreSimulator } from "./CoreSimulator";
import { Notices } from "./Notices";
import "./lead-sale.css";

// Keep Atomic CRM's Admin/router/UI foundation; domain commands use Supabase.
// An explicit demo mode is available independently from the production session.
const foundationProvider = fakeRestDataProvider({});
const NotFound = () => (
  <Empty
    title="Không tìm thấy trang"
    description="Kiểm tra đường dẫn hoặc chọn chức năng trong menu."
  />
);
export default function LeadSaleApp() {
  return (
    <WorkspaceProvider>
      <Admin
        dataProvider={foundationProvider}
        layout={Layout}
        dashboard={Dashboard}
        catchAll={NotFound}
        title="Lead Sale"
        disableTelemetry
      >
        <CustomRoutes>
          <Route path="/queue" element={<IntakeQueue />} />
          <Route path="/handover" element={<Handover />} />
          <Route path="/account" element={<Account />} />
          <Route path="/leads" element={<LeadsList />} />
          <Route path="/leads/create" element={<LeadForm key="create" />} />
          <Route path="/leads/:id/show" element={<LeadShow />} />
          <Route path="/leads/:id" element={<LeadForm />} />
          <Route path="/assignments" element={<AssignmentsList />} />
          <Route path="/assignments/:id/show" element={<AssignmentShow />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/import" element={<ImportLeads />} />
          <Route path="/core-simulator" element={<CoreSimulator />} />
          <Route path="/integrations" element={<CoreSimulator reconcile />} />
          <Route path="/notices" element={<Notices />} />
        </CustomRoutes>
      </Admin>
    </WorkspaceProvider>
  );
}
