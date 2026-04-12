import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, CheckCircle2, Circle, Loader2 } from "lucide-react";
import EghLogo from "@/components/ui/logo";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/providers/auth-provider";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const formSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").max(64),
    lastName: z.string().min(1, "Last name is required").max(64),
    username: z
      .string()
      .min(3, "At least 3 characters")
      .max(32)
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Letters, numbers, underscores, and hyphens only",
      ),
    email: z.string().email("Must be a valid email address"),
    password: z
      .string()
      .min(12, "At least 12 characters")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

interface SetupResponse {
  token: string;
  user: {
    id: number;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

async function postSetup(values: Omit<FormValues, "confirmPassword">): Promise<SetupResponse> {
  const res = await fetch(`${API_BASE}/api/setup/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `HTTP ${res.status}`,
    );
  }
  return data as SetupResponse;
}

const passwordRequirements = [
  { label: "At least 12 characters", test: (v: string) => v.length >= 12 },
  { label: "One lowercase letter",   test: (v: string) => /[a-z]/.test(v) },
  { label: "One uppercase letter",   test: (v: string) => /[A-Z]/.test(v) },
  { label: "One number",             test: (v: string) => /[0-9]/.test(v) },
];

const inputClass = "h-10 bg-input/60 border-border/60 placeholder:text-muted-foreground/40 focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-primary/30 transition-colors";
const labelClass = "text-xs font-medium text-muted-foreground uppercase tracking-wider";

export default function Setup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login: setAuthToken } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const watchedPassword = form.watch("password");

  const setupMutation = useMutation({
    mutationFn: postSetup,
    onSuccess: (data) => {
      setAuthToken(data.token);
      queryClient.setQueryData(["setup-status"], { setupRequired: false });
      toast({ title: "Account created", description: "Welcome to EGH Panel." });
      setLocation("/admin");
    },
    onError: (err: Error) => {
      toast({
        title: "Setup failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword: _confirm, ...rest } = values;
    setupMutation.mutate(rest);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-background overflow-hidden py-10">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[600px] w-[600px] rounded-full bg-primary/5 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-lg px-4 flex flex-col gap-6">
        {/* Logo */}
        <div className="flex justify-center">
          <EghLogo subtitle="Initial Setup" />
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/25 bg-amber-500/8 px-4 py-3">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-300/90 leading-relaxed">
            This page is only shown once — it disappears automatically after your
            administrator account is created. Keep your credentials safe.
          </p>
        </div>

        <Card className="border-border/60 bg-card/80 shadow-2xl shadow-black/40 backdrop-blur-sm">
          <CardContent className="px-6 py-7">
            <div className="mb-6 space-y-1">
              <h2 className="text-base font-semibold text-foreground">Create administrator account</h2>
              <p className="text-xs text-muted-foreground">This account will have full control over the panel.</p>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane" className={inputClass} {...field} />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" className={inputClass} {...field} />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Username</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="janedoe"
                          className={inputClass}
                          autoComplete="username"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@example.com"
                          className={inputClass}
                          autoComplete="email"
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
                      <FormLabel className={labelClass}>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••••••"
                          className={inputClass}
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                      {watchedPassword.length > 0 && (
                        <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {passwordRequirements.map(({ label, test }) => {
                            const ok = test(watchedPassword);
                            return (
                              <li
                                key={label}
                                className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                                  ok ? "text-emerald-400" : "text-muted-foreground/60"
                                }`}
                              >
                                {ok
                                  ? <CheckCircle2 className="h-3 w-3 shrink-0" />
                                  : <Circle className="h-3 w-3 shrink-0" />
                                }
                                {label}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••••••"
                          className={inputClass}
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="pt-1">
                  <Button
                    type="submit"
                    className="w-full h-10 font-semibold"
                    disabled={setupMutation.isPending}
                  >
                    {setupMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating account…
                      </>
                    ) : (
                      "Create Administrator Account"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/40 select-none">
          EGH Panel &middot; Easy Game Host
        </p>
      </div>
    </div>
  );
}
