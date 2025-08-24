// src/app/(app)/layout.jsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import BottomNav from "@/components/BottomNav";
import "@/styles/AppShell.css";

export const dynamic = "force-dynamic"; // evita cachear sesión

export default async function AppLayout({ children }) {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/profile"); // página pública de login
  }

  // Layout del segmento protegido
  return (
    <div className="app-shell">
      <main className="page">{children}</main>
      <BottomNav />
    </div>
  );
}
