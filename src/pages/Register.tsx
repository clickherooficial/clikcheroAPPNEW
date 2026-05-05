import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Check,
  ArrowLeft,
  ArrowRight,
  User,
  Mail,
  Lock,
  Building2,
  Link2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/shared/Logo';
import { HexGrid } from '@/components/shared/HexGrid';

const signupSchema = z
  .object({
    displayName: z.string().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
    email: z.string().email('Email invalido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
    organizationName: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
    slug: z
      .string()
      .min(3, 'Mínimo 3 caracteres')
      .max(50, 'Máximo 50 caracteres')
      .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Apenas minusculas, numeros e hifens'),
    avatarSeed: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

// ---- Helpers ----

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_SEEDS: Array<{ id: string; from: string; to: string; label: string }> = [
  { id: 'amber', from: 'from-amber-400', to: 'to-orange-600', label: 'Ambar' },
  { id: 'violet', from: 'from-violet-500', to: 'to-fuchsia-600', label: 'Violeta' },
  { id: 'emerald', from: 'from-emerald-400', to: 'to-teal-600', label: 'Esmeralda' },
  { id: 'sky', from: 'from-sky-400', to: 'to-indigo-600', label: 'Ceu' },
  { id: 'rose', from: 'from-rose-400', to: 'to-pink-600', label: 'Rosa' },
  { id: 'slate', from: 'from-slate-500', to: 'to-zinc-700', label: 'Grafite' },
];

function passwordStrength(pwd: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (pwd.length >= 12) score++;
  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const map = {
    0: { label: '', color: 'bg-white/10' },
    1: { label: 'Fraca', color: 'bg-red-500' },
    2: { label: 'Razoavel', color: 'bg-orange-500' },
    3: { label: 'Boa', color: 'bg-yellow-500' },
    4: { label: 'Forte', color: 'bg-emerald-500' },
  } as const;
  return { score: clamped, ...map[clamped] };
}

// ---- Main component ----

const Register = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  /** Slugs disponíveis após erro 409 do create-organization */
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      organizationName: '',
      slug: '',
      avatarSeed: 'amber',
    },
  });

  const values = form.watch();
  const strength = useMemo(() => passwordStrength(values.password), [values.password]);

  // Auto-generate slug from orgName unless user has edited manually
  const handleOrgNameChange = (v: string) => {
    form.setValue('organizationName', v, { shouldValidate: true });
    if (!slugTouched) {
      form.setValue('slug', toSlug(v), { shouldValidate: true });
    }
  };

  const next = async () => {
    const fieldsByStep: Record<number, (keyof SignupFormValues)[]> = {
      1: ['displayName', 'email', 'password', 'confirmPassword'],
      2: ['organizationName', 'slug'],
    };
    const ok = await form.trigger(fieldsByStep[step]);
    if (!ok) return;
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  };

  const back = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));

  const onSubmit = async (v: SignupFormValues) => {
    setIsSubmitting(true);
    try {
      const { error, slugSuggestions: slugSuggestFromApi } = await signUp({
        email: v.email,
        password: v.password,
        displayName: v.displayName,
        organizationName: v.organizationName,
        slug: v.slug,
        avatarSeed: v.avatarSeed,
      });
      if (error) {
        if (slugSuggestFromApi && slugSuggestFromApi.length > 0) {
          setSlugSuggestions(slugSuggestFromApi);
          setStep(2);
          toast({
            title: 'URL já em uso',
            description:
              'Escolha uma das sugestões abaixo ou altere manualmente o endereço da organização.',
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Erro ao criar conta', description: error, variant: 'destructive' });
        }
        return;
      }
      setSlugSuggestions([]);
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Verifique seu email para confirmar o cadastro.',
      });
      navigate('/login');
    } catch {
      toast({
        title: 'Erro ao criar conta',
        description: 'Erro de conexão. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'h-11 bg-background/50 border-border rounded-xl focus:border-primary/50 focus:ring-primary/20 transition-all';

  const maxWidth = 'max-w-md';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 relative overflow-hidden transition-colors duration-500">
      <HexGrid />
      
      {/* Floating Theme Toggle */}
      <div className="absolute top-8 right-8 z-20">
        <ThemeToggle />
      </div>

      <div className={cn("w-full transition-all duration-700 relative z-10", maxWidth)}>
        <div className="bento-card bg-card/80 backdrop-blur-xl border-border shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-6 hover-lift cursor-pointer transition-all duration-500">
              <Logo size="lg" />
            </div>
            <h2 className="text-3xl font-bold tracking-tighter text-foreground">
              ClickHero
            </h2>
          </div>

        {/* Stepper */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-3 mb-3" role="list">
            {[1, 2, 3].map((n) => {
              const isActive = step === n;
              const isDone = step > n;
              return (
                <div key={n} className="flex items-center gap-3" role="listitem">
                  <div
                    aria-current={isActive ? 'step' : undefined}
                    className={cn(
                      'flex items-center justify-center h-8 w-8 rounded-full text-[13px] font-bold transition-all duration-300',
                      isDone && 'bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40',
                      isActive &&
                        'bg-primary text-primary-foreground ring-2 ring-primary/30 shadow-lg shadow-primary/20 scale-110',
                      !isActive && !isDone && 'bg-muted text-muted-foreground ring-1 ring-border',
                    )}
                  >
                    {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
                  </div>
                  {n < 3 && (
                    <div
                      className={cn(
                        'h-px w-10 transition-colors duration-500',
                        step > n ? 'bg-emerald-500/40' : 'bg-border',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={(step / 3) * 100} className="h-1.5 bg-muted" />
          <div className="flex justify-between mt-2 text-[11px] text-muted-foreground/70">
            <span className={cn(step >= 1 && 'text-foreground font-medium')}>Conta</span>
            <span className={cn(step >= 2 && 'text-foreground font-medium')}>Organização</span>
            <span className={cn(step >= 3 && 'text-foreground font-medium')}>Finalizar</span>
          </div>
        </div>

        {/* Card */}
        <div className="bento-card">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* ------ STEP 1 ------ */}
              {step === 1 && (
                <div className="space-y-5 fade-in">
                  <div className="text-center mb-4">
                    <h1 className="text-xl font-bold tracking-tight text-foreground">
                      Bem-vindo ao ClickHero
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                      Vamos começar pelos seus dados de acesso
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-medium text-foreground/80 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" /> Seu nome
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Joao Silva"
                            autoComplete="name"
                            className={inputClass}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-medium text-foreground/80 flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" /> Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="seu@email.com"
                            autoComplete="email"
                            className={inputClass}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-medium text-foreground/80 flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5" /> Senha
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Mínimo 8 caracteres"
                            autoComplete="new-password"
                            className={inputClass}
                            {...field}
                          />
                        </FormControl>
                        {/* Strength meter */}
                        <div className="mt-2 space-y-1.5">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className={cn(
                                  'h-1 flex-1 rounded-full transition-all duration-300',
                                  strength.score >= i ? strength.color : 'bg-muted',
                                )}
                              />
                            ))}
                          </div>
                          {strength.label && (
                            <p className="text-[11px] text-muted-foreground">
                              Forca: <span className="text-foreground font-medium">{strength.label}</span>
                            </p>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-medium text-foreground/80 flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5" /> Confirmar senha
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Repita a senha"
                            autoComplete="new-password"
                            className={inputClass}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* ------ STEP 2 ------ */}
              {step === 2 && (
                <div className="space-y-5 fade-in">
                  <div className="text-center mb-4">
                    <h1 className="text-xl font-semibold text-foreground tracking-tight">
                      Sua organização
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Configure o espaco de trabalho da sua empresa
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="organizationName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-medium text-foreground/80 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" /> Nome da empresa
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Minha Agencia"
                            className={inputClass}
                            {...field}
                            onChange={(e) => handleOrgNameChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[13px] font-medium text-foreground/80 flex items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5" /> URL da organização
                        </FormLabel>
                        <FormControl>
                          <div className={cn('flex items-center', inputClass, 'pr-0 overflow-hidden')}>
                            <span className="pl-3 pr-1 text-[13px] text-muted-foreground select-none">
                              clickhero.app/
                            </span>
                            <input
                              {...field}
                              onChange={(e) => {
                                setSlugSuggestions([]);
                                setSlugTouched(true);
                                field.onChange(e.target.value.toLowerCase());
                              }}
                              placeholder="minha-agencia"
                              className="flex-1 bg-transparent outline-none text-foreground text-sm py-2 pr-3 placeholder:text-muted-foreground/60"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                        {slugSuggestions.length > 0 && (
                          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 space-y-2">
                            <p className="text-[12px] text-amber-200/95 leading-snug">
                              Este endereço já está em uso. Toque para usar uma sugestão disponível:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {slugSuggestions.map((s) => (
                                <Button
                                  key={s}
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 rounded-lg text-xs font-medium"
                                  onClick={() => {
                                    form.setValue('slug', s, { shouldValidate: true });
                                    setSlugTouched(true);
                                    setSlugSuggestions([]);
                                  }}
                                >
                                  {s}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                </div>
              )}

              {/* ------ STEP 3 ------ */}
              {step === 3 && (
                <div className="space-y-6 fade-in">
                  <div className="text-center mb-2">
                    <h1 className="text-xl font-semibold text-foreground tracking-tight">
                      Quase la
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Personalize seu avatar e revise os dados
                    </p>
                  </div>

                  {/* Avatar preview */}
                  <FormField
                    control={form.control}
                    name="avatarSeed"
                    render={({ field }) => {
                      const seed = AVATAR_SEEDS.find((s) => s.id === field.value) ?? AVATAR_SEEDS[0];
                      return (
                        <FormItem>
                          <div className="flex flex-col items-center gap-4">
                            <div
                              className={cn(
                                'h-24 w-24 rounded-full bg-gradient-to-br flex items-center justify-center text-2xl font-bold text-white shadow-xl ring-2 ring-white/10 transition-all duration-300',
                                seed.from,
                                seed.to,
                              )}
                            >
                              {initialsOf(values.displayName || '?')}
                            </div>
                            <FormControl>
                              <div className="flex gap-2">
                                {AVATAR_SEEDS.map((s) => {
                                  const selected = field.value === s.id;
                                  return (
                                    <button
                                      type="button"
                                      key={s.id}
                                      aria-label={`Avatar cor ${s.label}`}
                                      onClick={() => field.onChange(s.id)}
                                      className={cn(
                                        'h-8 w-8 rounded-full bg-gradient-to-br transition-all duration-200',
                                        s.from,
                                        s.to,
                                        selected
                                          ? 'ring-2 ring-white scale-110'
                                          : 'ring-1 ring-white/10 hover:scale-105',
                                      )}
                                    />
                                  );
                                })}
                              </div>
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  {/* Review card */}
                  <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5">
                    <ReviewRow icon={<User className="h-3.5 w-3.5" />} label="Nome" value={values.displayName} />
                    <ReviewRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={values.email} />
                    <ReviewRow
                      icon={<Building2 className="h-3.5 w-3.5" />}
                      label="Organização"
                      value={values.organizationName}
                    />
                    <ReviewRow
                      icon={<Link2 className="h-3.5 w-3.5" />}
                      label="URL"
                      value={`clickhero.app/${values.slug}`}
                    />
                  </div>
                </div>
              )}

              {/* ------ Footer buttons ------ */}
              <div className="flex gap-3 pt-2">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={back}
                    disabled={isSubmitting}
                    className="h-11 px-4 rounded-xl bg-muted/30 border-border hover:bg-muted text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
                  </Button>
                )}
                {step < 3 && (
                    <Button
                      type="button"
                      onClick={next}
                      className="flex-1 h-11 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                    >
                      Continuar <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                  )}
                  {step === 3 && (
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 h-11 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        "Criar minha conta"
                      )}
                    </Button>
                )}
              </div>
            </form>
          </Form>
        </div>

        <p className="text-[13px] text-muted-foreground text-center mt-6">
          Ja tem conta?{' '}
          <Link to="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
            Entrar
          </Link>
        </p>
      </div>
    </div>
    </div>
  );
};

function ReviewRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-foreground font-medium truncate max-w-[60%] text-right">
        {value || <span className="text-muted-foreground/60">—</span>}
      </span>
    </div>
  );
}

export default Register;
