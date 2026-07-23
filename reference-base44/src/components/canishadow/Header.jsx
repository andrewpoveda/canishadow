import React from "react";
import { Link } from "react-router-dom";
import { Github, Search } from "lucide-react";

export default function Header() {
  return (
    <div className="pointer-events-auto flex w-full items-center justify-between px-3 pt-3">
      <span className="rounded-pill bg-paper/80 px-4 py-1.5 font-display text-[22px] italic text-ink backdrop-blur-sm">
        canishadow
      </span>
      <div className="flex items-center gap-2">
      <Link
        to="/search"
        aria-label="Search clinics"
        className="flex h-11 w-11 items-center justify-center rounded-pill bg-paper/80 backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Search className="h-5 w-5 text-ink-2" />
      </Link>
      <a
        href="https://github.com/andrewpoveda/canishadow"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub repository"
        className="flex h-11 w-11 items-center justify-center rounded-pill bg-paper/80 backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Github className="h-5 w-5 text-ink-2" />
      </a>
      </div>
    </div>
  );
}