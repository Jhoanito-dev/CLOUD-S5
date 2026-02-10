import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Map, 
  FileWarning, 
  User, 
  LogOut, 
  RefreshCw,
  Users,
  UserX,
  Settings
} from 'lucide-react';
import { useState } from 'react';
import api from '../services/api';

function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const response = await api.get('/api/sync/firebase');
      setSyncMessage(`Sync: ${response.data.imported} importé(s), ${response.data.updated} mis à jour`);
      setTimeout(() => setSyncMessage(''), 3000);
    } catch (error) {
      setSyncMessage(error.response?.data?.message || 'Erreur de synchronisation');
      setTimeout(() => setSyncMessage(''), 3000);
    } finally {
      setSyncing(false);
    }
  };

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { path: '/reports', icon: FileWarning, label: 'Signalements' },
    { path: '/map', icon: Map, label: 'Carte' },
    { path: '/profile', icon: User, label: 'Profil' },
  ];

  if (user?.role === 'manager') {
    navItems.push({ path: '/users', icon: Users, label: 'Utilisateurs' });
    navItems.push({ path: '/blocked-users', icon: UserX, label: 'Débloquer' });
    navItems.push({ path: '/settings', icon: Settings, label: 'Paramètres' });
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/dashboard" className="text-xl font-bold text-blue-600">
                  🛣️ Travaux Routiers
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                        isActive
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {syncMessage && (
                <span className={`text-sm ${syncMessage.includes('Erreur') ? 'text-red-600' : 'text-green-600'}`}>
                  {syncMessage}
                </span>
              )}
              {user?.role === 'manager' && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center px-3 py-2 border border-blue-600 text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 disabled:opacity-50"
                  title="Synchroniser les signalements depuis Firebase"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  Synchroniser
                </button>
              )}
              <span className="text-sm text-gray-600">
                {user?.first_name} {user?.last_name}
                <span className="ml-2 px-2 py-1 text-xs bg-gray-200 rounded">
                  {user?.role}
                </span>
              </span>
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
