import type { ReactNode } from 'react';
import ScrollProgress from '@/components/anim/ScrollProgress';
import SiteFooter from '@/components/site/SiteFooter';
import SiteNav from '@/components/site/SiteNav';

/** Chrome for every public page: progress bar, sticky nav, footer. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollProgress />
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
