# TileServer Data

## Instructions pour les cartes d'Antananarivo

### Télécharger les tuiles OpenStreetMap

1. Téléchargez les données MBTiles pour Madagascar/Antananarivo:
   - Option 1: https://openmaptiles.org/downloads/
   - Option 2: https://download.maptiler.com/

2. Renommez le fichier téléchargé en `antananarivo.mbtiles`

3. Placez le fichier dans ce dossier (`./data/`)

### Utilisation avec Docker

Le TileServer sera accessible sur `http://localhost:8080`

Les tuiles seront disponibles à l'URL:
```
http://localhost:8080/data/antananarivo/{z}/{x}/{y}.png
```

### Alternative: Utiliser OpenStreetMap en ligne

Si vous n'avez pas les tuiles offline, l'application utilisera automatiquement les tuiles en ligne d'OpenStreetMap:
```
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```
