import Image from 'next/image';
import Link from 'next/link';

export default function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="Sosial home">
      <Image src="/bolt.png" alt="" width={26} height={26} className="h-7 w-7 object-contain" priority />
      <span className="font-display text-lg font-extrabold tracking-tight">Sosial</span>
    </Link>
  );
}
