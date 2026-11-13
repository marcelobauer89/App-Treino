// Minha semana: arrastar e soltar, seletor do +, avisos, gravação e reflexos no app.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const irPara = async (p, tela) => { if (tela === 'voce') return H.voce(p, 'semana'); await p.click(`.nav [data-tela="${tela}"]`); await p.waitForFunction(t => !document.getElementById(`tela-${t}`).hidden, tela); };
const dias = (p) => p.$$eval('#dias-cfg .dia-cfg', els => els.map(e => [...e.querySelectorAll('.ativ')].map(a => a.dataset.arrastar).join('+') || '-'));
const semanaTela = (p) => p.$$eval('#dias .dia-info b', els => els.map(e => e.textContent));
const linhaDia = (p, i) => p.locator(`#dias-cfg .dia-cfg[data-dia="${i}"]`);
async function arrastar(p, origem, destino, { soltar = true } = {}) {
  await p.locator('#dias-cfg').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await p.evaluate(() => scrollBy(0, 80));
  const o = await origem.boundingBox();
  const d = await destino.boundingBox();
  await p.mouse.move(o.x + 14, o.y + o.height / 2);
  await p.mouse.down();
  await p.mouse.move(o.x + 30, o.y + o.height / 2 + 4, { steps: 3 });
  await p.mouse.move(d.x + d.width / 2, d.y + d.height / 2, { steps: 8 });
  const alvo = await p.evaluate(() => [document.querySelectorAll('.fantasma').length, document.querySelector('.dia-cfg.alvo')?.dataset.dia ?? null]);
  if (soltar) await p.mouse.up();
  await H.gravacoes(p);
  return alvo;
}
const daPaleta = (p, t) => p.locator(`#paleta [data-arrastar="${t}"]`);
const doDia = (p, i, t) => p.locator(`#dias-cfg .dia-cfg[data-dia="${i}"] [data-arrastar="${t}"]`);

