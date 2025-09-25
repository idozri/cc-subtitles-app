import { Inter, Roboto, Open_Sans, Lato, Montserrat } from 'next/font/google';

// Preload a small curated set using Next.js fonts
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});
const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'] });
const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});
const lato = Lato({ subsets: ['latin'], weight: ['400', '700'] });
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});

export type PreloadedFont = { family: string; className: string };

export const POPULAR_FONTS: PreloadedFont[] = [
  { family: 'Inter', className: inter.className },
  { family: 'Roboto', className: roboto.className },
  { family: 'Open Sans', className: openSans.className },
  { family: 'Lato', className: lato.className },
  { family: 'Montserrat', className: montserrat.className },
];

const familyToClass = new Map(
  POPULAR_FONTS.map((f) => [f.family.toLowerCase(), f.className] as const)
);

export const getPreloadedFontClassName = (
  family?: string
): string | undefined => {
  if (!family) return undefined;
  return familyToClass.get(family.toLowerCase());
};
