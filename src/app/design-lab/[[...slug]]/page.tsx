import { DesignLabApp } from "@/design-lab/app";

export default async function DesignLabPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  return <DesignLabApp slug={slug} />;
}
