import Link from "next/link";

interface SiteNavProps {
  activePage: "home" | "bracket" | "about";
}

const PROJECT_GITHUB_URL = "https://github.com/wsmartf/brackets";

export default function SiteNav({ activePage }: SiteNavProps) {
  return (
    <nav className="bg-[#0d0d12] border-b border-white/8 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <span className="text-sm font-semibold tracking-wide text-white/90">
          Brackets
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            {activePage === "home" ? (
              <span className="rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-white">
                Dashboard
              </span>
            ) : (
              <Link
                href="/"
                className="rounded-full border border-white/10 px-4 py-1.5 text-white/60 transition-colors hover:bg-white/8 hover:text-white"
              >
                Dashboard
              </Link>
            )}
            {activePage === "bracket" ? (
              <span className="hidden sm:inline-block rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-white">
                Live Bracket
              </span>
            ) : (
              <Link
                href="/bracket/418275901"
                className="hidden sm:inline-block rounded-full border border-white/10 px-4 py-1.5 text-white/60 transition-colors hover:bg-white/8 hover:text-white"
              >
                Live Bracket
              </Link>
            )}
            {activePage === "about" ? (
              <span className="rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-white">
                About
              </span>
            ) : (
              <Link
                href="/about"
                className="rounded-full border border-white/10 px-4 py-1.5 text-white/60 transition-colors hover:bg-white/8 hover:text-white"
              >
                About
              </Link>
            )}
          </div>
          <a
            href={PROJECT_GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="View the project on GitHub"
            title="View the project on GitHub"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/72 transition-all hover:-translate-y-0.5 hover:border-white/24 hover:bg-white/10 hover:text-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="h-4 w-4 fill-current"
            >
              <path d="M8 0C3.58 0 0 3.67 0 8.2c0 3.63 2.29 6.7 5.47 7.78.4.08.55-.18.55-.39 0-.19-.01-.82-.01-1.49-2.01.38-2.53-.51-2.69-.98-.09-.24-.48-.98-.82-1.18-.28-.15-.68-.53-.01-.54.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.5-1.09-1.78-.21-3.64-.92-3.64-4.07 0-.9.31-1.64.82-2.22-.08-.21-.36-1.05.08-2.18 0 0 .67-.22 2.2.85A7.36 7.36 0 0 1 8 3.8c.68 0 1.37.09 2.01.27 1.53-1.07 2.2-.85 2.2-.85.44 1.13.16 1.97.08 2.18.51.58.82 1.31.82 2.22 0 3.16-1.87 3.86-3.65 4.07.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.14.47.55.39A8.22 8.22 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z" />
            </svg>
          </a>
        </div>
      </div>
    </nav>
  );
}
