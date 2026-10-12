// Script de verificação visual/funcional via Playwright headless — não é parte do
// app, só uma ferramenta local pro agente conferir o que está sendo construído sem
// depender de alguém testar manualmente toda vez.
//
// Uso: node --env-file=.env scripts/verificar-ui.mjs [cena]
// Cenas disponíveis: login, home, keypad, dialog-desktop, todas (padrão)
//
// Salva screenshots em scripts/.capturas/ (git-ignorado) e imprime um resumo de
// checagens de CSS computado (ex.: focus-ring só aparece em :focus-visible).

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PASTA_CAPTURAS = path.join(__dirname, '.capturas');
mkdirSync(PASTA_CAPTURAS, { recursive: true });

const BASE_URL = 'http://localhost:5173';
const SENHA_TESTE = process.env.SENHA_TESTE_PLAYWRIGHT;

const VIEWPORTS = {
  mobile360: { width: 360, height: 800 },
  mobile390: { width: 390, height: 844 },
  mobile430: { width: 430, height: 932 },
  desktop: { width: 1280, height: 800 },
};

function relatar(titulo) {
  console.log(`\n=== ${titulo} ===`);
}

async function capturar(page, nome) {
  const caminho = path.join(PASTA_CAPTURAS, `${nome}.png`);
  await page.screenshot({ path: caminho, fullPage: false });
  console.log(`  📸 ${caminho}`);
}

async function definirTema(page, escuro) {
  await page.evaluate((valor) => {
    document.documentElement.classList.toggle('dark', valor);
    localStorage.setItem('temaEscuro', JSON.stringify(valor));
  }, escuro);
}

async function login(page) {
  if (!SENHA_TESTE) {
    throw new Error('SENHA_TESTE_PLAYWRIGHT não está no ambiente — rode com: node --env-file=.env scripts/verificar-ui.mjs');
  }
  await page.goto(BASE_URL);
  await page.locator('#senha').fill(SENHA_TESTE);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForSelector('text=Saldo atual', { timeout: 10000 });
  // Espera o layout estabilizar antes de qualquer interação — o .click() do Playwright
  // faz "scroll into view" a cada retry, e isso pode brigar com o colapso do Hero
  // (sensível a scroll) se disparado durante o assentamento inicial da página.
  await page.waitForTimeout(800);
}

async function checarFocusRing(page) {
  relatar('Checagem: focus-ring só em :focus-visible');
  const botao = page.getByRole('button', { name: /receita/i }).first();
  const outlineRepouso = await botao.evaluate((el) => getComputedStyle(el).outlineColor);

  // .focus() programático nem sempre ativa :focus-visible no Chromium — precisa
  // de navegação real por teclado pra isso disparar de verdade.
  await botao.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');

  const outlineFocado = await botao.evaluate((el) => getComputedStyle(el).outlineColor);
  console.log(`  repouso: ${outlineRepouso}`);
  console.log(`  focado (via Tab): ${outlineFocado}`);
  console.log(outlineRepouso !== outlineFocado ? '  ✅ muda só no foco' : '  ⚠️  não mudou — revisar');
}

async function cenaLogin(browser) {
  relatar('Cena: Login');
  const page = await (await browser.newContext({ viewport: VIEWPORTS.mobile390 })).newPage();
  await page.goto(BASE_URL);
  await page.waitForSelector('text=Bem-vindo');
  await capturar(page, '01-login-light');
  await definirTema(page, true);
  await page.reload();
  await page.waitForSelector('text=Bem-vindo');
  await capturar(page, '02-login-dark');
  await page.close();
}

async function cenaHome(browser) {
  relatar('Cena: Home (logada)');
  for (const [nomeViewport, viewport] of Object.entries(VIEWPORTS)) {
    const page = await (await browser.newContext({ viewport })).newPage();
    await login(page);
    await capturar(page, `home-${nomeViewport}-light`);

    if (nomeViewport === 'mobile390') {
      await checarFocusRing(page);
    }

    await definirTema(page, true);
    await page.reload();
    await page.waitForSelector('text=Saldo atual');
    await page.waitForTimeout(400);
    await capturar(page, `home-${nomeViewport}-dark`);

    // Testa o colapso do Hero/aparecimento do FAB ao rolar
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(400);
    await capturar(page, `home-${nomeViewport}-dark-scrolled`);

    await page.close();
  }
}

