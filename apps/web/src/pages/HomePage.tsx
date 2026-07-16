import { AboutBand } from '../components/home/AboutBand';
import { FeaturedContent } from '../components/home/FeaturedContent';
import { Hero } from '../components/home/Hero';
import { siteContent } from '../content/site';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export function HomePage() {
  useDocumentMeta({ title: siteContent.name, description: siteContent.description });

  return (
    <>
      <Hero />
      <FeaturedContent />
      <AboutBand />
    </>
  );
}
