import { redirect } from 'next/navigation';

/** /new moved to /create — keep old links alive. */
export default function NewRedirect() {
  redirect('/create');
}
