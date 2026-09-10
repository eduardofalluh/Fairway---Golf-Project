"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BookingProviderId } from "@/lib/providers/config";
import type { MarketId } from "@/lib/types";

export type Language = "en" | "fr";

type ProviderCopy = {
  action: string;
  description: string;
};

type Copy = {
  langName: string;
  toggleLabel: string;
  nav: {
    accounts: string;
    teeTimes: string;
    how: string;
    faq: string;
    search: string;
  };
  hero: {
    eyebrow: (marketCount: number, courseCount: number) => string;
    title1: string;
    title2: string;
    explore: string;
    connect: string;
    body: string;
    playVideo: string;
    pauseVideo: string;
    videoUnsupported: string;
  };
  accounts: {
    eyebrow: string;
    title: string;
    body: string;
    stats: {
      chronogolf: string;
      teetime: string;
      toronto: string;
      connected: string;
      active: (count: number) => string;
    };
    providerHosted: string;
    connectedStatus: string;
    yourClub: string;
    chooseClub: (count: number) => string;
    signInClub: (clubName: string) => string;
    connected: string;
    chooseClubToSignIn: string;
    loggedIn: string;
    disconnect: string;
    clubHelp: string;
    markedConnected: (providerName: string) => string;
    confirmSignedIn: (providerName: string) => string;
    opensLogin: string;
    gggolfClubAccess: string;
    note: string;
    provider: Partial<Record<BookingProviderId, ProviderCopy>>;
  };
  search: {
    loadingMap: string;
    eyebrow: (area: string) => string;
    title: string;
    body: string;
    marketArea: Record<MarketId, string>;
    availabilityTitle: string;
    liveOnlyBody: string;
    liveEstimateBody: string;
    liveOnly: string;
    liveEstimates: string;
    date: string;
    preferredTime: string;
    players: string;
    flexibleBy: string;
    holes: string;
    any: string;
    holesValue: (holes: string | number) => string;
    targetBudget: string;
    hardCeiling: string;
    regions: string;
    publicOnly: string;
    allRegions: string;
    loadingButton: string;
    submit: string;
    updating: string;
    resultHeading: (total: number, courses: number) => string;
    rangeFrom: (liveRows: number) => string;
    resultSummary: (liveRows: number, total: number) => string;
    noResultsMeta: string;
    locationUnavailable: string;
    locationError: string;
    serviceError: string;
    genericError: string;
    useLocationTitle: string;
    locating: string;
    usingLocation: string;
    useLocation: string;
    list: string;
    map: string;
    change: string;
    sort: string;
    sortLabels: Record<string, string>;
    closest: string;
    liveNow: string;
    sortNearest: string;
    noMatches: () => string;
    includeEstimates: string;
    mapCaption: (count: number, hasUser: boolean) => string;
    liveLegend: string;
    estimateLegend: string;
    showingTop: (shown: number, total: number) => string;
    confirmedTitle: string;
    estimatedTitle: string;
    unavailableTitle: string;
    liveBadge: string;
    estimateBadge: string;
    unavailableBadge: string;
    connectedBadge: string;
    distanceFromYou: (km: number, minutes: number) => string;
    cart: string;
    onBudget: string;
    perPlayer: string;
    spotsOpen: (spots: number) => string;
    estimatedPerPlayer: string;
    unavailablePerPlayer: string;
    unavailable: string;
    bookWithConnected: (course: string, provider: string) => string;
    bookWith: (provider: string) => string;
    review: string;
    check: string;
  };
  booking: {
    invalidEmail: string;
    emailFailed: string;
    emailTryAgain: string;
    srDescription: string;
    close: string;
    available: string;
    estimated: string;
    live: string;
    est: string;
    date: string;
    teeTime: string;
    where: string;
    round: string;
    greenFee: string;
    unavailableFee: string;
    players: (count: number) => string;
    holes: (count: number) => string;
    liveIntro: string;
    estimateIntro: string;
    connectedIntro: (provider: string) => string;
    contextualIntro: string;
    checkIntro: string;
    providerConfirms: string;
    verifyingProvider: string;
    verificationFailed: string;
    invalidLink: string;
    bookWith: (provider: string) => string;
    continueOn: (provider: string) => string;
    opened: (provider: string) => string;
    checkStep: (date: string, time: string) => string;
    connectedStep: string;
    signInStep: string;
    confirmStep: string;
    noReservation: string;
    reopen: (provider: string) => string;
    sent: (email: string) => string;
    emailDetails: string;
    emailLabel: string;
    sending: string;
    send: string;
  };
  features: {
    imageAlt: string;
    imageEyebrow: string;
    imageTitle: string;
    eyebrow: string;
    title: string;
    items: Array<{ title: string; body: string }>;
  };
  sections: {
    howEyebrow: string;
    howTitle: string;
    steps: Array<{ n: string; title: string; body: string }>;
    ctaAlt: string;
    ctaEyebrow: string;
    ctaTitle: string;
    ctaButton: string;
    faqEyebrow: string;
    faqTitle: string;
    faqIntro: string;
    faqs: Array<{ q: string; a: string }>;
    footerBody: string;
    footerSearch: string;
    footerAccounts: string;
    footerFaq: string;
    footerNote: string;
  };
};

