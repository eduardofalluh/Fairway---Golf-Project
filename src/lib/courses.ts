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
    access: "public",
    blurb: "Céline Dion's manicured 36 — the north-shore showpiece.",
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
    bookingUrl: "https://www.google.com/search?q=Club%20de%20Golf%20Islesmere%20Laval%20tee%20times",
    access: "private",
    blurb: "Private-feel championship layout in Laval.",
  },
  {
    slug: "rosemere",
    name: "Club de Golf de Rosemère",
    city: "Rosemère",
    holes: [18],
    lat: 45.64,
    lng: -73.8,
    weekday: 90,
    weekend: 110,
    bookingUrl: "https://www.google.com/search?q=Club%20de%20Golf%20de%20Rosem%C3%A8re%20tee%20times",
    access: "private",
    blurb: "Storied 1920s design with tight, classic greens.",
  },
  {
    slug: "carling-lake",
    name: "Golf Carling Lake",
    city: "Pine Hill",
    holes: [18],
    lat: 45.78,
    lng: -74.55,
    weekday: 80,
    weekend: 95,
    bookingUrl: "https://www.google.com/search?q=Golf%20Carling%20Lake%20tee%20times%20booking",
    access: "public",
    blurb: "A Laurentians destination round worth the drive.",
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
    bookingUrl: "https://www.google.com/search?q=Golf%20Summerlea%20Vaudreuil%20tee%20times",
    access: "public",
    blurb: "Two championship 18s west of the island.",
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
    bookingUrl: "https://www.google.com/search?q=Golf%20de%20la%20Vall%C3%A9e%20du%20Richelieu%20Sainte-Julie%20tee%20times",
    access: "public",
    blurb: "36 holes at the foot of Mont Saint-Bruno.",
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
