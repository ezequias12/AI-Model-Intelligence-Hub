import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";
import { ThemeProvider } from "@/components/shell/theme";
import { themeInitScript } from "@/components/shell/theme-script";
import { DataModeBanner } from "@/components/ui/primitives";
import { getRepository } from "@/lib/data";
import { computeFreshness, thresholdsForDomain } from "@/lib/domain/freshness";
import { buildSearchIndex } from "@/lib/search";

export const metadata: Metadata = {
  title: {
    default: "AI Model Intelligence Hub",
    template: "%s · AI Model Intelligence Hub",
  },
  description:
    "Model metrics, benchmark rankings, cost efficiency, provider intelligence, AI news, coding-harness subscriptions and neutral world news in one analytical workspace.",
  applicationName: "AI Model Intelligence Hub",
  robots: { index: false, follow: false },
  openGraph: {
    title: "AI Model Intelligence Hub",
    description:
      "An information-dense intelligence portal for AI models, news and coding-agent subscriptions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6fd" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const repository = await getRepository();

  const [models, providers, harnessProducts, harnessPlans, harnessPlanSnapshots, sources, news] =
    await Promise.all([
      repository.getModels(),
      repository.getProviders(),
      repository.getHarnessProducts(),
      repository.getHarnessPlans(),
      repository.getHarnessPlanSnapshots(),
      repository.getSources(),
      repository.getNews({ limit: 80 }),
    ]);

  const searchIndex = buildSearchIndex({
    models,
    providers,
    harnessProducts,
    harnessPlans,
    harnessPlanSnapshots: harnessPlanSnapshots.map((snapshot) => ({
      planId: snapshot.planId,
      monthlyPriceUsd: snapshot.monthlyPriceUsd,
      capturedAt: snapshot.capturedAt,
    })),
    sources,
    news,
  });

  const freshness = computeFreshness(repository.meta.datasetCapturedAt, {
    thresholds: thresholdsForDomain("models"),
  });

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <AppShell
            freshnessLabel={`Data ${freshness.label}`}
            freshnessTone={freshness.state}
            dataModeLabel={repository.meta.mode === "mock" ? "Mock data" : "Live"}
            degraded={repository.meta.degraded}
            searchIndex={searchIndex}
            dataNotice={
              repository.meta.degraded ? (
                <DataModeBanner
                  mode={repository.meta.mode}
                  degraded
                  label={repository.meta.label}
                  detail={repository.meta.degradedReason}
                />
              ) : repository.meta.mode === "mock" ? (
                <DataModeBanner
                  mode="mock"
                  degraded={false}
                  label="Fixture data (mock mode)"
                  detail="No credentials required. Every value on this screen is a deterministic fixture and is labeled as such."
                />
              ) : null
            }
          >
            {children}
          </AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
