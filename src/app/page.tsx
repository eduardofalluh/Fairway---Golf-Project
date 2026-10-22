import { Nav } from "@/components/Nav";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Hero, CourseMarquee } from "@/components/Hero";
import { SearchProvider } from "@/components/search/SearchProvider";
import { FiltersSheet } from "@/components/search/FiltersSheet";
import { Results } from "@/components/results/Results";
import { BookingSheet } from "@/components/BookingSheet";
import { HowItWorks, Faq, Footer } from "@/components/Sections";
import { getDirectory } from "@/lib/aggregator";
import { emailConfigured } from "@/lib/email-config";

// The shell is prerendered and refreshed every 6 hours; tee times load live in
// the browser, so the page never waits on providers.
export const revalidate = 21600;

export default async function Home() {
  const [montrealCourses, torontoCourses] = await Promise.all([
    getDirectory("montreal"),
    getDirectory("toronto"),
  ]);
  const courses = [...montrealCourses, ...torontoCourses];
  const names = courses.filter((c) => c.online).map((c) => c.name);

  return (
    <SearchProvider emailEnabled={emailConfigured()}>
      <ScrollProgress />
      <Nav />
      <main>
        <Hero courseCount={courses.length} />
        <CourseMarquee names={names} />
        <Results />
        <HowItWorks />
        <Faq />
      </main>
      <Footer />
      <FiltersSheet />
      <BookingSheet />
    </SearchProvider>
  );
}
