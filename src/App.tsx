import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { LandingPage } from './components/pages/LandingPage';
import { ConversationView } from './components/pages/ConversationView';
import { SettingsPage } from './components/pages/SettingsPage';
import { ProjectDetailPage } from './components/pages/ProjectDetailPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="c/:conversationId" element={<ConversationView />} />
          <Route path="settings/:section?" element={<SettingsPage />} />
          <Route path="project/:projectId" element={<ProjectDetailPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
