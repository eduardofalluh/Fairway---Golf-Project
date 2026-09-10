import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Hero, CourseMarquee } from "@/components/Hero";
import { TeeFinder } from "@/components/TeeFinder";
import { ProviderAccounts } from "@/components/ProviderAccounts";
import { HowItWorks, Faq, Footer } from "@/components/Sections";
import { getDirectory } from "@/lib/aggregator";

// Revalidate the live Chronogolf directory periodically.
export const revalidate = 21600;

export default async function Home() {
  const courses = await getDirectory();
  const names = courses.map((c) => c.name);

  return (
    <>
      <ScrollProgress />
      <Nav />
      <main>
        <Hero courseCount={courses.length} />
        <CourseMarquee names={names} />
        <TeeFinder />
        <ProviderAccounts />
        <HowItWorks />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
