import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { queryClient } from './lib/query-client';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { TeacherPage } from './pages/TeacherPage';
import { CourseDetailPage, CoursesIndexPage } from './pages/CourseDetailPage';
import { CourseLearnPage } from './pages/CourseLearnPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { QuestionArticlePage } from './pages/QuestionArticlePage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/ustaz" element={<TeacherPage />} />
              <Route path="/questions" element={<QuestionsPage />} />
              <Route path="/questions/:articleId" element={<QuestionArticlePage />} />
              <Route path="/courses" element={<CoursesIndexPage />} />
              <Route path="/courses/:courseId" element={<CourseDetailPage />} />
              <Route path="/courses/:courseId/learn" element={<CourseLearnPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
