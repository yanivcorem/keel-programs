import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DemoControls } from "@/components/demo-controls";
import { Nav } from "@/components/nav";
import { config } from "@/lib/config";
import { homeStats, programHeader } from "@/lib/queries";
import { currentWorkspace } from "@/lib/workspace";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${config.productName}: agentic accelerator demo`,
  description: `A running startup program with ${config.agentName}, an AI program manager. Demo data only.`,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { db, workspaceId } = await currentWorkspace();
  const [header, stats] = await Promise.all([programHeader(db, workspaceId), homeStats(db, workspaceId)]);
  const signupUrl = process.env.NEXT_PUBLIC_SIGNUP_URL;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground md:flex-row">
        <Nav badge={stats.needsCall + stats.pendingDrafts} productName={config.productName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center md:justify-between md:px-8">
            <div>
              <h1 className="text-lg font-semibold">{header.name}</h1>
              <p className="text-sm text-muted-foreground">
                Cohort {header.cohort} · Week {header.week} of {header.totalWeeks} · demo data
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <DemoControls simDay={header.simDay} />
              {signupUrl ? (
                <a href={signupUrl} className="text-xs underline underline-offset-4">
                  Get updates / join the show-n-tell
                </a>
              ) : null}
            </div>
          </header>
          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
