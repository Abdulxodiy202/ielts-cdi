import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://ielts-cdi.vercel.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://ielts-cdi.vercel.app/reading', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://ielts-cdi.vercel.app/listening', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://ielts-cdi.vercel.app/mock-test', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
  ]
}
