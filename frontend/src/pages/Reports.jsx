import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, MapPin, X, Edit, Image } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function LocationPicker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} /> : null;
}

function Reports() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showPhotosModal, setShowPhotosModal] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(null);
  const [statusModalData, setStatusModalData] = useState({ status: '', repair_level: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [statusFilter, setStatusFilter] = useState('');
  const [position, setPosition] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    surface: '',
    budget: '',
    company: '',
  });
  const [editFormData, setEditFormData] = useState({
    description: '',
    surface: '',
    budget: '',
    company: '',
  });

  const isManager = user?.role === 'manager';

  useEffect(() => {
    fetchReports();
  }, [pagination.page, pagination.limit, sortConfig, statusFilter]);

  const fetchReports = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        sort: sortConfig.key,
        order: sortConfig.direction,
      });
      if (statusFilter) params.append('status', statusFilter);

      const response = await api.get(`/api/reports?${params}`);
      setReports(response.data.reports);
      setPagination(prev => ({ ...prev, total: response.data.pagination.total }));
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const openStatusModal = (report, newStatus) => {
    setShowStatusModal(report);
    setStatusModalData({ status: newStatus, repair_level: report.niveau || '' });
  };

  const handleStatusChange = async (e) => {
    e.preventDefault();
    if (!showStatusModal) return;
    try {
      const payload = { status: statusModalData.status };
      if (statusModalData.repair_level !== '' && statusModalData.repair_level !== null) {
        payload.repair_level = parseInt(statusModalData.repair_level);
      }
      await api.patch(`/api/reports/${showStatusModal.id}/status`, payload);
      setShowStatusModal(null);
      fetchReports();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/reports/${id}`);
      setShowDeleteConfirm(null);
      fetchReports();
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const openEditModal = (report) => {
    setEditingReport(report);
    setEditFormData({
      description: report.description || '',
      surface: report.surface || '',
      budget: report.budget || '',
      company: report.company || '',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingReport) return;

    try {
      await api.put(`/api/reports/${editingReport.id}`, {
        description: editFormData.description,
        surface: editFormData.surface ? parseFloat(editFormData.surface) : null,
        budget: editFormData.budget ? parseFloat(editFormData.budget) : null,
        company: editFormData.company,
      });
      setShowEditModal(false);
      setEditingReport(null);
      fetchReports();
    } catch (error) {
      console.error('Error updating report:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!position) return;

    try {
      await api.post('/api/reports', {
        latitude: position[0],
        longitude: position[1],
        ...formData,
        surface: formData.surface ? parseFloat(formData.surface) : null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
      });
      setShowModal(false);
      setPosition(null);
      setFormData({ description: '', surface: '', budget: '', company: '' });
      fetchReports();
    } catch (error) {
      console.error('Error creating report:', error);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      new: 'bg-red-100 text-red-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      done: 'bg-green-100 text-green-800',
    };
    const labels = { new: 'Nouveau', in_progress: 'En cours', done: 'Terminé' };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline" /> : 
      <ChevronDown className="w-4 h-4 inline" />;
  };

  // Parse photos from string or array
  const parsePhotos = (photoData) => {
    if (!photoData) return [];
    if (Array.isArray(photoData)) return photoData;
    try {
      return JSON.parse(photoData);
    } catch {
      return [photoData];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Signalements</h1>
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Tous les statuts</option>
            <option value="new">Nouveau</option>
            <option value="in_progress">En cours</option>
            <option value="done">Terminé</option>
          </select>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau signalement
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                onClick={() => handleSort('created_at')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
              >
                Date <SortIcon column="created_at" />
              </th>
              <th 
                onClick={() => handleSort('status')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
              >
                Statut <SortIcon column="status" />
              </th>
              <th 
                onClick={() => handleSort('surface')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
              >
                Surface (m²) <SortIcon column="surface" />
              </th>
              <th 
                onClick={() => handleSort('budget')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
              >
                Budget (Ar) <SortIcon column="budget" />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Entreprise
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Niveau réparation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Dates étapes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Photos
              </th>
              {isManager && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(report.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(report.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.surface?.toLocaleString('fr-FR') || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.budget?.toLocaleString('fr-FR') || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.company || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {report.niveau ? (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      report.niveau <= 3 ? 'bg-green-100 text-green-800' :
                      report.niveau <= 6 ? 'bg-yellow-100 text-yellow-800' :
                      report.niveau <= 8 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {report.niveau}/10
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-xs text-gray-500">
                  <div className="space-y-0.5">
                    {report.date_nouveau && (
                      <div><span className="text-red-600 font-medium">Nouveau:</span> {new Date(report.date_nouveau).toLocaleDateString('fr-FR')}</div>
                    )}
                    {report.date_en_cours && (
                      <div><span className="text-yellow-600 font-medium">En cours:</span> {new Date(report.date_en_cours).toLocaleDateString('fr-FR')}</div>
                    )}
                    {report.date_termine && (
                      <div><span className="text-green-600 font-medium">Terminé:</span> {new Date(report.date_termine).toLocaleDateString('fr-FR')}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {parsePhotos(report.photo_url).length > 0 ? (
                    <button
                      onClick={() => setShowPhotosModal(report)}
                      className="inline-flex items-center text-blue-600 hover:text-blue-800"
                    >
                      <Image className="w-4 h-4 mr-1" />
                      {parsePhotos(report.photo_url).length} photo(s)
                    </button>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                {isManager && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                    <button
                      onClick={() => openEditModal(report)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4 inline" />
                    </button>
                    {report.status !== 'in_progress' && (
                      <button
                        onClick={() => openStatusModal(report, 'in_progress')}
                        className="text-yellow-600 hover:text-yellow-800"
                      >
                        En cours
                      </button>
                    )}
                    {report.status !== 'done' && (
                      <button
                        onClick={() => openStatusModal(report, 'done')}
                        className="text-green-600 hover:text-green-800"
                      >
                        Terminé
                      </button>
                    )}
                    <button
                      onClick={() => setShowDeleteConfirm(report.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700">Afficher</span>
            <select
              value={pagination.limit}
              onChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <span className="text-sm text-gray-700">lignes</span>
          </div>
          <div className="text-sm text-gray-700">
            Total: {pagination.total} signalements
          </div>
        </div>
      </div>

      {/* Modal Nouveau signalement */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">Nouveau signalement</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="h-64 rounded-lg overflow-hidden border">
                <MapContainer
                  center={[-18.8792, 47.5079]}
                  zoom={13}
                  className="h-full w-full"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <LocationPicker position={position} setPosition={setPosition} />
                </MapContainer>
              </div>
              <p className="text-sm text-gray-600 flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                {position 
                  ? `Position: ${position[0].toFixed(6)}, ${position[1].toFixed(6)}`
                  : 'Cliquez sur la carte pour sélectionner la position'}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="3"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Surface (m²)</label>
                  <input
                    type="number"
                    value={formData.surface}
                    onChange={(e) => setFormData(prev => ({ ...prev, surface: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget (Ar)</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!position}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmation suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Êtes-vous sûr ?</h3>
            <p className="text-gray-600 mb-6">Cette action est irréversible.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modification signalement */}
      {showEditModal && editingReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">Modifier signalement #{editingReport.id}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="3"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Surface (m²)</label>
                  <input
                    type="number"
                    value={editFormData.surface}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, surface: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget (Ar)</label>
                  <input
                    type="number"
                    value={editFormData.budget}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, budget: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entreprise</label>
                <input
                  type="text"
                  value={editFormData.company}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, company: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Changement de statut */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">
                Changer le statut — Signalement #{showStatusModal.id}
              </h2>
              <button onClick={() => setShowStatusModal(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleStatusChange} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau statut</label>
                <select
                  value={statusModalData.status}
                  onChange={(e) => setStatusModalData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="new">Nouveau</option>
                  <option value="in_progress">En cours</option>
                  <option value="done">Terminé</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Niveau de réparation
                  {statusModalData.repair_level && (
                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      statusModalData.repair_level <= 3 ? 'bg-green-100 text-green-800' :
                      statusModalData.repair_level <= 6 ? 'bg-yellow-100 text-yellow-800' :
                      statusModalData.repair_level <= 8 ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {statusModalData.repair_level}/10
                    </span>
                  )}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={statusModalData.repair_level || 1}
                  onChange={(e) => setStatusModalData(prev => ({ ...prev, repair_level: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 — Mineur</span>
                  <span>5 — Moyen</span>
                  <span>10 — Critique</span>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Photos */}
      {showPhotosModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">
                Photos du signalement #{showPhotosModal.id}
              </h2>
              <button onClick={() => setShowPhotosModal(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {parsePhotos(showPhotosModal.photo_url).length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {parsePhotos(showPhotosModal.photo_url).map((photoUrl, index) => (
                    <a
                      key={index}
                      href={photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square overflow-hidden rounded-lg border hover:opacity-90 transition-opacity"
                    >
                      <img
                        src={photoUrl}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🖼️</text></svg>';
                        }}
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Aucune photo disponible</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
