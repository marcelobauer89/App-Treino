// Vídeos fora do app: cartões sem carrossel, biblioteca e avisos sem "vídeo"; a lista fica guardada em docs/.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const fs = require('fs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const T = new Date('2026-10-27T15:00:00'); // terça: treino com vídeos na lista guardada
(async () => {
  const arq = JSON.parse(fs.readFileSync(H.APOIO + '/videos-exemplo.json', 'utf8'));
  const ids = Object.values(arq.videos);
  ok(ids.length === 80 && new Set(ids).size === 80 && ids.every((v) => /^[\w-]{11}$/.test(v)), 'lista guardada com os 80 vídeos, sem repetir', String(ids.length));
  const html = fs.readFileSync(H.RAIZ + '/index.html', 'utf8');
  ok(/const VIDEOS = \{\};/.test(html) && !ids.some((v) => html.includes(v)), 'nenhum vídeo no index.html');
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, semVideos: true, viewport: { width: 390, height: 844 } });
    const pedidos = []; p.on('request', (r) => pedidos.push(r.url()));
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(400);
    for (const t of await p.locator('[data-treino]').all()) {
      await t.click().catch(() => {}); await p.waitForTimeout(150);
      ok(!(await p.locator('#list .ex-slides, #list .ex-video, #list .ex-dica').count()), `${scheme}: treino "${(await t.innerText()).split('\n')[0]}" sem carrossel de vídeo`);
    }
    ok(!pedidos.some((u) => /ytimg|youtube/.test(u)), `${scheme}: nada é baixado do YouTube`);
    await p.screenshot({ path: `${H.SAIDA}/sem-video-${scheme}.png` });
    await H.voce(p, 'treinos'); await p.click('#editar-treinos'); await p.click('[data-ed-vista="escolher"]'); await p.waitForTimeout(150);
    const bib = await p.locator('#ed-bib').innerText();
    ok(!/vídeo/i.test(bib) && (await p.locator('.ed-bib-item').count()) === 136, `${scheme}: biblioteca sem "vídeo"`);
    ok(!/com vídeo/.test(await p.locator('#editor-body').innerText()), `${scheme}: editor sem "com vídeo"`);
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Avisos de novidade sem "0 com vídeo"
  for (const contaNova of [false, true]) {
    const p = await H.novaPagina(b, { semVideos: true, extra: { perfis: [{ id: 'u1', nome: 'Ana', email: 'a@x.com', foto: '', tema: 'auto', dias_jiu: [2, 4], novidade_oculta: null, novidade_treinos: null, treinos: null }], checkins: contaNova ? [] : [{ id: 'c', usuario_id: 'u1', tipo: 't1', inicio: '2026-10-20T10:00:00', fim: '2026-10-20T11:00:00', sem_horario: false, obs: '', retroativo: false, series: {} }] } });
    await p.clock.install({ time: T });
    await p.goto(H.PAGINA); await p.waitForTimeout(900);
    // Conta nova: a biblioteca aparece no passo do objetivo das boas-vindas (depois de "Começar").
    if (contaNova) { await p.click('[data-jd-comecar]').catch(() => {}); await p.waitForTimeout(100); }
    const t = (await p.locator(contaNova ? '#jornada-body' : '#novidade-body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    ok(t.length > 20 && !/vídeo/.test(t) && /136 exercícios/.test(t), `aviso ${contaNova ? 'de conta nova' : 'de novidade'} sem vídeo`, t.slice(0, 160));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
