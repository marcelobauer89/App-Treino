// Atividade recente: 7 por vez e agrupada por dia (detalhe do usuário no admin.html).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const ev = (u, tipo, quando, dados = {}) => ({ usuario_id: u, tipo, dados, criado_em: quando });
// 18 atividades de u1: 6 hoje (23/10), 7 ontem, 5 em 19/10. Mais 3 de u2.
const eventos = [];
for (let i = 0; i < 6; i += 1) eventos.push(ev('u1', 'sessao', `2026-10-23T${String(14 - i).padStart(2, '0')}:00:00`, { navegador: 'Safari', sistema: 'iOS' }));
for (let i = 0; i < 7; i += 1) eventos.push(ev('u1', 'video', `2026-10-22T${String(20 - i).padStart(2, '0')}:10:00`, { exercicio: `Ex ${i}` }));
for (let i = 0; i < 4; i += 1) eventos.push(ev('u1', 'semana_alterada', `2026-10-19T${String(18 - i).padStart(2, '0')}:00:00`));
for (let i = 0; i < 3; i += 1) eventos.push(ev('u2', 'sessao', `2026-10-23T0${8 + i}:00:00`, {}));
const ADM = {
  ids: ['u1'],
  usuarios: [
    { id: 'u1', nome: 'Marcelo Bauer', email: 'm@x.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-23T14:00:00', acessos: 40, semana: null, dias_jiu: [2, 4], sem_peso: [] },
    { id: 'u2', nome: 'Ana Souza', email: 'a@x.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: '2026-10-23T10:00:00', acessos: 3, semana: null, dias_jiu: [2, 4], sem_peso: [] },
    { id: 'u3', nome: 'Bruno Lima', email: 'b@x.com', cadastro: '2026-09-01T12:00:00Z', ultimo_acesso: null, acessos: 0, semana: null, dias_jiu: [], sem_peso: [] },
  ],
  checkins: [{ id: 'c1', usuario_id: 'u1', tipo: 'jiu', inicio: '2026-10-19T06:30:00', fim: null, sem_horario: false, recuperacao: null, retroativo: false }],
  eventos,
};
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 375, height: 760 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM } });
    await p.clock.install({ time: new Date('2026-10-23T15:00:00') });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])');
    const abrir = async (nome) => { if (await p.locator('#aba-usuarios').isHidden()) await p.click('#tab-usuarios'); await p.locator('#usuarios-corpo tr', { hasText: nome }).click(); await p.waitForSelector('#detalhe[open]'); };
    await abrir('Marcelo');
    const li = p.locator('#det-atividade li');
    let dias = await p.locator('#det-atividade .atv-dia').allInnerTexts();
    ok(await li.count() === 7 && dias.map((d) => d.toLowerCase()).join('|') === 'hoje|ontem', `${tag}: 7 itens, Hoje e Ontem`, `${await li.count()} ${dias.join('|')}`);
    ok((await li.first().locator('time').innerText()) === '14:00' && (await li.first().locator('time').getAttribute('datetime')).startsWith('2026-10-23'), `${tag}: só a hora, data no datetime`);
    ok((await txt(p, '[data-mais-atividade]')) === 'Mostrar mais (11)', `${tag}: botão com o que falta`, await txt(p, '[data-mais-atividade]'));
    await p.waitForTimeout(400);
    await p.locator('#det-tempo').scrollIntoViewIfNeeded(); await p.locator('#det-tempo').evaluate((e) => e.parentElement.scrollIntoView({ block: 'start' })); await p.locator('#det-tempo').locator('xpath=..').screenshot({ path: `atv-${tag}-7.png` });
    await p.click('[data-mais-atividade]');
    dias = await p.locator('#det-atividade .atv-dia').allInnerTexts();
    ok(await li.count() === 14 && dias.length === 3 && new Set(dias).size === 3, `${tag}: 14 itens, sem repetir título de dia`, `${await li.count()} ${dias.join('|')}`);
    ok(await p.evaluate(() => document.activeElement && document.activeElement.dataset.i) === '7', `${tag}: foco no primeiro item novo`);
    ok((await txt(p, '[data-mais-atividade]')) === 'Mostrar mais (4)', `${tag}: faltam 4`);
    await p.click('[data-mais-atividade]');
    dias = await p.locator('#det-atividade .atv-dia').allInnerTexts();
    ok(await li.count() === 18 && dias.length === 3 && dias[2].toLowerCase() === 'seg, 19 de out' && await p.locator('[data-mais-atividade]').count() === 0, `${tag}: tudo, terceiro dia, sem botão`, `${await li.count()} ${dias.join('|')}`);
    ok((await txt(p, '#det-atividade')).includes('Check-in de Jiu-jitsu'), `${tag}: check-in aparece na lista`);
    await p.locator('#det-tempo').locator('xpath=..').screenshot({ path: `atv-${tag}-tudo.png` });
    await p.click('[data-fechar]');
    await abrir('Marcelo');
    ok(await li.count() === 7, `${tag}: reabrir volta a 7`);
    await p.click('[data-fechar]');
    await abrir('Ana');
    ok(await li.count() === 3 && await p.locator('[data-mais-atividade]').count() === 0, `${tag}: 3 itens, sem botão`);
    await p.click('[data-fechar]');
    await abrir('Bruno');
    ok((await txt(p, '#det-atividade')) === 'Nenhuma atividade registrada.', `${tag}: sem atividades`);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(sw <= 0 && p.errs.length === 0, `${tag}: sem rolagem e sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
