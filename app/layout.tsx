import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { siteConfig } from "@/config/site";
import { I18nProvider } from "@/components/common/I18nProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: `${siteConfig.brand.name} — ${siteConfig.brand.taglineKo}`,
  description: `${siteConfig.brand.taglineKo} · ${siteConfig.brand.taglineEn}`,
  openGraph: {
    title: `${siteConfig.brand.name} — ${siteConfig.brand.taglineKo}`,
    description: siteConfig.brand.taglineEn,
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbf8f3",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={siteConfig.defaultLanguage}>
      <body>
        <I18nProvider>{children}</I18nProvider>
        {siteConfig.features.analytics && <Analytics />}
      </body>
    </html>
  );
}
