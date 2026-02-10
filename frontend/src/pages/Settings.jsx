import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw } from 'lucide-react';
import api from '../services/api';

function Settings() {
  const [prixParM2, setPrixParM2] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/api/settings/prix_par_m2');
      setPrixParM2(response.data.prix_par_m2.toString());
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.put('/api/settings/prix_par_m2', { value: parseFloat(prixParM2) });
      setMessage('✅ Prix par m² mis à jour avec succès');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('❌ Erreur: ' + (error.response?.data?.error || 'Impossible de sauvegarder'));
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setSaving(false);
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
      <div className="flex items-center space-x-3">
        <SettingsIcon className="w-8 h-8 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
      </div>

      <div className="bg-white shadow rounded-lg p-6 max-w-xl">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Configuration du budget</h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Formule :</strong> Budget = prix_par_m² × niveau × surface
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Le budget est automatiquement calculé lors de la création ou modification d'un signalement
            si le niveau et la surface sont renseignés.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix par m² (Ariary)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={prixParM2}
              onChange={(e) => setPrixParM2(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-lg"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Valeur actuelle : {parseFloat(prixParM2 || 0).toLocaleString('fr-FR')} Ar/m²
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Exemple de calcul</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Surface = 100 m², Niveau = 5</p>
              <p className="font-semibold text-gray-900">
                Budget = {parseFloat(prixParM2 || 0).toLocaleString('fr-FR')} × 5 × 100 = {(parseFloat(prixParM2 || 0) * 5 * 100).toLocaleString('fr-FR')} Ar
              </p>
            </div>
          </div>

          {message && (
            <div className={`p-3 rounded-md text-sm ${message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message}
            </div>
          )}

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Settings;
