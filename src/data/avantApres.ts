export interface AvantApresProject {
  meta: string;
  title: string;
  description: string;
  // Localité réelle du chantier (utilisée dans les alt d'images). Défaut appliqué
  // par les pages appelantes : « Région liégeoise ». Ne jamais inventer une ville.
  location?: string;
  beforeImage: string;
  afterImage: string;
  frame?: 'landscape' | 'portrait';
  axis?: 'horizontal' | 'vertical';
  blurSides?: boolean;
}

export const avantApresProjects: AvantApresProject[] = [
  {
    meta: 'Escalier · Rénovation bois',
    title: 'Escalier bois remis au clair',
    description: 'Escalier et rampe transformés pour un rendu plus lumineux, net et contemporain.',
    beforeImage: '/images/avant-apres/01-escalier-bois-avant.jpg',
    afterImage: '/images/avant-apres/01-escalier-bois-apres.jpg',
    frame: 'portrait',
    axis: 'vertical',
  },
  {
    meta: 'Salon · Boiseries et cheminée',
    title: 'Salon boisé modernisé',
    description: 'Boiseries murales et cheminée modernisées avec une finition claire et plus actuelle.',
    beforeImage: '/images/avant-apres/03-salon-boiseries-cheminee-avant.jpg',
    afterImage: '/images/avant-apres/03-salon-boiseries-cheminee-apres.jpg',
  },
  {
    meta: 'Entrée · Lambris mural',
    title: 'Mur lambrissé repris et peint',
    description: 'Lambris existant réparé, préparé puis uniformisé avec une teinte gris bleuté.',
    beforeImage: '/images/avant-apres/04-mur-lambris-porte-avant.jpg',
    afterImage: '/images/avant-apres/04-mur-lambris-porte-apres.jpg',
  },
  {
    meta: 'Hall · Boiseries',
    title: 'Couloir bois transformé',
    description: 'Habillage bois complet repeint pour créer une entrée plus sobre et lumineuse.',
    beforeImage: '/images/avant-apres/05-couloir-bois-entree-avant.jpg',
    afterImage: '/images/avant-apres/05-couloir-bois-entree-apres.jpg',
  },
  {
    meta: 'Salon · Mur accent',
    title: 'Séjour adouci par la couleur',
    description: 'Pièce à vivre rafraîchie avec un mur accent vert sauge et des finitions claires.',
    beforeImage: '/images/avant-apres/06-salon-mur-vert-sauge-avant.jpg',
    afterImage: '/images/avant-apres/06-salon-mur-vert-sauge-apres.jpg',
  },
  {
    meta: 'Pièce de vie · Fenêtres et boiseries',
    title: 'Pièce ancienne remise au propre',
    description: 'Murs, boiseries et sol visuellement harmonisés pour retrouver une base saine.',
    beforeImage: '/images/avant-apres/08-piece-fenetres-boiseries-avant.jpg',
    afterImage: '/images/avant-apres/08-piece-fenetres-boiseries-apres.jpg',
  },
  {
    meta: 'Salon · Sol et murs',
    title: 'Séjour modernisé en gris doux',
    description: 'Grand espace rafraîchi avec une palette neutre et un rendu plus homogène.',
    beforeImage: '/images/avant-apres/09-salon-parquet-gris-avant.jpg',
    afterImage: '/images/avant-apres/09-salon-parquet-gris-apres.jpg',
  },
  {
    meta: 'Chambre · Menuiseries',
    title: 'Chambre clarifiée',
    description: 'Boiseries foncées et murs jaunis remplacés par une finition claire et apaisée.',
    beforeImage: '/images/avant-apres/10-chambre-portes-bois-avant.jpg',
    afterImage: '/images/avant-apres/10-chambre-portes-bois-apres.jpg',
  },
  {
    meta: 'Palier · Salle de bain',
    title: 'Palier et accès salle de bain rénovés',
    description: 'Teintes, encadrements et revêtements repris pour un ensemble plus propre et cohérent.',
    beforeImage: '/images/avant-apres/11-palier-salle-bain-avant.jpg',
    afterImage: '/images/avant-apres/11-palier-salle-bain-apres.jpg',
  },
  {
    meta: 'Mezzanine · Garde-corps',
    title: 'Mezzanine allégée',
    description: 'Palier modernisé avec une finition plus claire et un garde-corps visuellement allégé.',
    beforeImage: '/images/avant-apres/12-mezzanine-garde-corps-avant.jpg',
    afterImage: '/images/avant-apres/12-mezzanine-garde-corps-apres.jpg',
  },
  {
    meta: 'Chambre · Lambris',
    title: 'Petite chambre uniformisée',
    description: 'Mur lambrissé et teinte brune remplacés par une finition neutre et lumineuse.',
    beforeImage: '/images/avant-apres/13-petite-chambre-lambris-avant.jpg',
    afterImage: '/images/avant-apres/13-petite-chambre-lambris-apres.jpg',
  },
  {
    meta: 'Cheminée · Enduit de finition',
    title: 'Cheminée moderne enduite',
    description: 'Habillage brut préparé puis finalisé avec un enduit blanc lisse et contemporain.',
    beforeImage: '/images/avant-apres/14-cheminee-moderne-enduit-avant.jpg',
    afterImage: '/images/avant-apres/14-cheminee-moderne-enduit-apres.jpg',
    frame: 'portrait',
    axis: 'vertical',
    blurSides: false,
  },
];
