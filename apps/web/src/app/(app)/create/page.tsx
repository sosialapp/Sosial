import { redirect } from 'next/navigation';

export const metadata = { title: 'Create' };


/** /create moved to /post, keep old links alive. */
export default function CreateRedirect() {
  redirect('/post');
}
