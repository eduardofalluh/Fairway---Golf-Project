"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MarketId, ProviderId, SortKey } from "@/lib/types";

export type Language = "en" | "fr";

type Copy = {
  langName: string;
  toggleLabel: string;
  nav: {
    teeTimes: string;
    how: string;
    faq: string;
    find: string;
    home: string;
  };
  hero: {
    eyebrow: (courseCount: number) => string;
    title1: string;
    title2: string;
    body: string;
    playVideo: string;
    pauseVideo: string;
    videoUnsupported: string;
  };
  search: {
    label: string;
    markets: Record<MarketId, { label: string; short: string }>;
    date: string;
    time: string;
    flex: string;
    players: string;
    find: string;
    finding: string;
    flexValue: (minutes: number) => string;
    playersValue: (count: number) => string;
    quickDates: { today: string; tomorrow: string; saturday: string; sunday: string };
    editSearch: string;
    filters: string;
    morePlayers: string;
    fewerPlayers: string;
  };
  filters: {
    title: string;
    yourRound: string;
    refine: string;
    holes: string;
    any: string;
    holesValue: (holes: number) => string;
    maxPrice: string;
    targetBudget: string;
    targetHint: string;
    regions: string;
    allRegions: string;
    publicOnly: string;
    cartOnly: string;
    reset: string;
    show: (count: number) => string;
    close: string;
  };
  results: {
    eyebrow: string;
    checking: (courses: number) => string;
    checkingCourse: string;
    foundSoFar: (count: number) => string;
    heading: (count: number) => string;
    acrossCourses: (courses: number) => string;
    windowSummary: (date: string, start: string, end: string) => string;
    views: { course: string; time: string; map: string };
    viewsLabel: string;
    sort: string;
    sortLabels: Record<SortKey, string>;
    nearMe: string;
    locating: string;
    usingLocation: string;
    locationError: string;
    locationUnavailable: string;
    timelineLabel: string;
    timelineHint: string;
    allTimes: string;
    bucketLabel: (count: number, time: string) => string;
    from: string;
    perPlayer: string;
    spots: (count: number) => string;
    cart: string;
    holes: (count: number) => string;
    moreTimes: (count: number) => string;
    fewerTimes: string;
    bestMatch: string;
    onBudget: string;
    distance: (km: number, minutes: number | null) => string;
    showMore: (count: number) => string;
    emptyTitle: string;
    emptyBody: string;
    tryWider: string;
    tryTomorrow: string;
    clearFilters: string;
    providerName: Record<ProviderId, string>;
    providerBusy: (provider: string, seconds?: number) => string;
    providerPartial: (provider: string) => string;
    providerDown: (provider: string) => string;
    retry: string;
    serviceError: string;
    busyError: string;
    handoffTitle: (count: number) => string;
    handoffBody: string;
    handoffBadge: string;
    openProvider: (name: string) => string;
    mapCaption: (count: number, hasUser: boolean) => string;
    loadingMap: string;
    live: string;
    openDetails: (course: string, time: string) => string;
    announce: (count: number, courses: number) => string;
  };
  booking: {
    close: string;
    srDescription: string;
    live: string;
    date: string;
    where: string;
    round: string;
    greenFee: string;
    players: (count: number) => string;
    holes: (count: number) => string;
    checking: (provider: string) => string;
    verified: string;
    verifiedNote: string;
    changed: string;
    unverifiable: string;
    continueOn: (provider: string) => string;
    openAnyway: (provider: string) => string;
    pickAnother: string;
    signInFirst: (provider: string) => string;
    steps: { check: (date: string, time: string) => string; signIn: string; confirm: string };
    noReservation: string;
    emailDetails: string;
    emailLabel: string;
    send: string;
    sending: string;
    sent: (email: string) => string;
    invalidEmail: string;
    emailFailed: string;
  };
  sections: {
    howEyebrow: string;
    howTitle: string;
    steps: Array<{ n: string; title: string; body: string }>;
    faqEyebrow: string;
    faqTitle: string;
    faqIntro: string;
    faqs: Array<{ q: string; a: string }>;
    footerBody: string;
    footerSearch: string;
    footerHow: string;
    footerFaq: string;
    footerNote: string;
  };
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const copy: Record<Language, Copy> = {
  en: {
    langName: "English",
    toggleLabel: "Language",
    nav: { teeTimes: "Tee times", how: "How it works", faq: "FAQ", find: "Find a tee time", home: "Fairway home" },
    hero: {
      eyebrow: (count) => (count > 0 ? `Montréal + Toronto · ${count} courses, one search` : "Montréal + Toronto · one search"),
      title1: "Find your round.",
      title2: "We'll line it up.",
      body: "Pick a day and the hour you want to tee off. Fairway checks live tee sheets across the region and shows every open slot around it.",
      playVideo: "Play background video",
      pauseVideo: "Pause background video",
      videoUnsupported: "Your browser does not support background video.",
    },
    search: {
      label: "Search tee times",
      markets: {
        montreal: { label: "Montréal", short: "MTL" },
        toronto: { label: "Toronto", short: "TOR" },
      },
      date: "Date",
      time: "Tee off around",
      flex: "Flexible by",
      players: "Players",
      find: "Find tee times",
      finding: "Searching…",
      flexValue: (m) => (m === 0 ? "Exact time" : m < 60 ? `± ${m} min` : `± ${m / 60} hr`),
      playersValue: (n) => plural(n, "player", "players"),
      quickDates: { today: "Today", tomorrow: "Tomorrow", saturday: "Sat", sunday: "Sun" },
      editSearch: "Edit search",
      filters: "Filters",
      morePlayers: "Add a player",
      fewerPlayers: "Remove a player",
    },
    filters: {
      title: "Refine your search",
      yourRound: "Your round",
      refine: "Filters",
      holes: "Holes",
      any: "Any",
      holesValue: (h) => `${h} holes`,
      maxPrice: "Max green fee",
      targetBudget: "Budget sweet spot",
      targetHint: "Sort by “Closest to my budget” to rank by this.",
      regions: "Regions",
      allRegions: "All regions",
      publicOnly: "Public courses only",
      cartOnly: "Cart included",
      reset: "Reset filters",
      show: (n) => (n === 1 ? "Show 1 tee time" : `Show ${n} tee times`),
      close: "Close filters",
    },
    results: {
      eyebrow: "Live tee times",
      checking: (n) => (n > 0 ? `Checking ${n} courses…` : "Checking live tee sheets…"),
      checkingCourse: "Now checking",
      foundSoFar: (n) => `${plural(n, "tee time", "tee times")} found so far`,
      heading: (n) => (n === 1 ? "tee time" : "tee times"),
      acrossCourses: (n) => `across ${plural(n, "course", "courses")}`,
      windowSummary: (date, start, end) => `${date} · ${start} – ${end}`,
      views: { course: "By course", time: "By time", map: "Map" },
      viewsLabel: "Result view",
      sort: "Sort",
      sortLabels: {
        "closest-time": "Closest to my time",
        "price-asc": "Price: low → high",
        "price-desc": "Price: high → low",
        "closest-price": "Closest to my budget",
        distance: "Nearest",
      },
      nearMe: "Near me",
      locating: "Locating…",
      usingLocation: "Using your location",
      locationError: "Couldn't get your location — allow it and try again.",
      locationUnavailable: "Location isn't available in this browser.",
      timelineLabel: "Open slots through your window",
      timelineHint: "Tap a bar to focus on that quarter hour.",
      allTimes: "All times",
      bucketLabel: (n, time) => `${plural(n, "slot", "slots")} at ${time}`,
      from: "from",
      perPlayer: "per player",
      spots: (n) => `${plural(n, "spot", "spots")} open`,
      cart: "cart",
      holes: (n) => `${n} holes`,
      moreTimes: (n) => `+${n} more`,
      fewerTimes: "Show fewer",
      bestMatch: "Best match",
      onBudget: "On budget",
      distance: (km, min) => (min == null ? `${km} km` : `${km} km · ~${min} min`),
      showMore: (n) => `Show ${n} more`,
      emptyTitle: "Nothing open in that window",
      emptyBody: "Tee sheets fill fast. Widen the window, try another day, or loosen a filter.",
      tryWider: "Widen to ± 2 hr",
      tryTomorrow: "Try the next day",
      clearFilters: "Clear filters",
      providerName: { chronogolf: "Chronogolf", teetime: "TeeTime" },
      providerBusy: (p, s) => `${p} asked us to slow down${s ? ` — try again in about ${s}s` : ""}. Showing everything we could check.`,
      providerPartial: (p) => `Some ${p} courses didn't answer in time, so a few tee times may be missing.`,
      providerDown: (p) => `${p} isn't answering right now.`,
      retry: "Retry",
      serviceError: "We couldn't reach the tee-time service. Check your connection and try again.",
      busyError: "You're searching faster than the tee sheets can keep up. Give it a few seconds.",
      handoffTitle: (n) => `${plural(n, "course", "courses")} you can book directly`,
      handoffBody: "Live tee sheets are unreachable for these right now. Open the course's own booking page to see times.",
      handoffBadge: "Book on site",
      openProvider: (name) => `Open ${name}`,
      mapCaption: (n, hasUser) =>
        `${plural(n, "course", "courses")} · ${hasUser ? "the blue dot is you" : "tap “Near me” to measure distance"}`,
      loadingMap: "Loading map…",
      live: "Live",
      openDetails: (course, time) => `Book ${course} at ${time}`,
      announce: (n, c) => `${plural(n, "tee time", "tee times")} across ${plural(c, "course", "courses")}`,
    },
    booking: {
      close: "Close",
      srDescription: "Review this tee time, then continue to the provider to reserve and pay.",
      live: "Live",
      date: "Date",
      where: "Where",
      round: "Round",
      greenFee: "Green fee · per player",
      players: (n) => plural(n, "player", "players"),
      holes: (n) => `${n} holes`,
      checking: (p) => `Re-checking this slot with ${p}…`,
      verified: "Still open — verified just now",
      verifiedNote: "Your date and round length are already in the link.",
      changed: "That tee time was just taken or changed. Pick another one.",
      unverifiable: "The provider is busy, so we couldn't re-check. Its booking page shows what's open.",
      continueOn: (p) => `Continue on ${p}`,
      openAnyway: (p) => `Open ${p} anyway`,
      pickAnother: "Back to tee times",
      signInFirst: (p) => `Have a ${p} account? Sign in first`,
      steps: {
        check: (date, time) => `Pick ${time} on ${date}`,
        signIn: "Sign in or check out as a guest",
        confirm: "Confirm and pay with the course",
      },
      noReservation: "Fairway doesn't hold or book the slot. The course's confirmation is your booking.",
      emailDetails: "Email me these details",
      emailLabel: "Email address",
      send: "Send",
      sending: "Sending…",
      sent: (email) => `Sent to ${email}.`,
      invalidEmail: "Please enter a valid email address",
      emailFailed: "The email could not be delivered.",
    },
    sections: {
      howEyebrow: "How it works",
      howTitle: "From an open afternoon\nto a booked round.",
      steps: [
        { n: "01", title: "Pick the hour", body: "Choose the day, when you'd like to tee off, how flexible you are and how many are playing." },
        { n: "02", title: "See every open slot", body: "Fairway reads live tee sheets across Montréal and Toronto and lines them up by course, time, price or distance." },
        { n: "03", title: "Book with the course", body: "We re-check your slot, then send you to the course's booking page with the date already filled in." },
      ],
      faqEyebrow: "Before you tee off",
      faqTitle: "Good questions.",
      faqIntro: "Fairway finds and compares tee times. The course or its booking provider takes the reservation and payment.",
      faqs: [
        { q: "Are these tee times real?", a: "Yes. Fairway only shows slots that a provider's live tee sheet lists right now, and re-checks your pick before sending you on. Nothing is estimated." },
        { q: "Where does availability come from?", a: "Chronogolf for most Québec and Ontario courses, plus TeeTime clubs in the GTA. Courses that use other systems appear as direct links to their own booking page." },
        { q: "Why is a course missing or a time gone?", a: "Most courses open their sheets a few days ahead, and popular times go fast. If a provider is busy, Fairway shows what it could check and tells you." },
        { q: "Does Fairway take payment?", a: "No. You confirm and pay on the course's booking page, and the course sends your confirmation." },
      ],
      footerBody: "One search for tee times around Montréal and Toronto.",
      footerSearch: "Search",
      footerHow: "How it works",
      footerFaq: "FAQ",
      footerNote: "Bookings are confirmed by each course.",
    },
  },
  fr: {
    langName: "Français",
    toggleLabel: "Langue",
    nav: { teeTimes: "Départs", how: "Fonctionnement", faq: "FAQ", find: "Trouver un départ", home: "Accueil Fairway" },
    hero: {
      eyebrow: (count) => (count > 0 ? `Montréal + Toronto · ${count} parcours, une recherche` : "Montréal + Toronto · une recherche"),
      title1: "Trouvez votre ronde.",
      title2: "On s’occupe du reste.",
      body: "Choisissez le jour et l’heure de départ souhaitée. Fairway consulte les feuilles de départ en direct de la région et affiche chaque créneau libre autour.",
      playVideo: "Lire la vidéo d’arrière-plan",
      pauseVideo: "Mettre la vidéo en pause",
      videoUnsupported: "Votre navigateur ne prend pas en charge la vidéo d’arrière-plan.",
    },
    search: {
      label: "Rechercher des départs",
      markets: {
        montreal: { label: "Montréal", short: "MTL" },
        toronto: { label: "Toronto", short: "TOR" },
      },
      date: "Date",
      time: "Départ vers",
      flex: "Flexibilité",
      players: "Joueurs",
      find: "Trouver des départs",
      finding: "Recherche…",
      flexValue: (m) => (m === 0 ? "Heure exacte" : m < 60 ? `± ${m} min` : `± ${String(m / 60).replace(".", ",")} h`),
      playersValue: (n) => plural(n, "joueur", "joueurs"),
      quickDates: { today: "Aujourd’hui", tomorrow: "Demain", saturday: "Sam.", sunday: "Dim." },
      editSearch: "Modifier",
      filters: "Filtres",
      morePlayers: "Ajouter un joueur",
      fewerPlayers: "Retirer un joueur",
    },
    filters: {
      title: "Affinez votre recherche",
      yourRound: "Votre ronde",
      refine: "Filtres",
      holes: "Trous",
      any: "Tous",
      holesValue: (h) => `${h} trous`,
      maxPrice: "Droit de jeu max.",
      targetBudget: "Budget idéal",
      targetHint: "Triez par « Plus près de mon budget » pour classer selon ce montant.",
      regions: "Régions",
      allRegions: "Toutes les régions",
      publicOnly: "Parcours publics seulement",
      cartOnly: "Voiturette incluse",
      reset: "Réinitialiser",
      show: (n) => (n === 1 ? "Voir 1 départ" : `Voir ${n} départs`),
      close: "Fermer les filtres",
    },
    results: {
      eyebrow: "Départs en direct",
      checking: (n) => (n > 0 ? `Vérification de ${n} parcours…` : "Vérification des feuilles de départ…"),
      checkingCourse: "En cours",
      foundSoFar: (n) => `${plural(n, "départ trouvé", "départs trouvés")} jusqu’ici`,
      heading: (n) => (n === 1 ? "départ" : "départs"),
      acrossCourses: (n) => `dans ${plural(n, "parcours", "parcours")}`,
      windowSummary: (date, start, end) => `${date} · ${start} – ${end}`,
      views: { course: "Par parcours", time: "Par heure", map: "Carte" },
      viewsLabel: "Affichage des résultats",
      sort: "Trier",
      sortLabels: {
        "closest-time": "Plus près de mon heure",
        "price-asc": "Prix : croissant",
        "price-desc": "Prix : décroissant",
        "closest-price": "Plus près de mon budget",
        distance: "Les plus proches",
      },
      nearMe: "Près de moi",
      locating: "Localisation…",
      usingLocation: "Votre position",
      locationError: "Impossible d’obtenir votre position — autorisez-la et réessayez.",
      locationUnavailable: "La localisation n’est pas offerte dans ce navigateur.",
      timelineLabel: "Créneaux libres dans votre plage",
      timelineHint: "Touchez une barre pour voir ce quart d’heure.",
      allTimes: "Toutes les heures",
      bucketLabel: (n, time) => `${plural(n, "créneau", "créneaux")} à ${time}`,
      from: "dès",
      perPlayer: "par joueur",
      spots: (n) => `${plural(n, "place libre", "places libres")}`,
      cart: "voiturette",
      holes: (n) => `${n} trous`,
      moreTimes: (n) => `+${n} autres`,
      fewerTimes: "Voir moins",
      bestMatch: "Meilleur choix",
      onBudget: "Dans le budget",
      distance: (km, min) => (min == null ? `${km} km` : `${km} km · ~${min} min`),
      showMore: (n) => `Voir ${n} de plus`,
      emptyTitle: "Rien de libre dans cette plage",
      emptyBody: "Les feuilles de départ se remplissent vite. Élargissez la plage, essayez un autre jour ou retirez un filtre.",
      tryWider: "Élargir à ± 2 h",
      tryTomorrow: "Essayer le lendemain",
      clearFilters: "Effacer les filtres",
      providerName: { chronogolf: "Chronogolf", teetime: "TeeTime" },
      providerBusy: (p, s) => `${p} nous demande de ralentir${s ? ` — réessayez dans environ ${s} s` : ""}. Voici tout ce qu’on a pu vérifier.`,
      providerPartial: (p) => `Certains parcours ${p} n’ont pas répondu à temps; quelques départs peuvent manquer.`,
      providerDown: (p) => `${p} ne répond pas pour le moment.`,
      retry: "Réessayer",
      serviceError: "Impossible de joindre le service de départs. Vérifiez votre connexion et réessayez.",
      busyError: "Vous cherchez plus vite que les feuilles de départ peuvent suivre. Patientez quelques secondes.",
      handoffTitle: (n) => `${plural(n, "parcours", "parcours")} à réserver directement`,
      handoffBody: "Leurs feuilles en direct sont inaccessibles pour l’instant. Ouvrez la page de réservation du parcours pour voir les heures.",
      handoffBadge: "Réserver sur le site",
      openProvider: (name) => `Ouvrir ${name}`,
      mapCaption: (n, hasUser) =>
        `${plural(n, "parcours", "parcours")} · ${hasUser ? "le point bleu, c’est vous" : "touchez « Près de moi » pour mesurer la distance"}`,
      loadingMap: "Chargement de la carte…",
      live: "Direct",
      openDetails: (course, time) => `Réserver ${course} à ${time}`,
      announce: (n, c) => `${plural(n, "départ", "départs")} dans ${plural(c, "parcours", "parcours")}`,
    },
    booking: {
      close: "Fermer",
      srDescription: "Vérifiez ce départ, puis continuez chez le fournisseur pour réserver et payer.",
      live: "Direct",
      date: "Date",
      where: "Lieu",
      round: "Ronde",
      greenFee: "Droit de jeu · par joueur",
      players: (n) => plural(n, "joueur", "joueurs"),
      holes: (n) => `${n} trous`,
      checking: (p) => `Nouvelle vérification auprès de ${p}…`,
      verified: "Toujours libre — vérifié à l’instant",
      verifiedNote: "La date et le nombre de trous sont déjà dans le lien.",
      changed: "Ce départ vient d’être pris ou a changé. Choisissez-en un autre.",
      unverifiable: "Le fournisseur est occupé; on n’a pas pu revérifier. Sa page de réservation montre ce qui est libre.",
      continueOn: (p) => `Continuer sur ${p}`,
      openAnyway: (p) => `Ouvrir ${p} quand même`,
      pickAnother: "Retour aux départs",
      signInFirst: (p) => `Vous avez un compte ${p}? Connectez-vous d’abord`,
      steps: {
        check: (date, time) => `Choisissez ${time} le ${date}`,
        signIn: "Connectez-vous ou payez comme invité",
        confirm: "Confirmez et payez auprès du parcours",
      },
      noReservation: "Fairway ne retient ni ne réserve le départ. La confirmation du parcours fait foi.",
      emailDetails: "M’envoyer ces détails par courriel",
      emailLabel: "Adresse courriel",
      send: "Envoyer",
      sending: "Envoi…",
      sent: (email) => `Envoyé à ${email}.`,
      invalidEmail: "Entrez une adresse courriel valide",
      emailFailed: "Le courriel n’a pas pu être envoyé.",
    },
    sections: {
      howEyebrow: "Fonctionnement",
      howTitle: "D’un après-midi libre\nà une ronde réservée.",
      steps: [
        { n: "01", title: "Choisissez l’heure", body: "Le jour, l’heure de départ souhaitée, votre flexibilité et le nombre de joueurs." },
        { n: "02", title: "Voyez chaque créneau", body: "Fairway lit les feuilles de départ en direct à Montréal et Toronto et les classe par parcours, heure, prix ou distance." },
        { n: "03", title: "Réservez avec le parcours", body: "On revérifie votre créneau, puis on vous envoie à la page de réservation avec la date déjà remplie." },
      ],
      faqEyebrow: "Avant le départ",
      faqTitle: "Bonnes questions.",
      faqIntro: "Fairway trouve et compare les départs. Le parcours ou son fournisseur prend la réservation et le paiement.",
      faqs: [
        { q: "Ces départs sont-ils réels?", a: "Oui. Fairway affiche seulement les créneaux qu’une feuille de départ en direct liste en ce moment, et revérifie votre choix avant de vous rediriger. Rien n’est estimé." },
        { q: "D’où vient la disponibilité?", a: "De Chronogolf pour la plupart des parcours du Québec et de l’Ontario, et des clubs TeeTime dans la RGT. Les parcours sur d’autres systèmes apparaissent comme liens directs vers leur page de réservation." },
        { q: "Pourquoi un parcours ou une heure manque-t-il?", a: "La plupart des parcours ouvrent leurs feuilles quelques jours d’avance et les bonnes heures partent vite. Si un fournisseur est occupé, Fairway affiche ce qu’il a pu vérifier et vous le dit." },
        { q: "Fairway prend-il le paiement?", a: "Non. Vous confirmez et payez sur la page de réservation du parcours, qui vous envoie la confirmation." },
      ],
      footerBody: "Une seule recherche pour les départs autour de Montréal et Toronto.",
      footerSearch: "Chercher",
      footerHow: "Fonctionnement",
      footerFaq: "FAQ",
      footerNote: "Chaque parcours confirme sa réservation.",
    },
  },
};

const LanguageContext = createContext<{
  lang: Language;
  setLang: (lang: Language) => void;
  t: Copy;
} | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem("fairway-language");
    } catch {
      // Private browsing can block storage; English stays the default.
    }
    if (saved !== "fr" && saved !== "en") return;
    const frame = window.requestAnimationFrame(() => setLangState(saved));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem("fairway-language", next);
    } catch {
      // Storage is optional.
    }
  };

  const value = useMemo(() => ({ lang, setLang, t: copy[lang] }), [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

export function formatLongDateForLanguage(date: string, lang: Language) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(
    lang === "fr" ? "fr-CA" : "en-CA",
    { weekday: "long", month: "long", day: "numeric" },
  );
}

export function formatShortDateForLanguage(date: string, lang: Language) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(
    lang === "fr" ? "fr-CA" : "en-CA",
    { weekday: "short", month: "short", day: "numeric" },
  );
}

/** Clock time split for display: "1:05" + "PM" in English, "13 h 05" in French. */
export function timeParts(time: string, lang: Language): { main: string; suffix: string } {
  const [h, m] = time.split(":").map(Number);
  if (lang === "fr") return { main: `${h} h ${String(m).padStart(2, "0")}`, suffix: "" };
  return { main: `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`, suffix: h >= 12 ? "PM" : "AM" };
}

export function formatTimeForLanguage(time: string, lang: Language) {
  const { main, suffix } = timeParts(time, lang);
  return suffix ? `${main} ${suffix}` : main;
}
