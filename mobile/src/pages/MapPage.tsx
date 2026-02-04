import React, { useState, useEffect, useRef } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import { logOutOutline, locationOutline, locateOutline, navigateOutline } from 'ionicons/icons';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { useAuth } from '../context/AuthContext';
import { getReports, addReport, subscribeToReports, Report as FirestoreReport } from '../services/firestore';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Report {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  surface?: number | null;
  budget?: number | null;
  company?: string;
  status: string;
  created_at: any;
}

const LocationPicker: React.FC<{ onLocationSelect: (lat: number, lng: number) => void }> = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Component to fly to a location
const FlyToLocation: React.FC<{ position: [number, number] | null; zoom?: number }> = ({ position, zoom = 16 }) => {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom, { duration: 1.5 });
    }
  }, [position, map, zoom]);
  
  return null;
};

// Component to fix map size issue
const MapResizer: React.FC = () => {
  const map = useMap();
  
  useEffect(() => {
    // Fix for map not rendering correctly
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    // Also invalidate on window resize
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);
  
  return null;
};

// User location marker (blue dot)
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const MapPage: React.FC = () => {
  const { logout, user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [flyToPosition, setFlyToPosition] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    surface: '',
    budget: '',
    company: '',
  });
  const [present] = useIonToast();

  useEffect(() => {
    // Subscribe to real-time updates from Firestore
    console.log('Subscribing to Firestore reports...');
    const unsubscribe = subscribeToReports((firestoreReports) => {
      console.log('Received', firestoreReports.length, 'reports from Firestore');
      setReports(firestoreReports as unknown as Report[]);
      setLoading(false);
    }, 100);

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Get current geolocation
  const getCurrentLocation = async () => {
    setLocating(true);
    try {
      // Try Capacitor first, fallback to browser API
      let coords: [number, number];
      
      try {
        const permissionStatus = await Geolocation.checkPermissions();
        
        if (permissionStatus.location !== 'granted') {
          const requestResult = await Geolocation.requestPermissions();
          if (requestResult.location !== 'granted') {
            throw new Error('Permission refusée');
          }
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        
        coords = [position.coords.latitude, position.coords.longitude];
      } catch (capacitorError) {
        // Fallback to browser geolocation API
        console.log('Capacitor geolocation failed, using browser API');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        coords = [position.coords.latitude, position.coords.longitude];
      }
      
      setUserLocation(coords);
      setFlyToPosition(coords);
      
      present({
        message: 'Position trouvée',
        duration: 1500,
        color: 'success',
      });
    } catch (error: any) {
      console.error('Geolocation error:', error);
      present({
        message: error.message || 'Impossible d\'obtenir la position',
        duration: 2000,
        color: 'danger',
      });
    } finally {
      setLocating(false);
    }
  };

  // Use current location for new report
  const useLocationForReport = async () => {
    setLocating(true);
    try {
      let coords: [number, number];
      
      try {
        const permissionStatus = await Geolocation.checkPermissions();
        
        if (permissionStatus.location !== 'granted') {
          const requestResult = await Geolocation.requestPermissions();
          if (requestResult.location !== 'granted') {
            throw new Error('Permission refusée');
          }
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        
        coords = [position.coords.latitude, position.coords.longitude];
      } catch (capacitorError) {
        // Fallback to browser geolocation API
        console.log('Capacitor geolocation failed, using browser API');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        coords = [position.coords.latitude, position.coords.longitude];
      }
      
      setUserLocation(coords);
      setSelectedPosition(coords);
      setFlyToPosition(coords);
      setShowModal(true);
      
      present({
        message: 'Position actuelle sélectionnée',
        duration: 1500,
        color: 'success',
      });
    } catch (error: any) {
      console.error('Geolocation error:', error);
      present({
        message: error.message || 'Impossible d\'obtenir la position',
        duration: 2000,
        color: 'danger',
      });
    } finally {
      setLocating(false);
    }
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    setSelectedPosition([lat, lng]);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!selectedPosition || !user) return;

    try {
      // Add report directly to Firestore
      const reportId = await addReport({
        latitude: selectedPosition[0],
        longitude: selectedPosition[1],
        description: formData.description,
        surface: formData.surface ? parseFloat(formData.surface) : null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        company: formData.company,
        status: 'new',
        user_uid: user.uid,
        user_email: user.email || '',
      });

      if (reportId) {
        present({
          message: 'Signalement créé avec succès',
          duration: 2000,
          color: 'success',
        });

        setShowModal(false);
        setSelectedPosition(null);
        setFormData({ description: '', surface: '', budget: '', company: '' });
        // No need to fetch - subscribeToReports will auto-update
      } else {
        throw new Error('Failed to add report');
      }
    } catch (error) {
      console.error('Error creating report:', error);
      present({
        message: 'Erreur lors de la création',
        duration: 2000,
        color: 'danger',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return '#ef4444';
      case 'in_progress': return '#f59e0b';
      case 'done': return '#22c55e';
      default: return '#3b82f6';
    }
  };

  const createIcon = (color: string) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding ion-text-center">
          <IonSpinner />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Carte</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={logout}>
              <IonIcon icon={logOutOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div style={{ height: 'calc(100vh - 56px)', width: '100%', position: 'relative' }}>
          <MapContainer
            center={[-18.8792, 47.5079]}
            zoom={13}
            style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />
            <MapResizer />
            <LocationPicker onLocationSelect={handleLocationSelect} />
            <FlyToLocation position={flyToPosition} />
            {/* User location marker */}
            {userLocation && (
              <Marker position={userLocation} icon={userLocationIcon}>
                <Popup>Ma position</Popup>
              </Marker>
            )}
            {reports.map((report) => (
              <Marker
                key={report.id}
                position={[report.latitude, report.longitude]}
                icon={createIcon(getStatusColor(report.status))}
              >
                <Popup>
                  <div>
                    <strong>#{report.id}</strong>
                    <p>{report.description || 'Aucune description'}</p>
                    {report.surface && <p>Surface: {report.surface} m²</p>}
                    {report.budget && <p>Budget: {report.budget} Ar</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
            {selectedPosition && (
              <Marker position={selectedPosition} />
            )}
          </MapContainer>
        </div>

        {/* Action buttons - using native buttons for React compatibility */}
        <div style={{
          position: 'absolute',
          bottom: '80px',
          right: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 1000,
        }}>
          <button
            onClick={getCurrentLocation}
            disabled={locating}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: locating ? '#93c5fd' : '#3b82f6',
              border: 'none',
              color: 'white',
              cursor: locating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            }}
            title="Ma position"
          >
            <IonIcon icon={locateOutline} style={{ fontSize: '24px' }} />
          </button>
          <button
            onClick={useLocationForReport}
            disabled={locating}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: locating ? '#86efac' : '#22c55e',
              border: 'none',
              color: 'white',
              cursor: locating ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            }}
            title="Signaler à ma position"
          >
            <IonIcon icon={navigateOutline} style={{ fontSize: '24px' }} />
          </button>
        </div>

        {/* Loading indicator for geolocation */}
        {locating && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255,255,255,0.9)',
            padding: '20px',
            borderRadius: '10px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}>
            <IonSpinner />
            <span>Localisation en cours...</span>
          </div>
        )}

        {/* Custom Modal - using conditional render to avoid Ionic/React compatibility issues */}
        {showModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '400px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Nouveau signalement</h2>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#6b7280',
                  }}
                >
                  ×
                </button>
              </div>
              
              {/* Modal Content */}
              <div style={{ padding: '16px' }}>
                {selectedPosition && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}>
                    <IonIcon icon={locationOutline} style={{ fontSize: '20px', color: '#3b82f6' }} />
                    <span>Position: {selectedPosition[0].toFixed(6)}, {selectedPosition[1].toFixed(6)}</span>
                  </div>
                )}
                {!selectedPosition && (
                  <p style={{ textAlign: 'center', color: '#666', marginBottom: '16px' }}>
                    Cliquez sur la carte pour sélectionner une position
                  </p>
                )}

                {/* Form fields using native inputs */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: '#374151' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: '#374151' }}>
                    Surface (m²)
                  </label>
                  <input
                    type="number"
                    value={formData.surface}
                    onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: '#374151' }}>
                    Budget (Ar)
                  </label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, color: '#374151' }}>
                    Entreprise
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!selectedPosition}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: selectedPosition ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: selectedPosition ? 'pointer' : 'not-allowed',
                  }}
                >
                  Créer le signalement
                </button>
              </div>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default MapPage;
