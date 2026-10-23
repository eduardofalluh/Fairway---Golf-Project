import { EXTRA_COURSES } from "./courses";
import { fetchChronogolfWindow, getChronogolfDirectory } from "./providers/chronogolf";
import { mergeProviderStates } from "./results";
import { fetchTeeTimeWindow } from "./providers/teetime";
import { parseTimeToMinutes } from "./format";
import { deepBookingUrl } from "./booking-links";

export { deepBookingUrl };
import type { RangeQuery } from "./search-query";
import type {
  GolfCourse,
  MarketId,
  ProviderId,
  ProviderState,
  TeeTime,
  TeeTimePartResponse,
  WindowQuery,
} from "./types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/club de golf|golf|club|de la|de|du|des|le|la|les/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * The full course directory: live Chronogolf courses + curated non-Chronogolf
 * extras (extras dropped if a live course already covers the same name), and
 * whether the Chronogolf part was read completely.
 */
export async function getDirectoryWithState(
  market: MarketId = "montreal",
): Promise<{ courses: GolfCourse[]; chronogolf: ProviderState }> {
  const { courses: live, state } = await getChronogolfDirectory(market);
  const liveNames = new Set(live.map((c) => norm(c.name)));
  const marketExtras = EXTRA_COURSES.filter((course) => course.market === market);
  const curatedByName = new Map(marketExtras.map((c) => [norm(c.name), c]));
  const usedCurated = new Set<string>();
  const directory = live.map((course) => {
    const curated = curatedByName.get(norm(course.name));
    if (curated?.source === "teetime") {
      usedCurated.add(norm(course.name));
      return curated;
    }
    // Directory-only Chronogolf entries must not hide a verified booking portal.
    if (!course.online && curated) return {
      ...curated, id: course.id, photo: course.photo ?? curated.photo,
    };
    return course;
  });
  const extras = marketExtras.filter(
    (e) => !liveNames.has(norm(e.name)) && !usedCurated.has(norm(e.name)),
  );
  return {
    courses: [...directory, ...extras].sort((a, b) => a.distanceKm - b.distanceKm),
    chronogolf: state,
  };
}

export async function getDirectory(market: MarketId = "montreal"): Promise<GolfCourse[]> {
  return (await getDirectoryWithState(market)).courses;
}

export async function findCourse(market: MarketId, courseId: string): Promise<GolfCourse | null> {
  const directory = await getDirectory(market);
  return directory.find((course) => course.id === courseId) ?? null;
}

/** Courses with a live feed Fairway can read, in a stable order. */
function liveFeedCourses(directory: GolfCourse[]): GolfCourse[] {
  return directory
    .filter((c) => c.online && (c.chronogolfSlug || c.teeTimeSlug))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Round-robin split so every part covers a similar mix of near and far courses. */
export function coursesForPart(courses: GolfCourse[], part: number, parts: number): GolfCourse[] {
  return courses.filter((_, index) => index % parts === part);
}

export function windowBounds(query: Pick<WindowQuery, "desiredTime" | "windowMinutes">) {
  const desired = parseTimeToMinutes(query.desiredTime);
  return {
    startMin: Math.max(0, desired - query.windowMinutes),
    endMin: Math.min(23 * 60 + 59, desired + query.windowMinutes),
  };
}

/**
 * One slice of a market search over a minute range. The browser asks for every
 * part in parallel, renders each as it lands, and only asks for minutes it has
 * not already loaded; identical ranges share cached provider pages.
 */
export async function searchPart(query: RangeQuery): Promise<TeeTimePartResponse> {
  const { courses: directory, chronogolf: directoryState } = await getDirectoryWithState(query.market);
  const courses = coursesForPart(liveFeedCourses(directory), query.part, query.parts);
  const { startMin, endMin } = query;
  const byId = new Map(courses.map((c) => [c.id, c]));

  const [chronogolf, teetime] = await Promise.all([
    fetchChronogolfWindow(courses.filter((c) => c.source === "chronogolf"), query.date, startMin, endMin),
    fetchTeeTimeWindow(courses.filter((c) => c.source === "teetime"), query.date, startMin, endMin),
  ]);

  const providers: Partial<Record<ProviderId, ProviderState>> = {};
  // If the directory itself wasn't fully read, this part can't be complete —
  // even when it has no Chronogolf courses left to ask about.
  if (courses.some((c) => c.source === "chronogolf")) {
    providers.chronogolf = directoryState.status === "ok"
      ? chronogolf.state
      : mergeProviderStates([directoryState, chronogolf.state]) ?? directoryState;
  } else if (directoryState.status !== "ok") {
    providers.chronogolf = directoryState;
  }
  if (courses.some((c) => c.source === "teetime")) providers.teetime = teetime.state;

  const teeTimes: TeeTime[] = [];
  for (const row of [...chronogolf.rows, ...teetime.rows]) {
    const course = byId.get(row.courseId);
    if (!course || row.date !== query.date) continue;
    if (row.minutes < startMin || row.minutes > endMin) continue;
    teeTimes.push({ ...row, bookingUrl: deepBookingUrl(course, row.date, row.holes) });
  }
  teeTimes.sort((a, b) => a.minutes - b.minutes || a.price - b.price);

  return {
    market: query.market,
    date: query.date,
    startMin,
    endMin,
    part: query.part,
    parts: query.parts,
    checkedCourses: courses.length,
    teeTimes,
    providers,
  };
}
