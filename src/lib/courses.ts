import type { GolfCourse } from "./types";
import { classifyRegion, distanceFromDowntown } from "./geo";

export { REGIONS } from "./types";

/**
 * Curated courses that are NOT bookable through Chronogolf — the gap Chronogolf
 * leaves. These centralize the well-known Montréal-area courses on other
 * platforms (TeeOn, phone, their own site) so the aggregator is genuinely "all
 * of them," not just the Chronogolf marketplace. Tee times for these are
 * always *estimates* (clearly labelled), anchored to typical green fees, with a
 * link out to the course's real booking page.
 */
interface ExtraSeed {
  slug: string;
  name: string;
  city: string;
  holes: number[];
  lat: number;
  lng: number;
  weekday: number;
  weekend: number;
  bookingUrl: string;
  blurb: string;
  access: "public" | "semi-private" | "private";
}

const EXTRA_SEEDS: ExtraSeed[] = [
  {
    slug: "golf-le-mirage",
    name: "Golf Le Mirage",
    city: "Terrebonne",
    holes: [18, 18],
    lat: 45.72,
    lng: -73.69,
    weekday: 95,
    weekend: 115,
    bookingUrl: "https://www.golfmirage.ca",
    access: "private",
    blurb: "Céline Dion's manicured 36 — a private north-shore showpiece.",
  },
  {
    slug: "islesmere",
    name: "Club de Golf Islesmere",
    city: "Laval",
    holes: [18],
    lat: 45.62,
    lng: -73.83,
    weekday: 75,
    weekend: 90,
    bookingUrl: "https://islesmere.clublink.ca/",
    access: "private",
    blurb: "Private-feel championship layout in Laval.",
  },
  {
    slug: "rosemere",
    name: "Club de Golf Rosemère Fontainebleau",
    city: "Blainville",
    holes: [18],
    lat: 45.66103,
    lng: -73.82008,
    weekday: 90,
    weekend: 110,
    bookingUrl: "https://rosemere.clublink.ca/",
    access: "private",
    blurb: "The former Rosemère club, now a private ClubLink course in Blainville.",
  },
  {
    slug: "summerlea",
    name: "Golf Summerlea",
    city: "Vaudreuil-Dorion",
    holes: [18, 18],
    lat: 45.39,
    lng: -74.07,
    weekday: 60,
    weekend: 75,
    bookingUrl: "https://www.summerlea.com/",
    access: "private",
    blurb: "Two championship 18s at a private club west of the island.",
  },
  {
    slug: "vallee-du-richelieu",
    name: "Golf de la Vallée du Richelieu",
    city: "Sainte-Julie",
    holes: [18, 18],
    lat: 45.58,
    lng: -73.33,
    weekday: 70,
    weekend: 88,
    bookingUrl: "https://www.valleedurichelieu.com/",
    access: "private",
    blurb: "Two championship 18s at a private club near Mont Saint-Bruno.",
  },
  {
    slug: "la-madeleine",
    name: "Club de Golf La Madeleine",
    city: "Sainte-Madeleine",
    holes: [18, 18],
    lat: 45.61,
    lng: -73.12,
    weekday: 48,
    weekend: 60,
    bookingUrl: "https://secure.gggolf.ca/madeleine/index.php?lang=fr&option=com_ggpublic&req=user",
    access: "public",
    blurb: "Two public 18s (Le Presidential & Le Doral) in the Montérégie.",
  },
  {
    slug: "parcours-du-cerf",
    name: "Le Parcours du Cerf",
    city: "Longueuil",
    holes: [18, 18],
    lat: 45.5504,
    lng: -73.4231,
    weekday: 52,
    weekend: 58,
    bookingUrl: "https://secure.gggolf.ca/cerf/index.php?lang=fr&option=com_ggpublic&req=teetimes",
    access: "public",
    blurb: "Two public 18s (Le Brocard & Le Faon) in Longueuil.",
  },
  {
    slug: "ile-de-montreal",
    name: "Club de Golf de l'Île de Montréal",
    city: "Montréal",
    holes: [18, 18],
    lat: 45.6848,
    lng: -73.5366,
    weekday: 55,
    weekend: 65,
    bookingUrl: "https://secure.gggolf.ca/iledemontreal/index.php?Itemid=123&lang=fr&option=com_ggpublic",
    access: "public",
    blurb: "Two public 18s — the Ireland and Island courses — in east Montréal.",
  },
  {
    slug: "golf-atlantide",
    name: "Golf Atlantide",
    city: "Notre-Dame-de-l'Île-Perrot",
    holes: [18, 18],
    lat: 45.3745,
    lng: -73.9439,
    weekday: 58,
    weekend: 68,
    bookingUrl: "https://secure.gggolf.ca/atlantide/index.php?lang=fr&option=com_ggpublic&req=teetimes",
    access: "public",
    blurb: "Two public 18s beside Lac Saint-Louis on Île-Perrot.",
  },
];

export const EXTRA_COURSES: GolfCourse[] = EXTRA_SEEDS.map((e) => ({
  id: `extra-${e.slug}`,
  name: e.name,
  city: e.city,
  region: classifyRegion(e.city, e.lat, e.lng),
  holes: e.holes,
  distanceKm: distanceFromDowntown(e.lat, e.lng),
  lat: e.lat,
  lng: e.lng,
  source: "extra",
  weekdayPrice: e.weekday,
  weekendPrice: e.weekend,
  online: false,
  access: e.access,
  bookingUrl: e.bookingUrl,
  blurb: e.blurb,
}));
