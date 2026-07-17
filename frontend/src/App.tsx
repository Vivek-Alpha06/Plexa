import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext";
import { Header } from "./components/Header";
import { WalletModal } from "./components/WalletModal";
import { Toasts } from "./components/Toasts";
import { DemoWalletModal } from "./components/DemoWalletModal";
import { Landing } from "./pages/Landing";
import { Groups } from "./pages/Groups";
import { Dashboard } from "./pages/Dashboard";
import { Profile } from "./pages/Profile";
import { CreateGroup } from "./pages/CreateGroup";
import { GroupDetail } from "./pages/GroupDetail";

function AppShell() {
  return (
    <div className="shell">
      <Header />
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <Toasts />
        <WalletModal />
        <DemoWalletModal />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/groups" replace />} />
            <Route path="groups" element={<Groups />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="create" element={<CreateGroup />} />
            <Route path="group/:id" element={<GroupDetail />} />
          </Route>
        </Routes>
      </WalletProvider>
    </BrowserRouter>
  );
}
