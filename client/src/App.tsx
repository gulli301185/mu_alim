import { BrowserRouter, Navigate, Routes, Route, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { TeacherPage } from './pages/TeacherPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseLearnPage } from './pages/CourseLearnPage';
import { QuestionsPage } from './pages/QuestionsPage';
import { QuestionArticlePage } from './pages/QuestionArticlePage';
import { ProfilePage } from './pages/ProfilePage';

function CourseLearnRedirect() {
  const { courseId } = useParams();
  return <Navigate to={`/courses/${courseId}/learn`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/ustaz" element={<TeacherPage />} />
            <Route path="/questions" element={<QuestionsPage />} />
            <Route path="/questions/:articleId" element={<QuestionArticlePage />} />
            <Route path="/courses" element={<CoursesPage />} />
            <Route path="/courses/:courseId/learn" element={<CourseLearnPage />} />
            <Route path="/courses/:courseId" element={<CourseLearnRedirect />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
