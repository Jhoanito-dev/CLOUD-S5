# Projet Cloud S5 - Travaux Routiers Antananarivo

Application de signalement et suivi des travaux routiers à Antananarivo...

## 📋 Fonctionnalités

### Module Authentification (API REST)
- ✅ Inscription / Connexion
- ✅ Firebase Auth (en ligne) ou PostgreSQL (hors ligne)
- ✅ Modification profil utilisateur
- ✅ Limite de tentatives de connexion (3 par défaut, paramétrable)
- ✅ API de déblocage des utilisateurs
- ✅ Documentation Swagger (`/docs`)

### Module Web (Backoffice React)
- ✅ 3 profils : Visiteur, Utilisateur, Manager
- ✅ Carte Leaflet avec marqueurs de signalements
- ✅ Tableau de bord avec KPIs (nb signalements, surface, budget, avancement)
- ✅ Gestion des signalements (CRUD)
- ✅ Synchronisation Firebase (Manager)
- ✅ Gestion des utilisateurs bloqués (Manager)

### Module Mobile (Ionic/React)
- ✅ Connexion Firebase
- ✅ Carte OpenStreetMap avec signalement
- ✅ Liste "Mes signalements" avec filtre

### Module Cartes
- ✅ TileServer Docker pour cartes offline
- ✅ Leaflet pour l'affichage des cartes

## 🛠️ Technologies

- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: React, Vite, TailwindCSS, Leaflet
- **Mobile**: Ionic, React, Capacitor
- **Auth**: Firebase Auth / JWT local
- **Docker**: PostgreSQL, TileServer-GL
- **Documentation**: Swagger

## 🚀 Installation et Démarrage

### Prérequis
- Node.js 18+
- Docker & Docker Compose
- (Optionnel) Android Studio pour l'APK

### 1. Cloner et configurer

```bash
cd cloud-project

# Copier les fichiers d'environnement
cp backend/.env.example backend/.env
```

### 2. Configurer Firebase (optionnel)

Si vous souhaitez utiliser Firebase, éditez `backend/.env` :
```
FIREBASE_PROJECT_ID=votre-project-id
FIREBASE_PRIVATE_KEY=votre-private-key
FIREBASE_CLIENT_EMAIL=votre-client-email
```

### 3. Démarrer avec Docker

```bash
# Démarrer tous les services
docker-compose up -d

# Vérifier les logs
docker-compose logs -f
```

### 4. OU Démarrer sans Docker (développement)

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (dans un autre terminal)
cd frontend
npm install
npm run dev
```

### 5. Accéder à l'application

- **Frontend Web**: http://localhost:5173
- **API Backend**: http://localhost:3000
- **Documentation API**: http://localhost:3000/docs
- **TileServer**: http://localhost:8080

### 6. Compte Manager par défaut

```
Email: manager@roadworks.mg
Mot de passe: password
```

## 📱 Application Mobile

### Développement
```bash
cd mobile
npm install
ionic serve
```

### Build APK
```bash
cd mobile
npm install
ionic capacitor build android
```

L'APK sera généré dans `mobile/android/app/build/outputs/apk/`

## 📁 Structure du Projet

```
cloud-project/
├── backend/                 # API Node.js
│   ├── src/
│   │   ├── config/         # Configuration (DB, Firebase, Swagger)
│   │   ├── middleware/     # Auth, Error handling
│   │   └── routes/         # Routes API
│   ├── init.sql            # Script SQL d'initialisation
│   └── Dockerfile
├── frontend/               # Application React
│   ├── src/
│   │   ├── components/     # Composants réutilisables
│   │   ├── context/        # Context Auth
│   │   ├── pages/          # Pages de l'application
│   │   └── services/       # Service API
│   └── Dockerfile
├── mobile/                 # Application Ionic
│   └── src/
│       ├── context/        # Context Auth Firebase
│       ├── pages/          # Pages mobile
│       └── services/       # Service API
├── data/                   # Données TileServer (cartes)
└── docker-compose.yml
```

## 🔌 API Endpoints

### Authentification
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| POST | `/api/auth/logout` | Déconnexion |
| POST | `/api/auth/unblock/:userId` | Débloquer un utilisateur (Manager) |
| GET | `/api/auth/blocked-users` | Liste des utilisateurs bloqués (Manager) |

### Utilisateurs
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/users/me` | Profil utilisateur |
| PUT | `/api/users/me` | Modifier profil |
| GET | `/api/users` | Liste utilisateurs (Manager) |

### Signalements
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/reports` | Liste des signalements |
| GET | `/api/reports/:id` | Détail d'un signalement |
| POST | `/api/reports` | Créer un signalement |
| PUT | `/api/reports/:id` | Modifier un signalement (Manager) |
| PATCH | `/api/reports/:id/status` | Changer le statut (Manager) |
| DELETE | `/api/reports/:id` | Supprimer (soft delete, Manager) |

### Statistiques
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/stats` | Statistiques globales |
| GET | `/api/stats/monthly` | Statistiques mensuelles |

### Synchronisation
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/sync/firebase` | Récupérer depuis Firebase (Manager) |
| POST | `/api/sync/to-firebase` | Envoyer vers Firebase (Manager) |
| GET | `/api/sync/status` | Statut de synchronisation |

## 📊 MCD (Modèle Conceptuel de Données)

```
┌─────────────┐       ┌─────────────┐
│   USERS     │       │   REPORTS   │
├─────────────┤       ├─────────────┤
│ id          │───┐   │ id          │
│ uid         │   │   │ uid         │
│ email       │   │   │ user_id     │←──┘
│ password    │   └──→│ latitude    │
│ first_name  │       │ longitude   │
│ last_name   │       │ description │
│ role        │       │ surface     │
│ login_attempts│     │ budget      │
│ is_blocked  │       │ company     │
│ blocked_until│      │ status      │
└─────────────┘       │ photo_url   │
                      │ is_deleted  │
                      │ firebase_synced│
                      └─────────────┘
```

## 👥 Équipe

- Promotion 17 - Projet Cloud S5

## 📝 Notes

- Sans Firebase configuré, l'application fonctionne en mode local avec PostgreSQL
- Les cartes offline nécessitent le fichier `antananarivo.mbtiles` dans `./data/`
- Sans cartes offline, l'application utilise OpenStreetMap en ligne
