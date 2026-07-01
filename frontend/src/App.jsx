import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Navbar from './components/layout/Navbar/Navbar';
import Footer from './components/layout/Footer/Footer';
import LandingPage from './pages/LandingPage/LandingPage';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import RunsPage from './pages/RunsPage/RunsPage';
import RunDetailPage from './pages/RunDetailPage/RunDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<DashboardPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/runs/:id" element={<RunDetailPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}
