import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import { FirebaseProvider } from "./providers";
import { HighlightProvider } from './contexts/HighlightContext';
import { ThemeProvider } from './contexts/ThemeContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scripture Study App",
  description: "A collaborative scripture study application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-white`}>
        <FirebaseProvider>
          <HighlightProvider>
            <ThemeProvider>
              <Navbar />
              <main className="min-h-screen bg-white dark:bg-gray-900">
                {children}
              </main>
            </ThemeProvider>
          </HighlightProvider>
        </FirebaseProvider>
      </body>
    </html>
  );
}
