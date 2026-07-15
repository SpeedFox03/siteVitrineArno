// Liste centrale des services (pages sous /services/).
// Utilisée par ZoneServices (pages zones) — l'ordre est l'ordre d'affichage.

export interface ServiceLien {
  slug: string;
  label: string;
  resume: string;
}

export const servicesListe: ServiceLien[] = [
  {
    slug: 'peinture-interieure',
    label: 'Peinture intérieure',
    resume: 'Murs, plafonds et pièces de vie repeints avec une préparation soignée et des finitions tendues.',
  },
  {
    slug: 'peinture-exterieure',
    label: 'Peinture extérieure',
    resume: 'Façades, annexes et éléments extérieurs protégés avec des systèmes adaptés au climat belge.',
  },
  {
    slug: 'enduisage-plafonnage',
    label: 'Enduisage & plafonnage',
    resume: 'Plafonnage, rebouchage et enduits de lissage pour des murs et plafonds parfaitement plans.',
  },
  {
    slug: 'enduits-decoratifs',
    label: 'Enduits décoratifs',
    resume: 'Stuc, béton ciré, chaux et effets matière pour des murs qui ont une vraie présence.',
  },
  {
    slug: 'tadelakt',
    label: 'Tadelakt',
    resume: "L'enduit à la chaux ciré des salles de bain : continu, sans joints, naturellement adapté à l'eau.",
  },
  {
    slug: 'peinture-a-la-chaux',
    label: 'Peinture à la chaux',
    resume: 'Badigeons et peintures naturelles : un mat profond, respirant et sain pour l’intérieur.',
  },
  {
    slug: 'revetement-mural',
    label: 'Revêtement mural',
    resume: 'Papiers peints, textures et revêtements muraux posés avec précision.',
  },
  {
    slug: 'revetement-de-sol',
    label: 'Revêtement de sol',
    resume: 'Parquet flottant, vinyle et stratifié pour des sols rénovés et cohérents avec le projet.',
  },
  {
    slug: 'boiserie-et-ferronneries',
    label: 'Boiserie & ferronneries',
    resume: 'Portes, escaliers, châssis et éléments métalliques laqués dans les règles de l’art.',
  },
];
