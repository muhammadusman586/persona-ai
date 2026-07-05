import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { isAuthenticated } = await auth();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold">Persona AI</h1>
        <p className="max-w-xl text-muted-foreground">
          Chat with AI versions of Hitesh Choudhary and Piyush Garg. Learn to code in
          their own voice and teaching style.
        </p>
      </div>
      <div className="flex gap-3">
        {isAuthenticated ? (
          <Button asChild>
            <Link href="/chat">Go to chat →</Link>
          </Button>
        ) : (
          <>
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="secondary">Sign up</Button>
            </SignUpButton>
          </>
        )}
      </div>
    </main>
  );
}
