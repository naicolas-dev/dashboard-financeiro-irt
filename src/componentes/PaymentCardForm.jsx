import React, { useState } from 'react';
import { toast } from 'sonner';
import Input from './ui/Input';
import Button from './ui/Button';
import { criarCartao, atualizarCartao } from '../servicos/cartoes.js';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Cadastro rápido de cartão — tema/bandeira ficam com default, formulário grande fica
// fora de escopo. Reaproveitado também pra edição (`cartaoParaEditar`): mesmos campos,
// `onCriado` só dispara na criação (TransactionFlow depende disso pra selecionar o
// cartão recém-criado e continuar a despesa), `onEditado`/`onExcluido` só na edição.
const PaymentCardForm = ({
  cartaoParaEditar,
  comprometido = 0,
  onVoltar,
  onCartaoSalvo,
  onCriado,
  onEditado,
  excluirCartao,
  onExcluido,
}) => {
  const modoEdicao = !!cartaoParaEditar;

  const [nome, setNome] = useState(modoEdicao ? cartaoParaEditar.nome : '');
  const [limiteCentavos, setLimiteCentavos] = useState(
    modoEdicao ? String(Math.round(cartaoParaEditar.limiteTotal * 100)) : '0'
  );
  const [diaFechamento, setDiaFechamento] = useState(modoEdicao ? String(cartaoParaEditar.diaFechamento) : '');
  const [diaVencimento, setDiaVencimento] = useState(modoEdicao ? String(cartaoParaEditar.diaVencimento) : '');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const handleLimiteChange = (e) => {
    const digitos = e.target.value.replace(/\D/g, '');
    setLimiteCentavos(digitos || '0');
  };

  const diaValido = (valor) => {
    const numero = Number(valor);
    return numero >= 1 && numero <= 31;
  };

  const limiteNumerico = Number(limiteCentavos) / 100;
  const limiteInsuficiente = modoEdicao && limiteNumerico < comprometido;

  const podeSalvar =
    nome.trim() !== '' &&
    limiteNumerico > 0 &&
    !limiteInsuficiente &&
    diaValido(diaFechamento) &&
    diaValido(diaVencimento) &&
    !salvando;

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);

    const dados = {
      nome: nome.trim(),
      limiteTotal: limiteNumerico,
      diaFechamento: Number(diaFechamento),
      diaVencimento: Number(diaVencimento),
      tema: modoEdicao ? cartaoParaEditar.tema : 'grafite',
      bandeira: modoEdicao ? cartaoParaEditar.bandeira : '',
    };

    try {
      if (modoEdicao) {
        await atualizarCartao(cartaoParaEditar.id, dados);
        onCartaoSalvo({ id: cartaoParaEditar.id, ...dados });
        toast.success('Cartão atualizado!');
        onEditado();
      } else {
        const cartaoCriado = await criarCartao(dados);
        onCartaoSalvo(cartaoCriado);
        toast.success('Cartão cadastrado!');
        onCriado(cartaoCriado);
      }
    } catch (erro) {
      console.error('Erro ao salvar cartão:', erro);
      toast.error('Não foi possível salvar o cartão. Tente novamente.');
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (excluindo) return;
    setExcluindo(true);
    const sucesso = await excluirCartao(cartaoParaEditar);
    if (sucesso) onExcluido();
    else setExcluindo(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={onVoltar}
          className="focus-ring cursor-pointer text-sm text-foreground-secondary px-2 py-1.5 rounded-lg"
        >
          Voltar
        </button>
        <p className="text-sm font-semibold text-foreground">{modoEdicao ? 'Editar cartão' : 'Novo cartão'}</p>
        <div className="w-12" aria-hidden="true" />
      </div>

      <Input label="Nome do cartão / banco" placeholder="Ex: Nubank" value={nome} onChange={(e) => setNome(e.target.value)} />

      <Input
        label="Limite total"
        inputMode="numeric"
        value={formatadorMoeda.format(limiteNumerico)}
        onChange={handleLimiteChange}
      />

      {limiteInsuficiente && (
        <p className="text-sm text-negative">
          O limite não pode ser menor que a dívida atual do cartão ({formatadorMoeda.format(comprometido)}).
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Dia de fechamento"
          type="number"
          min="1"
          max="31"
          value={diaFechamento}
          onChange={(e) => setDiaFechamento(e.target.value)}
        />
        <Input
          label="Dia de vencimento"
          type="number"
          min="1"
          max="31"
          value={diaVencimento}
          onChange={(e) => setDiaVencimento(e.target.value)}
        />
      </div>

      {diaValido(diaFechamento) && diaValido(diaVencimento) && Number(diaVencimento) <= Number(diaFechamento) && (
        <p className="text-xs text-foreground-muted">
          A fatura fecha no dia {diaFechamento} e vence no dia {diaVencimento} do mês seguinte.
        </p>
      )}

      <Button size="lg" className="w-full" disabled={!podeSalvar} carregando={salvando} onClick={salvar}>
        {modoEdicao ? 'Salvar alterações' : 'Salvar cartão'}
      </Button>

      {modoEdicao && (
        <Button variant="destructive" size="lg" className="w-full" carregando={excluindo} onClick={excluir}>
          Excluir cartão
        </Button>
      )}
    </div>
  );
};

export default PaymentCardForm;