(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  const p = await H.novaPagina(b);
  await p.clock.install({ time: new Date('2026-10-19T09:00:00') }); // segunda
  await p.goto(H.PAGINA + '#voce/semana');
  await H.prontos(p);
  await p.evaluate(() => document.fonts.ready);

  ok((await dias(p)).join(' ') === 't2 jiu t1 jiu t3 bike -', 'default week from dias_jiu', (await dias(p)).join(' '));
  // Conta antiga com jiu (dias_jiu): a semana dela não é mais o padrão, que começa sem lutas.
  ok(!(await p.isDisabled('#semana-padrao')), 'reset enabled: old jiu week differs from the new default');
  ok((await txt(p, '#avisos-semana')) === '', 'no warnings on default week', await txt(p, '#avisos-semana'));
  ok(await p.evaluate(() => document.documentElement.scrollWidth) === 375, 'no horizontal scroll');
  await linhaDia(p, 1).scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'w-padrao.png', fullPage: true });

  // arrastar jiu da paleta para segunda
  const alvo = await arrastar(p, daPaleta(p, 'jiu'), linhaDia(p, 1));
  ok(alvo[0] === 1 && alvo[1] === '1', 'ghost + Monday highlighted while dragging', JSON.stringify(alvo));
  ok(await p.locator('.fantasma').count() === 0 && await p.locator('.dia-cfg.alvo').count() === 0, 'ghost cleaned up');
  ok((await dias(p))[0] === 't2+jiu', 'jiu dropped on Monday', (await dias(p))[0]);
  let db = await H.banco(p);
  ok(JSON.stringify(db.perfis[0].semana) === JSON.stringify([[], ['t2', 'jiu'], ['jiu'], ['t1'], ['jiu'], ['t3'], ['bike']]), 'semana saved to DB', JSON.stringify(db.perfis[0].semana));
  ok((await txt(p, '#avisos-semana')).includes('Na segunda você terá Treino 2 e Jiu Jitsu'), 'same-day warning', await txt(p, '#avisos-semana'));
  ok(!(await p.isDisabled('#semana-padrao')), 'reset enabled');
  ok(!(await txt(p, '#toast')).includes('Arraste'), 'no tap hint after a drag');

  // terceira atividade no mesmo dia: sai a mais antiga
  await arrastar(p, daPaleta(p, 'bike'), linhaDia(p, 1));
  ok((await dias(p))[0] === 'jiu+bike', 'third replaces oldest', (await dias(p))[0]);
  ok((await txt(p, '#toast')).includes('Treino 2 saiu da segunda'), 'replace toast', await txt(p, '#toast'));
  ok((await txt(p, '#avisos-semana')).includes('Treino 2 ficou fora da semana'), 'missing workout warning', await txt(p, '#avisos-semana'));

  // mover entre dias: Treino 1 de quarta para segunda (substitui jiu)
  await arrastar(p, doDia(p, 3, 't1'), linhaDia(p, 1));
  let d = await dias(p);
  ok(d[0] === 'bike+t1' && d[2] === '-', 'moved from Wednesday to Monday', d.join(' '));
  // soltar fora tira do dia
  await arrastar(p, doDia(p, 1, 'bike'), p.locator('#paleta'));
  ok((await dias(p))[0] === 't1' && (await txt(p, '#toast')).includes('Cardio saiu da segunda'), 'drop outside removes', (await dias(p))[0]);
  // mesma atividade no dia: não duplica
  await arrastar(p, daPaleta(p, 't1'), linhaDia(p, 1));
  ok((await dias(p))[0] === 't1' && (await txt(p, '#toast')).includes('já está na segunda'), 'no duplicate', await txt(p, '#toast'));
  // × remove
  await p.click('#dias-cfg [data-remover="5:t3"]');
  await H.gravacoes(p);
  ok((await dias(p))[4] === '-', 'x removes Treino 3 from Friday');

  // seletor do +
  await p.click('#dias-cfg [data-adicionar="0"]');
  ok(await p.isVisible('#ativ-dialog') && (await txt(p, '#ativ-title')) === 'Domingo', 'picker opens for Sunday');
  await p.click('#ativ-dialog [data-escolher="t3"]');
  await p.click('#ativ-dialog [data-escolher="t2"]');
  await p.click('#ativ-dialog [data-escolher="bike"]');
  ok(await p.getAttribute('#ativ-dialog [data-escolher="t3"]', 'aria-pressed') === 'false' && await p.getAttribute('#ativ-dialog [data-escolher="bike"]', 'aria-pressed') === 'true', 'picker toggles, max 2');
  await p.screenshot({ path: 'w-seletor.png' });
  await p.click('#ativ-dialog [data-escolher="bike"]');
  await p.click('#ativ-dialog [data-fechar].modal-done');
  await H.gravacoes(p);
  d = await dias(p);
  ok(d[6] === 't2' && !(await p.isVisible('#ativ-dialog')), 'Sunday = Treino 2 via picker', d.join(' '));
  // jiu de sábado depois de pernas na sexta
  await arrastar(p, daPaleta(p, 't3'), linhaDia(p, 5));
  await arrastar(p, daPaleta(p, 'jiu'), linhaDia(p, 6));
  const av = await txt(p, '#avisos-semana');
  ok(av.includes('No sábado o jiu vem logo depois do Treino 3'), 'rule 5 warning', av);
  d = await dias(p);
  ok(d.join(' ') === 't1 jiu - jiu t3 bike+jiu t2', 'week state', d.join(' '));
  await p.click('#tela-voce [data-arrastar="t1"]:not([data-de])');
  ok((await txt(p, '#toast')).includes('Arraste a atividade'), 'tap on palette chip gives hint');
  await linhaDia(p, 1).scrollIntoViewIfNeeded();
  await p.screenshot({ path: 'w-editada.png', fullPage: true });

  // reflexos: topo, Semana e Dashboard
  await irPara(p, 'treino');
  ok((await txt(p, '#atividade')) === 'Treino 1', 'hero = Monday plan', await txt(p, '#atividade'));
  const st = await semanaTela(p);
  ok(st[0] === 'Treino 1' && st[2] === 'Descanso' && st[5] === 'Cardio + Jiu Jitsu' && st[6] === 'Treino 2', 'Semana list follows config', st.join(' | '));
  ok(await p.isHidden('#semana-nota'), 'default-week note hidden');
  await irPara(p, 'dashboard');
  const metas = await txt(p, '#metas');
  ok(metas.includes('Musculação 0 de 3') && metas.includes('Jiu Jitsu 0 de 3') && metas.includes('Cardio 0 de 1'), 'metas follow config', metas);

  // recarregar mantém, e o treino do dia abre conforme a semana da conta
  await p.evaluate(() => localStorage.removeItem('bauer-treino-v2'));
  await p.reload();
  await H.prontos(p);
  await irPara(p, 'voce');
  ok((await dias(p)).join(' ') === 't1 jiu - jiu t3 bike+jiu t2', 'persists after reload');
  await p.click('#semana-padrao');
  await H.gravacoes(p);
  ok((await dias(p)).join(' ') === 't2 - t1 - t3 bike -' && await p.isDisabled('#semana-padrao'), 'reset to default (no jiu)', (await dias(p)).join(' '));
  db = await H.banco(p);
  ok(JSON.stringify(db.perfis[0].semana) === JSON.stringify([[], ['t2'], [], ['t1'], [], ['t3'], ['bike']]), 'reset saved');
  console.log('errors:', p.errs);
  ok(!p.errs.length, 'no page errors');

  // ficha abre no treino do dia vindo da semana salva (segunda = Treino 3 aqui)
  const q = await H.novaPagina(b, { extra: { perfis: [{ id: 'u1', nome: 'M', email: 'm@x.com', foto: '', tema: 'auto', dias_jiu: [2, 4], semana: [[], ['t3'], [], [], [], [], []] }] } });
  await q.clock.install({ time: new Date('2026-10-19T09:00:00') });
  await q.goto(H.PAGINA);
  await H.prontos(q);
  ok((await txt(q, '#atividade')) === 'Treino 3' && await q.getAttribute('[data-treino="3"]', 'aria-selected') === 'true', 'ficha opens on Treino 3 from saved week');
  // conta antiga só com dias_jiu = [1, 6]
  const r = await H.novaPagina(b, { extra: { perfis: [{ id: 'u1', nome: 'M', email: 'm@x.com', foto: '', tema: 'auto', dias_jiu: [1, 6] }] } });
  await r.clock.install({ time: new Date('2026-10-19T09:00:00') });
  await r.goto(H.PAGINA + '#voce/semana');
  await H.prontos(r);
  ok((await dias(r)).join(' ') === 't2+jiu - t1 - t3 jiu -', 'old account: week from dias_jiu', (await dias(r)).join(' '));

  // banco sem a coluna semana: aviso específico
  const s = await H.novaPagina(b, { extra: { semColunaSemana: true } });
  await s.clock.install({ time: new Date('2026-10-19T09:00:00') });
  await s.goto(H.PAGINA + '#voce/semana');
  await H.prontos(s);
  await s.click('#dias-cfg [data-remover="1:t2"]');
  await H.gravacoes(s);
  await s.waitForTimeout(100);
  ok((await txt(s, '#toast')).includes('rode de novo o supabase/schema.sql'), 'missing column message', await txt(s, '#toast'));
  ok((await dias(s))[0] === 't2', 'reverted to server state');

  // dark + toque (CDP)
  const t = await H.novaPagina(b, { scheme: 'dark' });
  await t.clock.install({ time: new Date('2026-10-19T09:00:00') });
  await t.goto(H.PAGINA + '#voce/semana');
  await H.prontos(t);
  await t.evaluate(() => document.fonts.ready);
  const cdp = await t.context().newCDPSession(t);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  // Domingo acima da faixa de rolagem automática (50 px sobre a navegação).
  await linhaDia(t, 0).evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await t.evaluate(() => scrollBy(0, 160));
  const o = await daPaleta(t, 't1').boundingBox(), dd = await linhaDia(t, 0).boundingBox();
  const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await toque('touchStart', o.x + 14, o.y + 18);
  for (let k = 1; k <= 10; k++) await toque('touchMove', o.x + 14 + (dd.x + 150 - o.x - 14) * k / 10, o.y + 18 + (dd.y + 30 - o.y - 18) * k / 10);
  const sy = await t.evaluate(() => scrollY);
  await t.screenshot({ path: 'w-arrastando-dark.png' });
  await toque('touchEnd');
  await H.gravacoes(t);
  ok((await dias(t))[6] === 't1', 'touch drag drops on Sunday', (await dias(t)).join(' '));
  await t.screenshot({ path: 'w-dark.png', fullPage: true });
  console.log('errors t:', t.errs);

  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
