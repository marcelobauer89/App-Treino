// Painel: card "Jornadas escolhidas" (última escolha de cada pessoa no período) e nomes na atividade.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-10-28T15:00:00';
const usuario = (id, nome) => ({ id, nome, email: `${id}@x.com`, cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-28T10:00:00', acessos: 5, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true, liberado: true });
const ev = (u, jornada, origem, em) => ({ usuario_id: u, tipo: 'jornada_escolhida', dados: { jornada, origem }, criado_em: em });
const ADM = {
  ids: ['u1'], usuarios: [usuario('u1', 'Marcelo'), usuario('u2', 'Ana'), usuario('u3', 'Bruno'), usuario('u4', 'Caio')],
  checkins: [],
  eventos: [
    ev('u2', 'forca', 'boas-vindas', '2026-10-20T12:00:00Z'), ev('u2', 'hipertrofia', 'trocar', '2026-10-25T12:00:00Z'),
    ev('u3', 'hipertrofia', 'boas-vindas', '2026-10-26T12:00:00Z'), ev('u4', 'mobilidade', 'boas-vindas', '2026-10-27T12:00:00Z'),
    ev('u1', 'jiu', 'boas-vindas', '2026-08-10T12:00:00Z'),
  ],
  emails: [], convites: [],
};
const linhas = (p) => p.locator('#jornadas-lista li').evaluateAll((ls) => ls.map((l) => ({
  nome: l.querySelector('.rt-nome').textContent.trim(), num: l.querySelector('.rt-num').textContent.replace(/\s+/g, ' ').trim(),
  sub: l.querySelector('.rt-sub').textContent.trim(), zerado: l.classList.contains('zerado') })));
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM } });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(300);
    let l = await linhas(p);
    ok(l.map((x) => x.nome).join('|') === 'Hipertrofia|Mobilidade e prevenção|Jiu-jitsu (OSS)|Força e potência', `${tag}: ordem (30 dias, última escolha)`, l.map((x) => x.nome).join('|'));
    ok(l[0].num === '267%' && l[0].sub === '2 pessoas · 1 na troca' && l[1].sub === '1 pessoa' && l[3].zerado && l[3].sub === 'ninguém', `${tag}: números e detalhe`, l.map((x) => `${x.num} ${x.sub}`).join(' / '));
    await p.locator('#jornadas-titulo').scrollIntoViewIfNeeded();
    await p.locator('section[aria-labelledby="jornadas-titulo"]').screenshot({ path: `jornadas-admin-${tag}.png` });
    if (tag === 'light-1280') {
      await p.click('[data-periodo="90"]').catch(() => {}); await p.waitForTimeout(200);
      l = await linhas(p);
      ok(l.find((x) => x.nome === 'Jiu-jitsu (OSS)').sub === '1 pessoa', '90 dias inclui a escolha mais antiga', l.map((x) => x.sub).join(' / '));
    }
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Sem escolhas no período.
  const p = await H.novaPagina(b, { extra: { admin: { ...ADM, eventos: [] } } });
  await p.clock.install({ time: new Date(AGORA) });
  await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(200);
  ok(/Ninguém escolheu/.test(await p.locator('#jornadas-lista').innerText()), 'sem escolhas: mensagem');
  await p.context().close();
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
