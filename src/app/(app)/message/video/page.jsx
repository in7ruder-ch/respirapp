'use client';

import { redirect } from 'next/navigation';

export default function VideoMessagePage() {
  redirect('/library');
  return null;
}
