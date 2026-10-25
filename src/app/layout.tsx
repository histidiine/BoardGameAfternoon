import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import "./globals.css";
import { getViewer } from "@/lib/data";
import { isTheme, type Theme } from "@/lib/domain";
import { THEME_COOKIE } from "@/lib/theme";
import { Avatar } from "@/components/Bits";
import { Icon, IconSprite } from "@/components/Icons";
import { Mascot } from "@/components/Mascot";
import { Nav } from "@/components/Nav";
import { ThemeMenu } from "@/components/ThemePicker";
import { UIProvider } from "@/components/UI";

export const metadata: Metadata = {
  title: { default: "Board Game Afternoons", template: "%s · Board Game Afternoons" },
  description: "Our shared shelf of board games, favorites and votes for the next afternoon.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

const FONTS =
  "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&family=Baloo+2:wght@500;600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const cookieTheme = (await cookies()).get(THEME_COOKIE)?.value;
  const theme: Theme = viewer?.theme ?? (isTheme(cookieTheme) ? cookieTheme : "a");

  return (
    <html lang="en" data-skin={theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <IconSprite />
        <UIProvider>
          <header className="top">
            <div className="wrap">
              <Link className="brand" href="/" aria-label="Board Game Afternoons, go to the shelf">
                <Mascot mood="happy" size={34} />
                <span>Board Game Afternoons</span>
              </Link>
              <Nav admin={viewer?.role === "admin"} variant="top" />
              <ThemeMenu current={theme} />
              <div className="who">
                {viewer ? (
                  <Link className="iconbtn" href="/profile" aria-label={`Profile of ${viewer.display_name}`} style={{ textDecoration: "none", paddingLeft: 4 }}>
                    <Avatar member={viewer} />
                    <span className="nm">{viewer.display_name}</span>
                  </Link>
                ) : (
                  <Link className="iconbtn" href="/login" style={{ textDecoration: "none" }}>
                    <Icon name="user" />
                    <span>Log in</span>
                  </Link>
                )}
              </div>
            </div>
          </header>
          <main id="main" className="wrap">
            {children}
          </main>
          <Nav admin={false} variant="tabs" />
        </UIProvider>
      </body>
    </html>
  );
}
