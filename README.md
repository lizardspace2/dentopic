# Copie de DentoPic — frontend-for-you.vercel.app

Copie fonctionnelle de **DentoPic** reconstruite en
**React 19 + Vite + Chakra UI v3 + React Router + Supabase**, après
rétro-ingénierie via **Playwright/Chromium** et **rea** (github.com/morluto/rea).

## Démarrer

```bash
cd app
npm install
npm run dev      # http://localhost:5173
npm run build    # build production → dist/
```

Connexion : les identifiants du site original fonctionnent — la copie pointe sur
le **même projet Supabase** (clé anon publique dans `app/.env`, voir `.env.example`).

## Pour une IA / un nouveau développeur

**`app/AGENTS.md`** est le point d'entrée : carte du projet, conventions
(couleurs, requêtes, composants), modèle de données, squelette de nouvelle page.

Architecture en 3 couches, pensée pour être prévisible :

```
pages/*.jsx        → écrans (un fichier = une page, aucun accès DB direct)
components/ui.jsx  → primitives partagées (PageHeader, Card, Tag, Select,
                     Modal, Tip — popups locales sans quitter la route)
api.js             → TOUTES les requêtes Supabase, nommées listX/countX/updateX
theme.js           → objet C = palette unique (jamais d'hex en dur ailleurs)
media.js           → signed URLs du bucket privé `photos`
context/           → session, profil, workspace (useApp())
```

## Arborescence du workspace

| Dossier | Contenu |
|---|---|
| `app/` | **la copie** — code de production |
| `explore/` | scripts Playwright + screenshots original vs copie + schéma des tables |
| `site-assets/` | bundles JS du site original + analyses `rea` (JSON de preuves) |
| `rea-repo/` | clone de l'outil rea |

## Pages reproduites

`/login` · `/` (dashboard) · `/recherche` · `/acquisition` · `/dossier-patient` ·
`/studio` (sombre) · `/collection` · `/publication` · `/presentations` ·
`/reglage` + `/reglage/profil` + `/reglage/appareils` · `404`

Non couvert : éditeurs internes (montage photo/vidéo, présentation, capture
live) — interfaces d'édition complexes hors périmètre de cette copie.
