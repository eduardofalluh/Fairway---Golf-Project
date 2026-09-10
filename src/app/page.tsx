import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Hero, CourseMarquee } from "@/components/Hero";
import { TeeFinder } from "@/components/TeeFinder";
import { ProviderAccounts } from "@/components/ProviderAccounts";
import { HowItWorks, Faq, Footer } from "@/components/Sections";
import { getDirectory } from "@/lib/aggregator";

// Keep the app shell fresh so mobile browsers and Netlify do not retain old UI copy.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const [montrealCourses, torontoCourses] = await Promise.all([
    getDirectory("montreal"),
    getDirectory("toronto"),
  ]);
  const courses = [...montrealCourses, ...torontoCourses];
  const names = courses.map((c) => c.name);

  return (
    <>
      <ScrollProgress />
      <Nav />
      <main>
        <Hero courseCount={courses.length} />
        <CourseMarquee names={names} />
        <ProviderAccounts />
        <TeeFinder />
        <HowItWorks />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
