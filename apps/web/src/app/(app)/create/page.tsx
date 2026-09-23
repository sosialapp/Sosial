import { redirect } from 'next/navigation';

/** /create moved to /post — keep old links alive. */
export default function CreateRedirect() {
  redirect('/post');
}
