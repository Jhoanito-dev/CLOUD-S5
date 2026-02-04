import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
  RefresherEventDetail,
} from '@ionic/react';
import { 
  alertCircleOutline, 
  constructOutline, 
  checkmarkCircleOutline,
  mapOutline,
  cashOutline,
  trendingUpOutline,
  layersOutline
} from 'ionicons/icons';
import { getReports, Report } from '../services/firestore';

interface Stats {
  total_reports: number;
  total_surface: number;
  total_budget: number;
  progress_percentage: number;
  by_status: {
    new: number;
    in_progress: number;
    done: number;
  };
}

const Stats: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch all reports from Firestore and calculate stats client-side
      const reports = await getReports(500);
      console.log('Stats: Fetched', reports.length, 'reports from Firestore');
      
      // Calculate stats from reports
      const calculatedStats: Stats = {
        total_reports: reports.length,
        total_surface: reports.reduce((sum, r) => sum + (r.surface || 0), 0),
        total_budget: reports.reduce((sum, r) => sum + (r.budget || 0), 0),
        progress_percentage: 0,
        by_status: {
          new: reports.filter(r => r.status === 'new').length,
          in_progress: reports.filter(r => r.status === 'in_progress').length,
          done: reports.filter(r => r.status === 'done').length,
        }
      };
      
      // Calculate progress percentage (done / total * 100)
      if (calculatedStats.total_reports > 0) {
        calculatedStats.progress_percentage = Math.round(
          (calculatedStats.by_status.done / calculatedStats.total_reports) * 100
        );
      }
      
      console.log('Stats calculated:', calculatedStats);
      setStats(calculatedStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await fetchStats();
    event.detail.complete();
  };

  const formatNumber = (num: number) => {
    return num?.toLocaleString('fr-FR') || '0';
  };

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Récapitulatif</IonTitle>
          </IonToolbar>
        </IonHeader>
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
          <IonTitle>Récapitulatif</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: '16px' }}>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {/* Total signalements */}
            <IonCard style={{ margin: 0 }}>
              <IonCardContent style={{ textAlign: 'center', padding: '16px' }}>
                <IonIcon icon={mapOutline} style={{ fontSize: '32px', color: '#3b82f6' }} />
                <h2 style={{ margin: '8px 0 4px', fontSize: '24px', fontWeight: 'bold' }}>
                  {formatNumber(stats?.total_reports || 0)}
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Total signalements</p>
              </IonCardContent>
            </IonCard>

            {/* Surface totale */}
            <IonCard style={{ margin: 0 }}>
              <IonCardContent style={{ textAlign: 'center', padding: '16px' }}>
                <IonIcon icon={layersOutline} style={{ fontSize: '32px', color: '#8b5cf6' }} />
                <h2 style={{ margin: '8px 0 4px', fontSize: '24px', fontWeight: 'bold' }}>
                  {formatNumber(stats?.total_surface || 0)}
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Surface (m²)</p>
              </IonCardContent>
            </IonCard>

            {/* Budget total */}
            <IonCard style={{ margin: 0 }}>
              <IonCardContent style={{ textAlign: 'center', padding: '16px' }}>
                <IonIcon icon={cashOutline} style={{ fontSize: '32px', color: '#22c55e' }} />
                <h2 style={{ margin: '8px 0 4px', fontSize: '24px', fontWeight: 'bold' }}>
                  {formatNumber(stats?.total_budget || 0)}
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Budget (Ar)</p>
              </IonCardContent>
            </IonCard>

            {/* Avancement */}
            <IonCard style={{ margin: 0 }}>
              <IonCardContent style={{ textAlign: 'center', padding: '16px' }}>
                <IonIcon icon={trendingUpOutline} style={{ fontSize: '32px', color: '#f59e0b' }} />
                <h2 style={{ margin: '8px 0 4px', fontSize: '24px', fontWeight: 'bold' }}>
                  {stats?.progress_percentage || 0}%
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Avancement</p>
              </IonCardContent>
            </IonCard>
          </div>

          {/* Status breakdown */}
          <IonCard>
            <IonCardContent>
              <h3 style={{ margin: '0 0 16px', fontWeight: 'bold' }}>Par statut</h3>
              
              {/* Nouveau */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px',
                background: '#fef2f2',
                borderRadius: '8px',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={alertCircleOutline} style={{ color: '#ef4444', fontSize: '24px' }} />
                  <span style={{ color: '#ef4444', fontWeight: '500' }}>Nouveau</span>
                </div>
                <span style={{ fontWeight: 'bold', color: '#ef4444', fontSize: '18px' }}>
                  {stats?.by_status?.new || 0}
                </span>
              </div>

              {/* En cours */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px',
                background: '#fffbeb',
                borderRadius: '8px',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={constructOutline} style={{ color: '#f59e0b', fontSize: '24px' }} />
                  <span style={{ color: '#f59e0b', fontWeight: '500' }}>En cours</span>
                </div>
                <span style={{ fontWeight: 'bold', color: '#f59e0b', fontSize: '18px' }}>
                  {stats?.by_status?.in_progress || 0}
                </span>
              </div>

              {/* Terminé */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '12px',
                background: '#f0fdf4',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={checkmarkCircleOutline} style={{ color: '#22c55e', fontSize: '24px' }} />
                  <span style={{ color: '#22c55e', fontWeight: '500' }}>Terminé</span>
                </div>
                <span style={{ fontWeight: 'bold', color: '#22c55e', fontSize: '18px' }}>
                  {stats?.by_status?.done || 0}
                </span>
              </div>
            </IonCardContent>
          </IonCard>

          {/* Progress bar */}
          <IonCard>
            <IonCardContent>
              <h3 style={{ margin: '0 0 12px', fontWeight: 'bold' }}>Progression globale</h3>
              <div style={{ 
                width: '100%', 
                height: '24px', 
                background: '#e5e7eb', 
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${stats?.progress_percentage || 0}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                  borderRadius: '12px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <p style={{ textAlign: 'center', marginTop: '8px', color: '#666' }}>
                {stats?.by_status?.done || 0} terminé(s) sur {stats?.total_reports || 0}
              </p>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Stats;
