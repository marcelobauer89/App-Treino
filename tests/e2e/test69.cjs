// Painel, aba Usuários: caixinha "Só quem fez check-in no período" (segue o período, junta com a busca, vale para o CSV e fica lembrada).
const { chromium } = require('playwright');
const fs = require('fs');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-10-28T15:00:00';
const ck = (u, dia) => ({ usuario_id: u, tipo: 'jiu', inicio: `${dia}T19:00:00`, fim: `${dia}T20:00:00` });
const usuario = (id, nome) => ({ id, nome, email: `${id}@x.com`, cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-28T10:00:00', acessos: 5, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true, liberado: true, videos_liberados: false });
const ADM = {
  ids: ['u1'], usuarios: [usuario('u1', 'Marcelo'), usuario('u2', 'Ana'), usuario('u3', 'Bruno')],
  // Marcelo treinou ontem, Ana hoje e Bruno só em agosto (fora dos 30 dias).
  checkins: [ck('u1', '2026-10-27'), ck('u2', '2026-10-28'), ck('u3', '2026-08-20')],
  eventos: [], emails: [], convites: [],
};
const nomes = (p) => p.locator('#usuarios-corpo tr[data-usuario] b').evaluateAll((bs) => bs.map((b) => b.textContent.trim()).sort());

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM } });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(ADMIN + '#usuarios'); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(200);
    const caixa = p.locator('#so-checkin');
    ok(await caixa.isVisible() && !(await caixa.isChecked()), `${tag}: caixinha visível e desmarcada`);
    ok((await nomes(p)).join() === 'Ana,Bruno,Marcelo' && (await p.textContent('#u-contagem')) === '3 usuários', `${tag}: sem filtro, todos`, (await nomes(p)).join());
    const alvo = await p.locator('label.so-checkin').boundingBox();
    ok(alvo && alvo.height >= 44, `${tag}: área de toque de 44 px`, String(alvo && alvo.height));
    await p.locator('label.so-checkin').click(); await p.waitForTimeout(100);
    ok((await nomes(p)).join() === 'Ana,Marcelo' && (await p.textContent('#u-contagem')) === '2 de 3 usuários', `${tag}: marcada, só quem fez check-in em 30 dias`, `${(await nomes(p)).join()} / ${await p.textContent('#u-contagem')}`);
    await p.locator('label.so-checkin').scrollIntoViewIfNeeded();
    await p.locator('#aba-usuarios').screenshot({ path: `${H.SAIDA}/so-checkin-${tag}.png` });
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${tag}: sem rolagem lateral`);
    if (tag === 'light-1280') {
      await p.click('[data-periodo="hoje"]'); await p.waitForTimeout(150);
      ok((await nomes(p)).join() === 'Ana', 'Hoje: só quem treinou hoje', (await nomes(p)).join());
      await p.click('[data-periodo="tudo"]'); await p.waitForTimeout(150);
      ok((await nomes(p)).join() === 'Ana,Bruno,Marcelo', 'Tudo: Bruno volta (treinou em agosto)', (await nomes(p)).join());
      await p.click('[data-periodo="30"]'); await p.waitForTimeout(150);
      // Junto com a busca.
      await p.fill('#busca', 'bru'); await p.waitForTimeout(100);
      ok(/Ninguém fez check-in no período/.test(await p.textContent('#usuarios-corpo')), 'busca + filtro sem ninguém: mensagem clara', await p.textContent('#usuarios-corpo'));
      await p.fill('#busca', 'zzz'); await p.waitForTimeout(100);
      ok(/Nenhum usuário encontrado/.test(await p.textContent('#usuarios-corpo')), 'busca sem resultado: mensagem de sempre');
      await p.fill('#busca', ''); await p.waitForTimeout(100);
      // CSV com o filtro.
      const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#csv')]);
      const csv = fs.readFileSync(await dl.path(), 'utf8').trim().split('\n');
      ok(csv.length === 3 && csv.some((l) => l.includes('Ana')) && !csv.some((l) => l.includes('Bruno')), 'CSV só com quem aparece', String(csv.length));
      // Lembrada depois de recarregar.
      await p.reload(); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(200);
      ok(await p.locator('#so-checkin').isChecked() && (await nomes(p)).join() === 'Ana,Marcelo', 'continua marcada depois de recarregar');
      await p.locator('label.so-checkin').click(); await p.waitForTimeout(100);
      ok((await nomes(p)).join() === 'Ana,Bruno,Marcelo', 'desmarcar volta todos');
    }
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
