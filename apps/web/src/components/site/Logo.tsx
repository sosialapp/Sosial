import Image from 'next/image';
import Link from 'next/link';

export default function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="Sosial home">
      <Image src="/bolt.png" alt="" width={30} height={30} className="h-8 w-8 object-contain" priority />
      <span className="font-display text-xl font-extrabold tracking-tighter">Sosial</span>
    </Link>
  );
}
