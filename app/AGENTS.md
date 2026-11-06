# AGENTS.md — Guide pour agents IA

Copie fonctionnelle de **DentoPic** (frontend-for-you.vercel.app).
Stack : **React 19 · Vite · Chakra UI v3 · React Router 7 · @supabase/supabase-js**.

## Carte du projet

```
src/
├── config.js            # URL + clé anon Supabase (lit .env, fallback = projet d'origine)
├── supabase.js          # client Supabase (instance unique)
├── theme.js             # objet C — TOUTES les couleurs de l'app
├── api.js               # TOUTES les requêtes Supabase (listX/countX/updateX)
├── media.js             # signed URLs du bucket privé `photos` (cache 1 h)
├── context/AppContext.jsx # session + profile + workspace → useApp()
├── components/
│   ├── AppShell.jsx     # sidebar + topbar (+ thème sombre auto sur /studio)
│   ├── Logo.jsx         # logo DentoPic (deux barres + texte)
│   ├── PhotoImg.jsx     # <img> depuis storage_path (signed URL auto)
│   └── ui.jsx           # primitives : Card, Tag, PageHeader, PrimaryButton,
│                        #   SearchInput, Select, Field, IconTile, SectionLabel,
│                        #   ProgressBar, EmptyPane, HelpButton, Modal, Tip,
│                        #   ago(), isTestName()
└── pages/               # un fichier = un écran
```

## Conventions à respecter

1. **Couleurs** : jamais d'hex en dur dans les pages — importer `C` depuis `../theme`.
   `C` renvoie des variables CSS (`var(--c-*)` définies dans `index.css`) : chaque
   couleur existe en clair ET en sombre. Le basculement se fait par
   `applyMode('dark'|'light')` / `getMode()` (persisté dans `localStorage`
   `dentopic.theme`, appliqué dès `index.html` pour éviter le flash). Les vars
   Chakra (`white`, `gray.*`, `blackAlpha.*`) sont aussi remappées en sombre :
   `bg="white"`, `color="gray.500"`… basculent automatiquement.
2. **Données** : jamais de `supabase.from(...)` dans les pages — ajouter une fonction
   nommée dans `api.js` (`listX`, `countX`, `updateX`). Les listes excluent `deleted_at`.
3. **Workspace** : toutes les requêtes prennent `wsId` (= `workspace.id` via `useApp()`).
4. **Pages** : `w="100%" px="6" py="6"` + `<PageHeader>` (pleine largeur, sans max-width).
5. **Boutons** : `PrimaryButton` (bleu) / variant `outline` (secondaire) / `HelpButton`.
6. **Images** : `<PhotoImg storagePath={p.storage_path} ratio="16/9" />` — jamais d'URL
   directe (bucket privé, signed URL gérée en interne).
7. **Routes** : déclarées dans `App.jsx`, dans l'`AppShell` (sidebar incluse) sauf la 404.
8. **Studio** est la seule page sombre : `AppShell` bascule automatiquement sur `/studio`.
9. **Interactions en modal, pas de navigation forcée** : les flux complexes restent
   dans leur route via `<Modal>` (overlay centré, fermeture au clic dehors/croix,
   `footer` optionnel) et `<Tip>` (tooltip au survol).
   Exemple complet : `pages/acquisition/` (module en 3 fichiers —
   `index.jsx` = page/état, `modals.jsx` = 8 popups contrôlés,
   `constants.js` = `HELP_STEPS` + `SOURCE_DEFS`). Une seule string d'état
   (`modal`) pilote l'ouverture : guide 5 étapes (auto 1ʳᵉ visite via
   `localStorage`), source d'acquisition, destination (recherche + `createDossier`),
   mobile QR, caméra (liste + formulaire → `createCaptureDevice`), FTP et dossier
   surveillé (config persistée dans `capture_devices.metadata` jsonb via
   `updateCaptureDevice`), import (drop zone → `importPhotos`, photos liées à la
   session via `capture_session_id`), nouvelle acquisition
   (destination + mode → `createCaptureSession`, clôture `endCaptureSession`,
   compteur via `countSessionPhotos`).
10. **Studio = éditeur bitmap façon Photoshop** : `pages/studio/` —
    `engine.js` (moteur canvas 2D pur : pile de calques, filtres `ctx.filter`,
    undo/redo sérialisé en PNG dataURL, recadrage/rotation/flip — aucun état
    React), `index.jsx` (événements pointer/wheel/clavier + menus + rendu),
    `panels.jsx` (barre de menus, toolbar, options, panneaux
    Calques/Réglages/Infos — thème sombre fixe `C.dark*`),
    `constants.js` (TOOLS, ADJUST_DEFS, PRESETS), `modals.jsx` (ouvrir photo
    workspace, export/sauvegarde → `saveEditedPhoto`). Règle : appeler
    `editor.snapshot()` **avant** toute mutation pour que Ctrl+Z fonctionne.

## Modèle de données (tables Supabase)

