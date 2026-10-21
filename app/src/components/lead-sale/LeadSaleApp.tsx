import { CustomRoutes } from "ra-core";
import { Route } from "react-router";
import fakeRestDataProvider from "ra-data-fakerest";
import { Admin } from "@/components/admin/admin";
import { WorkspaceProvider } from "./context";
import { Layout } from "./Layout";
import { Dashboard } from "./Dashboard";
import { LeadForm, LeadsList, LeadShow, ImportLeads } from "./Leads";
import { AssignmentsList, AssignmentShow } from "./Assignments";
import { Appointments } from "./Appointments";
import { Reports } from "./Reports";
import { Settings } from "./Settings";
import { Empty } from "./shared";
import "./lead-sale.css";

// Reuse Atomic CRM's Admin/router/UI foundation; domain persistence is local
// until Supabase Auth, RLS and the new schema are connected in the next step.
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
        </CustomRoutes>
      </Admin>
    </WorkspaceProvider>
  );
}
