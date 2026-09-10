"use client";

import { useState } from "react";
import { ArrowUpRight, KeyRound, ShieldCheck } from "lucide-react";
import {
  GGGOLF_CLUB_PORTALS,
  PROVIDER_ACCOUNT_LINKS,
} from "@/lib/providers/config";

type AccountProviderId = (typeof PROVIDER_ACCOUNT_LINKS)[number]["id"];

export function ProviderAccounts() {
  const [openedProvider, setOpenedProvider] = useState<AccountProviderId | null>(
    null,
  );
  const [gggolfPortal, setGggolfPortal] = useState("");

  return (
    <section
      id="accounts"
      aria-labelledby="provider-accounts-title"
      className="bg-[#f3efe4] px-5 py-20 text-[#153528] sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#547164]">
            Provider accounts
          </p>
          <h2
            id="provider-accounts-title"
            className="font-display text-4xl font-bold tracking-tight sm:text-5xl"
          >
            Sign in where your tee time lives.
          </h2>
          <p className="mt-5 text-base leading-7 text-[#547164] sm:text-lg">
            Open the provider&apos;s own sign-in page, then come back to compare
            tee times. Fairway never asks for or stores your golf account
            password.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {PROVIDER_ACCOUNT_LINKS.map((provider) => {
            const wasOpened = openedProvider === provider.id;
            const selectedClub = GGGOLF_CLUB_PORTALS.find(
              (club) => club.href === gggolfPortal,
            );
            const href =
              provider.id === "gggolf"
                ? selectedClub?.href
                : provider.href;
            const action =
              provider.id === "gggolf" && selectedClub
                ? `Sign in · ${selectedClub.name}`
                : provider.action;
            return (
              <article
                key={provider.id}
                className="rounded-[1.75rem] border border-[#cbd3c7] bg-[#fffdf7] p-6 shadow-[0_18px_55px_rgba(21,53,40,0.08)] sm:p-8"
              >
                <div className="flex items-start justify-between gap-5">
                  <span className="grid size-12 place-items-center rounded-2xl bg-[#153528] text-[#f4c95d]">
                    <KeyRound aria-hidden="true" size={22} />
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cbd3c7] px-3 py-1 text-xs font-semibold text-[#547164]">
                    <ShieldCheck aria-hidden="true" size={14} /> Provider hosted
                  </span>
                </div>
                <h3 className="mt-7 font-display text-2xl font-bold">
                  {provider.name}
                </h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-[#547164]">
                  {provider.description}
                </p>
                {provider.id === "gggolf" && (
                  <div className="mt-5">
                    <label
                      htmlFor="gggolf-club"
                      className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#547164]"
                    >
                      Your club
                    </label>
                    <select
                      id="gggolf-club"
                      value={gggolfPortal}
                      onChange={(event) => {
                        setGggolfPortal(event.target.value);
                        setOpenedProvider(null);
                      }}
                      className="min-h-12 w-full rounded-xl border border-[#cbd3c7] bg-[#f3efe4] px-4 text-sm font-semibold text-[#153528] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153528]"
                    >
                      <option value="" disabled>Choose your club</option>
                      {GGGOLF_CLUB_PORTALS.map((club) => (
                        <option key={club.href} value={club.href}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {href ? <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpenedProvider(provider.id)}
                  className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#153528] px-5 py-3 text-center text-sm font-bold text-[#fffdf7] transition hover:bg-[#214d3a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#153528]"
                >
                  {action}
                  <ArrowUpRight aria-hidden="true" size={17} />
                </a> : (
                  <button
                    type="button"
                    disabled
                    className="mt-6 flex min-h-12 w-full items-center justify-center rounded-full bg-[#153528]/15 px-5 py-3 text-center text-sm font-bold text-[#547164]"
                  >
                    Choose a club to sign in
                  </button>
                )}
                {provider.id === "gggolf" && (
                  <a
                    href={provider.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block text-center text-sm text-[#547164] underline underline-offset-4"
                  >
                    Club not listed? Get help finding its login
                  </a>
                )}
                <p
                  className="mt-3 text-center text-xs text-[#6f8178]"
                  aria-live="polite"
                >
                  {wasOpened
                    ? `${provider.name} opened in a new tab. Fairway cannot read or confirm that session yet.`
                    : href ? "Opens the provider's login form in a new tab." : "GGGolf accounts are accessed through your club."}
                </p>
              </article>
            );
          })}
        </div>

        <p className="mt-7 max-w-3xl text-sm leading-6 text-[#64776d]">
          In-app account linking and checkout are not available yet. Complete
          and confirm your reservation with the provider.
        </p>
      </div>
    </section>
  );
}
