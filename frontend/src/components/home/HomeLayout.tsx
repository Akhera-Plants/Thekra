"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Sprout } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DirectionalArrow } from "@/components/shared/DirectionalArrow";
import { useSession } from "@/features/auth/hooks/useSession";
import { HomeWirdCard } from "@/features/practice/components/hub/HomeWirdCard";
import { usePracticeStore } from "@/features/practice/hooks/usePracticeStore";
import { accountsEnabled } from "@/lib/accounts";

/** Remembers the last answer, so a returning user does not see the guest order flash first. Per-device convenience only. */
const PERSONAL_HINT = "thekra.home.personal";

function readHint(): boolean {
  try {
    return window.localStorage.getItem(PERSONAL_HINT) === "1";
  } catch {
    return false;
  }
}

function writeHint(personal: boolean) {
  try {
    if (personal) window.localStorage.setItem(PERSONAL_HINT, "1");
    else window.localStorage.removeItem(PERSONAL_HINT);
  } catch {
    // Storage blocked (private window): the page still works, it may only reorder once after loading.
  }
}

const noSubscribe = () => () => {};

/**
 * A visitor who practises here: signed in, or this device already holds habit plans (they live on the device). Everyone
 * else is a guest. False during the server render (the home is cached and the same for everyone).
 */
function useIsPersonal(): boolean {
  const session = useSession();
  const snapshot = usePracticeStore();
  const hint = useSyncExternalStore(noSubscribe, readHint, () => false);
  const signedIn = accountsEnabled() && session.isAuthenticated;
  const hasPlans = (snapshot?.store.plans.length ?? 0) > 0;
  const known = snapshot !== null && (!accountsEnabled() || !session.isLoading);
  const personal = signedIn || hasPlans;
  useEffect(() => {
    if (known) writeHint(personal);
  }, [known, personal]);
  return known ? personal : hint;
}

interface HomeLayoutProps {
  pathways: ReactNode;
  divider: ReactNode;
  moments: ReactNode;
  /** «تذكرة مختارة» (null when the API did not answer). */
  reminder: ReactNode;
  /** «باب من الخير» (null when the API did not answer). */
  deed: ReactNode;
  reflection: ReactNode;
  sources: ReactNode;
}

/**
 * The home's order depends on who is reading (owner decision, 2026-11-01):
 *
 * - Guest: «أبواب الخير» first (the site's main content), then the moments, today's reminder and door, and a quiet
 *   invitation to start a habit.
 * - Signed in, or a device with habits: today's reminder and door first with the user's own buttons under them
 *   («بقي عليك اليوم» · «ورد اليوم» · «سجلّي»), then «أبواب الخير».
 */
export function HomeLayout({
  pathways,
  divider,
  moments,
  reminder,
  deed,
  reflection,
  sources,
}: HomeLayoutProps) {
  const t = useTranslations("home");
  const personal = useIsPersonal();

  if (personal) {
    return (
      <>
        <section
          className="reading-pair home-today"
          aria-label={t("readingPairLabel")}
        >
          <div className="home-today-main">
            {reminder}
            <PersonalActions />
          </div>
          {deed}
        </section>
        {pathways}
        {divider}
        {moments}
        {reflection}
        {sources}
      </>
    );
  }

  return (
    <>
      {pathways}
      {divider}
      {moments}
      {reminder || deed ? (
        <section className="reading-pair" aria-label={t("readingPairLabel")}>
          {reminder}
          {deed}
        </section>
      ) : null}
      <StartInvitation />
      {reflection}
      {sources}
    </>
  );
}

/** Under today's reminder: «ورد اليوم» · «سجلّي» · «بقي عليك اليوم n · المداومة», or «ابدأ بغرسٍ صغير» without habits. */
function PersonalActions() {
  const t = useTranslations("home");
  const tNav = useTranslations("nav");
  const snapshot = usePracticeStore();
  const hasPlans = (snapshot?.store.plans.length ?? 0) > 0;

  return (
    <div className="home-today-actions">
      {hasPlans ? (
        <>
          <Link className="solid-button" href="/practice">
            {tNav("practice")} <DirectionalArrow className="size-[18px]" />
          </Link>
          <Link className="outline-button" href="/practice/record">
            {tNav("record")}
          </Link>
          <HomeWirdCard />
        </>
      ) : (
        <Link
          className="solid-button"
          href={{ pathname: "/practice", query: { add: "1" } }}
        >
          <Sprout aria-hidden />
          {t("startCta")} <DirectionalArrow className="size-[18px]" />
        </Link>
      )}
    </div>
  );
}

function StartInvitation() {
  const t = useTranslations("home");
  return (
    <section className="home-start" aria-labelledby="home-start-title">
      <div className="home-start-text">
        <h2 id="home-start-title">{t("startTitle")}</h2>
        <p>{t("startLead")}</p>
      </div>
      <Link
        className="solid-button"
        href={{ pathname: "/practice", query: { add: "1" } }}
      >
        <Sprout aria-hidden />
        {t("startCta")} <DirectionalArrow className="size-[18px]" />
      </Link>
    </section>
  );
}
