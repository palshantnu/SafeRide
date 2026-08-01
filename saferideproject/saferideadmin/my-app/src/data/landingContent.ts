// Shared contract + defaults for the public Landing Page content.
// The admin "Landing Content" module edits this; the public LandingPage reads it.
// If the backend (/landing) isn't ready, the page falls back to DEFAULT_LANDING_CONTENT.

export interface LandingStat {
  value: string;
  label: string;
  color: string;
}

export interface LandingContent {
  hero_badge: string;
  hero_title: string;       // first line
  hero_highlight: string;   // gradient highlighted line
  hero_subtitle: string;
  hero_image: string | null; // uploaded hero/banner image URL (admin-managed)
  stats: LandingStat[];
  cta_title: string;
  cta_subtitle: string;
  cta_tags: string[];
}

const PINK  = "#f0047f";
const BLUE  = "#1877f2";
const GREEN = "#5cb85c";

export const STAT_COLORS = [PINK, BLUE, GREEN];

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  hero_badge: "Platform Live & Operational",
  hero_title: "The Command Center",
  hero_highlight: "for Sigi Ride",
  hero_subtitle:
    "Manage your entire ride-sharing ecosystem — captains, bookings, services, and revenue — from a single powerful dashboard.",
  hero_image: null,
  stats: [
    { value: "10K+",  label: "Rides Completed", color: PINK  },
    { value: "500+",  label: "Active Captains",  color: BLUE  },
    { value: "50+",   label: "Cities Covered",   color: GREEN },
    { value: "99.9%", label: "Platform Uptime",  color: PINK  },
  ],
  cta_title: "Ready to Take Control?",
  cta_subtitle:
    "Log in to manage your fleet, view analytics, and keep operations running smoothly.",
  cta_tags: ["Fleet Tracking", "Real-time Alerts", "Revenue Reports", "Driver Verification"],
};

// ─── Section model (matches backend landing_sections rows) ───────────────────
// The landing page is stored as discrete "sections" keyed by `section_key`.
// We use three fixed keys to power the designed page:
//   hero  → title, subtitle, content: { badge, highlight }
//   stats → content: LandingStat[]
//   cta   → title, subtitle, content: { tags: string[] }
export const SECTION_KEYS = { hero: "hero", stats: "stats", cta: "cta" } as const;
export type SectionKey = (typeof SECTION_KEYS)[keyof typeof SECTION_KEYS];

export interface LandingSection {
  id: number;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  content: unknown;
  image: string | null;
  image_url: string | null;
  sort_order: number;
  status: number;
}

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.trim() ? v : fallback;

// Build a key → section lookup from either the `sections` map or `data` array
// shape returned by GET /landing or GET /admin/landing.
export function indexSections(payload: unknown): Record<string, LandingSection> {
  const out: Record<string, LandingSection> = {};
  if (!payload || typeof payload !== "object") return out;
  const p = payload as { data?: unknown; sections?: unknown };
  const arr = Array.isArray(p.data) ? (p.data as LandingSection[])
            : Array.isArray(payload) ? (payload as LandingSection[])
            : [];
  for (const sec of arr) {
    if (sec && typeof sec.section_key === "string" && out[sec.section_key] === undefined) {
      out[sec.section_key] = sec;
    }
  }
  return out;
}

// Map backend sections → the render-safe LandingContent the page expects,
// filling any missing piece from DEFAULT_LANDING_CONTENT.
export function sectionsToContent(payload: unknown): LandingContent {
  const d = DEFAULT_LANDING_CONTENT;
  const idx = indexSections(payload);

  const hero = idx[SECTION_KEYS.hero];
  const heroContent = (hero?.content && typeof hero.content === "object" ? hero.content : {}) as
    { badge?: string; highlight?: string };

  const statsSec = idx[SECTION_KEYS.stats];
  const rawStats = Array.isArray(statsSec?.content) ? (statsSec!.content as LandingStat[]) : null;
  const stats = rawStats && rawStats.length
    ? rawStats.map((st, i) => ({
        value: str(st?.value, d.stats[i]?.value ?? ""),
        label: str(st?.label, d.stats[i]?.label ?? ""),
        color: str(st?.color, d.stats[i]?.color ?? STAT_COLORS[i % STAT_COLORS.length]),
      }))
    : d.stats;

  const cta = idx[SECTION_KEYS.cta];
  const ctaContent = (cta?.content && typeof cta.content === "object" ? cta.content : {}) as { tags?: unknown };
  const cta_tags = Array.isArray(ctaContent.tags) && ctaContent.tags.length
    ? (ctaContent.tags as unknown[]).filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : d.cta_tags;

  return {
    hero_image:     hero?.image_url ?? null,
    hero_badge:     str(heroContent.badge, d.hero_badge),
    hero_title:     str(hero?.title, d.hero_title),
    hero_highlight: str(heroContent.highlight, d.hero_highlight),
    hero_subtitle:  str(hero?.subtitle, d.hero_subtitle),
    stats,
    cta_title:      str(cta?.title, d.cta_title),
    cta_subtitle:   str(cta?.subtitle, d.cta_subtitle),
    cta_tags,
  };
}

// Convert the editor's LandingContent into the per-section field payloads
// (title / subtitle / content) used when creating or updating each section row.
export function contentToSectionFields(c: LandingContent): Record<SectionKey, {
  title: string | null;
  subtitle: string | null;
  content: unknown;
}> {
  return {
    hero: {
      title: c.hero_title,
      subtitle: c.hero_subtitle,
      content: { badge: c.hero_badge, highlight: c.hero_highlight },
    },
    stats: {
      title: "Stats",
      subtitle: null,
      content: c.stats,
    },
    cta: {
      title: c.cta_title,
      subtitle: c.cta_subtitle,
      content: { tags: c.cta_tags },
    },
  };
}
