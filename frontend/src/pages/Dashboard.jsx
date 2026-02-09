import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { FileWarning, Ruler, DollarSign, TrendingUp } from 'lucide-react';
import api from '../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [delays, setDelays] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [statsRes, delaysRes] = await Promise.all([
        api.get('/api/stats'),
        api.get('/api/stats/delays'),
      ]);
      setStats(statsRes.data);
      setDelays(delaysRes.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  const chartData = {
    labels: ['Nouveau', 'En cours', 'Terminé'],
    datasets: [
      {
        label: 'Nombre de signalements',
        data: stats ? [stats.by_status.new, stats.by_status.in_progress, stats.by_status.done] : [0, 0, 0],
        backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'],
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Signalements par statut' },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  const kpiCards = [
    {
      title: 'Total signalements',
      value: stats?.total_reports || 0,
      icon: FileWarning,
      color: 'bg-blue-500',
    },
    {
      title: 'Surface totale (m²)',
      value: stats?.total_surface?.toLocaleString('fr-FR') || '0',
      icon: Ruler,
      color: 'bg-purple-500',
    },
    {
      title: 'Budget total (Ar)',
      value: stats?.total_budget?.toLocaleString('fr-FR') || '0',
      icon: DollarSign,
      color: 'bg-green-500',
    },
    {
      title: 'Avancement',
      value: `${stats?.progress_percentage || 0}%`,
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <Link
          to="/reports"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          Voir tous les signalements
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <Bar data={chartData} options={chartOptions} />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Récapitulatif</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="text-red-700">Nouveau</span>
              <span className="font-bold text-red-700">{stats?.by_status.new || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
              <span className="text-yellow-700">En cours</span>
              <span className="font-bold text-yellow-700">{stats?.by_status.in_progress || 0}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-green-700">Terminé</span>
              <span className="font-bold text-green-700">{stats?.by_status.done || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques de délai moyen */}
      {delays && delays.total_completed > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">📊 Délai moyen de traitement</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">Nouveau → En cours</p>
              <p className="text-2xl font-bold text-red-700">{delays.avg_delay_nouveau_en_cours} jours</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">En cours → Terminé</p>
              <p className="text-2xl font-bold text-yellow-700">{delays.avg_delay_en_cours_termine} jours</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">Traitement total</p>
              <p className="text-2xl font-bold text-green-700">{delays.avg_delay_total} jours</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Basé sur {delays.total_completed} signalement(s) terminé(s)</p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
