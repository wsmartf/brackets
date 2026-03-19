import Link from "next/link";

interface SiteNavProps {
  activePage: "home" | "bracket" | "about";
}

export default function SiteNav({ activePage }: SiteNavProps) {
  return (
    <nav className="bg-[#0d0d12] border-b border-white/8 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <span className="text-sm font-semibold tracking-wide text-white/90">
          Brackets
        </span>
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
      </div>
    </nav>
  );
}
