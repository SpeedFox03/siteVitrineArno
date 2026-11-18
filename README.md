# Moment D.Art — V3 premium

## Lancer le projet

```bash
npm install
npm run dev
```

## Formulaires de devis et de contact sur Netlify

Configurer `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et
`DEVIS_TO_EMAIL`, ainsi que `CONTACT_TO_EMAIL` (ou `DEVIS_TO_EMAIL` en repli pour le contact), dans les variables Netlify,
pour le contexte Production et avec la portée Functions. Le fichier `.env`
local ne configure pas les fonctions déployées. Redéployer après modification.
Voir la [documentation Netlify](https://docs.netlify.com/build/functions/environment-variables/).

Les fonctions utilisent l'API native `Request`/`Response` de Netlify et Node 22
(22.12 minimum pour le SDK Blobs). La CI exécute les tests avant le build.
`npm run dev` lance Astro seul : il ne fournit pas les fonctions Netlify.
Pour les tester dans leur environnement local Netlify, utiliser Netlify Dev.
Ne pas remplacer leurs URL par les anciens fichiers PHP dans `public/api` :
Netlify héberge ces fichiers comme des fichiers statiques, sans exécuter PHP.

### Enregistrement et référence de suivi

Chaque demande valide est sauvegardée **avant** l'envoi de sa notification dans
Netlify Blobs, avec une référence `DEV-<UUID>` pour un devis ou `CON-<UUID>`
pour un contact. Cette référence figure dans la réponse, l'objet et le corps de
l'e-mail, ainsi que dans son en-tête `X-Momentdart-Reference` et les journaux.

Le store de production s'appelle `form-submissions` ; les autres contextes utilisent
`form-submissions-<CONTEXT>` (par exemple `form-submissions-dev` en local).
Le stockage utilise la région `eu-central-1` et la cohérence forte. Toute lecture
ou maintenance par script doit ouvrir la même région. Le store est lié au site,
et survit aux redéploiements. Il n'existe aucun endpoint public de lecture des demandes.
Voir la [documentation Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

Le navigateur conserve un identifiant par contenu de formulaire pendant la session
de la page. Une nouvelle tentative identique après une réponse perdue retrouve la
même demande, sans envoyer un second e-mail. Changer le contenu ou recharger la page
constitue une nouvelle demande. Aucun renvoi SMTP automatique n'est effectué.

### Interpréter les résultats et retrouver une demande

| Résultat | Signification | Action |
| --- | --- | --- |
| HTTP 200, `saved: true`, `notificationStatus: accepted` | Demande sauvegardée et destinataire accepté par SMTP | Vérifier la boîte professionnelle avec sa référence |
| HTTP 202, `saved: true`, `notificationStatus: failed` | Demande sauvegardée, notification échouée | Retrouver la demande dans Blobs et la traiter manuellement |
| HTTP 202, `saved: true`, `notificationStatus: pending` | Demande sauvegardée, résultat de notification inconnu ou en cours | Consulter les journaux et la boîte avant tout renvoi |
| HTTP 503 | Enregistrement non confirmé ; aucun nouvel envoi SMTP tenté | Vérifier Blobs et les journaux, puis réessayer avec le même formulaire |
| HTTP 400 / 409 / 413 | Champs ou référence invalides, conflit de contenu ou demande trop volumineuse | Corriger la demande ; aucun nouvel envoi SMTP |

Une acceptation SMTP **ne prouve pas une arrivée dans la boîte de réception**.
Le statut `accepted` ne doit pas être interprété comme « reçu par Arno ».
Après un timeout, la demande peut avoir été enregistrée avant la coupure :
conserver la saisie et réessayer sans recharger permet de retrouver la même référence.

Dans les journaux de la fonction `devis` ou `contact`, rechercher la référence :

- `saved` : sauvegarde terminée, avec le type particulier/professionnel/contact.
- `smtp_accepted` : SMTP a accepté le destinataire ; `messageId` permet un rapprochement avec le serveur de messagerie.
- `smtp_failed` : notification échouée, avec un code sans contenu privé.
- `storage_failed` : impossible de confirmer la sauvegarde ; vérifier la présence de la clé avant traitement manuel.
- `notification_status_save_failed` : la demande initiale reste sauvegardée en `pending` ; le résultat SMTP est dans les journaux.

- `Invalid SMTP configuration` : variables manquantes ou port invalide.
- `EAUTH` : authentification refusée ; vérifier le compte SMTP et son mot de passe.
- `ETIMEDOUT` / `ECONNECTION` : vérifier le serveur, le port et sa disponibilité.
- `ERECIPIENT` : destinataire non accepté par SMTP.

La clé Blobs est la référence complète. Son objet JSON contient `receivedAt`, `fields`
et `notification`. Pour les demandes `failed` ou `pending`, vérifier d'abord la boîte
(y compris les indésirables) puis traiter le contenu sauvegardé manuellement.
Ces statuts ne déclenchent pas d'alerte ni de renvoi automatique : prévoir leur contrôle.
Limiter l'accès au projet Netlify aux personnes autorisées ; supprimer les sauvegardes
qui ne sont plus nécessaires au suivi, selon la politique de conservation du client.
Ne pas publier les données des demandes ni les mots de passe dans les logs ou dans Git.

Le formulaire conserve la saisie en cas d'erreur ou de notification non confirmée,
affiche la référence disponible et indique comment contacter Arno si nécessaire.
Il n'efface les champs qu'après confirmation structurée de sauvegarde et d'acceptation SMTP.

### Vérifications réalisées et contrôle après déploiement

Le contrôle HTTP initial du 18 novembre 2026 a constaté une redirection normale
de `/devis` vers `/devis/` et une réponse 405 de la fonction lors d'une requête HEAD
(l'envoi attend POST). L'incident intermittent d'ouverture signalé dans l'audit
n'a pas été reproduit : sa cause ne peut pas être attribuée au code ou à l'hébergeur
sans les journaux correspondant à l'heure de l'incident.

`npm test` n'utilise aucun compte réel : les essais couvrent les trois formulaires,
la sauvegarde via le vrai SDK Blobs et son serveur local, un vrai échange SMTP local,
les échecs de stockage/SMTP, les doublons et les réponses réseau incorrectes.

À effectuer séparément, après déploiement et avec l'autorisation du client :

1. Ouvrir le devis depuis l'accueil, sur mobile et ordinateur, et vérifier les deux onglets.
2. Envoyer une demande clairement identifiée TEST pour chaque profil, puis un contact court.
3. Retrouver chaque référence dans Blobs, dans les journaux de sa fonction et dans la boîte d'Arno.
4. Si SMTP accepte mais que le message manque, consulter les indésirables et les traces OVH avec le `messageId` ; vérifier la configuration du domaine d'envoi.
5. En cas de nouvel incident d'accès, conserver l'heure, l'URL, le statut HTTP et le `X-Nf-Request-Id` pour examiner les journaux Netlify.

Conformément à la demande, aucun test d'envoi réel ni déploiement n'a été réalisé pendant cette intervention.

## Images et accueil mobile

`npm run images:optimize` produit les variantes WebP et le manifeste
`src/data/image-variants.json`. Cette commande est également exécutée avant
`npm run dev` et `npm run build`. Les fichiers maîtres restent inchangés.
Le générateur utilise Sharp, conserve les proportions et l'orientation, limite
les photos à 320/640/1000 px sans agrandissement, et le logo à 96/192 px.
Les variantes déjà présentes sont réutilisées ; une modification d'original
produit un nouveau nom fondé sur son contenu. Les formats sont servis via
`srcset` et `sizes` par le helper `src/utils/image.ts`.

La présentation d'origine a été rétablie : grille et espacements de l'accueil,
dimensions des boutons et du menu, fonds décoratifs, cartes et comparateurs.
Seuls le nouveau texte d'accueil et les améliorations techniques sont conservés.
Le portrait d'Arno reste à son emplacement d'origine sur ordinateur et tablette ;
il est masqué et n'est pas téléchargé sur mobile (640 px et moins).
L'accueil utilise une image prioritaire sans animation qui en retarderait l'affichage.

Les cartes retrouvent leur diaporama et leurs indicateurs d'origine. Une seule
miniature optimisée est chargée initialement par projet ; les suivantes sont
chargées au moment du défilement, uniquement pour les cartes à l'écran.
Le diaporama s'arrête hors écran, au survol ou lorsque la réduction des animations
est demandée. Les pages de projet utilisent des aperçus WebP et chargent les
originaux dans la visionneuse. Les fonds floutés des comparateurs utilisent
des variantes de 320 px pour conserver leur aspect sans charger les originaux.

Contrôles locaux du 18 novembre 2026 :

- Construction des 34 pages et vérification de la présence des fichiers WebP référencés.
- Les contrôles visuels précédents à 360, 390 et 430 px concernaient une version intermédiaire avec escalier et ne représentent pas la présentation d'origine rétablie ensuite.
- Menu mobile et visionneuse vérifiés, dont le passage de la photo 1 à la photo 2 sur 6.
- Mesure locale de la version avec escalier à 430 × 800, réseau « Slow 4G » simulé, sans ralentissement CPU : LCP observé autour de 1,65–1,66 s, CLS affiché à 0. Le bandeau avait été refusé lors de ces mesures ; son affichage a été contrôlé séparément. Cette mesure précède le rétablissement du portrait d'Arno.
- Portrait original : 2 109 167 octets ; variante de 640 px : 26 206 octets. Logo original : 311 150 octets ; variantes 96/192 px : 3 380/6 708 octets. Photo d'escalier de 640 px : 18 896 octets.

Ces mesures locales ne sont pas directement comparables à celles de l'audit
initial et ne remplacent pas trois mesures de production à froid, avec les
mêmes paramètres de réseau et de CPU. Aucun déploiement n'a été effectué.

Les animations d'apparition sont pilotées par `src/utils/reveal.js` via
`ScrollReveal.astro`. Les éléments déjà présents dans la fenêtre sont révélés
dès l'initialisation, sans attendre de scroll. Les autres sont observés
individuellement et commencent leur apparition 64 px avant leur entrée à l'écran,
sans seuil proportionnel à la hauteur d'une section ni délai JavaScript supplémentaire.
Le contrôleur respecte la préférence de réduction des animations et laisse
le contenu disponible lorsque `IntersectionObserver` est absent.

## Points ajoutés dans cette version

- Nouvelle navigation avec menu déroulant `Services`
- Pages dédiées pour chaque service
- Page `Réalisations`
- Page `Devis` avec explication de la projection à partir d'une photo
- DA premium conservée
- Boutons principaux en brun clair
- Logo transparent intégré : `public/images/logo-premium-transparent.png`
- Zone vidéo d'introduction prête à l'emploi : déposer votre fichier dans `public/videos/intro.mp4`

## À personnaliser ensuite

- Remplacer `X années` par le nombre réel d'années d'expérience
- Remplacer les images de démonstration par de vraies photos de chantiers
- Ajouter les coordonnées réelles (email / téléphone)
- Ajouter la vraie vidéo d'introduction dans `/public/videos/intro.mp4`
