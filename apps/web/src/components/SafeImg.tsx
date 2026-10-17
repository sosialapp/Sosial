'use client';

import { useState, type ImgHTMLAttributes, type ReactNode } from 'react';

/**
 * An <img> that degrades gracefully when the stored file is gone. A signed or
 * public storage URL is minted even when the object is missing, so the fetch
 * 500s and the browser paints a broken-image icon; once the load fails we
 * render `fallback` (nothing by default) instead. Media that survived a
 * migration as rows without bytes lands here, as does any expired URL.
 */
export default function SafeImg({
  fallback = null,
  onError,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      onError={(e) => {
        setFailed(true);
        onError?.(e);
      }}
    />
  );
}
