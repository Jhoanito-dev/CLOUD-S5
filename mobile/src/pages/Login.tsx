import React, { useState, useRef } from 'react';
import {
  IonContent,
  IonPage,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
  IonIcon,
  IonList,
  IonItem,
} from '@ionic/react';
import { mailOutline, lockClosedOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const history = useHistory();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      history.push('/tabs/map');
    } catch (err: any) {
      console.error('Login error:', err);
      // Afficher le vrai message d'erreur Firebase
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Mot de passe incorrect');
      } else if (err.code === 'auth/user-not-found') {
        setError('Aucun compte trouvé avec cet email');
      } else if (err.code === 'auth/invalid-email') {
        setError('Format d\'email invalide');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Trop de tentatives. Réessayez plus tard.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erreur réseau. Vérifiez votre connexion.');
      } else if (err.code === 'auth/api-key-not-valid') {
        setError('Configuration Firebase invalide');
      } else {
        setError(err.message || 'Erreur de connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: '400px', margin: '0 auto', paddingTop: '60px' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>🛣️ Travaux Routiers</h1>
          <h2 style={{ textAlign: 'center', color: '#666', marginBottom: '40px' }}>Antananarivo</h2>

          <form onSubmit={handleSubmit}>
            {error && (
              <IonText color="danger">
                <p style={{ textAlign: 'center', marginBottom: '20px' }}>{error}</p>
              </IonText>
            )}

            <IonList>
              <IonItem>
                <IonIcon icon={mailOutline} slot="start" />
                <IonInput
                  type="email"
                  label="Adresse e-mail"
                  labelPlacement="floating"
                  value={email}
                  onIonInput={(e) => setEmail(e.detail.value || '')}
                />
              </IonItem>

              <IonItem>
                <IonIcon icon={lockClosedOutline} slot="start" />
                <IonInput
                  type="password"
                  label="Mot de passe"
                  labelPlacement="floating"
                  value={password}
                  onIonInput={(e) => setPassword(e.detail.value || '')}
                />
              </IonItem>
            </IonList>

            <IonButton
              expand="block"
              type="submit"
              disabled={loading}
              style={{ marginTop: '30px' }}
            >
              {loading ? <IonSpinner name="crescent" /> : 'Se connecter'}
            </IonButton>
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Login;
