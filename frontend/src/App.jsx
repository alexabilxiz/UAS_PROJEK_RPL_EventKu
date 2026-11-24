import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccountPage from './pages/AccountPage';
import AccountHelpPage, { ResetPasswordPage } from './pages/AccountHelpPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import EventCatalogPage from './pages/EventCatalogPage';
import EventCalendarPage from './pages/EventCalendarPage';
import EventDetailPage from './pages/EventDetailPage';
import EventSubmissionPage from './pages/EventSubmissionPage';
import EventModerationPage from './pages/EventModerationPage';
import AdminOrganizationsPage from './pages/AdminOrganizationsPage';
import AdminCategoriesPage from './pages/AdminCategoriesPage';
import OrganizerNotificationsPage from './pages/OrganizerNotificationsPage';
import OrganizerEventsPage from './pages/OrganizerEventsPage';
import EventParticipantsPage from './pages/EventParticipantsPage';
import OrganizerManageEventPage from './pages/OrganizerManageEventPage';
import { AdminUsersPage, ModerationHistoryPage, PublishedEventsPage } from './pages/AdminToolsPage';
import { StudentDemoMailPage, StudentFavoritesPage, StudentNotificationsPage, StudentPreferencesPage, StudentReviewPage } from './pages/StudentActivityPage';
import WorkspaceStatisticsPage from './pages/WorkspaceStatisticsPage';
import RegistrationsPage from './pages/RegistrationsPage';
import EventRegistration from './components/EventRegistration';
import PageShell from './components/PageShell';
import RoleRoute from './routes/RoleRoute';

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/bantuan-akun" element={<AccountHelpPage />} />
    <Route path="/atur-ulang-kata-sandi" element={<ResetPasswordPage />} />
    <Route path="/events" element={<EventCatalogPage />} />
    <Route path="/events/calendar" element={<EventCalendarPage />} />
    <Route path="/events/:eventId" element={<EventDetailPage renderRegistration={(event) => <EventRegistration key={event.eventId} event={event} />} />} />
    <Route element={<RoleRoute />}>
      <Route path="/dashboard" element={<AccountPage />} />
      <Route path="/akun/pengaturan" element={<AccountSettingsPage />} />
    </Route>
    <Route element={<RoleRoute roles={['penyelenggara']} />}>
      <Route path="/penyelenggara/event/ajukan" element={<EventSubmissionPage />} />
      <Route path="/penyelenggara/event" element={<OrganizerEventsPage />} />
      <Route path="/penyelenggara/event/:eventId/peserta" element={<EventParticipantsPage />} />
      <Route path="/penyelenggara/event/:eventId/kelola" element={<OrganizerManageEventPage />} />
      <Route path="/penyelenggara/notifikasi" element={<OrganizerNotificationsPage />} />
      <Route path="/penyelenggara/statistik" element={<WorkspaceStatisticsPage />} />
    </Route>
    <Route element={<RoleRoute roles={['mahasiswa']} />}>
      <Route path="/mahasiswa/pendaftaran" element={<RegistrationsPage />} />
      <Route path="/mahasiswa/minat" element={<StudentPreferencesPage />} />
      <Route path="/mahasiswa/notifikasi" element={<StudentNotificationsPage />} />
      {import.meta.env.DEV && import.meta.env.MODE === 'demo' && <Route path="/mahasiswa/email-demo" element={<StudentDemoMailPage />} />}
      <Route path="/mahasiswa/favorit" element={<StudentFavoritesPage />} />
      <Route path="/mahasiswa/ulasan/:eventId" element={<StudentReviewPage />} />
    </Route>
    <Route element={<RoleRoute roles={['admin']} />}>
      <Route path="/admin/moderasi" element={<EventModerationPage />} />
      <Route path="/admin/moderasi/riwayat" element={<ModerationHistoryPage />} />
      <Route path="/admin/moderasi/tayang" element={<PublishedEventsPage />} />
      <Route path="/admin/organisasi" element={<AdminOrganizationsPage />} />
      <Route path="/admin/kategori" element={<AdminCategoriesPage />} />
      <Route path="/admin/pengguna" element={<AdminUsersPage />} />
      <Route path="/admin/statistik" element={<WorkspaceStatisticsPage key="admin" admin />} />
    </Route>
    {['mahasiswa', 'penyelenggara', 'admin'].map((role) => <Route key={role} element={<RoleRoute roles={[role]} />}><Route path={`/${role}`} element={<AccountPage rolePage={role} />} /></Route>)}
    <Route path="*" element={<PageShell><section className="status-panel"><p className="eyebrow">404</p><h1>Halaman tidak ditemukan</h1><p>Periksa kembali alamat halaman yang Anda buka.</p><Link className="primary-button" to="/">Kembali ke beranda</Link></section></PageShell>} />
  </Routes>;
}
