'use client';

import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function Nav() {
  return (
    <nav>
      <Link href="/" className="logo">
        <em>sharp</em><span>d</span>
      </Link>
      <div className="nav-right">
        <ThemeToggle />
      </div>
    </nav>
  );
}
