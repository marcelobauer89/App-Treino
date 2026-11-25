// Minha semana: avisos pela organização da semana (foco de cada treino × esportes) e paleta opaca no estilo Gelo.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const perfil = (semana, extra = {}) => ({ id: 'u1', nome: 'Pessoa Exemplo', email: 'pessoa@exemplo.com', foto: '', tema: 'auto', dias_jiu: [], semana, ...extra });
const ck = (id, modalidade) => ({ id, usuario_id: 'u1', tipo: 'bike', modalidade, inicio: '2026-10-1' + id.slice(-1) + 'T08:00:00', fim: '2026-10-1' + id.slice(-1) + 'T08:30:00', sem_horario: false, recuperacao: null, obs: '', retroativo: false, ultima_serie: null, series: {} });
// Treinos montados pela pessoa: A = pernas leve (PSE 6), B = costas.
const MEUS = {
  1: { nome: 'Treino A', subtitulo: 'Inferiores', exercicios: [{ nome: 'Passada para frente', dose: '3×10', pse: 6 }, { nome: 'Panturrilha', dose: '3×15', pse: 6 }] },
  2: { nome: 'Treino B', subtitulo: 'Puxadas', exercicios: [{ nome: 'Remada inversa', dose: '3×10', pse: 8 }, { nome: 'Puxada', dose: '3×10', pse: 8 }] },
  // Costas em que a pessoa pôs um agachamento pesado: o aviso olha os exercícios, não o nome do treino.
  3: { nome: 'Treino C', subtitulo: 'Costas', exercicios: [{ nome: 'Remada inversa', dose: '3×10', pse: 8 }, { nome: 'Puxada', dose: '3×10', pse: 8 }, { nome: 'Agachamento', dose: '4×6', pse: 9 }] },
};
// Plano pronto: Treino 1 = costas, Treino 2 = ombros, Treino 3 = pernas. Índices: 0 = domingo.
const CASOS = [
  ['pernas na véspera do futebol (exercícios, PSE alto e dia livre)', [[], ['t1'], [], ['t2'], [], ['t3'], ['futebol']], {},
    ['No sábado você tem Futebol e, na véspera, o Treino 3 (Agachamento e Deadlift).', 'Recomendamos ir com cargas moderadas', 'Na terça está livre']],
  ['treino montado: pernas leve na véspera do futebol', [[], ['t2'], [], [], [], ['t1'], ['futebol']], { treinos: MEUS },
    ['na véspera, o Treino A (Passada para frente e Panturrilha)', 'Como as cargas desse treino já são moderadas, recomendamos manter assim']],
  ['treino de costas com um agachamento, na véspera do futebol', [[], ['t1'], [], ['t2'], [], ['t3'], ['futebol']], { treinos: MEUS },
    ['No sábado você tem Futebol e, na véspera, o Treino C (Agachamento).', 'Como é o único exercício de pernas desse treino, recomendamos fazer Agachamento com carga moderada nesse dia, ou passá-lo para outro treino da semana.']],
  ['treino de costas com um agachamento, no dia seguinte ao de pernas', [[], ['t1'], ['t3'], [], ['t2'], [], []], { treinos: MEUS },
    ['O Treino A (Passada para frente e Panturrilha) na segunda e o Treino C (Agachamento) na terça trabalham pernas em dias seguidos.']],
  ['treino montado: costas e jiu no mesmo dia', [[], ['t2', 'jiu'], [], ['t1'], [], [], []], { treinos: MEUS },
    ['Na segunda você tem o Treino B (Remada inversa e Puxada) e Jiu Jitsu. Recomendamos fazer o Jiu Jitsu primeiro', 'as costas e a pegada cansadas']],
  ['pernas e futvôlei no mesmo dia', [[], ['t1'], [], ['t2'], ['t3', 'futvolei'], [], []], {},
    ['Na quinta você tem o Treino 3 (Agachamento e Deadlift) e Futvôlei. Recomendamos fazer o Futvôlei primeiro']],
  ['ombros na véspera do surf', [['surf'], ['t1'], [], ['t3'], [], [], ['t2']], {},
    ['No domingo você tem Surf e, na véspera, o Treino 2 (', 'remada']],
  ['futebol na véspera de pernas', [[], ['t1'], ['futebol'], ['t3'], [], ['t2'], []], {},
    ['Depois do Futebol da terça, as pernas podem chegar doloridas na quarta para o Treino 3 (Agachamento e Deadlift)', 'Recomendamos ajustar a carga']],
  ['pernas com cardio de quem corre', [[], ['t3', 'bike'], [], ['t1'], [], ['t2'], []], { checkins: [ck('c1', 'corrida'), ck('c2', 'corrida'), ck('c3', 'bike')] },
    ['Na segunda você tem Treino 3 e Cardio. Recomendamos fazer a musculação primeiro', 'Como o seu cardio costuma ser corrida, nesse dia a bike tende a cansar menos as pernas']],
  ['dois esportes no mesmo dia', [[], ['t1'], [], ['t2'], [], ['t3'], ['jiu', 'muay']], {},
    ['No sábado você tem Jiu Jitsu e Muay Thai, dois treinos intensos no mesmo dia. Recomendamos']],
  ['mesmo treino em dias seguidos', [[], ['t1'], ['t3'], ['t3'], [], ['t2'], []], {},
    ['O Treino 3 cai em dias seguidos (terça e quarta). Recomendamos deixar um dia entre eles', 'aparece 2 vezes na semana. Se não for de propósito, recomendamos']],
];