export const copy: Record<Language, Copy> = {
  en: {
    langName: "English",
    toggleLabel: "Language",
    nav: {
      accounts: "Accounts",
      teeTimes: "Tee times",
      how: "How it works",
      faq: "FAQ",
      search: "Search",
    },
    hero: {
      eyebrow: (marketCount, courseCount) =>
        `Montréal + Toronto · ${marketCount} markets · ${courseCount} courses tracked`,
      title1: "Find your round.",
      title2: "We'll line it up.",
      explore: "Explore tee times",
      connect: "Connect accounts",
      body: "Compare nearby courses and green fees. Find a time that fits.",
      playVideo: "Play background video",
      pauseVideo: "Pause background video",
      videoUnsupported: "Your browser does not support background video.",
    },
    accounts: {
      eyebrow: "Start here",
      title: "Connect your booking accounts first.",
      body: "Open Chronogolf, TeeTime, Golf the 6ix, MinuteGolf, GolfNow, or your club's GGGolf sign-in page before you compare tee times. Fairway keeps the search in one place while each provider handles its own secure login.",
      stats: {
        chronogolf: "Live tee times",
        teetime: "Toronto live slots",
        toronto: "City + GTA links",
        connected: "Connected",
        active: (count) => `${count} active`,
      },
      providerHosted: "Provider hosted",
      connectedStatus: "Live · Connected",
      yourClub: "Your club",
      chooseClub: (count) => `Choose your club (${count})`,
      signInClub: (clubName) => `Sign in · ${clubName}`,
      connected: "Connected",
      chooseClubToSignIn: "Choose a club to sign in",
      loggedIn: "I'm logged in",
      disconnect: "Disconnect on this device",
      clubHelp: "Club not listed? Get help finding its login",
      markedConnected: (providerName) => `${providerName} is marked connected on this device.`,
      confirmSignedIn: (providerName) =>
        `Confirm once you are signed in so Fairway can mark ${providerName} as connected here.`,
      opensLogin: "Opens the provider's login form in a new tab.",
      gggolfClubAccess: "GGGolf accounts are accessed through your club.",
      note: "Fairway checks live Chronogolf and TeeTime tee sheets when they are available. Other provider cards are secure handoffs to the booking system golfers already use. In-app account linking and checkout are not available yet, so complete and confirm your reservation with the provider.",
      provider: {
        chronogolf: {
          action: "Sign in on Chronogolf",
          description:
            "Live tee times come from Chronogolf when its course sheet is open. Sign in there before you finish booking.",
        },
        teetime: {
          action: "Sign in on TeeTime",
          description:
            "Toronto live tee times can come from TeeTime clubs. Sign in there before you finish booking.",
        },
        golfthe6ix: {
          action: "Open Golf the 6ix",
          description: "City of Toronto courses use Golf the 6ix for provider-hosted booking.",
        },
        golfnow: {
          action: "Sign in on GolfNow",
          description:
            "GolfNow is useful for Toronto-area provider handoffs where clubs use its booking network.",
        },
        minutegolf: {
          action: "Sign in on MinuteGolf",
          description: "Use MinuteGolf's own secure page. Your password stays with MinuteGolf.",
        },
        gggolf: {
          action: "Sign in on GGGolf",
          description: "Choose a verified local club portal. Your password stays with GGGolf.",
        },
      },
    },
    search: {
      loadingMap: "Loading map…",
      eyebrow: (area) => `Search ${area}`,
      title: "Your time. Your price.\nEvery fairway.",
      body: "Compare every useful option first. Only provider-confirmed slots appear here, so prices and times come from live booking sheets.",
      marketArea: { montreal: "Greater Montréal", toronto: "Toronto + GTA" },
      availabilityTitle: "Availability quality",
      liveOnlyBody:
        "Only provider-confirmed slots are shown. If a provider has not opened its tee sheet or the slot disappeared, Fairway shows no card.",
      liveEstimateBody:
        "Only provider-confirmed slots are shown. If a provider has not opened its tee sheet or the slot disappeared, Fairway shows no card.",
      liveOnly: "Live only",
      liveEstimates: "Live only",
      date: "Date",
      preferredTime: "I want to play around",
      players: "Players",
      flexibleBy: "Flexible by",
      holes: "Holes",
      any: "Any",
      holesValue: (holes) => `${holes} holes`,
      targetBudget: "Target budget",
      hardCeiling: "Hard ceiling",
      regions: "Regions",
      publicOnly: "Public courses only",
      allRegions: "All regions",
      loadingButton: "Searching the fairways…",
      submit: "Find my tee times",
      updating: "Updating tee times…",
      resultHeading: (total, courses) =>
        `${total} tee ${total === 1 ? "time" : "times"} · ${courses} ${courses === 1 ? "course" : "courses"}`,
      rangeFrom: () => "From",
      resultSummary: (liveRows) =>
        `${liveRows} live provider ${liveRows === 1 ? "slot" : "slots"}`,
      noResultsMeta: "No results match this search. Availability can change; check again or adjust your filters.",
      locationUnavailable: "Location isn't available in this browser.",
      locationError: "Couldn't get your location — allow it and try again.",
      serviceError: "We couldn't reach the tee-time service. Please try again.",
      genericError: "Something went wrong",
      useLocationTitle: "Sort and measure by distance from where you are",
      locating: "Locating…",
      usingLocation: "Using your location",
      useLocation: "Use my location",
      list: "List",
      map: "Map",
      change: "change",
      sort: "Sort",
      sortLabels: {
        "price-desc": "Price: high → low",
        "price-asc": "Price: low → high",
        "closest-price": "Closest to my budget",
        "closest-time": "Closest to my time",
        distance: "Nearest to me",
      },
      closest: "Closest to you",
      liveNow: "live now",
      sortNearest: "Sort by nearest →",
      noMatches: () =>
        "No provider-confirmed tee times match those filters. Try another time, region, or budget.",
      includeEstimates: "Show only provider-confirmed slots",
      mapCaption: (count, hasUser) =>
        `${count} courses · ${hasUser ? "blue dot is you" : "tap “Use my location” to measure distance"}. Tap a dot for times & booking.`,
      liveLegend: "● live",
      estimateLegend: "",
      showingTop: (_shown, total) => `Showing the top 60 of ${total}. Tighten your filters to narrow it down.`,
      confirmedTitle: "Confirmed on the course's live tee sheet right now",
      estimatedTitle: "Not provider-confirmed",
      unavailableTitle: "Not provider-confirmed, so Fairway will not offer this as bookable",
      liveBadge: "● Live",
      estimateBadge: "Unavailable",
      unavailableBadge: "Unavailable",
      connectedBadge: "Connected",
      distanceFromYou: (km, minutes) => `📍 ${km} km · ~${minutes} min`,
      cart: "cart",
      onBudget: "On budget",
      perPlayer: "per player",
      spotsOpen: (spots) => `${spots} ${spots === 1 ? "spot" : "spots"} open`,
      estimatedPerPlayer: "not provider-confirmed",
      unavailablePerPlayer: "not provider-confirmed",
      unavailable: "Unavailable",
      bookWithConnected: (course, provider) => `Book ${course} with connected ${provider} account`,
      bookWith: (provider) => `Book with ${provider} ↗`,
      review: "Review",
      check: "Check",
    },
    booking: {
      invalidEmail: "Please enter a valid email address",
      emailFailed: "The email could not be delivered.",
      emailTryAgain: "Couldn't send the details — try again.",
      srDescription: "Review this tee time and continue to the provider to complete the reservation.",
      close: "Close booking details",
      available: "Available tee time",
      estimated: "Unavailable tee time",
      live: "Live",
      est: "Est.",
      date: "Date",
      teeTime: "Tee time",
      where: "Where",
      round: "Round",
      greenFee: "Green fee · per player",
      unavailableFee: "Not confirmed",
      players: (count) => `${count} ${count === 1 ? "player" : "players"}`,
      holes: (count) => `${count} holes`,
      liveIntro: "Fairway will re-check this exact tee time with the provider before opening checkout.",
      estimateIntro:
        "This tee time is not provider-confirmed, so Fairway will not prepare it for booking.",
      connectedIntro: (provider) =>
        `Your ${provider} account is marked connected on this device, so this opens the provider booking page in one click.`,
      contextualIntro: "Your date and round length are included in the booking link.",
      checkIntro: "Check the date, time, player count, and price on the next page.",
      providerConfirms: "The provider still confirms the reservation and payment.",
      verifyingProvider: "Verifying live availability…",
      verificationFailed: "This slot changed on the provider site. Search again before booking.",
      invalidLink: "This course does not have a valid booking link yet.",
      bookWith: (provider) => `Verify and continue on ${provider}`,
      continueOn: (provider) => `Verify and continue on ${provider}`,
      opened: (provider) => `${provider} opened`,
      checkStep: (date, time) => `Check ${date} at ${time}`,
      connectedStep: "Your provider account is already marked connected here",
      signInStep: "Sign in or create your provider account",
      confirmStep: "Review the total and confirm on the provider page",
      noReservation:
        "No reservation has been made in Fairway. The provider's confirmation is your proof of booking.",
      reopen: (provider) => `Reopen ${provider}`,
      sent: (email) => `Sent to ${email} — check your inbox.`,
      emailDetails: "Email me these details too",
      emailLabel: "Email address",
      sending: "Sending…",
      send: "Send",
    },
    features: {
      imageAlt: "Golf ball on a tee in warm evening light",
      imageEyebrow: "Made for the spontaneous round",
      imageTitle: "More time playing. Less time searching.",
      eyebrow: "Why Fairway",
      title: "One search.\nA clearer choice.",
      items: [
        {
          title: "The market in one view",
          body: "See available rounds from supported booking platforms without juggling tabs.",
        },
        {
          title: "Compare the real price",
          body: "Sort by green fee, budget fit, time, or distance before you commit.",
        },
        {
          title: "Search on your schedule",
          body: "Choose an exact time or widen the window when the round matters more than the hour.",
        },
      ],
    },
    sections: {
      howEyebrow: "The Fairway route",
      howTitle: "From an open afternoon\nto a booked round.",
      steps: [
        { n: "01", title: "Set the round", body: "Choose the day, party size, preferred time, and how far you are willing to travel." },
        { n: "02", title: "Compare the field", body: "Scan live tee times across supported providers and sort the results by price, time, or distance." },
        { n: "03", title: "Finish the booking", body: "Pick your tee time and continue with the provider account you already use to review and confirm." },
      ],
      ctaAlt: "A golf course winding through forest in morning light",
      ctaEyebrow: "Your next round is out there",
      ctaTitle: "See what's open.\nChoose your fairway.",
      ctaButton: "Search tee times",
      faqEyebrow: "Before you tee off",
      faqTitle: "A few good questions.",
      faqIntro:
        "The app keeps discovery, provider sign-in, and booking handoff together, while final confirmation stays on the provider page.",
      faqs: [
        { q: "Are all results live?", a: "Yes. Fairway now shows only provider-confirmed tee times. If a provider sheet is closed, unavailable, or the slot disappears, that card is not shown." },
        { q: "Where does availability come from?", a: "Chronogolf and TeeTime availability appears only when their live tee sheets are reachable. Other provider account cards remain secure sign-in handoffs, but they do not create tee-time cards." },
        { q: "How does the time window work?", a: "Choose your ideal tee time and up to three hours of flexibility in either direction. Fairway returns matching slots and lets you sort the list your way." },
        { q: "Does Fairway complete the payment?", a: "You review the final details, sign in on the provider page, and complete payment there. The provider sends the booking confirmation." },
      ],
      footerBody: "One place to discover and compare golf around Montréal and Toronto.",
      footerSearch: "Search",
      footerAccounts: "Accounts",
      footerFaq: "FAQ",
      footerNote: "Confirm final details with the provider.",
    },
  },
  fr: {
    langName: "Français",
    toggleLabel: "Langue",
    nav: {
      accounts: "Comptes",
      teeTimes: "Départs",
      how: "Fonctionnement",
      faq: "FAQ",
      search: "Chercher",
    },
    hero: {
      eyebrow: (marketCount, courseCount) =>
        `Montréal + Toronto · ${marketCount} marchés · ${courseCount} parcours suivis`,
      title1: "Trouvez votre ronde.",
      title2: "On vous l’aligne.",
      explore: "Voir les départs",
      connect: "Connecter les comptes",
      body: "Comparez les parcours près de vous et les droits de jeu. Trouvez l’heure qui vous convient.",
      playVideo: "Lire la vidéo d’arrière-plan",
      pauseVideo: "Mettre la vidéo d’arrière-plan en pause",
      videoUnsupported: "Votre navigateur ne prend pas en charge la vidéo d’arrière-plan.",
    },
    accounts: {
      eyebrow: "Commencez ici",
      title: "Connectez d’abord vos comptes de réservation.",
      body: "Ouvrez Chronogolf, TeeTime, Golf the 6ix, MinuteGolf, GolfNow ou la page de connexion GGGolf de votre club avant de comparer les départs. Fairway garde la recherche au même endroit pendant que chaque fournisseur gère sa propre connexion sécurisée.",
      stats: {
        chronogolf: "Départs en direct",
        teetime: "Départs Toronto en direct",
        toronto: "Liens ville + RGT",
        connected: "Connecté",
        active: (count) => `${count} actif${count === 1 ? "" : "s"}`,
      },
      providerHosted: "Chez le fournisseur",
      connectedStatus: "En direct · Connecté",
      yourClub: "Votre club",
      chooseClub: (count) => `Choisir votre club (${count})`,
      signInClub: (clubName) => `Connexion · ${clubName}`,
      connected: "Connecté",
      chooseClubToSignIn: "Choisissez un club pour vous connecter",
      loggedIn: "Je suis connecté",
      disconnect: "Déconnecter sur cet appareil",
      clubHelp: "Club absent? Aide pour trouver sa connexion",
      markedConnected: (providerName) => `${providerName} est marqué connecté sur cet appareil.`,
      confirmSignedIn: (providerName) =>
        `Confirmez après vous être connecté pour que Fairway marque ${providerName} comme connecté ici.`,
      opensLogin: "Ouvre le formulaire de connexion du fournisseur dans un nouvel onglet.",
      gggolfClubAccess: "Les comptes GGGolf passent par votre club.",
      note: "Fairway vérifie les feuilles de départ Chronogolf et TeeTime en direct quand elles sont accessibles. Les autres cartes de fournisseurs sont des redirections sécurisées vers les systèmes de réservation déjà utilisés par les golfeurs. La connexion de compte et le paiement intégrés ne sont pas encore disponibles; complétez et confirmez donc votre réservation chez le fournisseur.",
      provider: {
        chronogolf: {
          action: "Connexion à Chronogolf",
          description:
            "Les départs en direct viennent de Chronogolf quand la feuille du parcours est ouverte. Connectez-vous là-bas avant de terminer la réservation.",
        },
        teetime: {
          action: "Connexion à TeeTime",
          description:
            "Les départs en direct à Toronto peuvent venir des clubs TeeTime. Connectez-vous là-bas avant de terminer la réservation.",
        },
        golfthe6ix: {
          action: "Ouvrir Golf the 6ix",
          description: "Les parcours de la Ville de Toronto utilisent Golf the 6ix pour la réservation chez le fournisseur.",
        },
        golfnow: {
          action: "Connexion à GolfNow",
          description:
            "GolfNow est utile pour les redirections de parcours de la région de Toronto qui utilisent son réseau de réservation.",
        },
        minutegolf: {
          action: "Connexion à MinuteGolf",
          description: "Utilisez la page sécurisée de MinuteGolf. Votre mot de passe reste avec MinuteGolf.",
        },
        gggolf: {
          action: "Connexion à GGGolf",
          description: "Choisissez un portail de club local vérifié. Votre mot de passe reste avec GGGolf.",
        },
      },
    },
    search: {
      loadingMap: "Chargement de la carte…",
      eyebrow: (area) => `Recherche ${area}`,
      title: "Votre heure. Votre prix.\nTous les fairways.",
      body: "Comparez d’abord toutes les bonnes options. Seuls les départs confirmés par les fournisseurs apparaissent ici, avec des prix et heures tirés des feuilles de réservation en direct.",
      marketArea: { montreal: "Grand Montréal", toronto: "Toronto + RGT" },
      availabilityTitle: "Qualité de la disponibilité",
      liveOnlyBody:
        "Seuls les départs confirmés par les fournisseurs sont affichés. Si la feuille n’est pas ouverte ou si le départ a disparu, Fairway ne montre pas de carte.",
      liveEstimateBody:
        "Seuls les départs confirmés par les fournisseurs sont affichés. Si la feuille n’est pas ouverte ou si le départ a disparu, Fairway ne montre pas de carte.",
      liveOnly: "Direct seulement",
      liveEstimates: "Direct seulement",
      date: "Date",
      preferredTime: "Je veux jouer vers",
      players: "Joueurs",
      flexibleBy: "Flexible de",
      holes: "Trous",
      any: "Tous",
      holesValue: (holes) => `${holes} trous`,
      targetBudget: "Budget cible",
      hardCeiling: "Prix maximum",
      regions: "Régions",
      publicOnly: "Parcours publics seulement",
      allRegions: "Toutes les régions",
      loadingButton: "Recherche des départs…",
      submit: "Trouver mes départs",
      updating: "Mise à jour des départs…",
      resultHeading: (total, courses) =>
        `${total} départ${total === 1 ? "" : "s"} · ${courses} parcours`,
      rangeFrom: () => "À partir de",
      resultSummary: (liveRows) =>
        `${liveRows} départ${liveRows === 1 ? "" : "s"} fournisseur en direct`,
      noResultsMeta: "Aucun résultat ne correspond à cette recherche. La disponibilité peut changer; réessayez ou ajustez vos filtres.",
      locationUnavailable: "La localisation n’est pas disponible dans ce navigateur.",
      locationError: "Impossible d’obtenir votre position — autorisez-la et réessayez.",
      serviceError: "Impossible de joindre le service de départs. Veuillez réessayer.",
      genericError: "Une erreur est survenue",
      useLocationTitle: "Trier et mesurer la distance depuis votre position",
      locating: "Localisation…",
      usingLocation: "Position utilisée",
      useLocation: "Utiliser ma position",
      list: "Liste",
      map: "Carte",
      change: "changer",
      sort: "Trier",
      sortLabels: {
        "price-desc": "Prix : élevé → bas",
        "price-asc": "Prix : bas → élevé",
        "closest-price": "Plus près de mon budget",
        "closest-time": "Plus près de mon heure",
        distance: "Le plus proche",
      },
      closest: "Le plus proche de vous",
      liveNow: "en direct",
      sortNearest: "Trier par proximité →",
      noMatches: () =>
        "Aucun départ confirmé par un fournisseur ne correspond à ces filtres. Essayez une autre heure, région ou budget.",
      includeEstimates: "Afficher seulement les départs confirmés",
      mapCaption: (count, hasUser) =>
        `${count} parcours · ${hasUser ? "le point bleu, c’est vous" : "touchez « Utiliser ma position » pour mesurer la distance"}. Touchez un point pour voir les heures et réserver.`,
      liveLegend: "● direct",
      estimateLegend: "",
      showingTop: (_shown, total) => `Affichage des 60 meilleurs sur ${total}. Resserrez les filtres pour réduire la liste.`,
      confirmedTitle: "Confirmé sur la feuille de départ en direct du parcours",
      estimatedTitle: "Non confirmé par le fournisseur",
      unavailableTitle: "Non confirmé par le fournisseur, donc Fairway ne l’offre pas comme réservable",
      liveBadge: "● Direct",
      estimateBadge: "Indisponible",
      unavailableBadge: "Indisponible",
      connectedBadge: "Connecté",
      distanceFromYou: (km, minutes) => `📍 ${km} km · ~${minutes} min`,
      cart: "voiturette",
      onBudget: "Dans le budget",
      perPlayer: "par joueur",
      spotsOpen: (spots) => `${spots} place${spots === 1 ? "" : "s"} libre${spots === 1 ? "" : "s"}`,
      estimatedPerPlayer: "non confirmé par le fournisseur",
      unavailablePerPlayer: "non confirmé par le fournisseur",
      unavailable: "Indisponible",
      bookWithConnected: (course, provider) => `Réserver ${course} avec le compte ${provider} connecté`,
      bookWith: (provider) => `Réserver avec ${provider} ↗`,
      review: "Voir",
      check: "Vérifier",
    },
    booking: {
      invalidEmail: "Veuillez entrer une adresse courriel valide",
      emailFailed: "Le courriel n’a pas pu être envoyé.",
      emailTryAgain: "Impossible d’envoyer les détails — réessayez.",
      srDescription: "Vérifiez ce départ et continuez chez le fournisseur pour compléter la réservation.",
      close: "Fermer les détails de réservation",
      available: "Départ disponible",
      estimated: "Départ indisponible",
      live: "Direct",
      est: "Est.",
      date: "Date",
      teeTime: "Heure de départ",
      where: "Lieu",
      round: "Ronde",
      greenFee: "Droit de jeu · par joueur",
      unavailableFee: "Non confirmé",
      players: (count) => `${count} joueur${count === 1 ? "" : "s"}`,
      holes: (count) => `${count} trous`,
      liveIntro: "Fairway revérifie ce départ exact chez le fournisseur avant d’ouvrir la réservation.",
      estimateIntro:
        "Ce départ n’est pas confirmé par le fournisseur, donc Fairway ne le prépare pas pour la réservation.",
      connectedIntro: (provider) =>
        `Votre compte ${provider} est marqué connecté sur cet appareil; la page de réservation du fournisseur s’ouvre donc en un clic.`,
      contextualIntro: "La date et la durée de la ronde sont incluses dans le lien de réservation.",
      checkIntro: "Vérifiez la date, l’heure, le nombre de joueurs et le prix sur la page suivante.",
      providerConfirms: "Le fournisseur confirme quand même la réservation et le paiement.",
      verifyingProvider: "Vérification de la disponibilité en direct…",
      verificationFailed: "Ce départ a changé sur le site du fournisseur. Relancez la recherche avant de réserver.",
      invalidLink: "Ce parcours n’a pas encore de lien de réservation valide.",
      bookWith: (provider) => `Vérifier et continuer sur ${provider}`,
      continueOn: (provider) => `Vérifier et continuer sur ${provider}`,
      opened: (provider) => `${provider} ouvert`,
      checkStep: (date, time) => `Vérifiez ${date} à ${time}`,
      connectedStep: "Votre compte fournisseur est déjà marqué connecté ici",
      signInStep: "Connectez-vous ou créez votre compte fournisseur",
      confirmStep: "Vérifiez le total et confirmez sur la page du fournisseur",
      noReservation:
        "Aucune réservation n’a été faite dans Fairway. La confirmation du fournisseur est votre preuve de réservation.",
      reopen: (provider) => `Rouvrir ${provider}`,
      sent: (email) => `Envoyé à ${email} — vérifiez votre boîte de réception.`,
      emailDetails: "M’envoyer aussi ces détails par courriel",
      emailLabel: "Adresse courriel",
      sending: "Envoi…",
      send: "Envoyer",
    },
    features: {
      imageAlt: "Balle de golf sur un tee dans une lumière chaude de fin de journée",
      imageEyebrow: "Pensé pour la ronde spontanée",
      imageTitle: "Plus de temps à jouer. Moins de temps à chercher.",
      eyebrow: "Pourquoi Fairway",
      title: "Une recherche.\nUn choix plus clair.",
      items: [
        {
          title: "Le marché en une seule vue",
          body: "Voyez les rondes disponibles sur les plateformes compatibles sans jongler avec les onglets.",
        },
        {
          title: "Comparez le vrai prix",
          body: "Triez par droit de jeu, respect du budget, heure ou distance avant de réserver.",
        },
        {
          title: "Cherchez selon votre horaire",
          body: "Choisissez une heure exacte ou élargissez la fenêtre quand la ronde compte plus que l’heure précise.",
        },
      ],
    },
    sections: {
      howEyebrow: "Le parcours Fairway",
      howTitle: "D’un après-midi libre\nà une ronde réservée.",
      steps: [
        { n: "01", title: "Réglez la ronde", body: "Choisissez la journée, la taille du groupe, l’heure préférée et la distance que vous êtes prêt à parcourir." },
        { n: "02", title: "Comparez le terrain", body: "Parcourez les départs en direct chez les fournisseurs compatibles et triez les résultats par prix, heure ou distance." },
        { n: "03", title: "Terminez la réservation", body: "Choisissez votre départ et continuez avec le compte fournisseur que vous utilisez déjà pour vérifier et confirmer." },
      ],
      ctaAlt: "Un parcours de golf qui serpente dans la forêt au matin",
      ctaEyebrow: "Votre prochaine ronde vous attend",
      ctaTitle: "Voyez ce qui est libre.\nChoisissez votre fairway.",
      ctaButton: "Chercher des départs",
      faqEyebrow: "Avant de prendre le départ",
      faqTitle: "Quelques bonnes questions.",
      faqIntro:
        "L’app garde la découverte, la connexion aux fournisseurs et la redirection de réservation ensemble, pendant que la confirmation finale reste sur la page du fournisseur.",
      faqs: [
        { q: "Tous les résultats sont-ils en direct?", a: "Oui. Fairway affiche seulement les départs confirmés par les fournisseurs. Si une feuille est fermée, inaccessible ou si le départ disparaît, la carte n’est pas affichée." },
        { q: "D’où vient la disponibilité?", a: "Les disponibilités Chronogolf et TeeTime apparaissent seulement quand leurs feuilles en direct sont accessibles. Les autres cartes de fournisseurs restent des liens de connexion sécurisés, sans créer de cartes de départ." },
        { q: "Comment fonctionne la fenêtre horaire?", a: "Choisissez votre heure idéale et jusqu’à trois heures de flexibilité de chaque côté. Fairway retourne les départs correspondants et vous laisse trier la liste à votre façon." },
        { q: "Fairway complète-t-il le paiement?", a: "Vous vérifiez les derniers détails, vous vous connectez sur la page du fournisseur et vous payez là-bas. Le fournisseur envoie la confirmation de réservation." },
      ],
      footerBody: "Un seul endroit pour découvrir et comparer le golf autour de Montréal et Toronto.",
      footerSearch: "Chercher",
      footerAccounts: "Comptes",
      footerFaq: "FAQ",
      footerNote: "Confirmez les derniers détails avec le fournisseur.",
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
    const saved = window.localStorage.getItem("fairway-language");
    if (saved !== "fr" && saved !== "en") return;
    const frame = window.requestAnimationFrame(() => setLangState(saved));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Language) => {
    setLangState(next);
    window.localStorage.setItem("fairway-language", next);
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

export function windowLabel(minutes: number, lang: Language) {
  if (minutes === 0) return lang === "fr" ? "0 min" : "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return lang === "fr" ? `${hours} h` : `${hours} hr`;
  return lang === "fr" ? `${hours.toFixed(1)} h` : `${hours.toFixed(1)} hr`;
}
