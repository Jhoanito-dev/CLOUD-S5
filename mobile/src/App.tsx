import { IonApp, IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect } from 'react-router-dom';
import { map, list, logIn, statsChart } from 'ionicons/icons';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import MapPage from './pages/MapPage';
import MyReports from './pages/MyReports';
import Stats from './pages/Stats';

setupIonicReact();

const PrivateRoute: React.FC<{ component: React.FC; path: string; exact?: boolean }> = ({ component: Component, ...rest }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Route
      {...rest}
      render={() => (user ? <Component /> : <Redirect to="/login" />)}
    />
  );
};

const AppTabs: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/tabs/map" component={MapPage} />
        <Route exact path="/tabs/reports" component={MyReports} />
        <Route exact path="/tabs/stats" component={Stats} />
        <Route exact path="/tabs">
          <Redirect to="/tabs/map" />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="map" href="/tabs/map">
          <IonIcon icon={map} />
          <IonLabel>Carte</IonLabel>
        </IonTabButton>
        <IonTabButton tab="reports" href="/tabs/reports">
          <IonIcon icon={list} />
          <IonLabel>Signalements</IonLabel>
        </IonTabButton>
        <IonTabButton tab="stats" href="/tabs/stats">
          <IonIcon icon={statsChart} />
          <IonLabel>Récap</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

const App: React.FC = () => {
  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route exact path="/login" component={Login} />
            <Route path="/tabs" component={AppTabs} />
            <Route exact path="/">
              <Redirect to="/tabs/map" />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
};

export default App;
