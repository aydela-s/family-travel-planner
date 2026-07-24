import { redirect } from "next/navigation";
import { sharedTripViewPath } from "@/lib/public-urls";

/** Legacy email links used /trip/[id] — send them to the editable itinerary view. */
export default async function SharedTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(sharedTripViewPath(id));
}
