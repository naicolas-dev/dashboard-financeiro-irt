import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { SunIcon, MoonIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import Button from '../componentes/ui/Button';
import IconButton from '../componentes/ui/IconButton';
import Input from '../componentes/ui/Input';
import Skeleton from '../componentes/ui/Skeleton';
import EmptyState from '../componentes/ui/EmptyState';
import ResponsiveDialog from '../componentes/ui/ResponsiveDialog';
import FinancialHero from '../componentes/FinancialHero';
import TransactionRow from '../componentes/TransactionRow';
import AmountKeypad from '../componentes/AmountKeypad';
import GoalCard from '../componentes/GoalCard';
import CreditCardTile from '../componentes/CreditCardTile';
import BottomNavigation from '../componentes/BottomNavigation';
import FloatingActionButton from '../componentes/FloatingActionButton';

// Dados fictícios só para visualizar os componentes — nada aqui toca o Firestore real.
const TRANSACOES_DEMO = [
  { id: '1', descricao: 'Mercado', categoria: 'Alimentação', dataFormatada: 'Hoje, 18:42', valor: 189.9, tipo: 'despesa' },
  { id: '2', descricao: 'Uber', categoria: 'Transporte', dataFormatada: 'Hoje, 09:15', valor: 22.8, tipo: 'despesa' },
  { id: '3', descricao: 'Salário', categoria: 'Salário', dataFormatada: 'Ontem', valor: 4800, tipo: 'receita' },
  { id: '4', descricao: 'Academia', categoria: 'Saúde', dataFormatada: '8 de outubro', valor: 119.9, tipo: 'despesa' },
];

const META_DEMO = { nome: 'Viagem', valorAtual: 3420, valorAlvo: 10000 };

const CARTOES_DEMO = [
  {
    tema: 'nubank',
    banco: 'Nubank',
    bandeira: 'Mastercard',
    faturaAtual: 1842.9,
    limiteDisponivel: 3157.1,
    limiteTotal: 5000,
    fechamento: 18,
    vencimento: 25,
  },
  {
    tema: 'inter',
    banco: 'Inter',
    bandeira: 'Visa',
    faturaAtual: 612.4,
    limiteDisponivel: 1887.6,
    limiteTotal: 2500,
    fechamento: 5,
    vencimento: 12,
  },
];

// Classes literais (não construídas via template string) — o scanner do Tailwind
// só emite um token de @theme se encontrar o nome da utility escrito por extenso
// em algum arquivo. "warning" não tinha nenhum outro uso real no projeto, então
// o valor do light mode estava sendo removido do CSS final (achado da revisão visual).
const PALETA = [
  { token: 'background', nome: 'Background', classe: 'bg-background' },
  { token: 'surface', nome: 'Surface', classe: 'bg-surface' },
  { token: 'surface-raised', nome: 'Surface Raised', classe: 'bg-surface-raised' },
  { token: 'surface-hover', nome: 'Surface Hover', classe: 'bg-surface-hover' },
  { token: 'foreground', nome: 'Foreground', classe: 'bg-foreground' },
  { token: 'foreground-secondary', nome: 'Foreground Secondary', classe: 'bg-foreground-secondary' },
  { token: 'foreground-muted', nome: 'Foreground Muted', classe: 'bg-foreground-muted' },
  { token: 'border', nome: 'Border', classe: 'bg-border' },
  { token: 'primary', nome: 'Primary', classe: 'bg-primary' },
  { token: 'positive', nome: 'Positive', classe: 'bg-positive' },
  { token: 'negative', nome: 'Negative', classe: 'bg-negative' },
  { token: 'warning', nome: 'Warning', classe: 'bg-warning' },
];

const ABAS = [
  { id: 'paleta', label: 'Paleta' },
  { id: 'tipografia', label: 'Tipografia' },
  { id: 'base', label: 'Botões & Inputs' },
  { id: 'hero', label: 'Financial Hero' },
  { id: 'keypad', label: 'Amount Keypad' },
  { id: 'sheet', label: 'Sheets & Dialogs' },
  { id: 'transacoes', label: 'Transações' },
  { id: 'metas', label: 'Metas & Cartões' },
  { id: 'nav', label: 'Navegação' },
];

function PainelAba({ titulo, children }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
      {children}
    </section>
  );
}

