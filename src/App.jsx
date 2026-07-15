import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Deposit from "./pages/Deposit";
import Transfer from "./pages/Transfer";
import Bills from "./pages/Bills";
import Recharge from "./pages/Recharge";
import Savings from "./pages/Savings";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminKyc from "./pages/admin/AdminKyc";
import AdminLoginLogs from "./pages/admin/AdminLoginLogs";
import AdminAdmins from "./pages/admin/AdminAdmins";
import AdminAccountDeletions from "./pages/admin/AdminAccountDeletions";
import AdminDisputes from "./pages/admin/AdminDisputes";
import AdminFinance from "./pages/admin/AdminFinance";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminMarketing from "./pages/admin/AdminMarketing";
import AdminPinRequests from "./pages/admin/AdminPinRequests";
import AdminSystemLogs from "./pages/admin/AdminSystemLogs";
import AdminComms from "./pages/admin/AdminComms";
import AdminAssistant from "./pages/admin/AdminAssistant";
import AdminLiveChat from "./pages/admin/AdminLiveChat";
import AdminVtuTransactions from "./pages/admin/AdminVtuTransactions";
import ChatWidget from "./components/ChatWidget";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/deposit" element={<ProtectedRoute><Deposit /></ProtectedRoute>} />
          <Route path="/transfer" element={<ProtectedRoute><Transfer /></ProtectedRoute>} />
          <Route path="/bills" element={<ProtectedRoute><Bills /></ProtectedRoute>} />
          <Route path="/recharge" element={<ProtectedRoute><Recharge /></ProtectedRoute>} />
          <Route path="/savings" element={<ProtectedRoute><Savings /></ProtectedRoute>} />

          {/* Admin routes — require the `admin` custom claim on the Firebase ID token */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
          <Route path="/admin/users/:uid" element={<AdminRoute><AdminUserDetail /></AdminRoute>} />
          <Route path="/admin/transactions" element={<AdminRoute><AdminTransactions /></AdminRoute>} />
          <Route path="/admin/kyc" element={<AdminRoute><AdminKyc /></AdminRoute>} />
          <Route path="/admin/login-logs" element={<AdminRoute><AdminLoginLogs /></AdminRoute>} />
          <Route path="/admin/admins" element={<AdminRoute><AdminAdmins /></AdminRoute>} />
          <Route path="/admin/account-deletions" element={<AdminRoute><AdminAccountDeletions /></AdminRoute>} />
          <Route path="/admin/disputes" element={<AdminRoute><AdminDisputes /></AdminRoute>} />
          <Route path="/admin/finance" element={<AdminRoute><AdminFinance /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
          <Route path="/admin/marketing" element={<AdminRoute><AdminMarketing /></AdminRoute>} />
          <Route path="/admin/pin-requests" element={<AdminRoute><AdminPinRequests /></AdminRoute>} />
          <Route path="/admin/system-logs" element={<AdminRoute><AdminSystemLogs /></AdminRoute>} />
          <Route path="/admin/comms" element={<AdminRoute><AdminComms /></AdminRoute>} />
          <Route path="/admin/assistant" element={<AdminRoute><AdminAssistant /></AdminRoute>} />
          <Route path="/admin/live-chat" element={<AdminRoute><AdminLiveChat /></AdminRoute>} />
          <Route path="/admin/vtu-transactions" element={<AdminRoute><AdminVtuTransactions /></AdminRoute>} />
        </Routes>
        <ChatWidget />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
