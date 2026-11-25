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
    ['No sábado você tem Futebol e, na véspera, o Treino 3 (Agachamento e Deadlift).', 'Recomendamos fazê-lo com carga moderada, parando 2 ou 3 repetições antes da falha, ou passá-lo para a terça, que está livre: pernas cansadas']],
  ['treino montado: pernas leve na véspera do futebol', [[], ['t2'], [], [], [], ['t1'], ['futebol']], { treinos: MEUS },
    ['na véspera, o Treino A (Passada para frente e Panturrilha)', 'Recomendamos manter as cargas moderadas e não ir até a falha: pernas cansadas']],
  ['treino de costas com um agachamento, na véspera do futebol', [[], ['t1'], [], ['t2'], [], ['t3'], ['futebol']], { treinos: MEUS },
    ['No sábado você tem Futebol e, na véspera, o Treino C (Agachamento).', 'Recomendamos fazer esse exercício com carga moderada ou passá-lo para outro treino:']],
  ['não sugere o único dia de descanso', [[], ['t3', 'bike'], ['jiu'], ['t1'], ['t2', 'surf'], ['t3'], ['futebol']], {},
    ['No sábado você tem Futebol e, na véspera, o Treino 3 (Agachamento e Deadlift).'], (av) => !av.includes('está livre')],
  ['treino de costas com um agachamento, no dia seguinte ao de pernas', [[], ['t1'], ['t3'], [], ['t2'], [], []], { treinos: MEUS },
    ['O Treino A (Passada para frente e Panturrilha), segunda, e o Treino C (Agachamento), terça, trabalham pernas em dias seguidos.']],
  ['treino montado: costas e jiu no mesmo dia', [[], ['t2', 'jiu'], [], ['t1'], [], [], []], { treinos: MEUS },
    ['Na segunda você tem o Treino B (Remada inversa e Puxada) e Jiu Jitsu. Recomendamos fazer o Jiu Jitsu primeiro e a musculação pelo menos 6 h depois: costas e pegada cansadas']],
  ['pernas e futvôlei no mesmo dia', [[], ['t1'], [], ['t2'], ['t3', 'futvolei'], [], []], {},
    ['Na quinta você tem o Treino 3 (Agachamento e Deadlift) e Futvôlei. Recomendamos fazer o Futvôlei primeiro']],
  ['ombros na véspera do surf', [['surf'], ['t1'], [], ['t3'], [], [], ['t2']], {},
    ['No domingo você tem Surf e, na véspera, o Treino 2 (', 'remada']],
  ['futebol na véspera de pernas', [[], ['t1'], ['futebol'], ['t3'], [], ['t2'], []], {},
    ['Depois do Futebol da terça, as pernas podem estar doloridas na quarta, no Treino 3 (Agachamento e Deadlift). Recomendamos ajustar a carga']],
  ['pernas com cardio de quem corre', [[], ['t3', 'bike'], [], ['t1'], [], ['t2'], []], { checkins: [ck('c1', 'corrida'), ck('c2', 'corrida'), ck('c3', 'bike')] },
    ['Na segunda você tem Treino 3 e Cardio. Recomendamos a musculação primeiro', 'Como você costuma correr, nesse dia prefira a bike']],
  ['dois esportes no mesmo dia', [[], ['t1'], [], ['t2'], [], ['t3'], ['jiu', 'muay']], {},
    ['No sábado você tem Jiu Jitsu e Muay Thai no mesmo dia. Recomendamos 6 h entre eles']],
  ['mesmo treino em dias seguidos', [[], ['t1'], ['t3'], ['t3'], [], ['t2'], []], {},
    ['O Treino 3 está em dias seguidos (terça e quarta). Recomendamos deixar 1 dia entre eles', 'aparece 2 vezes na semana. Se não for de propósito, recomendamos']],
];

(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const [nome, semana, { treinos, checkins = [] }, esperados, extraOk = () => true] of CASOS) {
    const p = await H.novaPagina(b, { checkins, extra: { perfis: [perfil(semana, treinos ? { treinos } : {})] } });
    await p.clock.install({ time: new Date('2026-10-19T09:00:00') });
    await p.goto(H.PAGINA + '#voce/semana');
    await H.prontos(p);
    const av = (await p.locator('#avisos-semana li').allTextContents()).join(' ').replace(/\s+/g, ' ');
    ok(esperados.every((e) => av.includes(e)) && extraOk(av), nome, av);
    const itens = await p.locator('#avisos-semana li').allTextContents();
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
  // Mais de 3 avisos: os 3 de risco de lesão primeiro e o resto em "Ver mais".
  {
    const p = await H.novaPagina(b, { extra: { perfis: [perfil([[], ['t3', 'bike'], ['jiu'], ['t1'], ['t2', 'surf'], ['t3'], ['futebol']])] } });
    await p.goto(H.PAGINA + '#voce/semana');
    await H.prontos(p);
    const visiveis = () => p.locator('#avisos-semana li:visible').allInnerTexts();
    let v = await visiveis();
    ok(v.length === 3 && v.every((t) => /véspera|primeiro e a musculação/.test(t)), 'só 3 avisos à mostra, os de risco de lesão primeiro', v.join(' | '));
    ok((await p.locator('#avisos-mais').innerText()) === 'Ver mais 3 recomendações', 'botão Ver mais com a contagem', await p.locator('#avisos-mais').innerText());
    await p.click('#avisos-mais');
    v = await visiveis();
    ok(v.length === 6 && (await p.getAttribute('#avisos-mais', 'aria-expanded')) === 'true' && (await p.locator('#avisos-mais').innerText()) === 'Ver menos', 'Ver mais abre todos', v.length + '');
    await p.click('#avisos-mais');
    ok((await visiveis()).length === 3, 'Ver menos volta a 3');
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
