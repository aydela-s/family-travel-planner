import { NextResponse } from "next/server";
import { getItineraryShare } from "@/lib/itinerary-share-store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const share = await getItineraryShare(id);
  if (!share) {
    return NextResponse.json({ error: "Shared itinerary not found." }, { status: 404 });
  }
  return NextResponse.json({
    id: share.id,
    itinerary: share.itinerary,
    plan: share.plan,
  });
}
