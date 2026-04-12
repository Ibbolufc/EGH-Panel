import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/components/providers/auth-provider";
import EghLogo from "@/components/ui/logo";

const formSchema = z.object({
  email: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login: setAuthToken } = useAuth();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    loginMutation.mutate({ data: values }, {
      onSuccess: (data) => {
        setAuthToken(data.token);
        setLocation(data.user.role === "client" ? "/client" : "/admin");
      },
      onError: (error) => {
        toast({
          title: "Authentication failed",
          description: error.data?.error ?? "Invalid credentials. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background overflow-hidden">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm px-4 flex flex-col items-center gap-8">
        {/* Logo */}
        <EghLogo />

        {/* Card */}
        <Card className="w-full border-border/60 bg-card/80 shadow-2xl shadow-black/40 backdrop-blur-sm">
          <CardContent className="px-6 py-7 space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Sign in to your account</h2>
              <p className="text-xs text-muted-foreground">Enter your credentials to continue</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="you@example.com"
                          autoComplete="email"
                          autoFocus
                          className="h-10 bg-input/60 border-border/60 placeholder:text-muted-foreground/40 focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/30 transition-colors"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="h-10 bg-input/60 border-border/60 placeholder:text-muted-foreground/40 focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/30 transition-colors"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-10 font-semibold"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground/40 select-none">
          EGH Panel &copy; {new Date().getFullYear()} &middot; Easy Game Host
        </p>
      </div>
    </div>
  );
}