async function cenaKeypad(browser) {
  relatar('Cena: AmountKeypad + detalhes (fluxo FAB)');
  const page = await (await browser.newContext({ viewport: VIEWPORTS.mobile390 })).newPage();
  await login(page);

  // Usa a QuickAction "Despesa" (sempre visível no Hero) em vez do FAB — o FAB só
  // fica clicável quando o Hero está recolhido, o que exige rolagem suficiente
  // (não dá pra garantir com pouco conteúdo de teste). QuickAction já pula a
  // etapa "tipo" direto pro keypad, que é o que queremos testar aqui mesmo.
  await page.getByRole('button', { name: 'Despesa' }).first().click();
  await page.waitForSelector('text=R$ 0,00');
  await capturar(page, '04-fluxo-keypad-vazio');

  for (const digito of ['1', '8', '9', '0', '0']) {
    await page.getByRole('button', { name: new RegExp(`^(dígito ${digito}|dois zeros)$`, 'i') }).first().click();
  }
  await capturar(page, '05-fluxo-keypad-preenchido');

  await page.getByRole('button', { name: /continuar/i }).click();
  await page.waitForSelector('text=Detalhes');
  await capturar(page, '06-fluxo-detalhes-vazio');

  await page.close();
}

async function cenaDialogDesktop(browser) {
  relatar('Cena: ResponsiveDialog em desktop (deve virar dialog centralizado)');
  const page = await (await browser.newContext({ viewport: VIEWPORTS.desktop })).newPage();
  await login(page);
  await page.getByRole('button', { name: 'Despesa' }).first().click();
  await page.waitForSelector('text=R$ 0,00');
  await capturar(page, '07-dialog-desktop');
  await page.close();
}

async function cenaColapso(browser) {
  relatar('Cena: colapso do Hero + FAB (viewport baixo, pra garantir espaço de rolagem)');
  const page = await (await browser.newContext({ viewport: { width: 390, height: 500 } })).newPage();
  await login(page);

  const grid = page.locator('section > div').last();
  const fab = page.locator('button[aria-label="Novo lançamento"]');

  console.log('  antes de rolar — altura do grid de ações:', await grid.evaluate((el) => getComputedStyle(el).height));
  console.log('  antes de rolar — FAB pointer-events:', await fab.evaluate((el) => getComputedStyle(el).pointerEvents));

  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(400);

  const alturaDepois = await grid.evaluate((el) => getComputedStyle(el).height);
  const pointerDepois = await fab.evaluate((el) => getComputedStyle(el).pointerEvents);
  console.log('  depois de rolar — altura do grid de ações:', alturaDepois);
  console.log('  depois de rolar — FAB pointer-events:', pointerDepois);
  console.log(alturaDepois === '0px' && pointerDepois === 'auto' ? '  ✅ colapsou e FAB ficou clicável' : '  ⚠️  não colapsou como esperado');

  await capturar(page, '08-colapso-rolado');
  if (pointerDepois === 'auto') {
    await fab.click();
    await page.waitForSelector('text=O que você quer registrar?');
    await capturar(page, '09-fab-abriu-escolha-tipo');
  }

  await page.close();
}

async function main() {
  const cena = process.argv[2] ?? 'todas';
  const browser = await chromium.launch();

  try {
    if (cena === 'login' || cena === 'todas') await cenaLogin(browser);
    if (cena === 'home' || cena === 'todas') await cenaHome(browser);
    if (cena === 'keypad' || cena === 'todas') await cenaKeypad(browser);
    if (cena === 'dialog-desktop' || cena === 'todas') await cenaDialogDesktop(browser);
    if (cena === 'colapso' || cena === 'todas') await cenaColapso(browser);
  } finally {
    await browser.close();
  }

  console.log(`\nCapturas salvas em: ${PASTA_CAPTURAS}`);
}

main().catch((erro) => {
  console.error('Falhou:', erro);
  process.exit(1);
});
