import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useSettingsStore } from '../../store/useSettingsStore';

export function MainLayout() {
  const theme = useSettingsStore(s => s.theme);
  const loaded = useSettingsStore(s => s.loaded);

  useEffect(() => {
    useSettingsStore.getState().loadSettings();
    // Fire-and-forget startup reconciliation
    import('../../lib/reconcileProjects').then(m => m.reconcileOrphanedBackendProjects());
  }, []);

  // Apply dark mode class to html
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[var(--color-bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
