import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Classes from './pages/Classes';
import Subjects from './pages/Subjects';
import AssessmentTypes from './pages/AssessmentTypes';
import TeacherAssignments from './pages/TeacherAssignments';
import Profile from './pages/Profile';
import AcademicYears from './pages/AcademicYears';
import Gradebook from './pages/Gradebook';
import Attendance from './pages/Attendance';
import ReportCards from './pages/ReportCards';
import Rankings from './pages/Rankings';
import AcademicHistory from './pages/AcademicHistory';
import Promotion from './pages/Promotion';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import BackupRestore from './pages/BackupRestore';
import UserManagement from './pages/UserManagement';
import ActivityLogPage from './pages/ActivityLogPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/teachers" element={<ProtectedRoute roles={['administrator', 'principal']}><Teachers /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute roles={['administrator', 'principal']}><Classes /></ProtectedRoute>} />
            <Route path="/subjects" element={<ProtectedRoute roles={['administrator', 'principal']}><Subjects /></ProtectedRoute>} />
            <Route path="/assessments" element={<ProtectedRoute roles={['administrator', 'principal']}><AssessmentTypes /></ProtectedRoute>} />
            <Route path="/assignments" element={<ProtectedRoute roles={['administrator', 'principal']}><TeacherAssignments /></ProtectedRoute>} />
            <Route path="/academic-years" element={<ProtectedRoute roles={['administrator', 'principal']}><AcademicYears /></ProtectedRoute>} />
            <Route path="/gradebook" element={<ProtectedRoute roles={['administrator', 'principal', 'teacher', 'academic_officer']}><Gradebook /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute roles={['administrator', 'principal', 'teacher', 'academic_officer']}><Attendance /></ProtectedRoute>} />
            <Route path="/report-cards" element={<ReportCards />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/academic-history" element={<AcademicHistory />} />
            <Route path="/promotion" element={<ProtectedRoute roles={['administrator', 'principal']}><Promotion /></ProtectedRoute>} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<ProtectedRoute roles={['administrator']}><Settings /></ProtectedRoute>} />
            <Route path="/backup" element={<ProtectedRoute roles={['administrator']}><BackupRestore /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['administrator']}><UserManagement /></ProtectedRoute>} />
            <Route path="/activity-log" element={<ProtectedRoute roles={['administrator', 'principal']}><ActivityLogPage /></ProtectedRoute>} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
