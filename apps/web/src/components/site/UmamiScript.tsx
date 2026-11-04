'use client';

import Script from 'next/script';
import { useEffect } from 'react';

const UMAMI_URL = process.env.NEXT_PUBLIC_UMAMI_URL?.trim().replace(/\/+$/, '');
const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();

declare global {
  interface Window {
    umamiBeforeSend?: <T>(type: string, payload: T) => T | null;
  }
}

/** False once the visitor has left the layouts that mount this component. */
let onPublicPage = true;

if (typeof window !== 'undefined') {
  window.umamiBeforeSend = (_type, payload) => (onPublicPage ? payload : null);
}

/** Self-hosted, cookieless traffic stats for the public site and docs only.
 *  Never mount this on signed-in, auth or invite pages: their URLs can carry
 *  private ids and tokens. The loaded tracker survives client-side navigation
 *  and watches history, so the unmount below is what stops it reporting app
 *  URLs after a <Link> from a public page into the app.
 *
 *  Query strings are kept so UTM tags are reported; hashes are not. Renders
 *  nothing until both env values are set, and data-domains stops local and
 *  preview hosts from counting. */
export default function UmamiScript() {
  useEffect(() => {
    onPublicPage = true;
    return () => {
      onPublicPage = false;
    };
  }, []);

  if (!UMAMI_URL || !WEBSITE_ID) return null;
  return (
    <Script
      src={`${UMAMI_URL}/script.js`}
      strategy="afterInteractive"
      data-website-id={WEBSITE_ID}
      data-domains="sosial.app,docs.sosial.app"
      data-exclude-hash="true"
      data-before-send="umamiBeforeSend"
    />
  );
}
