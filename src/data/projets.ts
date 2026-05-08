export type ServiceSlug =
  | 'peinture-interieure'
  | 'peinture-exterieure'
  | 'enduits-decoratifs'
  | 'revetement-mural'
  | 'revetement-de-sol'
  | 'boiserie-et-ferronneries';

export const serviceLabels: Record<ServiceSlug, string> = {
  'peinture-interieure': 'Peinture intérieure',
  'peinture-exterieure': 'Peinture extérieure',
  'enduits-decoratifs': 'Enduits décoratifs',
  'revetement-mural': 'Revêtement mural',
  'revetement-de-sol': 'Revêtement de sol',
  'boiserie-et-ferronneries': 'Boiseries & ferronneries',
};

export interface Projet {
  slug: string;
  titre: string;
  localisation: string;
  categorie: ServiceSlug;
  description?: string;
  annee?: number;
  photos: string[];
}

export const projets: Projet[] = [
  // ── Peinture intérieure ──────────────────────────────────────────────────
  {
    slug: 'remise-en-blanc-neupre',
    titre: 'Remise en blanc complète',
    localisation: 'Neupré',
    categorie: 'peinture-interieure',
    description: 'Remise en blanc intégrale d\'une maison à Neupré. Préparation soignée des supports, enduits et peinture blanche mate sur murs, plafonds et menuiseries pour un résultat net et lumineux.',
    annee: 2024,
    photos: [
      '/images/projets/peinture-interieure/remise-en-blanc-neupre/01.jpg',
      '/images/projets/peinture-interieure/remise-en-blanc-neupre/02.jpg',
      '/images/projets/peinture-interieure/remise-en-blanc-neupre/03.jpg',
      '/images/projets/peinture-interieure/remise-en-blanc-neupre/04.jpg',
      '/images/projets/peinture-interieure/remise-en-blanc-neupre/05.jpg',
      '/images/projets/peinture-interieure/remise-en-blanc-neupre/06.jpg',
      '/images/projets/peinture-interieure/remise-en-blanc-neupre/07.jpg',
    ],
  },
  {
    slug: 'waterloo-peinture-interieure',
    titre: 'Mise en peinture complète',
    localisation: 'Waterloo',
    categorie: 'peinture-interieure',
    description: 'Remise en peinture complète d\'une maison à Waterloo. Préparation des supports, enduits de finition, peinture des murs, plafonds et menuiseries dans des teintes chaudes et contemporaines.',
    annee: 2024,
    photos: [
      '/images/projets/waterloo-peinture/01.jpg',
      '/images/projets/waterloo-peinture/02.jpg',
      '/images/projets/waterloo-peinture/03.jpg',
      '/images/projets/waterloo-peinture/04.jpg',
      '/images/projets/waterloo-peinture/05.jpg',
      '/images/projets/waterloo-peinture/06.jpg',
      '/images/projets/waterloo-peinture/07.jpg',
      '/images/projets/waterloo-peinture/08.jpg',
    ],
  },
  {
    slug: 'interieurs-colores',
    titre: 'Intérieurs colorés & rafraîchis',
    localisation: 'Région liégeoise',
    categorie: 'peinture-interieure',
    description: 'Sélection de chantiers de peinture intérieure — salons, chambres, couloirs — remis au goût du jour avec des teintes soigneusement choisies.',
    photos: [
      '/images/avant-apres/06-salon-mur-vert-sauge-apres.jpg',
      '/images/avant-apres/09-salon-parquet-gris-apres.jpg',
      '/images/avant-apres/10-chambre-portes-bois-apres.jpg',
      '/images/avant-apres/11-palier-salle-bain-apres.jpg',
      '/images/avant-apres/13-petite-chambre-lambris-apres.jpg',
    ],
  },
  // ── Enduits décoratifs ───────────────────────────────────────────────────
  {
    slug: 'enduits-decoratifs-liege',
    titre: 'Enduits décoratifs & finitions',
    localisation: 'Région liégeoise',
    categorie: 'enduits-decoratifs',
    description: 'Réalisations en enduits décoratifs : tadelakt, béton ciré, stuc, enduits colorés. Chaque surface devient un élément de décor à part entière.',
    annee: 2024,
    photos: [
      '/images/projets/enduits-decoratifs/01.jpg',
      '/images/projets/enduits-decoratifs/02.jpg',
      '/images/projets/enduits-decoratifs/03.jpg',
      '/images/projets/enduits-decoratifs/04.jpg',
      '/images/projets/enduits-decoratifs/05.jpg',
      '/images/projets/enduits-decoratifs/06.jpg',
      '/images/projets/enduits-decoratifs/07.jpg',
      '/images/projets/enduits-decoratifs/08.jpg',
      '/images/avant-apres/14-cheminee-moderne-enduit-apres.jpg',
    ],
  },
  // ── Boiseries & ferronneries ─────────────────────────────────────────────
  {
    slug: 'boiseries-menuiseries-renovees',
    titre: 'Boiseries & menuiseries rénovées',
    localisation: 'Région liégeoise',
    categorie: 'boiserie-et-ferronneries',
    description: 'Escaliers, lambris, garde-corps, boiseries murales et menuiseries remis au clair, repeints ou vernis pour un intérieur rajeuni et cohérent.',
    photos: [
      '/images/avant-apres/01-escalier-bois-apres.jpg',
      '/images/avant-apres/03-salon-boiseries-cheminee-apres.jpg',
      '/images/avant-apres/04-mur-lambris-porte-apres.jpg',
      '/images/avant-apres/05-couloir-bois-entree-apres.jpg',
      '/images/avant-apres/08-piece-fenetres-boiseries-apres.jpg',
      '/images/avant-apres/12-mezzanine-garde-corps-apres.jpg',
    ],
  },
];
