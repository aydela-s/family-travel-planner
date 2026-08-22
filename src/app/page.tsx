import BackToTopButton from "@/components/BackToTopButton";
import ProductFirstHomepage from "@/components/homepage/ProductFirstHomepage";
import PrefetchPlan from "@/components/PrefetchPlan";

export default function Home() {
  return (
    <>
      <ProductFirstHomepage />
      <PrefetchPlan />
      <BackToTopButton />
    </>
  );
}
