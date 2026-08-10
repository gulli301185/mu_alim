import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { TeacherPage } from './pages/TeacherPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/ustaz" element={<TeacherPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
