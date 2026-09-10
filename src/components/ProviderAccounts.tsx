"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import {
  GGGOLF_CLUB_PORTALS,
  PROVIDER_ACCOUNT_LINKS,
} from "@/lib/providers/config";
import { providerConnectionKey } from "@/lib/provider-connections";
import { useProviderConnections } from "@/lib/useProviderConnections";
import { useLanguage } from "@/lib/i18n";

export function ProviderAccounts() {
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  const [gggolfPortal, setGggolfPortal] = useState("");
  const { connectedCount, isConnected, saveConnection, removeConnection } =
    useProviderConnections();
  const { t } = useLanguage();

  return (
    <section
      id="accounts"
      aria-labelledby="provider-accounts-title"
      className="border-b border-[#d6cebd] bg-[#f3efe4] px-4 py-12 text-[#153528] sm:px-8 sm:py-16 lg:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.25 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start"
        >
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#547164]">
              {t.accounts.eyebrow}
            </p>
            <h2
              id="provider-accounts-title"
              className="font-display text-4xl font-bold leading-[.95] tracking-tight sm:text-5xl"
            >
              {t.accounts.title}
            </h2>
            <p className="mt-5 text-base leading-7 text-[#547164] sm:text-lg">
              {t.accounts.body}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:justify-self-end">
            <AccountStat label="Chronogolf" value={t.accounts.stats.chronogolf} />
            <AccountStat label="TeeTime" value={t.accounts.stats.teetime} />
            <AccountStat label="Toronto" value={t.accounts.stats.toronto} />
            <AccountStat label={t.accounts.stats.connected} value={t.accounts.stats.active(connectedCount)} emphasis />
          </div>
        </motion.div>

        <div className="mt-8 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PROVIDER_ACCOUNT_LINKS.map((provider) => {
            const selectedClub = GGGOLF_CLUB_PORTALS.find(
              (club) => club.href === gggolfPortal,
            );
            const href =
              provider.id === "gggolf"
                ? selectedClub?.href
                : provider.href;
            const providerCopy = t.accounts.provider[provider.id];
            const action =
              provider.id === "gggolf" && selectedClub
                ? t.accounts.signInClub(selectedClub.name)
                : providerCopy?.action ?? provider.action;
            const connectionKey = providerConnectionKey(provider.id, href);
            const providerConnected = href ? isConnected(provider.id, href) : false;
            const wasOpened = openedKey === connectionKey;
            return (
              <motion.article
                key={provider.id}
                initial={{ opacity: 0, y: 20, scale: 0.985 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: false, amount: 0.18 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={`rounded-[1.4rem] border p-5 shadow-[0_18px_55px_rgba(21,53,40,0.08)] sm:rounded-[1.75rem] sm:p-8 ${
                  providerConnected
                    ? "border-[#9eb58b] bg-[#f8fff1]"
                    : "border-[#cbd3c7] bg-[#fffdf7]"
                }`}
              >
                <div className="flex items-start justify-between gap-5">
                  <span className="grid size-12 place-items-center rounded-2xl bg-[#153528] text-[#f4c95d]">
                    <KeyRound aria-hidden="true" size={22} />
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                      providerConnected
                        ? "border-[#88a56e] bg-[#e9f8d6] text-[#2d5d21]"
                        : "border-[#cbd3c7] text-[#547164]"
                    }`}
                  >
                    {providerConnected ? (
                      <CheckCircle2 aria-hidden="true" size={14} />
                    ) : (
                      <ShieldCheck aria-hidden="true" size={14} />
                    )}{" "}
                    {providerConnected ? t.accounts.connectedStatus : t.accounts.providerHosted}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold sm:mt-7">
                  {provider.name}
                </h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-[#547164]">
                  {providerCopy?.description ?? provider.description}
                </p>
                {provider.id === "gggolf" && (
                  <div className="mt-5">
                    <label
                      htmlFor="gggolf-club"
                      className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#547164]"
                    >
                      {t.accounts.yourClub}
                    </label>
                    <select
                      id="gggolf-club"
                      value={gggolfPortal}
                      onChange={(event) => {
                        setGggolfPortal(event.target.value);
                        setOpenedKey(null);
                      }}
                      className="min-h-12 w-full rounded-xl border border-[#cbd3c7] bg-[#f3efe4] px-4 text-sm font-semibold text-[#153528] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153528]"
                    >
                      <option value="" disabled>{t.accounts.chooseClub(GGGOLF_CLUB_PORTALS.length)}</option>
                      {GGGOLF_CLUB_PORTALS.map((club) => (
                        <option key={club.href} value={club.href}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {providerConnected ? (
                  <button
                    type="button"
                    disabled
                    className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2f651f] px-5 py-3 text-center text-sm font-bold text-white"
                  >
                    <CheckCircle2 aria-hidden="true" size={17} />
                    {t.accounts.connected}
                  </button>
                ) : href ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenedKey(connectionKey);
                      window.open(href, "_blank", "noopener,noreferrer");
                    }}
                    className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#153528] px-5 py-3 text-center text-sm font-bold text-[#fffdf7] transition hover:bg-[#214d3a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#153528]"
                  >
                    {action}
                    <ArrowUpRight aria-hidden="true" size={17} />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-6 flex min-h-12 w-full items-center justify-center rounded-full bg-[#153528]/15 px-5 py-3 text-center text-sm font-bold text-[#547164]"
                  >
                    {t.accounts.chooseClubToSignIn}
                  </button>
                )}
                {wasOpened && !providerConnected && href && (
                  <button
                    type="button"
                    onClick={() => saveConnection(provider.id, href)}
                    className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full border border-[#9eb58b] bg-[#f2fae6] px-5 py-2.5 text-center text-sm font-bold text-[#2d5d21] transition hover:bg-[#e6f6d0]"
                  >
                    {t.accounts.loggedIn}
                  </button>
                )}
                {providerConnected && (
                  <button
                    type="button"
                    onClick={() => removeConnection(provider.id, href)}
                    className="mt-3 block w-full text-center text-sm text-[#547164] underline underline-offset-4"
                  >
                    {t.accounts.disconnect}
                  </button>
                )}
                {provider.id === "gggolf" && (
                  <a
                    href={provider.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block text-center text-sm text-[#547164] underline underline-offset-4"
                  >
                    {t.accounts.clubHelp}
                  </a>
                )}
                <p
                  className="mt-3 text-center text-xs text-[#6f8178]"
                  aria-live="polite"
                >
                  {providerConnected
                    ? t.accounts.markedConnected(provider.name)
                    : wasOpened
                      ? t.accounts.confirmSignedIn(provider.name)
                      : href ? t.accounts.opensLogin : t.accounts.gggolfClubAccess}
                </p>
              </motion.article>
            );
          })}
        </div>

        <p className="mt-7 max-w-3xl text-sm leading-6 text-[#64776d]">
          {t.accounts.note}
        </p>
      </div>
    </section>
  );
}

function AccountStat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 shadow-[0_10px_30px_rgba(21,53,40,0.05)] sm:p-4 ${
        emphasis
          ? "border-[#9eb58b] bg-[#f8fff1]"
          : "border-[#cbd3c7] bg-[#fffdf7]/80"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#6f8178]">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-[#153528]">{value}</p>
    </div>
  );
}
