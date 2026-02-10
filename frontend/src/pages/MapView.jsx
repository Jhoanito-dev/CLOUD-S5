import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { FileWarning, Ruler, DollarSign, TrendingUp, LogIn, Image } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;

const createIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

const icons = {
  new: createIcon('#ef4444'),
  in_progress: createIcon('#f59e0b'),
  done: createIcon('#22c55e'),
};

function MapView() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tileUrl, setTileUrl] = useState('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');

  useEffect(() => {
    fetchData();
  }, []);

  // Gestion du fallback entre tuiles offline et online
  useEffect(() => {
    const offlineUrl = 'http://localhost:3000/tiles/{z}/{x}/{y}.png';
    fetch(offlineUrl.replace('{z}', '13').replace('{x}', '4821').replace('{y}', '3142'))
      .then((res) => {
        if (res.ok) {
          setTileUrl(offlineUrl);
        }
      })
      .catch(() => {
        // Garde l'URL OpenStreetMap par défaut
      });
  }, []);

  const fetchData = async () => {
    try {
      const [reportsRes, statsRes] = await Promise.all([
        api.get('/api/reports?limit=100'),
        api.get('/api/stats'),
      ]);
      setReports(reportsRes.data.reports);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status) => {
    const labels = { new: 'Nouveau', in_progress: 'En cours', done: 'Terminé' };
    return labels[status];
  };

  if (loading || !tileUrl) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">
          🛣️ Travaux Routiers - Antananarivo
        </h1>
        <div className="flex items-center space-x-4">
          {user ? (
            <Link
              to="/dashboard"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Se connecter
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Map */}
        <div className="flex-1">
          <MapContainer
            center={[-18.8792, 47.5079]}
            zoom={13}
            className="h-full w-full"
          >
            <TileLayer
              url={tileUrl}
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {reports.filter((report) => report.latitude != null && report.longitude != null && !isNaN(parseFloat(report.latitude)) && !isNaN(parseFloat(report.longitude))).map((report) => (
              <Marker
                key={report.id}
                position={[parseFloat(report.latitude), parseFloat(report.longitude)]}
                icon={icons[report.status] || icons['new']}
              >
                <Popup>
                  <div className="min-w-48">
                    <div className="font-semibold text-gray-900 mb-2">
                      Signalement #{report.id}
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><strong>Date:</strong> {new Date(report.created_at).toLocaleDateString('fr-FR')}</p>
                      <p>
                        <strong>Statut:</strong>{' '}
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          report.status === 'new' ? 'bg-red-100 text-red-800' :
                          report.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {getStatusLabel(report.status)}
                        </span>
                      </p>
                      {report.surface && <p><strong>Surface:</strong> {report.surface.toLocaleString('fr-FR')} m²</p>}
                      {report.budget && <p><strong>Budget:</strong> {report.budget.toLocaleString('fr-FR')} Ar</p>}
                      {report.company && <p><strong>Entreprise:</strong> {report.company}</p>}
                      {(report.date_nouveau || report.date_en_cours || report.date_termine) && (
                        <div className="mt-1 pt-1 border-t border-dashed">
                          <p className="font-semibold text-xs text-gray-500 mb-0.5">Historique :</p>
                          {report.date_nouveau && <p className="text-xs"><span className="text-red-600">●</span> Nouveau: {new Date(report.date_nouveau).toLocaleDateString('fr-FR')}</p>}
                          {report.date_en_cours && <p className="text-xs"><span className="text-yellow-600">●</span> En cours: {new Date(report.date_en_cours).toLocaleDateString('fr-FR')}</p>}
                          {report.date_termine && <p className="text-xs"><span className="text-green-600">●</span> Terminé: {new Date(report.date_termine).toLocaleDateString('fr-FR')}</p>}
                        </div>
                      )}
                      {report.description && (
                        <p className="mt-2 text-gray-600">{report.description}</p>
                      )}
                      {report.photo_url && (
                        <div className="mt-2 pt-2 border-t">
                          <a 
                            href={typeof report.photo_url === 'string' && report.photo_url.startsWith('[') ? JSON.parse(report.photo_url)[0] : report.photo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
                          >
                            <Image className="w-4 h-4 mr-1" />
                            Voir les photos
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Sidebar Stats */}
        <div className="w-80 bg-white shadow-lg p-4 overflow-auto">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Récapitulatif</h2>
          
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FileWarning className="w-8 h-8 text-blue-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Total signalements</p>
                  <p className="text-2xl font-bold text-gray-900">{stats?.total_reports || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center">
                <Ruler className="w-8 h-8 text-purple-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Surface totale</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.total_surface?.toLocaleString('fr-FR') || 0} m²
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <DollarSign className="w-8 h-8 text-green-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Budget total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.total_budget?.toLocaleString('fr-FR') || 0} Ar
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-orange-500" />
                <div className="ml-3">
                  <p className="text-sm text-gray-600">Avancement</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats?.progress_percentage || 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Par statut</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-sm">Nouveau</span>
                </div>
                <span className="font-semibold">{stats?.by_status?.new || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                  <span className="text-sm">En cours</span>
                </div>
                <span className="font-semibold">{stats?.by_status?.in_progress || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm">Terminé</span>
                </div>
                <span className="font-semibold">{stats?.by_status?.done || 0}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Légende</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
                Nouveau problème
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-yellow-500 mr-2"></div>
                Travaux en cours
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
                Travaux terminés
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapView;
