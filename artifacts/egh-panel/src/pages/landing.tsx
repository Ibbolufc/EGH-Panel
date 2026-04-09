import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="container mx-auto px-4 py-6 flex justify-between items-center border-b border-border/40">
        <div className="text-xl font-bold text-primary tracking-tight">EGH Panel</div>
        <nav className="space-x-4">
          <Link href="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link href="/login">
            <Button>Get Started</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 max-w-4xl">
          Premium Game Server <span className="text-primary">Hosting Control</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
          High-performance, uncompromised control panel for serious game server hosts. Precise infrastructure management with zero fluff.
        </p>
        <div className="flex gap-4">
          <Link href="/login">
            <Button size="lg" className="text-lg px-8 h-14">Deploy Now</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="text-lg px-8 h-14">View Demo</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
