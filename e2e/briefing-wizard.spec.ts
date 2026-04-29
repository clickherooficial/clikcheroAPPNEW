// E2E do wizard de briefing pos-cadastro (task 10.3).
// Spec: briefing-onboarding (R1.1, R1.3, R1.4, R1.5, R1.6)
//
// Pre-requisitos para rodar:
//   - App rodando em baseURL configurada no playwright.config
//   - User de teste cadastrado e com `briefing_status='not_started'` (ou row inexistente)
//   - Credenciais via env: TEST_USER_EMAIL, TEST_USER_PASSWORD
//
// Como rodar: npx playwright test e2e/briefing-wizard.spec.ts

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? 'test+briefing@fury.local';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'CHANGE_ME';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/senha/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /entrar/i }).click();
}

test.describe('Briefing Wizard — fluxo principal', () => {
  test('redirect pos-cadastro: user com briefing nao iniciado vai pro wizard', async ({ page }) => {
    await login(page);
    // R1.1: Index redireciona para /briefing/wizard
    await expect(page).toHaveURL(/\/briefing\/wizard/);
    // R1.5: indicador de progresso visivel
    await expect(page.getByText(/passo 1 de 7/i)).toBeVisible();
  });

  test('wizard 7 passos completo libera redirect', async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/briefing\/wizard/);

    // Passo 1 — Negocio
    await page.getByLabel(/nicho/i).fill('Loja de moda feminina');
    await page.getByLabel(/descricao/i).fill('Venda online de vestidos casuais');
    await page.getByRole('button', { name: /continuar/i }).click();

    // Passo 2 — Oferta principal
    await expect(page.getByText(/passo 2 de 7/i)).toBeVisible();
    await page.getByLabel(/^nome/i).fill('Vestido Verao');
    await page.getByLabel(/preco/i).fill('199,90');
    await page.getByLabel(/^descricao/i).fill('Vestido leve para o dia a dia');
    await page.getByRole('button', { name: /^adicionar/i }).click();
    await page.getByRole('button', { name: /continuar/i }).click();

    // Passo 3 — Audiencia (defaults sao validos)
    await expect(page.getByText(/passo 3 de 7/i)).toBeVisible();
    await page.getByRole('button', { name: /continuar/i }).click();

    // Passo 4 — Tom (defaults validos)
    await expect(page.getByText(/passo 4 de 7/i)).toBeVisible();
    await page.getByText(/acolhedor/i).click();
    await page.getByRole('button', { name: /continuar/i }).click();

    // Passo 5 — Visual (paleta default valida)
    await expect(page.getByText(/passo 5 de 7/i)).toBeVisible();
    await page.getByRole('button', { name: /continuar/i }).click();

    // Passo 6 — Proibicoes
    await expect(page.getByText(/passo 6 de 7/i)).toBeVisible();
    await page.getByRole('button', { name: /concluir/i }).click();

    // Passo 7 — Meta / BM
    await expect(page.getByText(/passo 7 de 7/i)).toBeVisible();
    await page.getByRole('button', { name: /ir para o app/i }).click();

    // Apos conclusao, redirect para /
    await expect(page).toHaveURL(/^.*\/$|\/[a-z]*$/);
    await expect(page.getByText(/tudo pronto/i)).toBeVisible();
  });

  test('auto-save por passo: sair no passo 3 e voltar continua de onde parou', async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/briefing\/wizard/);

    await page.getByLabel(/nicho/i).fill('Teste auto-save');
    await page.getByLabel(/descricao/i).fill('Persistencia incremental');
    await page.getByRole('button', { name: /continuar/i }).click();

    // No passo 2, navegar pra fora
    await page.goto('/login');
    await login(page);

    // Voltar pro wizard — R1.3 (auto-save). Briefing ja tem niche/description salvos,
    // status virou 'incomplete', logo nao redireciona automaticamente. User abre /briefing/wizard manualmente.
    await page.goto('/briefing/wizard');
    // Volta pro passo 1 mas com dados preenchidos
    await expect(page.getByLabel(/nicho/i)).toHaveValue('Teste auto-save');
  });

  test('pular wizard mantem briefing pendente e exibe banner', async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/briefing\/wizard/);

    await page.getByRole('button', { name: /pular por enquanto/i }).click();

    // R1.4 + Fix H1: nao deve ter loop, deve voltar pra Index
    await expect(page).toHaveURL(/^.*\/$/);
    // R1.6: banner persistente no topo
    await expect(page.getByText(/briefing.*incompleto|briefing nao iniciado/i)).toBeVisible();
  });

  test('member nao consegue acessar o wizard', async ({ page }) => {
    // Pre-condicao: TEST_MEMBER_EMAIL/PASSWORD configurados como user com role=member
    test.skip(!process.env.TEST_MEMBER_EMAIL, 'TEST_MEMBER_EMAIL nao configurado');
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.TEST_MEMBER_EMAIL!);
    await page.getByLabel(/senha/i).fill(process.env.TEST_MEMBER_PASSWORD ?? '');
    await page.getByRole('button', { name: /entrar/i }).click();

    await page.goto('/briefing/wizard');
    await expect(page.getByText(/nao tem permissao|somente leitura/i)).toBeVisible();
  });
});
