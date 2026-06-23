import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Hero, CourseMarquee } from "@/components/Hero";
import { TeeFinder } from "@/components/TeeFinder";
import {
  HowItWorks,
  Stats,
  RegionsShowcase,
  CtaBand,
  Faq,
  Footer,
} from "@/components/Sections";
import { Features } from "@/components/Features";
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
        <Stats courses={courses} />
        <Features />
        <HowItWorks />
        <RegionsShowcase courses={courses} />
        <CtaBand />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
