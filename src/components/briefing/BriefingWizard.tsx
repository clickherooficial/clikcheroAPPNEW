// Wizard de onboarding: 6 passos de briefing + passo 7 (Meta / Business Manager).
// Spec: .kiro/specs/briefing-onboarding/ (task 6.1)

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useBriefing } from '@/hooks/use-briefing';
import { useArchetypeDetection } from '@/hooks/use-archetype-detection';
import { StepBusiness } from './steps/StepBusiness';
import { StepOffers } from './steps/StepOffers';
import { StepAudience } from './steps/StepAudience';
import { StepTone } from './steps/StepTone';
import { StepVisuals } from './steps/StepVisuals';
import { StepProhibitions } from './steps/StepProhibitions';
import { StepMetaConnect } from './steps/StepMetaConnect';
import {
  audienceStepSchema,
  businessStepSchema,
  toneStepSchema,
  visualStepSchema,
} from '@/lib/briefing-schemas';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from 'next-themes';
import { WIZARD_STEP_STORAGE_KEY } from '@/lib/oauth-meta-return';

const THEME_STORAGE_KEY = 'clickhero-theme';

const WIZARD_TOTAL_STEPS = 7;

type StepNum = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Lê `?step=` (1–7); invalido/absente retorna null. */
function parseWizardStepParam(search: string | null): StepNum | null {
  if (search == null || search === '') return null;
  const n = Number.parseInt(search, 10);
  if (!Number.isInteger(n) || n < 1 || n > WIZARD_TOTAL_STEPS) return null;
  return n as StepNum;
}

function readStoredWizardStep(): StepNum | null {
  try {
    const raw = Number.parseInt(sessionStorage.getItem(WIZARD_STEP_STORAGE_KEY) ?? '', 10);
    if (Number.isInteger(raw) && raw >= 1 && raw <= WIZARD_TOTAL_STEPS) return raw as StepNum;
  } catch {
    /* ignore */
  }
  return null;
}
const STEP_TITLES: Record<StepNum, string> = {
  1: 'Sobre seu negocio',
  2: 'Suas ofertas',
  3: 'Cliente ideal (ICP)',
  4: 'Tom de voz da sua marca',
  5: 'Identidade visual',
  6: 'O que Não usar (proibições)',
  7: 'Meta e Business Manager',
};

const STEP_HELPER: Record<StepNum, string> = {
  1: 'Ajude-nos a entender o que sua empresa faz e onde você esta nas redes.',
  2: 'O que você vende: nome, preço e descrição do principal produto ou serviço.',
  3: 'Quem e a pessoa ideal que compra de você: idade, lugar, dor, comportamento',
  4: 'Como SUA MARCA fala nos anúncios: formal/casual, palavras que você usa, palavras que não quer ver',
  5: 'Suas cores e logo para manter a marca consistente nos seus materiais.',
  6: 'Palavras, assuntos ou imagens que NUNCA podem aparecer (compliance)',
  7: 'Conecte a conta Meta do seu negocio para importar campanhas, páginas e contas de anúncio. Ao voltar depois da Meta, você permanece aqui — o briefing já preenchido continua salvo. Integrações ficam sempre disponíveis depois.',
};