function DesignLab() {
  const [escuro, setEscuro] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('paleta');
  const [valorCentavos, setValorCentavos] = useState('0');
  const [sheetAberto, setSheetAberto] = useState(false);
  const [navAtiva, setNavAtiva] = useState('inicio');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', escuro);
  }, [escuro]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Toaster richColors position="top-center" />

      <header className="sticky top-0 z-30 bg-surface-raised border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold">Design Lab</p>
            <p className="text-xs text-foreground-muted">Sandbox isolado — não lê/escreve dados reais</p>
          </div>
          <IconButton aria-label={escuro ? 'Mudar para claro' : 'Mudar para escuro'} onClick={() => setEscuro((v) => !v)}>
            {escuro ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </IconButton>
        </div>
        <nav className="max-w-5xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {ABAS.map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`focus-ring cursor-pointer whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                abaAtiva === aba.id ? 'bg-primary text-primary-foreground' : 'text-foreground-secondary hover:bg-surface-hover'
              }`}
            >
              {aba.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10 pb-24">
        {abaAtiva === 'paleta' && (
          <PainelAba titulo="Paleta">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {PALETA.map(({ token, nome, classe }) => (
                <div key={token} className="rounded-xl border border-border overflow-hidden">
                  <div className={`h-16 ${classe}`} />
                  <div className="p-2">
                    <p className="text-xs font-medium">{nome}</p>
                    <p className="text-[11px] text-foreground-muted">--color-{token}</p>
                  </div>
                </div>
              ))}
            </div>
          </PainelAba>
        )}

        {abaAtiva === 'tipografia' && (
          <PainelAba titulo="Tipografia">
            <div className="space-y-3">
              <p className="text-[42px] font-semibold tracking-tight tabular-nums">R$ 8.420,45</p>
              <p className="text-2xl font-semibold">Título de tela (22–26px)</p>
              <p className="text-lg font-semibold">Section title (16–18px)</p>
              <p className="text-base">Body (14–16px) — texto padrão de parágrafos e descrições.</p>
              <p className="text-sm text-foreground-secondary">Label (12–13px) uppercase opcional</p>
            </div>
          </PainelAba>
        )}

        {abaAtiva === 'base' && (
          <PainelAba titulo="Botões & Inputs">
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="flex flex-wrap gap-3">
              <IconButton aria-label="Editar"><PencilIcon className="h-5 w-5" /></IconButton>
              <IconButton aria-label="Excluir" variant="danger"><TrashIcon className="h-5 w-5" /></IconButton>
              <IconButton aria-label="Primário" variant="primary"><PencilIcon className="h-5 w-5" /></IconButton>
            </div>
            <div className="max-w-sm space-y-3">
              <Input label="Descrição" placeholder="Ex: Mercado" />
              <Input label="Com erro" placeholder="R$ 0,00" erro="Preencha um valor válido." />
            </div>
            <div className="max-w-sm space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <EmptyState
              icone={TrashIcon}
              titulo="Nenhuma despesa ainda"
              descricao="Adicione sua primeira despesa para acompanhar a distribuição por categoria."
              textoAcao="Adicionar despesa"
              onAcao={() => toast.success('Ação de exemplo')}
            />
          </PainelAba>
        )}

        {abaAtiva === 'hero' && (
          <PainelAba titulo="Financial Hero">
            <div className="max-w-md">
              <FinancialHero
                saldo={8420.45}
                receitas={6250}
                despesas={4930}
                variacaoMes={1320}
                onReceita={() => toast('Receita')}
                onDespesa={() => toast('Despesa')}
                onGuardar={() => toast('Guardar')}
                onCartoes={() => toast('Cartões')}
              />
            </div>
          </PainelAba>
        )}

        {abaAtiva === 'keypad' && (
          <PainelAba titulo="Amount Keypad">
            <div className="max-w-sm rounded-2xl border border-border bg-surface-raised p-4">
              <AmountKeypad
                valorCentavos={valorCentavos}
                onChange={setValorCentavos}
                titulo="Despesa"
                onCancelar={() => setValorCentavos('0')}
                onContinuar={() => toast.success(`Valor confirmado: ${(Number(valorCentavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)}
              />
            </div>
          </PainelAba>
        )}

        {abaAtiva === 'sheet' && (
          <PainelAba titulo="Sheets & Dialogs">
            <p className="text-sm text-foreground-secondary">
              Redimensione a janela: abaixo de 768px vira bottom sheet, acima vira dialog centralizado — mesmo componente.
            </p>
            <Button onClick={() => setSheetAberto(true)}>Abrir ResponsiveDialog</Button>
            <ResponsiveDialog aberto={sheetAberto} aoFechar={() => setSheetAberto(false)} titulo="Exemplo de conteúdo">
              <p className="text-sm text-foreground-secondary mb-4">
                Esc fecha, clique fora fecha, foco visível ao navegar com Tab.
              </p>
              <Button className="w-full" onClick={() => setSheetAberto(false)}>
                Fechar
              </Button>
            </ResponsiveDialog>
          </PainelAba>
        )}

        {abaAtiva === 'transacoes' && (
          <PainelAba titulo="Transações">
            <div className="max-w-md rounded-2xl border border-border bg-surface-raised p-2 divide-y divide-border">
              {TRANSACOES_DEMO.map((t) => (
                <TransactionRow key={t.id} {...t} onClick={() => toast(`Abrir: ${t.descricao}`)} />
              ))}
            </div>
          </PainelAba>
        )}

        {abaAtiva === 'metas' && (
          <PainelAba titulo="Metas & Cartões">
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
              <GoalCard {...META_DEMO} onGuardar={() => toast('Guardar na meta')} />
              {CARTOES_DEMO.map((cartao) => (
                <CreditCardTile key={cartao.banco} {...cartao} />
              ))}
            </div>
          </PainelAba>
        )}

        {abaAtiva === 'nav' && (
          <PainelAba titulo="Bottom Navigation & FAB">
            <p className="text-sm text-foreground-secondary">Visível só em telas estreitas que esta própria área de conteúdo (redimensione a janela).</p>
            <div className="relative h-40 rounded-2xl border border-border overflow-hidden">
              <BottomNavigation ativo={navAtiva} aoNavegar={setNavAtiva} />
            </div>
          </PainelAba>
        )}
      </main>

      <FloatingActionButton onClick={() => toast('Novo lançamento')} />
    </div>
  );
}

export default DesignLab;
