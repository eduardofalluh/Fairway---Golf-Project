"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, KeyRound, MapPinned } from "lucide-react";
import { Reveal } from "./Reveal";
import {
  GGGOLF_CLUB_PORTALS,
  PROVIDER_ACCOUNT_LINKS,
  type BookingProviderId,
} from "@/lib/providers/config";
import {
  buildFairwayConnectionReturnUrl,
  cleanProviderConnectionCallbackUrl,
  parseProviderConnectionCallback,
  providerLoginUrlWithReturn,
} from "@/lib/provider-callback";
import { useProviderConnections } from "@/lib/useProviderConnections";
import { connectionDaysLeft } from "@/lib/provider-connections";
import { formatDaysAgo, useLanguage } from "@/lib/i18n";

type ConnectableId = Exclude<BookingProviderId, "course">;

/**
 * Open a provider's own login in a new tab, asking it to send the golfer back
 * here so Fairway can remember (on this device only) that they signed in.
 */
export function openProviderLogin(providerId: ConnectableId, href: string) {
  const returnUrl = buildFairwayConnectionReturnUrl(providerId, href, window.location.href);
  window.open(providerLoginUrlWithReturn(providerId, href, returnUrl), "_blank", "noopener,noreferrer");
}

function ProviderCard({
  id,
  name,
  defaultHref,
  index,
}: {
  id: ConnectableId;
  name: string;
  defaultHref: string;
  index: number;
}) {
  const { t, lang } = useLanguage();
  const { markedAt, saveConnection, removeConnection } = useProviderConnections();
  const [club, setClub] = useState("");
  const [opened, setOpened] = useState(false);
  const href = id === "gggolf" ? club || null : defaultHref;
  const marked = href ? markedAt(id, href) : null;
  const connected = marked != null;
  const daysLeft = marked != null ? connectionDaysLeft(marked) : 0;
  const clubName = GGGOLF_CLUB_PORTALS.find((c) => c.href === club)?.name;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={`flex min-w-0 flex-col rounded-[1.5rem] border p-5 transition-colors duration-300 sm:p-6 ${
        connected ? "border-forest/35 bg-lime/15" : "border-line bg-base/50 hover:border-forest/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-forest font-display text-xl font-bold text-lime">
            {name.charAt(0)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl font-semibold leading-tight text-cream">{name}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-fog">
              <MapPinned aria-hidden size={11} /> {t.accounts.scope[id]}
            </p>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {connected && (
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-lime"
            >
              <Check aria-hidden size={12} /> {t.accounts.signedIn}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-3 text-sm leading-6 text-fog">{t.accounts.description[id]}</p>
      {marked != null && (
        <p className="mt-2 text-xs font-semibold text-forest">{t.accounts.markedWhen(formatDaysAgo(marked, lang), daysLeft)}</p>
      )}

      {id === "gggolf" && (
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-fog">{t.accounts.yourClub}</span>
          <select
            value={club}
            onChange={(e) => {
              setClub(e.target.value);
              setOpened(false);
            }}
            className="select-plain min-h-11 w-full rounded-xl border border-line bg-surface pl-3 text-sm font-semibold text-cream"
          >
            <option value="" disabled>{t.accounts.chooseClub(GGGOLF_CLUB_PORTALS.length)}</option>
            {GGGOLF_CLUB_PORTALS.map((c) => (
              <option key={c.href} value={c.href}>{c.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className="mt-auto pt-5">
        {connected && href ? (
          <button
            type="button"
            onClick={() => removeConnection(id, href)}
            className="min-h-11 text-sm font-semibold text-fog underline-offset-4 hover:text-cream hover:underline"
          >
            {t.accounts.forget}
          </button>
        ) : href ? (
          <div className="grid gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setOpened(true);
                openProviderLogin(id, href);
              }}
              className="shine flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-forest px-5 text-sm font-bold text-white transition-colors hover:bg-forest-soft"
            >
              {id === "gggolf" && clubName ? t.accounts.signInClub(clubName) : t.accounts.signIn(name)}
              <ArrowUpRight aria-hidden size={16} />
            </motion.button>
            <AnimatePresence>
              {opened && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => saveConnection(id, href)}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-forest/30 bg-lime/30 px-5 text-sm font-bold text-forest transition hover:bg-lime/50"
                  >
                    <Check aria-hidden size={16} /> {t.accounts.confirm}
                  </button>
                  <p className="mt-2 text-center text-xs text-fog">{t.accounts.confirmHint(name)}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <p className="flex min-h-12 items-center justify-center rounded-full bg-base-2 px-5 text-sm font-semibold text-fog">
            {t.accounts.pickClubFirst}
          </p>
        )}
        {id === "gggolf" && (
          <a
            href={defaultHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-center text-xs text-fog underline underline-offset-4 hover:text-cream"
          >
            {t.accounts.clubHelp}
          </a>
        )}
      </div>
    </motion.article>
  );
}

/** Sign in once to each booking app so picking a tee time goes straight to checkout. */
export function BookingAccounts() {
  const { t } = useLanguage();
  const { connectedCount, saveConnection } = useProviderConnections();

  // Chronogolf can send golfers back here after login; remember that and tidy the URL.
  useEffect(() => {
    const callback = parseProviderConnectionCallback(window.location.href);
    if (!callback) return;
    saveConnection(callback.providerId, callback.href);
    window.history.replaceState(window.history.state, "", cleanProviderConnectionCallbackUrl(window.location.href));
  }, [saveConnection]);

  return (
    <section id="accounts" aria-labelledby="accounts-title" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-8 lg:px-10 lg:py-20">
        <Reveal className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] text-fog">
              <KeyRound aria-hidden size={13} /> {t.accounts.eyebrow}
            </p>
            <h2 id="accounts-title" className="mt-3 whitespace-pre-line font-display text-5xl font-semibold leading-[.92] tracking-[-.035em] text-cream sm:text-6xl">
              {t.accounts.title}
            </h2>
            <p className="mt-4 text-[1rem] leading-7 text-fog">{t.accounts.body}</p>
          </div>
          <motion.p
            key={connectedCount}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
              connectedCount ? "bg-forest text-lime" : "border border-line text-fog"
            }`}
            aria-live="polite"
          >
            {connectedCount > 0 && <Check aria-hidden size={15} />}
            {t.accounts.connectedCount(connectedCount)}
          </motion.p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {PROVIDER_ACCOUNT_LINKS.map((provider, i) => (
            <ProviderCard key={provider.id} id={provider.id} name={provider.name} defaultHref={provider.href} index={i} />
          ))}
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-6 text-fog">{t.accounts.note}</p>
      </div>
    </section>
  );
}
