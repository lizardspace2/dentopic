# Product Marketing Context — DentoPic

## Produit
Application web professionnelle (B2B, self-serve) pour cabinets dentaires.
Stack : React 19 + Vite + Chakra UI v3 + Supabase. Interface en français.

## Proposition de valeur
Le dentiste photographie ses cas (mobile, boîtier, FTP) → les photos se rangent
automatiquement dans des dossiers patients cliniques (vue, étape, spécialité) →
il crée des montages avant/après, des présentations et des collections →
il les publie / programme sur les réseaux sociaux (Instagram, Facebook…).

## Cœur de l'expérience (job-to-be-done)
« Je suis dentiste, pas community manager : je veux transformer mes photos
cliniques en publications réseaux en quelques clics, sans tutoriel. »

## Audience
- Dentistes / orthodontistes en cabinet, peu de temps, pas experts en tech
- Assistantes qui gèrent la photo et la comm du cabinet
- B2B self-serve : inscription seule, pas de vente assistée

## Aha moment (activation)
Premier post programmé ou publié sur un réseau social connecté.
Proxy acceptable : premier montage avant/après partagé/exporté.

## Parcours critique (Minimum Path to Value)
1. Signup (email + mot de passe, confirmation email)
2. Créer un dossier patient
3. Acquérir/importer des photos
4. (Studio) montage avant/après
5. Publication : connecter un réseau → brouillon → programmer → publié

## Contraintes UX établies
- Pas de modal tutoriel bloquant (supprimé — le flux doit être intuitif seul)
- Vues par défaut épurées : recherche + bouton « Filtres » (progressive disclosure)
- Aide uniquement à la demande (bouton « Aide » qui fait quelque chose)
- Pas de contrôle mort ni grisé sans fonction
- Français, ton professionnel, phrases courtes
