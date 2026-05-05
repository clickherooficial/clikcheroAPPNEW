import { createContext, useCallback, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type {
  AuthState,
  Organization,
  Company,
  Profile,
  UserRole,
  SignUpData,
  SignInData,
} from '@/types/auth';

export type SignUpResult = { error: string | null; slugSuggestions?: string[] };

interface AuthContextValue extends AuthState {
  signIn: (data: SignInData) => Promise<{ error: string | null }>;
  signUp: (data: SignUpData) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<{ error: string | null }>;
  refreshAuth: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  // Fallback if slug is empty or too short
  if (slug.length < 3) {
    return `org-${Date.now().toString(36)}`;
  }
  return slug;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch user's profile, orgs, and current org data
  const loadUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile (colunas explicitas — evita vazar novas colunas sensiveis)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, current_organization_id, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        console.error('Failed to load profile:', profileError);
        setProfile(null);
        setOrganization(null);
        setCompany(null);
        setRole(null);
        setOrganizations([]);
        return;
      }

      setProfile(profileData as Profile);

      // Fetch all organizations the user belongs to
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userId);

      if (!memberships || memberships.length === 0) {
        setOrganization(null);
        setCompany(null);
        setRole(null);
        setOrganizations([]);
        return;
      }

      const orgIds = memberships.map((m) => m.organization_id);

      const { data: orgsData } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds);

      const orgs = (orgsData ?? []) as Organization[];
      setOrganizations(orgs);

      // Set current org and role
      const currentOrgId = profileData.current_organization_id;
      if (currentOrgId) {
        const currentOrg = orgs.find((o) => o.id === currentOrgId);
        const currentMembership = memberships.find(
          (m) => m.organization_id === currentOrgId
        );

        setOrganization(currentOrg ?? null);
        setRole((currentMembership?.role as UserRole) ?? null);

        // Load company linked to this organization (bridge)
        if (currentOrg) {
          const { data: companyData } = await (supabase
            .from('companies')
            .select('*') as any)
            .eq('organization_id', currentOrgId)
            .maybeSingle();
          setCompany((companyData as Company) ?? null);
        } else {
          setCompany(null);
        }
      } else if (orgs.length > 0) {
        // Auto-select first org if no current org set
        const firstOrg = orgs[0];
        const firstMembership = memberships.find(
          (m) => m.organization_id === firstOrg.id
        );

        setOrganization(firstOrg);
        setRole((firstMembership?.role as UserRole) ?? null);

        // Load company linked to this organization (bridge)
        const { data: companyData } = await (supabase
          .from('companies')
          .select('*') as any)
          .eq('organization_id', firstOrg.id)
          .maybeSingle();
        setCompany((companyData as Company) ?? null);

        // Persist the auto-selection
        await supabase
          .from('profiles')
          .update({ current_organization_id: firstOrg.id })
          .eq('id', userId);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setProfile(null);
      setOrganization(null);
      setCompany(null);
      setRole(null);
      setOrganizations([]);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    if (user) {
      await loadUserData(user.id);
    }
  }, [user, loadUserData]);

  // Listen to auth state changes — runs once on mount
  // Uses initialLoadDone ref to prevent double loadUserData (getSession + onAuthStateChange race)
  useEffect(() => {
    let isMounted = true;
    let initialLoadDone = false;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        initialLoadDone = true;
        loadUserData(initialSession.user.id).finally(() => {
          if (isMounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;

      // Skip INITIAL_SESSION event if getSession already handled it
      if (_event === 'INITIAL_SESSION' && initialLoadDone) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        loadUserData(newSession.user.id).finally(() => {
          if (isMounted) setIsLoading(false);
        });
      } else {
        setProfile(null);
        setOrganization(null);
        setCompany(null);
        setRole(null);
        setOrganizations([]);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (data: SignInData) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signUp = useCallback(async (data: SignUpData) => {
    // 1. Create user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { display_name: data.displayName },
      },
    });

    if (authError) {
      console.error('[signUp] auth.signUp failed:', authError);
      // Traduz mensagens comuns do Supabase pra portugues
      const msg = authError.message || '';
      if (/already registered|User already/i.test(msg)) {
        return { error: 'Este email ja esta cadastrado. Faca login ou use outro email.' };
      }
      if (/password.*(short|weak|length)/i.test(msg)) {
        return { error: 'Senha muito fraca. Use ao menos 8 caracteres com letras, numeros e simbolos.' };
      }
      return { error: msg || 'Falha ao criar conta' };
    }
    if (!authData.user) return { error: 'Falha ao criar conta' };

    // 1.1. Anti-enumeration detection: Supabase retorna 200 com user.identities=[]
    // quando o email ja esta em uso (modo padrao anti-enumeracao). Tratar como erro.
    if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
      return { error: 'Este email ja esta cadastrado. Faca login ou use outro email.' };
    }

    // 1.5. Garantir session. Se signUp nao devolveu (confirmacao de email ON),
    // fazer signInWithPassword pra obter token.
    let accessToken = authData.session?.access_token ?? null;
    if (!accessToken) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (signInError || !signInData.session) {
        console.warn('[signUp] signIn pos-signup falhou:', signInError);
        return {
          error:
            'Conta criada! Verifique seu email para confirmar o cadastro e depois faca login para completar a configuração da organização.',
        };
      }
      accessToken = signInData.session.access_token;
    }

    // 2. Create organization via Edge Function (atomic)
    // Usa fetch direto (nao supabase.functions.invoke) para garantir que o
    // Authorization header com o JWT do user seja enviado literalmente —
    // supabase-js sobrescreve headers em alguns casos.
    const slug = data.slug?.trim() || slugify(data.organizationName);
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey =
      (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
      (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
    const edgeUrl = `${supabaseUrl}/functions/v1/create-organization`;

    try {
      const res = await fetch(edgeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: data.organizationName.trim(), slug }),
      });

      let bodyJson: {
        error?: string;
        suggested_slugs?: string[];
      } = {};
      try {
        bodyJson = await res.json();
      } catch {
        /* response might be empty */
      }

      if (!res.ok) {
        console.error('[signUp] create-organization failed:', { status: res.status, body: bodyJson });
        if (res.status === 409 && Array.isArray(bodyJson.suggested_slugs)) {
          return {
            error:
              bodyJson.error?.trim() ||
              'Este endereço de URL já está em uso. Escolha uma das sugestões ou altere manualmente.',
            slugSuggestions: bodyJson.suggested_slugs.filter((s) => typeof s === 'string' && s.length > 0),
          };
        }
        const detail = bodyJson.error || `HTTP ${res.status}`;
        return { error: `Falha ao criar organização: ${detail}` };
      }
    } catch (fetchError) {
      console.error('[signUp] create-organization fetch threw:', fetchError);
      return { error: 'Erro de rede ao criar organização. Tente novamente.' };
    }

    // 3. Post-creation updates (non-blocking — if these fail we still consider signup OK)
    try {
      if (data.plan && data.plan !== 'free') {
        const { error: planError } = await supabase
          .from('organizations')
          .update({ plan: data.plan })
          .eq('slug', slug);
        if (planError) console.warn('Failed to set plan:', planError);
      }

      if (data.avatarSeed) {
        const { error: avatarError } = await supabase
          .from('profiles')
          .update({ avatar_url: `gradient:${data.avatarSeed}` })
          .eq('id', authData.user.id);
        if (avatarError) console.warn('Failed to set avatar:', avatarError);
      }
    } catch (postError) {
      console.warn('Non-blocking post-signup update failed:', postError);
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
      toast({
        title: 'Erro ao sair',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const switchOrganization = useCallback(
    async (orgId: string): Promise<{ error: string | null }> => {
      if (!user) return { error: 'Não autenticado' };

      // Validate that user is a member of this org
      if (!organizations.some((o) => o.id === orgId)) {
        return { error: 'Organização não encontrada' };
      }

      const { error } = await supabase
        .from('profiles')
        .update({ current_organization_id: orgId })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to switch organization:', error);
        toast({
          title: 'Erro ao trocar organização',
          description: 'Tente novamente.',
          variant: 'destructive',
        });
        return { error: error.message };
      }

      await loadUserData(user.id);
      return { error: null };
    },
    [user, organizations, loadUserData, toast]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        organization,
        company,
        role,
        organizations,
        isLoading,
        signIn,
        signUp,
        signOut,
        switchOrganization,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
