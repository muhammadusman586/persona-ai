import { listConversations } from "@/lib/db/conversations";
import { auth } from "@clerk/nextjs/server";
import { Sidebar } from "@/components/chat/sidebar";
import { UserButton } from "@clerk/nextjs";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const conversations = userId ? await listConversations(userId) : [];

  return (
    <div className="flex h-svh">
      <aside className="flex w-72 shrink-0 flex-col border-r bg-muted/30">
        <div className="flex items-center justify-between p-3">
          <span className="font-semibold">Persona AI</span>
          <UserButton />
        </div>
        <Sidebar conversations={conversations} />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
