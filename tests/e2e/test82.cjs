// Painel busca só os eventos do período (e do anterior, mínimo 35 dias); período mais longo busca de novo; "Tudo" busca o histórico inteiro.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const AGORA = '2026-11-12T15:00:00';
const usuario = (id, nome) => ({ id, nome, email: `${id}@exemplo.com`, cadastro: '2026-03-01T12:00:00Z', ultimo_acesso: '2026-11-12T10:00:00', acessos: 5, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true, liberado: true, videos_liberados: false });
const recorde = (id, iso) => ({ usuario_id: id, tipo: 'recorde', dados: { exercicio: 'Supino reto' }, criado_em: iso });
// Um recorde há 150 dias (só entra em "Tudo") e um há 3 dias.
const eventos = [recorde('u2', '2026-06-15T13:00:00.000Z'), recorde('u1', '2026-11-09T13:00:00.000Z')];
const ADM = { ids: ['u1'], usuarios: [usuario('u1', 'Pessoa Um'), usuario('u2', 'Pessoa Dois')], checkins: [], eventos, emails: [], convites: [] };
const buscas = async (p) => (await H.banco(p)).log.filter((l) => l.startsWith('range:admin_eventos:0') || l.startsWith('admin_eventos:desde:'));
const recordes = async (p) => { const t = (await p.locator('#kpis .kpi').allInnerTexts()).find((k) => /^Recordes/.test(k.trim())) || ''; return (t.match(/Recordes\s+(\d+)/) || [])[1]; };

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const p = await H.novaPagina(b, { scheme, viewport: { width: 1280, height: 900 }, extra: { admin: ADM } });
    await p.clock.install({ time: new Date(AGORA) });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])', { timeout: 20000 }); await p.waitForTimeout(300);
    let log = await buscas(p);
    // 30 dias: busca os últimos 60 (30 + 30 anteriores), não o histórico inteiro.
    const desde = (log.find((l) => l.startsWith('admin_eventos:desde:')) || '').slice('admin_eventos:desde:'.length);
    const dias = Math.round((Date.parse('2026-11-12T00:00:00') - Date.parse(desde)) / 864e5);
    ok(log.length === 2 && dias === 60, `${scheme}: abre buscando só os últimos 60 dias de eventos`, `${log.join(',')} (${dias} dias)`);
    ok(await recordes(p) === '1', `${scheme}: 30 dias conta só o recorde recente`, await recordes(p));
    // 7 dias cabe no que já veio: não busca de novo.
    await p.click('[data-periodo="7"]'); await p.waitForTimeout(300);
    ok((await buscas(p)).length === 2, `${scheme}: 7 dias não busca de novo`);
    // 90 dias precisa de 180: busca de novo.
    await p.click('[data-periodo="90"]'); await p.waitForTimeout(400);
    log = await buscas(p);
    ok(log.length === 4 && log.filter((l) => l.startsWith('admin_eventos:desde:')).length === 2, `${scheme}: 90 dias busca de novo`, log.join(','));
    // Tudo: o histórico inteiro, sem "desde", e o recorde antigo entra.
    await p.click('[data-periodo="tudo"]'); await p.waitForTimeout(400);
    log = await buscas(p);
    ok(log.length === 5 && log[4].startsWith('range:admin_eventos:0'), `${scheme}: Tudo busca o histórico inteiro`, log.join(','));
    ok(await recordes(p) === '2', `${scheme}: Tudo conta o recorde antigo`, await recordes(p));
    // Voltar para 30 dias não busca de novo (já tem tudo).
    await p.click('[data-periodo="30"]'); await p.waitForTimeout(300);
    ok((await buscas(p)).length === 5 && await recordes(p) === '1', `${scheme}: voltar para 30 dias usa o que já veio`);
    ok(!p.errs.length, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  await b.close(); srv.close();
  process.exit(fails ? 1 : 0);
})();
