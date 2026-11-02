// Eventos não se perdem (rede, sessão, evento recusado, tabela ausente) e perfil sem nome usa o nome do Google.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const esconder = (p) => p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
const abrir = async (b, extra = {}) => {
  const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, extra });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
  return p;
};
const tipos = async (p) => (await H.banco(p)).eventos.map((e) => e.tipo);
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  // 1. Rede caiu e depois sessão vencida: o lote volta para a fila e chega depois, sem duplicar.
  let p = await abrir(b, { eventosErros: ['rede', 'sessao'] });
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(100);
  await esconder(p); await p.waitForTimeout(200);
  let db = await H.banco(p);
  ok(db.log.includes('eventos:falhou:rede') && !db.eventos.length, 'falha de rede: nada gravado ainda');
  await esconder(p); await p.waitForTimeout(200);
  ok((await H.banco(p)).log.includes('eventos:falhou:sessao'), 'sessão vencida: tenta de novo');
  await p.click('[data-tela="voce"]'); await p.waitForTimeout(100);
  await esconder(p); await p.waitForTimeout(300);
  let t = await tipos(p);
  ok(t.includes('sessao') && t.filter((x) => x === 'tela').length >= 2, 'depois que a rede volta, os eventos antigos e novos chegam', t.join(','));
  ok(t.filter((x) => x === 'sessao').length === 1, 'nenhum evento duplicado', t.join(','));
  ok(!p.errs.length, 'sem erros (rede)', p.errs.join(' | '));
  await p.context().close();

  // 2. Evento "online": reenvia sozinho ao voltar a internet.
  p = await abrir(b, { eventosErros: ['rede'] });
  await esconder(p); await p.waitForTimeout(200);
  ok(!(await H.banco(p)).eventos.length, 'offline: fila guardada');
  await p.evaluate(() => window.dispatchEvent(new Event('online'))); await p.waitForTimeout(300);
  ok((await tipos(p)).includes('sessao'), 'ao voltar a internet, a fila é enviada');
  await p.context().close();

  // 3. Um evento recusado pelo banco não derruba os outros.
  p = await abrir(b, { eventoInvalido: 'tela' });
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(100);
  await esconder(p); await p.waitForTimeout(400);
  db = await H.banco(p);
  t = db.eventos.map((e) => e.tipo);
  ok(db.log.includes('eventos:recusado') && t.includes('sessao') && !t.includes('tela'), 'evento recusado é descartado e os outros são gravados', t.join(','));
  await p.click('[data-tela="voce"]'); await p.waitForTimeout(100);
  await H.banco(p).then(() => p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.eventoInvalido = null; localStorage.setItem('mock-supabase', JSON.stringify(d)); }));
  await esconder(p); await p.waitForTimeout(300);
  ok((await tipos(p)).includes('tela'), 'o envio continua ligado depois de um recusado');
  ok(!p.errs.length, 'sem erros (recusado)', p.errs.join(' | '));
  await p.context().close();

  // 4. Sem a tabela: para de enviar, sem erro.
  p = await abrir(b, { eventosErros: ['tabela'] });
  await esconder(p); await p.waitForTimeout(200);
  await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(100);
  await esconder(p); await p.waitForTimeout(200);
  db = await H.banco(p);
  ok(db.log.filter((l) => l === 'insert:eventos').length === 1 && !p.errs.length, 'sem a tabela, desliga o envio nesta sessão', String(db.log.filter((l) => l === 'insert:eventos').length));
  await p.context().close();

  // 5. Erro com mensagem enorme: cabe no banco (o registro de erro encurta; nada é recusado).
  p = await abrir(b);
  await p.evaluate(() => setTimeout(() => { throw new Error('x'.repeat(5000) + ' ção'); }));
  await p.waitForTimeout(100); await esconder(p); await p.waitForTimeout(300);
  db = await H.banco(p);
  const erro = db.eventos.find((e) => e.tipo === 'erro');
  ok(erro && new TextEncoder().encode(JSON.stringify(erro.dados)).length <= 2000 && !db.log.includes('eventos:recusado'), 'evento grande cabe no limite do banco');
  await p.context().close();

  // 6. Perfil sem nome: usa o nome do Google; apagar o nome em Você não grava vazio.
  p = await abrir(b, { perfis: [{ id: 'u1', nome: '', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4] }] });
  await p.waitForTimeout(300);
  ok((await H.banco(p)).perfis[0].nome === 'Marcelo Bauer', 'perfil vazio recebe o nome do Google', (await H.banco(p)).perfis[0].nome);
  await H.voce(p, 'dados');
  await p.fill('#p-nome', ''); await p.waitForTimeout(1200); await p.locator('#p-nome').blur(); await p.waitForTimeout(400);
  ok((await H.banco(p)).perfis[0].nome === 'Marcelo Bauer' && (await p.inputValue('#p-nome')) === 'Marcelo Bauer', 'nome em branco não é salvo e o campo volta', `${(await H.banco(p)).perfis[0].nome} / ${await p.inputValue('#p-nome')}`);
  await p.fill('#p-nome', 'Marcelo B.'); await p.locator('#p-nome').blur(); await p.waitForTimeout(400);
  ok((await H.banco(p)).perfis[0].nome === 'Marcelo B.', 'nome novo continua sendo salvo');
  ok(!p.errs.length, 'sem erros (nome)', p.errs.join(' | '));
  await p.context().close();

  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
