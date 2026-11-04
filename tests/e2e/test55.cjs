// Biblioteca: 47 exercícios novos das fichas, sem nenhum repetido (nem com outro equipamento ou acento).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const T = new Date('2026-10-28T15:00:00');
const PERFIL = { id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], novidade_oculta: '2026-10-01T00:00:00Z', treinos: null };
const NOVOS = {
  Mobilidade: ['Rotação de quadril ajoelhado', 'Mobilidade de tronco na parede', 'Alcance no pé semiajoelhado', 'Rolamento tocando os pés', 'Mobilidade 90/90 com remada', 'Windmill semiajoelhado', 'Armbar com kettlebell', 'Mobilidade de punho', 'Alongamento de posteriores', 'Alongamento de posterior com mobilidade escapular'],
  Core: ['Prancha trocando a base', 'Quadrupedia com flexão', 'Perdigueiro alternado', 'Prancha tocando os ombros', 'Swing diagonal semiajoelhado'],
  Explosivos: ['Saltitos', 'Elevação de quadril unilateral com salto'],
  Pernas: ['Cadeira flexora', 'Cadeira abdutora', 'Drop lunge', 'Ponte invertida unilateral', 'Sissy squat', 'Agachamento lateral alternado', 'Agachamento búlgaro', 'Agachamento sumô', 'Deadlift sumô', 'Step up', 'Flexão nórdica', 'Abdução de quadril no cabo', 'Abdução de quadril deitado de lado', 'Coice de glúteo na polia', 'Deslocamento lateral com elástico'],
  Costas: ['Remada serrote', 'Face pull', 'Extensão de ombros no cabo'],
  Peito: ['Flexão de braços', 'Supino reto'],
  Pescoço: ['Flexão lateral de pescoço'],
  Cardio: ['Cardio curto intervalado', 'Cardio intermediário'],
  Ombros: ['Crucifixo inverso sentado', 'Elevação frontal', 'Elevação lateral 180°', 'Encolhimento', 'Arremesso com elástico'],
  Braços: ['Rosca concentrada', 'Bíceps de cócoras no cabo', 'Rosca alternada no banco inclinado', 'Rosca com desenvolvimento', 'Tríceps testa', 'Tríceps na corda', 'Extensão de punho', 'Rotação de antebraço no cabo', 'Suspensão na barra', 'Pega anilha'],
};
// Dos PDFs, mas o movimento já estava na biblioteca (ou ficou de fora): não pode virar outro item.
const FORA = ['Agachamento goblet', 'Clean do chão unilateral', 'Barra fixa supinada', 'Tríceps no cabo', 'Supino reto pausado', 'Mobilidade 90/90', 'Alcance da ponte', 'Deadlift veloz', 'Swing diagonal', 'Elevação de quadril unilateral', 'Jeff curl', 'Ponte alta alternada', 'Cadeira flexora unilateral', 'Agachamento HBL', 'Remada alta unilateral no rosto', 'Remada alta na polia alta com corda',
  'Elevação lateral com halteres', 'Abdução de ombros unilateral', 'Bíceps ISO', 'Remada suspensa', 'Entrega à frente', 'Mobilidade de quadril e pé', 'Mobilidade de quadril cachorro',
  'Cócoras com alongamento posterior', 'Desenvolvimento sentado', 'Crucifixo no banco reto', 'Crucifixo na polia média', 'Puxada aberta', 'Passada com halteres', 'Flexão de joelhos com caneleiras',
  'Adução de quadril com caneleira', 'Carregada', 'Ananias', 'Mobilidade quadril pára-brisa', 'Mobilidade de quadril 90/90', 'Elevação de quadril com barra', 'Stiff pés afastados', 'Tríceps testa no TRX',
  'Tríceps testa unilateral na polia', 'Tríceps na polia com corda', 'Abdução de quadril na polia baixa', 'Step up com pausa embaixo', 'Glúteos coice na polia', 'Suspensão', 'Flexão de punho semiajoelhado'];
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
async function abrir(b, op = {}) {
  const p = await H.novaPagina(b, { extra: { perfis: [{ ...PERFIL }] }, ...op });
  if (op.html) await p.context().route(/\/index\.html/, async (r) => { const resp = await r.fetch(); r.fulfill({ response: resp, body: op.html(await resp.text()) }); });
  await p.clock.install({ time: T });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
  await H.voce(p, 'treinos'); await p.click('#editar-treinos'); await p.click('[data-ed-vista="escolher"]'); await p.waitForTimeout(150);
  return p;
}
const itens = (p) => p.locator('.ed-bib-item').evaluateAll((ls) => ls.map((l) => l.querySelector('b').textContent.trim()));
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await abrir(b, { scheme, viewport });
    const todos = await itens(p);
    const novos = Object.values(NOVOS).flat();
    ok(novos.length === 55 && new Set(novos.map(norm)).size === 55, `${tag}: lista de 55 novos sem repetição`);
    ok(todos.length === 136, `${tag}: biblioteca com 136 (126 + 10 abdominais)`, String(todos.length));
    ok(new Set(todos.map(norm)).size === todos.length, `${tag}: nenhum nome repetido (sem acento e maiúsculas)`);
    const faltam = novos.filter((n) => !todos.includes(n));
    ok(!faltam.length, `${tag}: todos os novos aparecem`, faltam.join(', '));
    const indevidos = FORA.filter((n) => todos.map(norm).includes(norm(n)));
    ok(!indevidos.length, `${tag}: variações de exercícios existentes não viram outro item`, indevidos.join(', '));
    for (const [g, ns] of Object.entries(NOVOS)) {
      await p.click(`[data-ed-grupo="${g}"]`); await p.waitForTimeout(60);
      const doGrupo = await itens(p);
      const fora = ns.filter((n) => !doGrupo.includes(n));
      ok(!fora.length, `${tag}: novos no grupo ${g}`, fora.join(', '));
    }
    await p.click('[data-ed-grupo="todos"]').catch(() => {});
    await p.fill('#ed-busca', 'face pull'); await p.waitForTimeout(80);
    ok((await itens(p)).join('|') === 'Face pull', `${tag}: busca acha o novo`, (await itens(p)).join('|'));
    await p.fill('#ed-busca', 'TRICEPS'); await p.waitForTimeout(80);
    ok((await itens(p)).length === 4, `${tag}: busca "tríceps" sem acento acha Tríceps, francês, testa e corda`, (await itens(p)).join('|'));
    // Nomes das fichas acham o exercício certo
    for (const [busca, esperado] of [['cardio 2', 'Cardio intermediário'], ['cardio 1', 'Cardio curto intervalado'], ['goblet', 'Agachamento'], ['supinada', 'Barra fixa'], ['supino reto pausado', 'Supino reto'], ['clean do chão', 'Clean'], ['tríceps no cabo', 'Tríceps'], ['elevação de quadril na cadeira', 'Elevação pélvica unilateral'], ['quadril com barra', 'Elevação de quadril'], ['HBL', null], ['cadeira flexora unilateral', 'Cadeira flexora'],
      ['flexao de joelhos', 'Mesa flexora'], ['jeff curl', 'Jefferson curl'], ['remada alta', 'Face pull'], ['tríceps testa no trx', 'Tríceps testa'], ['desenvolvimento sentado', 'Desenvolvimento']]) {
      await p.fill('#ed-busca', busca); await p.waitForTimeout(60);
      const r = await itens(p);
      if (esperado) ok(r.includes(esperado), `${tag}: busca "${busca}" acha ${esperado}`, r.join('|'));
      else ok(r.includes('Agachamento') && r.includes('Elevação de quadril'), `${tag}: busca "HBL" acha agachamento e elevação de quadril`, r.join('|'));
    }
    await p.fill('#ed-busca', 'cadeira'); await p.waitForTimeout(60);
    const tambem = await p.locator('[data-ed-add="Elevação pélvica unilateral"] .ed-tambem').textContent();
    ok(/Também: Elevação de quadril na cadeira/.test(tambem), `${tag}: item mostra os outros nomes`, tambem);
    if (viewport.width === 390) await p.screenshot({ path: `${H.SAIDA}/bib-cadeira-${scheme}.png` });
    await p.fill('#ed-busca', ''); await p.click('[data-ed-grupo="Cardio"]'); await p.waitForTimeout(80);
    ok((await itens(p)).join('|') === 'Cardio curto intervalado|Cardio intermediário', `${tag}: grupo Cardio com os 2 protocolos`, (await itens(p)).join('|'));
    if (viewport.width === 390) await p.screenshot({ path: `${H.SAIDA}/bib-cardio-${scheme}.png` });
    await p.click('[data-ed-grupo="todos"]');
    // Vídeos do Ciclo 4
    await p.fill('#ed-busca', ''); await p.waitForTimeout(60);
    const comVideo = await p.locator('.ed-bib-item').evaluateAll((ls) => ls.filter((l) => / · vídeo/.test(l.querySelector('small').textContent)).map((l) => l.querySelector('b').textContent.trim()));
    const semVid = ['Cardio curto intervalado', 'Cardio intermediário', 'Prancha trocando a base', 'Supino reto', 'Flexão lateral de pescoço', 'Remada serrote', 'Cadeira abdutora', 'Agachamento búlgaro', 'Suspensão na barra', 'Swing diagonal semiajoelhado', 'Extensão de ombros no cabo'].filter((n) => !comVideo.includes(n));
    ok(!semVid.length, `${tag}: vídeos do Ciclo 4`, semVid.join(', '));
    await p.fill('#ed-busca', '');
    if (viewport.width === 390) { await p.click('[data-ed-grupo="Braços"]'); await p.waitForTimeout(200); await p.screenshot({ path: `${H.SAIDA}/bib-bracos-${scheme}.png` }); }
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Outros nomes: cada um aponta para um exercício que existe e nenhum é nome de outro exercício (nem se repete)
  {
    const html = require('fs').readFileSync(H.RAIZ + '/index.html', 'utf8');
    const bloco = html.slice(html.indexOf('const VARIACOES = {'), html.indexOf('const GRUPOS_EX'));
    const pares = [...bloco.matchAll(/'([^']+)': \[([^\]]+)\]/g)].map((m) => [m[1], [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])]);
    const p0 = await abrir(b); const todos = (await itens(p0)).map(norm); await p0.context().close();
    const semDono = pares.filter(([n]) => !todos.includes(norm(n))).map(([n]) => n);
    const vars = pares.flatMap(([, v]) => v).map(norm);
    const conflito = vars.filter((v) => todos.includes(v));
    ok(pares.length >= 35 && !semDono.length, 'outros nomes apontam para exercícios que existem', semDono.join(', '));
    ok(!conflito.length && new Set(vars).size === vars.length, 'nenhum outro nome é nome de exercício nem se repete', conflito.join(', '));
  }
  // Adicionar um novo ao treino e salvar
  let p = await abrir(b);
  await p.fill('#ed-busca', 'sissy'); await p.click('[data-ed-add="Sissy squat"]');
  ok((await p.getAttribute('[data-ed-add="Sissy squat"]', 'aria-pressed')) === 'true', 'novo exercício marcado como adicionado');
  await p.locator('.ed-fixo [data-ed-vista="treino"]').click(); await p.waitForTimeout(100);
  await H.salvarEditor(p); await p.waitForTimeout(400); await H.gravacoes(p);
  const db = await H.banco(p);
  const salvo = JSON.stringify(db.perfis[0].treinos || {});
  ok(/Sissy squat/.test(salvo) && /3–4×6/.test(salvo), 'salvo no treino com a dose da ficha', salvo.slice(0, 120));
  ok(!p.errs.length, 'sem erros ao salvar', p.errs.join(' | '));
  await p.context().close();
  // Trava: um nome repetido (outra grafia) na lista não aparece duas vezes
  p = await abrir(b, { html: (h) => h.replace("    // Fichas de anti-lesão", "    { nome: 'FACE PULL', grupo: 'Costas', dose: '1×1', pse: 5, H: 'baixa', M: 'baixa', F: 'baixa', E: 'baixa', why: 'duplicado de teste' },\n    { nome: 'Cocoras', grupo: 'Mobilidade', dose: '1×1', pse: 5, H: 'baixa', M: 'baixa', F: 'baixa', E: 'baixa', why: 'duplicado de teste' },\n    // Fichas de anti-lesão") });
  const t2 = await itens(p);
  ok(t2.length === 136 && new Set(t2.map(norm)).size === t2.length && t2.includes('Cócoras') && !t2.includes('Cocoras'), 'trava: duplicado com outra grafia é ignorado (fica o primeiro)', String(t2.length));
  await p.context().close();
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
