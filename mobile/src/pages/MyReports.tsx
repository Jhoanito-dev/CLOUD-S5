import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonToggle,
  IonIcon,
  RefresherEventDetail,
} from '@ionic/react';
import { locationOutline, calendarOutline, cashOutline, imageOutline } from 'ionicons/icons';
import { useAuth } from '../context/AuthContext';
import { getReports, getReportsByUser, Report as FirestoreReport } from '../services/firestore';

interface Report {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  surface?: number | null;
  budget?: number | null;
  company?: string;
  niveau?: number | null;
  status: string;
  created_at: any;
  user_uid?: string;
  photos?: string[];
}

const MyReports: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, [showOnlyMine, user]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('MyReports: Fetching reports...', { showOnlyMine, userUid: user?.uid });
      
      let firestoreReports: FirestoreReport[];
      
      if (showOnlyMine && user) {
        console.log('MyReports: Fetching only my reports for user:', user.uid);
        firestoreReports = await getReportsByUser(user.uid, 50);
      } else {
        console.log('MyReports: Fetching all reports');
        firestoreReports = await getReports(50);
      }
      
      console.log('MyReports: Fetched', firestoreReports.length, 'reports');
      setReports(firestoreReports as unknown as Report[]);
    } catch (err: any) {
      console.error('MyReports: Error fetching reports:', err);
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await fetchReports();
    event.detail.complete();
  };

  const getStatusBadge = (status: string) => {
    const config = {
      new: { color: 'danger', label: 'Nouveau' },
      in_progress: { color: 'warning', label: 'En cours' },
      done: { color: 'success', label: 'Terminé' },
    };
    const { color, label } = config[status as keyof typeof config] || { color: 'medium', label: status };
    return <IonBadge color={color}>{label}</IonBadge>;
  };

  const formatDate = (dateValue: any) => {
    // Handle Firestore Timestamp or string
    let date: Date;
    if (dateValue?.toDate) {
      date = dateValue.toDate();
    } else if (dateValue?.seconds) {
      date = new Date(dateValue.seconds * 1000);
    } else {
      date = new Date(dateValue);
    }
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding ion-text-center">
          <IonSpinner />
          <p>Chargement...</p>
        </IonContent>
      </IonPage>
    );
  }

  if (error) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Mes signalements</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding ion-text-center">
          <p style={{ color: 'red' }}>Erreur: {error}</p>
          <button onClick={fetchReports} style={{ padding: '10px 20px', marginTop: '10px' }}>
            Réessayer
          </button>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Mes signalements</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonItem>
          <IonLabel>Afficher uniquement mes signalements</IonLabel>
          <IonToggle
            checked={showOnlyMine}
            onIonChange={(e) => setShowOnlyMine(e.detail.checked)}
          />
        </IonItem>

        {reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            <p>Aucun signalement trouvé</p>
          </div>
        ) : (
          <IonList>
            {reports.map((report) => (
              <IonItem key={report.id} lines="full">
                <div style={{ width: '100%', padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong>Signalement #{report.id}</strong>
                    {getStatusBadge(report.status)}
                  </div>
                  
                  {report.description && (
                    <p style={{ margin: '8px 0', color: '#333' }}>{report.description}</p>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '14px', color: '#666' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IonIcon icon={calendarOutline} />
                      {formatDate(report.created_at)}
                    </span>
                    
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <IonIcon icon={locationOutline} />
                      {Number(report.latitude).toFixed(4)}, {Number(report.longitude).toFixed(4)}
                    </span>
                    
                    {report.surface && (
                      <span>{report.surface} m²</span>
                    )}

                    {report.niveau && (
                      <span>Niveau: <strong>{report.niveau}/10</strong></span>
                    )}
                    
                    {report.budget && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={cashOutline} />
                        {report.budget.toLocaleString('fr-FR')} Ar
                      </span>
                    )}
                  </div>

                  {report.company && (
                    <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#666' }}>
                      Entreprise: {report.company}
                    </p>
                  )}

                  {/* Photos gallery */}
                  {report.photos && report.photos.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px', fontSize: '14px', color: '#666' }}>
                        <IonIcon icon={imageOutline} />
                        <span>{report.photos.length} photo(s)</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                        {report.photos.map((photoUrl, index) => (
                          <img
                            key={index}
                            src={photoUrl}
                            alt={`Photo ${index + 1}`}
                            style={{
                              width: '80px',
                              height: '80px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              flexShrink: 0,
                            }}
                            onClick={() => window.open(photoUrl, '_blank')}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default MyReports;
