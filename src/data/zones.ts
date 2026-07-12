// Zones d'intervention réelles de Moment D.Art.
// `slug` n'est renseigné que si une page locale dédiée existe sous /zones-intervention/.
// Les autres zones sont mentionnées honnêtement sans page propre (pas assez de contenu unique).

export interface Zone {
  nom: string;
  slug?: string;
  region: 'liege' | 'namur-condroz';
  resume: string;
}

export const zones: Zone[] = [
  {
    nom: 'Neupré',
    slug: 'neupre',
    region: 'liege',
    resume:
      "Notre base. Le siège de l'entreprise se trouve rue des Moges : c'est d'ici que partent toutes les visites et tous les chantiers, avec des interventions rapides sur Neupré, Neuville-en-Condroz, Rotheux et Plainevaux.",
  },
  {
    nom: 'Liège',
    slug: 'liege',
    region: 'liege',
    resume:
      "La grande ville la plus proche de notre siège. Appartements, maisons de ville, bureaux et commerces : nous y travaillons régulièrement, du centre aux communes périphériques.",
  },
  {
    nom: 'Sprimont',
    region: 'liege',
    resume:
      "À un quart d'heure de Neupré. Constructions quatre façades et rénovations : des clients de Sprimont figurent parmi les avis publiés sur ce site.",
  },
  {
    nom: 'Embourg',
    region: 'liege',
    resume:
      "Sur les hauteurs de Chaudfontaine, un habitat résidentiel où nous réalisons peintures intérieures, boiseries et finitions soignées.",
  },
  {
    nom: 'Beaufays',
    region: 'liege',
    resume:
      "Commune voisine entre Liège et l'Ourthe, où nous intervenons pour des chantiers résidentiels complets ou ciblés.",
  },
  {
    nom: 'Namur',
    slug: 'namur',
    region: 'namur-condroz',
    resume:
      "La capitale wallonne, à une quarantaine de minutes du siège. Maisons de maître, appartements et espaces professionnels : nous y organisons des chantiers complets.",
  },
  {
    nom: 'Ciney',
    slug: 'ciney',
    region: 'namur-condroz',
    resume:
      "Au cœur du Condroz. Peinture intérieure, portes, boiseries et enduits décoratifs : nous couvrons Ciney et ses villages selon les projets.",
  },
  {
    nom: 'Dinant',
    slug: 'dinant',
    region: 'namur-condroz',
    resume:
      "En vallée de Meuse, pour des projets de peinture et de finition dans le bâti ancien comme dans le neuf.",
  },
  {
    nom: 'Hamois',
    region: 'namur-condroz',
    resume:
      "Commune condrusienne entre Ciney et Havelange, desservie lors de nos interventions dans le Condroz.",
  },
  {
    nom: 'Rochefort',
    region: 'namur-condroz',
    resume:
      "À la lisière du Condroz et de la Famenne, pour des chantiers regroupés avec la région de Ciney.",
  },
];

export const zonesAvecPage = zones.filter((z) => z.slug);
