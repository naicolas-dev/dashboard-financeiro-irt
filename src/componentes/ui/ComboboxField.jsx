import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Combobox, Drawer, Portal, createListCollection } from '@chakra-ui/react';
import { ChevronUpDownIcon, ChevronRightIcon, CheckIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import IconButton from './IconButton.jsx';

// Mesmo breakpoint `md` (768px) já usado em ResponsiveDialog.jsx pra decidir
// sheet mobile vs. diálogo centrado desktop.
function useEhDesktop() {
  const [ehDesktop, setEhDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );

  useEffect(() => {
    const consulta = window.matchMedia('(min-width: 768px)');
    const aoMudar = (e) => setEhDesktop(e.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  }, []);

  return ehDesktop;
}

// Lista pesquisável — digitar filtra as opções (categoria tem muitas opções e
// se beneficia disso; listas pequenas como Tipo usam `SelectField`, não este).
// Filtro feito na mão (substring, case-insensitive) em vez de depender da API
// de coleção mutável do Chakra — mais simples de garantir correto, e o
// resultado visual/funcional é o mesmo. `opcoes`: [{ valor, texto }].
//
// Desktop (>=768px): Combobox do Chakra, popup ancorado no input, igual sempre foi.
// Mobile (<768px): vira um trigger + Drawer (bottom sheet) — popup flutuante +
// teclado virtual não é boa experiência em tela pequena. O Drawer não aninha o
// Combobox (ele é pensado pra popup ancorado, não pra conteúdo full-width de
// bottom sheet) — só um input de busca simples + lista de botões, reaproveitando
// a mesma lógica de filtro e o mesmo CheckIcon de seleção do desktop.
const ComboboxField = ({ label, value, onChange, opcoes, placeholder = 'Buscar...', id, className = '' }) => {
  const ehDesktop = useEhDesktop();
  const [inputValue, setInputValue] = useState(() => opcoes.find((o) => o.valor === value)?.texto ?? '');

  useEffect(() => {
    setInputValue(opcoes.find((o) => o.valor === value)?.texto ?? '');
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const itensFiltrados = useMemo(() => {
    const termo = inputValue.trim().toLowerCase();
    if (!termo) return opcoes;
    return opcoes.filter((o) => o.texto.toLowerCase().includes(termo));
  }, [opcoes, inputValue]);

  const collection = useMemo(
    () => createListCollection({ items: itensFiltrados, itemToString: (o) => o.texto, itemToValue: (o) => o.valor }),
    [itensFiltrados]
  );

  const [drawerAberto, setDrawerAberto] = useState(false);
  const [buscaDrawer, setBuscaDrawer] = useState('');
  const buscaDrawerRef = useRef(null);

  const itensFiltradosDrawer = useMemo(() => {
    const termo = buscaDrawer.trim().toLowerCase();
    if (!termo) return opcoes;
    return opcoes.filter((o) => o.texto.toLowerCase().includes(termo));
  }, [opcoes, buscaDrawer]);

  const textoSelecionado = opcoes.find((o) => o.valor === value)?.texto;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground-secondary block">
          {label}
        </label>
      )}

      {ehDesktop ? (
        <Combobox.Root
          collection={collection}
          value={value ? [value] : []}
          onValueChange={(details) => {
            const novoValor = details.value[0] ?? '';
            onChange(novoValor);
            setInputValue(opcoes.find((o) => o.valor === novoValor)?.texto ?? '');
          }}
          inputValue={inputValue}
          onInputValueChange={(details) => setInputValue(details.inputValue)}
          onOpenChange={(details) => {
            // Ao abrir, limpa o texto pra lista vir inteira (sem isso, o texto da seleção
            // atual já filtrava tudo de cara, sobrando só ela mesma na lista). Ao fechar
            // sem escolher nada novo, volta a mostrar o texto da seleção atual.
            if (details.open) {
              setInputValue('');
            } else {
              setInputValue(opcoes.find((o) => o.valor === value)?.texto ?? '');
            }
          }}
          openOnClick
        >
          <Combobox.Control className="relative">
            <Combobox.Input
              id={id}
              placeholder={placeholder}
              className={`focus-ring w-full h-11 px-3.5 pr-9 rounded-xl bg-surface-raised text-foreground placeholder:text-foreground-muted border border-border outline-none text-sm ${className}`}
            />
            <Combobox.IndicatorGroup className="absolute right-3 top-1/2 -translate-y-1/2">
              <Combobox.Trigger className="focus-ring cursor-pointer text-foreground-muted">
                <ChevronUpDownIcon className="h-4 w-4" />
              </Combobox.Trigger>
            </Combobox.IndicatorGroup>
          </Combobox.Control>
          <Portal>
            <Combobox.Positioner>
              <Combobox.Content className="bg-surface-raised border border-border rounded-xl shadow-lg p-1 text-sm z-50 max-h-64 overflow-y-auto">
                <Combobox.Empty className="px-3 py-2 text-foreground-muted">Nenhum resultado</Combobox.Empty>
                {collection.items.map((item) => (
                  <Combobox.Item
                    key={item.valor}
                    item={item}
                    className="focus-ring cursor-pointer flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-foreground data-[highlighted]:bg-surface-hover data-[state=checked]:bg-surface-active"
                  >
                    <Combobox.ItemText>{item.texto}</Combobox.ItemText>
                    <Combobox.ItemIndicator>
                      <CheckIcon className="h-4 w-4" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                ))}
              </Combobox.Content>
            </Combobox.Positioner>
          </Portal>
        </Combobox.Root>
      ) : (
        <>
          <button
            type="button"
            id={id}
            onClick={() => {
              setBuscaDrawer('');
              setDrawerAberto(true);
            }}
            className={`focus-ring cursor-pointer w-full flex items-center justify-between gap-2 h-11 px-3.5 rounded-xl bg-surface-raised text-sm border border-border ${className}`}
          >
            <span className={`truncate ${textoSelecionado ? 'text-foreground' : 'text-foreground-muted'}`}>
              {textoSelecionado ?? placeholder}
            </span>
            <ChevronRightIcon className="h-4 w-4 text-foreground-muted shrink-0" />
          </button>

          <Drawer.Root
            open={drawerAberto}
            onOpenChange={(details) => setDrawerAberto(details.open)}
            placement="bottom"
            initialFocusEl={() => buscaDrawerRef.current}
          >
            <Portal>
              <Drawer.Backdrop style={{ backgroundColor: 'var(--color-overlay)' }} />
              <Drawer.Positioner>
                <Drawer.Content className="bg-surface-raised rounded-t-3xl pb-safe max-h-[85dvh] flex flex-col">
                  <Drawer.Header className="flex items-center justify-between gap-2 px-5 pt-5 pb-2">
                    <Drawer.Title className="text-lg font-semibold text-foreground">{label || placeholder}</Drawer.Title>
                    <Drawer.CloseTrigger asChild>
                      <IconButton aria-label="Fechar">
                        <XMarkIcon className="h-5 w-5" />
                      </IconButton>
                    </Drawer.CloseTrigger>
                  </Drawer.Header>
                  <Drawer.Body className="px-5 pb-6 pt-2 overflow-y-auto flex-1">
                    <div className="relative mb-2">
                      <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted pointer-events-none" />
                      <input
                        ref={buscaDrawerRef}
                        value={buscaDrawer}
                        onChange={(e) => setBuscaDrawer(e.target.value)}
                        placeholder={placeholder}
                        className="focus-ring w-full h-11 pl-10 pr-3.5 rounded-xl bg-surface text-foreground placeholder:text-foreground-muted border border-border outline-none text-sm"
                      />
                    </div>
                    {itensFiltradosDrawer.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-foreground-muted">Nenhum resultado</p>
                    ) : (
                      <div className="space-y-1">
                        {itensFiltradosDrawer.map((item) => (
                          <button
                            key={item.valor}
                            type="button"
                            onClick={() => {
                              onChange(item.valor);
                              setDrawerAberto(false);
                            }}
                            className={`focus-ring cursor-pointer w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm text-left text-foreground ${
                              item.valor === value ? 'bg-surface-active' : 'hover:bg-surface-hover'
                            }`}
                          >
                            <span>{item.texto}</span>
                            {item.valor === value && <CheckIcon className="h-4 w-4 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </Drawer.Body>
                </Drawer.Content>
              </Drawer.Positioner>
            </Portal>
          </Drawer.Root>
        </>
      )}
    </div>
  );
};

export default ComboboxField;
