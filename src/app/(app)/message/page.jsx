'use client';

import { redirect } from 'next/navigation';

export default function MessagePage() {
  redirect('/library');
  return null;
}
