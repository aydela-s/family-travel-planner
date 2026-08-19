import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Itinerary } from "@/types/itinerary";
import { TripPlan } from "@/types/trip-plan";

export type StoredItineraryShare = {
  id: string;
  createdAt: string;
  itinerary: Itinerary;
  plan: TripPlan | null;
};

function shareDir(): string {
  // Local + serverless-friendly: project .data when writable, else /tmp.
  return process.env.ITINERARY_SHARE_DIR?.trim() ||
    path.join(process.cwd(), ".data", "itinerary-shares");
}

async function ensureDir(): Promise<string> {
  const dir = shareDir();
  try {
    await fs.mkdir(dir, { recursive: true });
    return dir;
  } catch {
    const fallback = path.join("/tmp", "familytravely-itinerary-shares");
    await fs.mkdir(fallback, { recursive: true });
    return fallback;
  }
}

function fileFor(dir: string, id: string): string {
  // Prevent path traversal — ids are UUIDs only.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("Invalid share id");
  }
  return path.join(dir, `${id}.json`);
}

export async function saveItineraryShare(input: {
  itinerary: Itinerary;
  plan?: TripPlan | null;
}): Promise<StoredItineraryShare> {
  const dir = await ensureDir();
  const id = randomUUID();
  const record: StoredItineraryShare = {
    id,
    createdAt: new Date().toISOString(),
    itinerary: input.itinerary,
    plan: input.plan ?? null,
  };
  await fs.writeFile(fileFor(dir, id), JSON.stringify(record), "utf8");
  return record;
}

export async function getItineraryShare(id: string): Promise<StoredItineraryShare | null> {
  try {
    const dir = await ensureDir();
    const raw = await fs.readFile(fileFor(dir, id), "utf8");
    return JSON.parse(raw) as StoredItineraryShare;
  } catch {
    return null;
  }
}