(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const [nome, semana, { treinos, checkins = [] }, esperados] of CASOS) {
    const p = await H.novaPagina(b, { checkins, extra: { perfis: [perfil(semana, treinos ? { treinos } : {})] } });
    await p.clock.install({ time: new Date('2026-10-19T09:00:00') });
    await p.goto(H.PAGINA + '#voce/semana');
    await H.prontos(p);
    const av = ((await p.locator('#avisos-semana').innerText()) || '').replace(/\s+/g, ' ');
    ok(esperados.every((e) => av.includes(e)), nome, av);
    const itens = await p.locator('#avisos-semana li').allInnerTexts();
    ok(itens.length && itens.every((t) => /recomendamos/i.test(t)), `${nome}: todo aviso em tom de recomendação`, itens.join(' | '));
    await p.context().close();
  }
  // Semana sem conflito: sem avisos (o plano pronto continua limpo).
  {
    const p = await H.novaPagina(b, { extra: { perfis: [perfil([[], ['t2'], ['jiu'], ['t1'], ['jiu'], ['t3'], ['bike']])] } });
    await p.goto(H.PAGINA + '#voce/semana');
    await H.prontos(p);
    ok((await p.locator('#avisos-semana').innerText()).trim() === '', 'semana do plano pronto sem avisos', await p.locator('#avisos-semana').innerText());
    await p.context().close();
  }
  // Gelo: a paleta presa no topo é opaca (os dias não aparecem por trás ao rolar).
  const p = await H.novaPagina(b, { scheme: 'dark', viewport: { width: 390, height: 600 }, local: { 'bauer-estilo': 'gelo' }, extra: { perfis: [perfil([[], ['t1'], ['jiu'], ['t2'], ['jiu'], ['t1', 'bike'], ['jiu', 't2']])] } });
  await p.goto(H.PAGINA + '#voce/semana');
  await H.prontos(p);
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => scrollBy(0, 400));
  await p.waitForTimeout(150);
  const cor = await p.evaluate(() => [getComputedStyle(document.getElementById('paleta')).backgroundColor, getComputedStyle(document.querySelector('#paleta .ativ')).backgroundColor]);
  ok(cor.every((c) => /^rgb\(/.test(c)), 'gelo: paleta e atividades com fundo opaco', cor.join(' | '));
  await p.screenshot({ path: `${H.SAIDA}/semana-gelo-rolada.png` });
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FAIL` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
