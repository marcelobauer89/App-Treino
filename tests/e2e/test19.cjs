// Botão fixo de check-in.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const irPara = async (p, tela) => { await p.click(`.nav [data-tela="${tela}"]`); await p.waitForFunction(t => !document.getElementById(`tela-${t}`).hidden, tela); };
const caixa = (p, s) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom }; }, s);
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme });
    await p.clock.install({ time: new Date('2026-10-19T09:00:00') }); // segunda: Treino 2
    await p.goto(H.PAGINA); await H.prontos(p); await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    const f = await caixa(p, '#fab-checkin'), nav = await caixa(p, '.nav');
    ok(await p.isVisible('#fab-checkin') && f.w > 150 && f.h === 56, `${scheme}: expanded on Treino`, JSON.stringify(f));
    ok(f.x + f.w <= 375 - 15 && f.b <= nav.y - 15, `${scheme}: bottom-right above nav`);
    await p.screenshot({ path: `f-${scheme}-topo.png` });
    await p.mouse.wheel(0, 900); await p.waitForTimeout(400);
    const e = await caixa(p, '#fab-checkin');
    ok(e.w === 56 && e.h === 56, `${scheme}: collapses to circle when scrolling down`, JSON.stringify(e));
    await p.screenshot({ path: `f-${scheme}-encolhido.png` });
    await p.mouse.wheel(0, -200); await p.waitForTimeout(400);
    ok((await caixa(p, '#fab-checkin')).w > 150, `${scheme}: expands when scrolling up`);
    if (scheme === 'light') {
      ok(await p.evaluate(() => document.documentElement.scrollWidth) === 375, 'no horizontal scroll');
      // abre o formulário com Treino 2; troca para jiu e salva
      await p.click('#fab-checkin');
      ok(await p.isVisible('#form-dialog') && await p.isChecked('input[name="f-tipo"][value="t2"]'), 'form opens with Treino 2');
      await p.screenshot({ path: 'f-form.png' });
      await p.click('#form-dialog label.opcao:has(input[value="jiu"])');
      await p.click('[data-salvar-form]');
      await H.gravacoes(p);
      const db = await H.banco(p);
      ok(db.checkins.length === 1 && db.checkins[0].tipo === 'jiu', 'saved jiu check-in', JSON.stringify(db.checkins.map(c => c.tipo)));
      const t = await caixa(p, '#toast'), f2 = await caixa(p, '#fab-checkin');
      ok(t.b <= f2.y, 'toast above the button', `${t.b} vs ${f2.y}`);
      // aba Treino 3
      await p.click('[data-treino="3"]');
      await p.click('#fab-checkin');
      ok(await p.isChecked('input[name="f-tipo"][value="t3"]'), 'tab Treino 3 preselected');
      await p.click('#form-dialog [data-fechar]');
      // Dashboard: tipo planejado de hoje (segunda = Treino 2)
      await irPara(p, 'dashboard');
      ok(await p.isVisible('#fab-checkin'), 'shown on Dashboard');
      await p.click('#fab-checkin');
      ok(await p.isChecked('input[name="f-tipo"][value="t2"]'), 'dashboard preselects planned type');
      await p.click('#form-dialog [data-fechar]');
      await irPara(p, 'voce');
      ok(await p.isHidden('#fab-checkin'), 'hidden on Você');
      await irPara(p, 'treino');
      // check-in ao vivo aberto: botão acima da barra preta
      await p.click('[data-treino="2"]');
      // check-in antigo aberto (salvar peso não abre mais check-in)
      await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.checkins.push({ id: 'ab', usuario_id: 'u1', tipo: 't2', inicio: '2026-10-19T09:00:00', fim: null, sem_horario: false, recuperacao: null, obs: '', retroativo: false, ultima_serie: null, series: {} }); localStorage.setItem('mock-supabase', JSON.stringify(d)); });
      await p.reload(); await H.prontos(p);
      await p.waitForSelector('#ativo:not([hidden])');
      const a = await caixa(p, '#ativo'), f3 = await caixa(p, '#fab-checkin');
      ok(f3.b <= a.y - 8, 'button above the active bar', `${f3.b} vs ${a.y}`);
      await p.screenshot({ path: 'f-ativo.png' });
      // último card não fica escondido: rola até o fim
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300);
      const ult = await caixa(p, '#tela-treino footer');
      ok(ult.b <= (await caixa(p, '#fab-checkin')).y + 60, 'end of page reachable above button');
    }
    ok(!p.errs.length, `${scheme}: no errors`, p.errs.join());
    await p.context().close();
  }
  const l = await H.novaPagina(b, { logado: false });
  await l.goto(H.PAGINA); await l.waitForSelector('#entrar-google:not([hidden])');
  ok(await l.isHidden('#fab-checkin'), 'hidden on login');
  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
