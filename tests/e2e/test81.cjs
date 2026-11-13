// App com mais de 1.000 check-ins e registros de peso: busca em páginas e não perde os mais novos (o Supabase devolve 1.000 por vez).
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-11-12T20:00:00';
const PERFIL = { id: 'u1', nome: 'Pessoa Teste', email: 'pessoa@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4] };
const dia = (n) => new Date(Date.parse('2026-11-12T12:00:00Z') - n * 86400000).toISOString().slice(0, 10);
// 1.200 check-ins, um por dia, do mais antigo até hoje; e 1.100 registros de peso.
const checkins = Array.from({ length: 1200 }, (_, i) => ({ id: `c${String(i).padStart(4, '0')}`, usuario_id: 'u1', tipo: 'jiu', inicio: `${dia(1199 - i)}T07:00:00`, fim: `${dia(1199 - i)}T08:00:00`, sem_horario: false, obs: '', retroativo: false, series: {} }));
const cargas = Array.from({ length: 1100 }, (_, i) => ({ usuario_id: 'u1', data: dia(1099 - i), treino: 't1', series: {} }));
const total = async (p) => (await p.locator('#numeros').innerText()).replace(/\s+/g, ' ');

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, checkins, extra: { perfis: [PERFIL], cargas, maxLinhas: 1000 } });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(250);
    const db = await H.banco(p);
    const pc = db.log.filter((l) => l.startsWith('range:checkins:'));
    ok(pc.join(',') === 'range:checkins:0-999,range:checkins:1000-1999', `${scheme}: check-ins buscados em 2 páginas`, pc.join(','));
    const pk = db.log.filter((l) => l.startsWith('range:cargas:'));
    ok(pk.join(',') === 'range:cargas:0-999,range:cargas:1000-1999', `${scheme}: pesos buscados em 2 páginas`, pk.join(','));
    await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(250);
    // Os 1.000 primeiros são os mais antigos: sem as páginas, novembro (os mais novos) ficaria vazio.
    ok(/Check-ins em novembro 12\b/.test(await total(p)), `${scheme}: Dashboard mostra os check-ins mais novos (novembro)`, await total(p));
    ok(/Semanas seguidas no plano 171 semanas/.test(await total(p)), `${scheme}: sequência conta o histórico inteiro`, await total(p));
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Poucos dados: uma página só, como antes.
  const p = await H.novaPagina(b, { checkins: checkins.slice(-5), extra: { perfis: [PERFIL], cargas: cargas.slice(-5) } });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(200);
  const log = (await H.banco(p)).log;
  ok(log.filter((l) => l.startsWith('range:checkins:')).length === 1 && log.filter((l) => l.startsWith('range:cargas:')).length === 1, 'poucos dados: uma página só');
  await p.context().close();
  await b.close(); srv.close();
  process.exit(fails ? 1 : 0);
})();
