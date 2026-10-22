import { CustomRoutes } from "ra-core";
import { Navigate, Route, useParams } from "react-router";
import fakeRestDataProvider from "ra-data-fakerest";
import { Admin } from "@/components/admin/admin";
import { WorkspaceProvider } from "./context";
import { Layout } from "./Layout";
import { Dashboard } from "./Dashboard";
import { LeadForm, LeadsList, LeadShow } from "./Leads";
import { ImportLeads } from "./ImportLeads";
import { Dispatch } from "./Dispatch";
import { Handover } from "./Operations";
import { Account } from "./Account";
import { TasksPage, TicketPage } from "./Assignments";
import { Appointments } from "./Appointments";
import { Reports } from "./Reports";
import { Settings } from "./Settings";
import { Empty } from "./shared";
import { Notices } from "./Notices";
import { InboxPage } from "./Inbox";
import "./lead-sale.css";

// Keep Atomic CRM's Admin/router/UI foundation; domain commands use Supabase.
// An explicit demo mode is available independently from the production session.
const foundationProvider = fakeRestDataProvider({});
const NotFound = () => (
  <div className="panel">
    <Empty
      title="Không tìm thấy trang"
      description="Đường dẫn không tồn tại. Chọn chức năng trong menu bên trái."
    />
  </div>
);
const LegacyTicket = () => <Navigate replace to={`/tasks/${useParams().id}`} />;
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
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TicketPage />} />
          <Route path="/dispatch" element={<Dispatch />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/leads" element={<LeadsList />} />
          <Route path="/leads/create" element={<LeadForm key="create" />} />
          <Route path="/leads/:id/show" element={<LeadShow />} />
          <Route path="/leads/:id" element={<LeadForm />} />
          <Route path="/import" element={<ImportLeads />} />
          <Route path="/handover" element={<Handover />} />
          <Route path="/reports" element={<Reports />} />
          <Route
            path="/admin"
            element={<Navigate replace to="/admin/users" />}
          />
          <Route path="/admin/:tab" element={<Settings />} />
          <Route path="/notifications" element={<Notices />} />
          <Route path="/account" element={<Account />} />
          {/* Links stored in notifications before the redesign. */}
          <Route path="/assignments/:id/show" element={<LegacyTicket />} />
          <Route
            path="/assignments"
            element={<Navigate replace to="/tasks" />}
          />
          <Route path="/queue" element={<Navigate replace to="/dispatch" />} />
          <Route
            path="/notices"
            element={<Navigate replace to="/notifications" />}
          />
          <Route
            path="/settings"
            element={<Navigate replace to="/admin/users" />}
          />
        </CustomRoutes>
      </Admin>
    </WorkspaceProvider>
  );
}
