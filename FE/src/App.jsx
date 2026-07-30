import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/layout/Navbar/Navbar";
import Footer from "./components/layout/Footer/Footer";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import GuestRoute from "./components/routing/GuestRoute";
import LandingPage from "./pages/LandingPage/LandingPage";
import BotsPage from "./pages/BotsPage/BotsPage";
import BotDetailPage from "./pages/BotDetailPage/BotDetailPage";
import BacktestsPage from "./pages/BacktestsPage/BacktestsPage";
import BacktestDetailPage from "./pages/BacktestDetailPage/BacktestDetailPage";
import BacktestComparePage from "./pages/BacktestComparePage/BacktestComparePage";
import LoginPage from "./pages/LoginPage/LoginPage";
import RegisterPage from "./pages/RegisterPage/RegisterPage";
import AccountPage from "./pages/AccountPage/AccountPage";
import EmulatorPage from "./pages/EmulatorPage/EmulatorPage";

const protectedPage = (component) => <ProtectedRoute>{component}</ProtectedRoute>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/bots" element={protectedPage(<BotsPage />)} />
          <Route path="/bots/:botId" element={protectedPage(<BotDetailPage />)} />
          <Route path="/emulator" element={protectedPage(<EmulatorPage />)} />
          <Route path="/backtests" element={protectedPage(<BacktestsPage />)} />
          <Route path="/backtests/compare" element={protectedPage(<BacktestComparePage />)} />
          <Route path="/backtests/:id" element={protectedPage(<BacktestDetailPage />)} />
          <Route path="/account" element={protectedPage(<AccountPage />)} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </AuthProvider>
  );
}