| Table | Rôle | Colonnes clés |
|---|---|---|
| `dossiers` | cas patient | name, parent_id (sous-dossiers), updated_at |
| `patient_photos` | photos | storage_path, dossier_id, is_favorite, photo_state |
| `montages` | assemblages avant/après | ratio, status (`draft`/`finalized`), dossier_id |
| `video_projects` | montages vidéo | timeline (jsonb), export_url |
| `presentations` + `presentation_slides` | diaporamas | status, position/type/media_url |
| `collections` | regroupements | color, cover_photo_id, cover_montage_id |
| `capture_sessions` | sessions de capture | status, started_at/ended_at, dossier_id |
| `capture_devices` | appareils | status (`online`/`offline`), connection_type |
| `ai_predictions` | classification IA | photo_id, label, confidence |
| `profiles`, `workspaces`, `workspace_members` | compte | full_name, profession |

## Ajouter une page

1. Créer `src/pages/MaPage.jsx` (squelette ci-dessous).
2. Ajouter la route dans `App.jsx` (+ entrée dans `NAV` de `AppShell.jsx` si sidebar).
3. Ajouter les requêtes nécessaires dans `api.js`.

```jsx
import { Box, Text } from '@chakra-ui/react'
import { PageHeader, HelpButton } from '../components/ui'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import { listDossiers } from '../api'

export default function MaPage() {
  const { workspace } = useApp()
  return (
    <Box w="100%" px="6" py="6">
      <PageHeader title="Ma page"><HelpButton /></PageHeader>
      <Text color={C.body}>…</Text>
    </Box>
  )
}
```

## Vérification

- `npm run build` doit passer sans erreur.
- Tester en local : `npm run dev` puis login avec le compte Supabase du projet.
- `explore/verify-copy.js` (workspace parent) rejoue un parcours Playwright complet.

## Classement clinique et comparaison

- Les étiquettes photo Vue/Étape sont stockées dans `patient_photos.edit_meta.dental`
  (`view`, `stage`), avec les valeurs définies dans `src/clinical.js`. Préserver les
  autres clés de `edit_meta` lors de toute mise à jour. `labelClinicalPhotos` dans
  `api.js` applique le classement en lot avec vérification workspace et erreurs partielles.
- `pages/studio/SessionComparison.jsx` compare deux photos sans modifier les originaux.
  Les repères sont exprimés dans un cadre de 900 × 600 ; `alignLandmarks` calcule
  une similitude (rotation, translation, échelle uniforme), jamais une déformation.
  Le montage aligné est une nouvelle image, les repères d’inspection ne sont pas persistés.
- `ProtocolGuideModal.jsx` propose des guides prédéfinis dans `src/clinical.js` et lit
  les protocoles du workspace. Les photos personnelles de référence sont associées
  aux identifiants de vues dans `edit_meta.dental.referenceViews` (tableau), via
  `saveClinicalReference`. Préserver ce tableau pendant les changements Vue/Étape.
  Les modèles du Studio ne créent pas automatiquement de protocole d’acquisition.

## Photothèque clinique (Collection)

- `Collection.jsx` conserve le gestionnaire de collections manuelles et délègue
  l’entrée à `Phototheque.jsx` (Photos / Patients / Collections). Les filtres sont
  conservés dans l’URL ; les photos sont recherchées côté serveur par pages de 48
  via `searchLibraryPhotos` dans `api.js`, avec annulation des requêtes périmées.
- `loadLibraryContext` charge les métadonnées dossiers/patients/collections, pas les
  photos du cabinet. `phototheque.js` gère les critères, accents et sous-dossiers.
- `PatientTimelineModal.jsx` distingue les sessions de capture réelles des groupes
  par date de prise de vue (date d’import si absente). La comparaison sélectionne
  explicitement deux photos étiquetées de la même vue puis ouvre `/studio?edit=…&compare=…`.
- Les recherches enregistrées sont locales à l’appareil et isolées par cabinet et
  utilisateur : clé `dentopic.library-searches.<workspaceId>.<userId>`. Aucun partage
  public ou album dynamique en base n’est créé par l’enregistrement d’une recherche.
- Tests unitaires : `node --test src/phototheque.test.js` depuis `app/`.

## Déploiement Edge Functions (réseaux sociaux)

`supabase/functions/` contient l'infra publication sociale (OAuth Meta /
agrégateur, moteur `social-publish-due`) — voir `supabase/functions/README.md`
pour la liste des secrets. Pour déployer depuis le repo :

```bash
SUPABASE_ACCESS_TOKEN=$(grep ^SUPABASE_ACCESS_TOKEN app/.env | cut -d= -f2) \
  supabase functions deploy <nom> --project-ref rgpoojpvhbxlabzdxfff
```

- Le token CLI vit dans `app/.env` (`SUPABASE_ACCESS_TOKEN`, gitignoré) —
  révoquable sur supabase.com/dashboard/account/tokens.
- `social-oauth-callback` se déploie avec `--no-verify-jwt` (redirection Meta
  sans session) ; les autres gardent la vérif JWT.
- `.env` contient aussi les clés publiques Vite (`VITE_SUPABASE_URL/ANON_KEY`).
