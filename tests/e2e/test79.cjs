// Atualização automática: ao voltar para o app (no máximo a cada 2 min), se o versao.json publicado mudou, o app
// recarrega sozinho quando é seguro (sem janela aberta, sem campo em edição) e registra "app_atualizado".
// Com uma janela aberta, espera fechar. Sem o versao.json (404), nada acontece.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const ck = (id, tipo, dia) => ({ id, usuario_id: 'u1', tipo, inicio: `${dia}T07:00:00`, fim: `${dia}T08:00:00`, sem_horario: false, obs: '', retroativo: false, series: {} });

async function abrir(b, versao) {
  const p = await H.novaPagina(b, { checkins: [ck('a', 't1', '2026-11-02')] });
  p.versao = versao; // null = sem o arquivo (404)
  await p.route(/\/versao\.json/, (r) => (p.versao ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ versao: p.versao }) }) : r.fulfill({ status: 404, body: '' })));
  await p.clock.install({ time: new Date('2026-11-12T10:00:00') });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__mesmaPagina = true; });
  return p;
}
// Sai e volta para o app depois de 3 minutos.
async function sairEVoltar(p) {
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.clock.runFor(180000);
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(600);
}
const recarregou = async (p) => !(await p.evaluate(() => window.__mesmaPagina === true).catch(() => false));

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  // Mesma versão: não recarrega.
  {
    const p = await abrir(b, 'aaaaaaa1111');
    await sairEVoltar(p);
    ok(!(await recarregou(p)), 'mesma versão: não recarrega');
    ok(!p.errs.length, 'mesma versão: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // Versão nova publicada: ao voltar, recarrega e registra o evento.
  {
    const p = await abrir(b, 'aaaaaaa1111');
    p.versao = 'bbbbbbb2222';
    await sairEVoltar(p);
    await p.waitForFunction(() => window.__mesmaPagina !== true, null, { timeout: 5000 }).catch(() => {});
    await H.prontos(p).catch(() => {});
    ok(await recarregou(p), 'versão nova: recarrega sozinho ao voltar');
    const db = await H.banco(p);
    const ev = (db.eventos || []).find((e) => e.tipo === 'app_atualizado');
    ok(ev && ev.dados.de === 'aaaaaaa' && ev.dados.para === 'bbbbbbb', 'evento app_atualizado (de → para)', JSON.stringify(ev && ev.dados));
    ok(!p.errs.length, 'versão nova: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  // Com uma janela aberta: espera fechar e então recarrega.
  {
    const p = await abrir(b, 'aaaaaaa1111');
    await p.click('[data-tela="voce"]'); await p.waitForTimeout(100);
    await p.evaluate(() => { const d = document.querySelector('dialog.modal'); d.showModal(); window.__janela = d.id; });
    p.versao = 'ccccccc3333';
    await sairEVoltar(p);
    ok(!(await recarregou(p)), 'janela aberta: não recarrega no meio');
    await p.evaluate(() => document.getElementById(window.__janela).close());
    await p.waitForFunction(() => window.__mesmaPagina !== true, null, { timeout: 5000 }).catch(() => {});
    ok(await recarregou(p), 'ao fechar a janela, recarrega');
    await p.context().close();
  }

  // Sem o versao.json (ambiente local): nada acontece.
  {
    const p = await abrir(b, null);
    await sairEVoltar(p);
    ok(!(await recarregou(p)), 'sem versao.json: não recarrega');
    ok(!p.errs.filter((e) => !/404|Failed to load resource/.test(e)).length, 'sem versao.json: sem erros', p.errs.join(' | '));
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
