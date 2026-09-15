import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: "Нарратив — главное в ваших данных",
  description: "Главное в ваших данных: выводы ИИ и ответы по отчётам.",
  openGraph: { title: "Нарратив — главное в ваших данных", description: "Главное в ваших данных: выводы ИИ и ответы по отчётам.", type: "website", locale: "ru_RU" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body><ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>{children}</ThemeProvider></body>
    </html>
  );
}
