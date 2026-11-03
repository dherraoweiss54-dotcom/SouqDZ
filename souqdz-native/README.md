# SouqDZ Native

Application mobile indépendante Android/iOS construite avec Expo + React Native. Ce n'est pas une WebView. Le site/PWA existant dans `souqdz-pwa/` reste inchangé.

## Fonctionnalités de cette première version
- Connexion et inscription Supabase
- Catalogue, recherche, catégories et détails des annonces
- Favoris
- Publication d'annonces avec photos
- Commandes acheteur/vendeur et mise à jour des statuts
- Messagerie acheteur-vendeur

## Lancer et tester
1. Installer Node.js LTS sur un ordinateur.
2. Ouvrir un terminal dans `souqdz-native`.
3. Exécuter `npm install`.
4. Exécuter `npx expo start`.
5. Installer Expo Go sur le téléphone et scanner le QR code pour tester l'interface.

## Construire une application Android (APK)
1. Se connecter : `npx eas-cli login`.
2. Configurer le projet : `npx eas-cli build:configure`.
3. Construire l'APK de test : `npx eas-cli build --platform android --profile preview`.
4. Télécharger l'APK depuis le lien fourni par EAS et l'installer sur Android.

## iPhone
Pour installer une vraie application iOS sur un iPhone sans App Store public, il faut une signature Apple. La distribution interne/ad hoc demande un compte Apple Developer payant et l'enregistrement des appareils. TestFlight est une autre voie de test, mais passe par App Store Connect.

## Sécurité avant diffusion
- La clé Supabase intégrée doit être une clé publishable/anon uniquement. Ne jamais mettre une clé `service_role` dans l'application.
- Les politiques RLS Supabase doivent limiter l'accès aux profils, favoris, commandes, conversations et messages aux personnes autorisées.
- Tester les données et photos avec de vrais comptes acheteur et vendeur.
- Les statuts de commande doivent être protégés côté base de données : l'interface mobile ne remplace pas les règles RLS.

Le code utilise le même projet Supabase que le site. La base native est séparée dans ce dossier pour préserver le site actuel.
