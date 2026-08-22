import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AppToaster } from './components/AppToaster';
import { AuthProvider } from './context/AuthContext';
import { queryClient } from './lib/query-client';
import { AdminLoginLayout, PublicLayout } from './components/AppLayouts';
import { AdminDashboardLayout } from './components/admin/AdminDashboardLayout';
import {
  AdminGuestOnly,
  BlockAdminFromUserArea,
  BlockUserFromAdminArea,
  RequireAdmin,
  RequireUser,
} from './components/RequireRole';
import { LandingPage } from './pages/LandingPage';
import { TeacherPage } from './pages/TeacherPage';
import { CourseDetailPage, CoursesIndexPage, FreeCoursesPage } from './pages/CourseDetailPage';
import { CourseLearnPage } from './pages/CourseLearnPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { QuestionArticlePage } from './pages/QuestionArticlePage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage';
import { AdminCoursesPage } from './pages/admin/AdminCoursesPage';
import { AdminCourseDetailPage } from './pages/admin/AdminCourseDetailPage';
import { AdminTestsPage } from './pages/admin/AdminTestsPage';
import { AdminSectionPlaceholder } from './pages/admin/AdminSectionPlaceholder';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage';
import { AdminHeroPage } from './pages/admin/AdminHeroPage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppToaster />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route element={<BlockAdminFromUserArea />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/ustaz" element={<TeacherPage />} />
                <Route path="/questions" element={<QuestionsPage />} />
                <Route path="/questions/:articleId" element={<QuestionArticlePage />} />
                <Route path="/courses/free" element={<FreeCoursesPage />} />
                <Route path="/courses" element={<CoursesIndexPage />} />
                <Route path="/courses/:courseId/learn" element={<CourseLearnPage />} />
                <Route path="/courses/:courseId" element={<CourseDetailPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>

              <Route element={<RequireUser />}>
                <Route path="/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path="/admin" element={<AdminLoginLayout />}>
              <Route element={<BlockUserFromAdminArea />}>
                <Route
                  path="login"
                  element={
                    <AdminGuestOnly>
                      <AdminLoginPage />
                    </AdminGuestOnly>
                  }
                />
              </Route>

              <Route element={<RequireAdmin />}>
                <Route element={<AdminDashboardLayout />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="questions" element={<QuestionsPage adminMode />} />
                  <Route path="questions/:articleId" element={<QuestionArticlePage adminMode />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="users/:userId" element={<AdminUserDetailPage />} />
                  <Route path="courses" element={<AdminCoursesPage />} />
                  <Route path="courses/:courseRef" element={<AdminCourseDetailPage />} />
                  <Route path="lessons" element={<Navigate to="/admin/courses" replace />} />
                  <Route path="tests" element={<AdminTestsPage />} />
                  <Route
                    path="certificates"
                    element={<AdminSectionPlaceholder section="certificates" />}
                  />
                  <Route path="hadiths" element={<AdminSectionPlaceholder section="hadiths" />} />
                  <Route path="teacher" element={<AdminSectionPlaceholder section="teacher" />} />
                  <Route path="reviews" element={<AdminReviewsPage />} />
                  <Route path="hero" element={<AdminHeroPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="login" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
