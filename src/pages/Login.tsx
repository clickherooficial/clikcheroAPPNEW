import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HexGrid } from '@/components/shared/HexGrid';
import { Logo } from '@/components/shared/Logo';

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Senha e obrigatoria'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await signIn({ email: values.email, password: values.password });
      if (error) {
        toast({ title: 'Erro ao entrar', description: error, variant: 'destructive' });
        return;
      }
      navigate('/');
    } catch {
      toast({ title: 'Erro ao entrar', description: 'Erro de conexão. Tente novamente.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 relative overflow-hidden transition-colors duration-500">
      <HexGrid />
      
      {/* Floating Theme Toggle */}
      <div className="absolute top-8 right-8 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative z-10 fade-in">
        <div className="bento-card bg-card/80 backdrop-blur-xl border-border shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="mb-6 hover-lift cursor-pointer transition-all duration-500">
              <Logo size="lg" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Acesse sua conta
            </h1>
            <p className="text-sm text-muted-foreground mt-2 text-center max-w-[280px]">
              Gerencie suas campanhas e leads com inteligência artificial
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        autoComplete="email"
                        className="h-11 bg-background/50 border-border rounded-xl px-4 text-sm focus:ring-primary/20 focus:border-primary transition-all"
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
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="h-11 bg-background/50 border-border rounded-xl px-4 text-sm focus:ring-primary/20 focus:border-primary transition-all"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Entrar na plataforma"
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Footer link */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground font-medium">
            Não tem uma conta?{" "}
            <Link to="/register" className="text-primary hover:underline font-bold transition-all">
              Criar conta agora
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
