import { redirect } from 'next/navigation';

/** /new moved to /post — keep old links alive. */
export default function NewRedirect() {
  redirect('/post');
}
