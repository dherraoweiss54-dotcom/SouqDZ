# SouqDZ Native

Application mobile indépendante Android/iOS construite avec Expo + React Native.
Le site/PWA existant reste inchangé dans `souqdz-pwa/`.

## Démarrage

1. Installer Node.js LTS.
2. Dans ce dossier : `npm install`
3. Lancer : `npx expo start`
4. Scanner le QR code avec Expo Go pour tester sur Android ou iPhone.

## Configuration

La configuration Supabase est dans `src/lib/supabase.js`. Elle utilise le projet et la clé publishable déjà présents dans la version web. Ne jamais mettre une clé `service_role` dans une application mobile.

## État

Première base native : connexion/inscription, catalogue, recherche, filtres de catégorie, favoris, publication d'annonces avec photos, détails, commandes et profil. Les conversations, notifications push et contrôles RLS doivent être portés/testés dans les prochaines étapes avant toute diffusion.
