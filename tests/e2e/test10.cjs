const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  // Conta que já tem dados de outro aparelho + dados locais antigos neste aparelho
  const remoto = [{ id: 'r1', usuario_id: 'u1', tipo: 'jiu', inicio: '2026-10-20T19:00:00', fim: '2026-10-20T20:00:00', sem_horario: false, recuperacao: 5, obs: 'remoto', retroativo: false, ultima_serie: null, series: {} }];
  const local = { 'bauer-checkins-v1': JSON.stringify([{ id: 'l1', tipo: 't1', inicio: '2026-10-14T10:00', fim: '2026-10-14T11:00', series: {} }]), 'bauer-config-v1': JSON.stringify({ tema: 'escuro', diasJiu: [5] }) };
  const p = await H.novaPagina(b, { checkins: remoto, local });
  await p.clock.install({ time: new Date('2026-10-21T10:00:00') });
  await p.goto(H.PAGINA);
  await H.prontos(p);
  const db = await H.banco(p);
  console.log(db.checkins.length === 1 && db.perfis[0].tema === 'auto' && db.perfis[0].dias_jiu.join() === '2,4' ? 'PASS second device keeps account data' : 'FAIL ' + JSON.stringify(db.perfis[0]) + ' ' + db.checkins.length);
  console.log('errors:', p.errs);
  await b.close(); srv.close();
})();
