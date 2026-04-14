import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const rubik = Rubik({
  subsets: ["latin", "arabic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FaceBurger",
  description: "Commandez vos burgers en ligne",
};

const themeInitScript = `(function(){try{var k='faceburger-theme';var t=localStorage.getItem(k);if(t==='dark'||t==='light'){document.documentElement.classList.toggle('dark',t==='dark');return}if(matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('dark')}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <body className={`${rubik.className} bg-white dark:bg-[#121316]`} suppressHydrationWarning style={{ margin: 0 }}>
        <Script id="faceburger-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
