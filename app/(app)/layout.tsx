import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar userEmail={user.email ?? "alex"} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
