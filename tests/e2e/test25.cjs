// Você: sem botão "Salvar dados"; nome e foto salvos sozinhos.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const nomeNoBanco = async (p) => (await H.banco(p)).perfis[0].nome;
(async () => {
  const srv = await H.servidor();
  const b = await chromium.launch();
  const p = await H.novaPagina(b);
  await p.goto(H.PAGINA + '#voce/dados'); await H.prontos(p);
  ok(await p.locator('#form-perfil button[type="submit"], #form-perfil .btn').count() === 0 && !(await txt(p, '#form-perfil')).includes('Salvar dados'), 'no save button');
  ok(!(await txt(p, '#form-perfil')).includes('automaticamente') && await p.locator('#nome-status').count() === 0, 'no auto-save note, no inline status');
  // pausa na digitação salva sem toast
  await p.fill('#p-nome', 'Bauer');
  await p.waitForTimeout(1300);
  ok(await nomeNoBanco(p) === 'Bauer' && await p.isHidden('#toast'), 'saved after typing pause, no message', await nomeNoBanco(p));
  ok((await txt(p, '#voce-avatar')) === 'B', 'avatar initials follow the name');
  // sair do campo: toast uma vez
  await p.fill('#p-nome', 'Bau');
  await p.click('#p-email'); await H.gravacoes(p);
  ok(await nomeNoBanco(p) === 'Bau' && await p.isHidden('#toast'), 'blur saves, no toast');
  // Enter salva e sai do campo
  await p.fill('#p-nome', 'Marcelo');
  await p.press('#p-nome', 'Enter'); await H.gravacoes(p);
  ok(await nomeNoBanco(p) === 'Marcelo' && !(await p.evaluate(() => document.activeElement.id === 'p-nome')), 'Enter saves and leaves field');
  // foco e saída sem mudança: sem toast nem gravação extra
  await p.waitForTimeout(2700);
  await p.evaluate(() => { document.getElementById('toast').hidden = true; });
  const antes = (await H.banco(p)).log.filter((l) => l === 'update:perfis').length;
  await p.click('#p-nome'); await p.click('#p-email'); await H.gravacoes(p);
  const depois = (await H.banco(p)).log.filter((l) => l === 'update:perfis').length;
  ok(await p.isHidden('#toast') && antes === depois, 'no change: no write');
  // trocar de tela com digitação pendente salva no pagehide/sair? -> sair da conta
  await p.fill('#p-nome', 'Marcelo Bauer');
  await p.click('[data-voltar]'); await p.waitForTimeout(100);
  await p.click('#sair'); // um toque só: nada pode cobrir o botão
  await p.waitForSelector('#entrar-google:not([hidden])'); await p.waitForTimeout(200);
  ok(await nomeNoBanco(p) === 'Marcelo Bauer', 'pending name saved when signing out');
  ok(!p.errs.length, 'no errors', p.errs.join());
  await p.context().close();
  // foto: salva sozinha ao escolher e ao remover
  const q = await H.novaPagina(b);
  await q.goto(H.PAGINA + '#voce/dados'); await H.prontos(q);
  const png = await q.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#2563eb'; x.fillRect(0, 0, 200, 200); return c.toDataURL('image/png').split(',')[1]; });
  await q.setInputFiles('#p-foto', { name: 'eu.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await q.waitForSelector('#voce-avatar img'); await H.gravacoes(q);
  ok((await H.banco(q)).perfis[0].foto.startsWith('data:image/jpeg') && (await txt(q, '#toast')) === 'Foto salva com sucesso.', 'first photo: "Foto salva com sucesso."', await txt(q, '#toast'));
  await q.evaluate(() => { document.getElementById('toast').hidden = true; });
  await q.setInputFiles('#p-foto', { name: 'eu2.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await q.waitForFunction(() => !document.getElementById('toast').hidden); await H.gravacoes(q);
  ok((await txt(q, '#toast')) === 'Foto alterada com sucesso.', 'replacing photo: "Foto alterada com sucesso."', await txt(q, '#toast'));
  await q.screenshot({ path: 'voce-foto-toast.png' });
  await q.click('#remover-foto'); await H.gravacoes(q);
  ok((await H.banco(q)).perfis[0].foto === '' && (await txt(q, '#toast')) === 'Foto removida.', 'photo removal saved automatically');
  await q.evaluate(() => document.fonts.ready);
  await q.screenshot({ path: 'voce-sem-botao.png', clip: { x: 0, y: 0, width: 375, height: 640 } });
  await b.close(); srv.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
