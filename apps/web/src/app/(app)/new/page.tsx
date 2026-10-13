import { redirect } from 'next/navigation';

export const metadata = { title: 'New post' };


/** /new moved to /post, keep old links alive. */
export default function NewRedirect() {
  redirect('/post');
}
