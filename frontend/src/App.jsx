import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import { PageLoader } from "./components/ui";
import Landing from "./pages/Landing";
import { Login, Register } from "./pages/Auth";
import Overview from "./pages/dashboard/Overview";
import Agenda from "./pages/dashboard/Agenda";
import Services from "./pages/dashboard/Services";
import Professionals from "./pages/dashboard/Professionals";
import Customers from "./pages/dashboard/Customers";
import Settings from "./pages/dashboard/Settings";
import Booking from "./pages/public/Booking";
import AppointmentPage from "./pages/public/AppointmentPage";
import NotFound from "./pages/NotFound";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/entrar" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/painel" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/entrar" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/cadastro" element={<GuestOnly><Register /></GuestOnly>} />

      <Route path="/painel" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route index element={<Overview />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="servicos" element={<Services />} />
        <Route path="profissionais" element={<Professionals />} />
        <Route path="clientes" element={<Customers />} />
        <Route path="configuracoes" element={<Settings />} />
      </Route>

      <Route path="/b/:slug" element={<Booking />} />
      <Route path="/agendamento/:code" element={<AppointmentPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
