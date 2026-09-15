# Moment D.Art — V3 premium

## Lancer le projet

```bash
npm install
npm run dev
```

## Formulaire de contact sur Netlify

Configurer `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et
`CONTACT_TO_EMAIL` (ou `DEVIS_TO_EMAIL` en repli) dans les variables Netlify,
pour le contexte Production et avec la portée Functions. Le fichier `.env`
local ne configure pas les fonctions déployées. Redéployer après modification.
Voir la [documentation Netlify](https://docs.netlify.com/build/functions/environment-variables/).

En cas d'échec, consulter les logs de la fonction `contact` :

- `Invalid SMTP configuration` : variables manquantes ou port invalide.
- `EAUTH` / `535` : authentification refusée ; vérifier le compte SMTP et son mot de passe.
- `ETIMEDOUT` / `ECONNECTION` : vérifier le serveur, le port et sa disponibilité.

Le formulaire conserve la saisie et propose l'adresse e-mail directe si l'envoi échoue.
Ne pas publier les mots de passe dans les logs ou dans Git.

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