export function BriefingWizard() {
  const { briefing, isLoading, isReadOnly, saveStep } = useBriefing();
  const { role, company } = useAuth();
  const { trigger: triggerArchetypeDetection } = useArchetypeDetection();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<StepNum>(() => {
    if (typeof window === 'undefined') return 1;
    const qs = new URLSearchParams(window.location.search);
    return parseWizardStepParam(qs.get('step')) ?? readStoredWizardStep() ?? 1;
  });

  const goToStep = useCallback(
    (s: StepNum) => {
      setStep(s);
      try {
        sessionStorage.setItem(WIZARD_STEP_STORAGE_KEY, String(s));
      } catch {
        /* ignore */
      }
      navigate(`/briefing/wizard?step=${String(s)}`, { replace: true });
    },
    [navigate],
  );

  // Meta OAuth na mesma aba: limpa query e dispara o mesmo fluxo do popup
  useEffect(() => {
    const oauthDone = searchParams.get('oauth_meta_done');
    const oauthErr = searchParams.get('oauth_meta_error');
    if (oauthDone !== '1' && oauthErr == null) return;

    const next = new URLSearchParams(searchParams);
    if (oauthDone === '1') {
      queryClient.invalidateQueries({ queryKey: ['meta-integration'] });
      queryClient.invalidateQueries({ queryKey: ['meta-assets'] });
      const acct = parseInt(searchParams.get('oauth_accounts') ?? '0', 10) || 0;
      window.dispatchEvent(
        new CustomEvent('meta-oauth-completed', { detail: { accounts: acct } }),
      );
      toast({
        title: 'Meta conectado!',
        description: acct
          ? `${acct} conta(s) encontrada(s). Escolha os ativos se desejar.`
          : 'Conta ligada ao app.',
      });
      next.delete('oauth_meta_done');
      next.delete('oauth_accounts');
    }
    if (oauthErr != null && oauthErr !== '') {
      toast({
        title: 'Erro na conexão Meta',
        description: decodeURIComponent(oauthErr),
        variant: 'destructive',
      });
      next.delete('oauth_meta_error');
    }
    if (!next.has('step')) {
      next.set('step', String(readStoredWizardStep() ?? 7));
    }

    navigate(`/briefing/wizard?${next}`, { replace: true });
  }, [searchParams, navigate, queryClient, toast]);

  // URL ?step= (bookmark / retorno OAuth) mantém estado alinhado
  useEffect(() => {
    const s = parseWizardStepParam(searchParams.get('step'));
    if (s == null) return;
    setStep((prev) => (prev !== s ? s : prev));
    try {
      sessionStorage.setItem(WIZARD_STEP_STORAGE_KEY, String(s));
    } catch {
      /* ignore */
    }
  }, [searchParams]);
  const [busy, setBusy] = useState(false);
  const progress = useMemo(
    () => Math.round(((step - 1) / WIZARD_TOTAL_STEPS) * 100),
    [step],
  );
  const preWizardThemeRef = useRef<string | null>(null);

  const canUseWizard = !role || role === 'owner' || role === 'admin';

  // Ao abrir o formulario do wizard o tema vira claro (inclui tela de carregamento); ao sair, restaura o preferido antes.
  useEffect(() => {
    if (!canUseWizard) return;

    try {
      preWizardThemeRef.current =
        typeof window !== 'undefined'
          ? localStorage.getItem(THEME_STORAGE_KEY) ?? 'dark'
          : 'dark';
    } catch {
      preWizardThemeRef.current = 'dark';
    }
    setTheme('light');

    return () => {
      const prev = preWizardThemeRef.current;
      preWizardThemeRef.current = null;
      if (prev != null && prev !== '') {
        try {
          setTheme(prev);
        } catch {
          /* ignore */
        }
      }
    };
  }, [canUseWizard, setTheme]);

  // Bloqueia members (R6.5 / R1.1)
  if (role && role !== 'owner' && role !== 'admin') {
    return (
      <div className="container max-w-2xl py-12">
        <Alert>
          <AlertDescription>
            Você não tem permissão para preencher o briefing. Apenas owner/admin podem editar.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSaveStep = async (
    stepNum: StepNum,
    partial: Record<string, unknown>,
    next: StepNum | 'done',
  ) => {
    setBusy(true);
    try {
      // Validacao por schema do passo (apenas para os passos que escrevem em company_briefings)
      if (stepNum === 1) {
        const parsed = businessStepSchema.safeParse(partial);
        if (!parsed.success) {
          toast({
            title: 'Campos invalidos',
            description: parsed.error.issues[0]?.message ?? 'Revise os campos',
            variant: 'destructive',
          });
          return;
        }
      } else if (stepNum === 3) {
        const parsed = audienceStepSchema.safeParse(partial);
        if (!parsed.success) {
          toast({
            title: 'Campos invalidos',
            description: parsed.error.issues[0]?.message ?? 'Revise os campos',
            variant: 'destructive',
          });
          return;
        }
      } else if (stepNum === 4) {
        const parsed = toneStepSchema.safeParse(partial);
        if (!parsed.success) {
          toast({
            title: 'Tom de voz inválido',
            description: parsed.error.issues[0]?.message ?? 'Revise os campos obrigatórios',
            variant: 'destructive',
          });
          return;
        }
      } else if (stepNum === 5) {
        const parsed = visualStepSchema.safeParse(partial);
        if (!parsed.success) {
          toast({ title: 'Paleta invalida', variant: 'destructive' });
          return;
        }
      }

      // Steps 1, 3, 4, 5 escrevem em company_briefings.
      // Steps 2 (offers) e 6 (prohibitions) escrevem nas tabelas filhas direto via seus proprios componentes.
      if ([1, 3, 4, 5].includes(stepNum)) {
        const result = await saveStep(stepNum, partial);
        if (!result.ok) {
          toast({
            title: 'Erro ao salvar',
            description: result.error.kind === 'validation'
              ? `Campos invalidos: ${result.error.fields.join(', ')}`
              : 'Tente novamente',
            variant: 'destructive',
          });
          return;
        }
      }

      if (next === 'done') {
        try {
          localStorage.removeItem('briefing:skipped-at');
        } catch {
          /* ignore */
        }
        toast({ title: 'Briefing salvo', description: 'Seu perfil de negocio foi atualizado.' });
        navigate('/');
      } else {
        goToStep(next);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    // R1.6: marca skip por usuario para que Index.tsx nao redirecione de volta.
    // Persistente entre reloads — banner permanece como CTA ate completar.
    try {
      localStorage.setItem('briefing:skipped-at', String(Date.now()));
    } catch { /* ignore — modo privado */ }
    toast({
      title: 'Briefing pendente',
      description: 'Você pode completar depois pelo menu. Algumas funções ficarao bloqueadas ate finalizar.',
    });
    navigate('/');
  };

  const isStepOne = step === 1;

  return (
    <div className="relative min-h-screen bg-background text-foreground py-8 pb-24">
      <div className="container max-w-3xl">
        <Card className="border-border bg-card text-card-foreground shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1 space-y-1">
                <CardTitle className="text-balance leading-snug">
                  {isStepOne
                    ? `Nos conte sobre o seu negócio - Passo 1 de ${WIZARD_TOTAL_STEPS}`
                    : `Passo ${step} de ${WIZARD_TOTAL_STEPS}: ${STEP_TITLES[step]}`}
                </CardTitle>
                <CardDescription>{STEP_HELPER[step]}</CardDescription>
              </div>
              <Button variant="ghost" className="shrink-0" onClick={handleSkip} disabled={busy}>
                Pular por enquanto
              </Button>
            </div>
            <Progress value={progress} className="mt-3 bg-secondary [&>div]:bg-primary" />
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <StepBusiness
                initial={briefing}
                disabled={busy || isReadOnly}
                onSubmit={(data) => handleSaveStep(1, data, 2)}
              />
            )}
            {step === 2 && (
              <StepOffers disabled={busy || isReadOnly} onContinue={() => goToStep(3)} onBack={() => goToStep(1)} />
            )}
            {step === 3 && (
              <StepAudience
                initial={briefing?.audience ?? {}}
                disabled={busy || isReadOnly}
                onSubmit={(audience) => handleSaveStep(3, { audience }, 4)}
                onBack={() => goToStep(2)}
              />
            )}
            {step === 4 && (
              <StepTone
                initial={briefing?.tone ?? {}}
                disabled={busy || isReadOnly}
                onSubmit={(tone) => handleSaveStep(4, { tone }, 5)}
                onBack={() => goToStep(3)}
              />
            )}
            {step === 5 && (
              <StepVisuals
                initial={briefing?.palette ?? {}}
                disabled={busy || isReadOnly}
                onSubmit={(palette) => handleSaveStep(5, { palette }, 6)}
                onBack={() => goToStep(4)}
              />
            )}
            {step === 6 && (
              <StepProhibitions
                niche={briefing?.niche ?? null}
                disabled={busy || isReadOnly}
                onComplete={() => goToStep(7)}
                onBack={() => goToStep(5)}
              />
            )}
            {step === 7 && (
              <StepMetaConnect
                disabled={busy || isReadOnly}
                onBack={() => goToStep(6)}
                onFinish={() => {
                  try {
                    localStorage.removeItem('briefing:skipped-at');
                  } catch {
                    /* ignore */
                  }
                  // Fire-and-forget: não aguarda, não bloqueia navegação (task 8.2)
                  if (company?.id) {
                    triggerArchetypeDetection(company.id).catch(() => { /* silent */ });
                  }
                  toast({
                    title: 'Tudo pronto',
                    description: 'Seu perfil de negocio foi salvo. Você ja pode usar o app.',
                  });
                  navigate('/');
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-6 right-6 z-50 md:bottom-8 md:right-10 pointer-events-none">
        <div className="pointer-events-auto rounded-full border border-border bg-card p-1 shadow-lg">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
