// Foto opcional no check-in: anexar, trocar, remover, falha no envio, só a dona vê (prévia, miniatura, tela cheia), painel sem fotos, exclusões e exportação.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
const fs = require('fs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const txt = async (p, s) => ((await p.locator(s).first().innerText()) || '').replace(/\s+/g, ' ').trim();
const T = new Date('2026-10-27T20:00:00');
// Imagem de teste 2000×1500 gerada em PNG (sem pessoas).
async function imagemTeste(b) {
  const pg = await b.newPage();
  const dados = await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 2000; c.height = 1500; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 2000, 1500); g.addColorStop(0, '#2563eb'); g.addColorStop(1, '#16a34a'); x.fillStyle = g; x.fillRect(0, 0, 2000, 1500); return c.toDataURL('image/png').split(',')[1]; });
  await pg.close();
  const arq = `${H.APOIO}/foto-teste.png`; fs.writeFileSync(arq, Buffer.from(dados, 'base64')); return arq;
}
const abrir = async (b, op = {}) => {
  const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 }, ...op });
  await p.context().route('https://teste.supabase.co/storage/**', (r) => r.fulfill({ contentType: 'image/png', body: fs.readFileSync(`${H.APOIO}/foto-teste.png`) }));
  await p.clock.install({ time: T });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
  return p;
};
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();
  const IMG = await imagemTeste(b);
  for (const scheme of ['light', 'dark']) {
    const p = await abrir(b, { scheme });
    p.reqs = []; p.on('request', (r) => p.reqs.push(r.url()));
    await p.click('#fab-checkin'); await p.waitForTimeout(200);
    ok(await p.locator('#f-foto-bloco [data-foto-escolher]').isVisible() && /Adicionar foto/.test(await txt(p, '#f-foto-bloco')) && /Tire agora ou escolha da galeria/.test(await txt(p, '#f-foto-bloco')), `${scheme}: formulário com "Adicionar foto"`);
    ok((await p.getAttribute('#f-foto-input', 'accept')) === 'image/*' && !(await p.getAttribute('#f-foto-input', 'capture')), `${scheme}: aceita câmera ou galeria`);
    await p.screenshot({ path: `${H.SAIDA}/foto-form-vazio-${scheme}.png` });
    // Sem foto: salva normal
    await p.click('[data-salvar-form]'); await H.gravacoes(p);
    let db = await H.banco(p);
    const semFoto = db.checkins[db.checkins.length - 1];
    ok(semFoto && semFoto.foto === '' && !(db.log || []).some((l) => l.startsWith('storage:upload')), `${scheme}: check-in sem foto salva normal (foto não é obrigatória)`);
    // Com foto
    await p.click('#fab-checkin'); await p.waitForTimeout(200);
    await p.check('input[name="f-tipo"][value="t1"]', { force: true });
    await p.fill('#f-inicio', '07:00');
    await p.setInputFiles('#f-foto-input', IMG); await p.waitForSelector('#f-foto-bloco img');
    ok(await p.locator('#f-foto-bloco .foto-moldura img[src^="blob:"]').count() === 1 && /Só você vê esta foto/.test(await txt(p, '#f-foto-bloco')), `${scheme}: prévia da foto no formulário`);
    await p.screenshot({ path: `${H.SAIDA}/foto-form-anexada-${scheme}.png` });
    await p.click('[data-salvar-form]'); await H.gravacoes(p); await p.waitForTimeout(300); await H.gravacoes(p);
    db = await H.banco(p);
    const c = db.checkins.find((x) => x.foto);
    const caminho = c && c.foto;
    ok(caminho === `u1/${c.id}.jpg` && db.fotos[caminho] && db.fotos[caminho].tipo === 'image/jpeg', `${scheme}: foto enviada em u1/<check-in>.jpg como JPEG`, JSON.stringify(db.fotos));
    ok(db.fotos[caminho].bytes < 400000, `${scheme}: foto reduzida no aparelho`, String(db.fotos[caminho].bytes));
    // Dashboard: só o sinal
    await p.click('.nav [data-tela="dashboard"]'); await p.waitForTimeout(200);
    const linha = p.locator('.ck', { has: p.locator('.ck-tem-foto') });
    ok(await linha.locator('.ck-tem-foto').count() === 1 && (await linha.locator('.ck-tem-foto .sr-only').evaluate((e) => e.getBoundingClientRect().width)) <= 1, `${scheme}: ícone de câmera no check-in com foto (texto só para leitor de tela)`);
    ok(await p.locator('.ck').count() === 2 && await p.locator('.ck .ck-tem-foto').count() === 1, `${scheme}: sem ícone no check-in sem foto`);
    await linha.locator('.ck-head').click(); await p.waitForTimeout(150);
    await p.waitForFunction(() => { const i = document.querySelector('#dia-lista .ck-foto img'); return i && i.complete && i.naturalWidth > 0; });
    ok(await p.locator('#dia-lista .ck-foto img').isVisible(), `${scheme}: dona vê a miniatura no detalhe`);
    await p.click('#dia-lista [data-ver-foto]'); await p.waitForSelector('#foto-ver[open]');
    await p.waitForFunction(() => document.getElementById('foto-ver-img').naturalWidth > 0);
    ok(/Treino 1/.test(await txt(p, '#foto-ver-legenda')), `${scheme}: tela cheia com legenda`, await txt(p, '#foto-ver-legenda'));
    await p.screenshot({ path: `${H.SAIDA}/foto-tela-cheia-${scheme}.png` });
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    ok(!(await p.locator('#foto-ver[open]').count()), `${scheme}: Esc fecha a tela cheia`);
    await p.screenshot({ path: `${H.SAIDA}/foto-dash-${scheme}.png`, fullPage: true });
    // Editar: trocar e remover
    await p.click('.ck-corpo [data-editar]'); await p.waitForTimeout(200);
    await p.waitForFunction(() => { const i = document.querySelector('#f-foto-bloco img'); return i && i.complete && i.naturalWidth > 0; });
    ok(/sign\/fotos-checkin\/u1\//.test(await p.getAttribute('#f-foto-bloco img', 'src')), `${scheme}: editar mostra a foto salva`);
    await p.setInputFiles('#f-foto-input', IMG); await p.waitForSelector('#f-foto-bloco img[src^="blob:"]');
    await p.click('[data-salvar-form]'); await H.gravacoes(p); await p.waitForTimeout(300);
    db = await H.banco(p);
    ok(db.log.filter((l) => l === `storage:upload:fotos-checkin/${caminho}`).length === 2, `${scheme}: trocar reenvia no mesmo caminho`, JSON.stringify(db.log.filter((l) => l.startsWith('storage'))) + ' ' + JSON.stringify(db.eventos.filter((e) => e.tipo === 'checkin_foto')));
    await p.click('.ck-corpo [data-editar]'); await p.waitForTimeout(200);
    await p.click('[data-foto-remover]');
    ok(/Adicionar foto/.test(await txt(p, '#f-foto-bloco')), `${scheme}: remover volta para "Adicionar foto"`);
    await p.click('[data-salvar-form]'); await H.gravacoes(p); await p.waitForTimeout(300); await H.gravacoes(p);
    db = await H.banco(p);
    ok(!db.fotos[caminho] && db.checkins.find((x) => x.id === c.id).foto === '', `${scheme}: remover apaga o arquivo e limpa o check-in`);
    await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await p.waitForTimeout(400);
    const acoes = (await H.banco(p)).eventos.filter((e) => e.tipo === 'checkin_foto').map((e) => e.dados.acao).join(',');
    ok(acoes === 'adicionou,trocou,removeu', `${scheme}: eventos de foto sem a imagem`, acoes);
    ok(p.errs.length === 0, `${scheme}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }
  // Falha no envio: check-in salvo e aviso
  {
    const p = await abrir(b, { extra: { falharFoto: true } });
    await p.click('#fab-checkin'); await p.waitForTimeout(200);
    await p.setInputFiles('#f-foto-input', IMG); await p.waitForSelector('#f-foto-bloco img');
    await p.click('[data-salvar-form]'); await H.gravacoes(p); await p.waitForTimeout(400);
    const db = await H.banco(p);
    ok(db.checkins.length === 1 && db.checkins[0].foto === '' && /foto não foi enviada/.test(await txt(p, '#toast')), 'falha no envio: check-in salvo e aviso', await txt(p, '#toast'));
    await p.context().close();
  }
  // Excluir check-in apaga a foto; baixar meus dados lista; excluir conta apaga
  {
    const ck = { id: 'c1', usuario_id: 'u1', tipo: 'jiu', inicio: '2026-10-27T07:00:00', fim: '2026-10-27T08:00:00', sem_horario: false, obs: '', retroativo: false, series: {}, foto: 'u1/c1.jpg' };
    const ck2 = { ...ck, id: 'c2', inicio: '2026-10-26T07:00:00', fim: '2026-10-26T08:00:00', foto: 'u1/c2.jpg' };
    const p = await abrir(b, { checkins: [ck, ck2], extra: { fotos: { 'u1/c1.jpg': { bytes: 1 }, 'u1/c2.jpg': { bytes: 1 } } } });
    await H.voce(p, 'privacidade');
    const [down] = await Promise.all([p.waitForEvent('download'), p.click('#baixar-dados')]);
    const j = JSON.parse(fs.readFileSync(await down.path(), 'utf8'));
    ok(Array.isArray(j.fotos) && j.fotos.length === 2 && j.fotos.every((f) => /t=86400/.test(f.link_24h)), 'baixar meus dados traz links de 24 h das fotos');
    await p.click('.nav [data-tela="dashboard"]'); await p.waitForTimeout(200);
    await p.locator('.ck-head').first().click(); await p.click('.ck-corpo [data-excluir]'); await p.click('[data-excluir-sim]'); await H.gravacoes(p); await p.waitForTimeout(200);
    let db = await H.banco(p);
    ok(!db.fotos['u1/c1.jpg'] && db.fotos['u1/c2.jpg'], 'excluir check-in apaga só a foto dele');
    await p.click('.nav [data-tela="voce"]'); await p.waitForTimeout(150);
    await p.click('#excluir-conta');
    await p.waitForSelector('#excluir-dialog[open]');
    await p.check('#excluir-entendi'); await p.click('#excluir-sim'); await p.waitForTimeout(600);
    db = await H.banco(p);
    ok(!db.fotos['u1/c2.jpg'], 'excluir a conta apaga as fotos', JSON.stringify(db.fotos));
    await p.context().close();
  }
  // Banco antigo, sem a coluna: nada de foto
  {
    const p = await abrir(b, { extra: { semFotos: true } });
    await p.click('#fab-checkin'); await p.waitForTimeout(200);
    ok(!(await p.locator('#f-foto-bloco').count()), 'sem a coluna no banco: sem o bloco de foto');
    await p.click('[data-salvar-form]'); await H.gravacoes(p);
    const db = await H.banco(p);
    ok(db.checkins.length === 1 && !('foto' in db.checkins[0]), 'sem a coluna: check-in salva sem enviar foto');
    ok(p.errs.length === 0, 'sem a coluna: sem erros', p.errs.join(' | '));
    await p.context().close();
  }
  // Painel: não mostra fotos; excluir usuário apaga a pasta
  {
    const ADM = { ids: ['u1'], usuarios: [{ id: 'u1', nome: 'Marcelo Bauer', email: 'm@x.com', cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: T.toISOString(), acessos: 1, semana: null, dias_jiu: [], sem_peso: [] },
      { id: 'u2', nome: 'Alessandra Machado', email: 'a@x.com', cadastro: '2026-10-01T12:00:00Z', ultimo_acesso: T.toISOString(), acessos: 1, semana: null, dias_jiu: [], sem_peso: [] }],
      checkins: [{ id: 'k9', usuario_id: 'u2', tipo: 'jiu', inicio: '2026-10-26T07:00:00', fim: '2026-10-26T08:00:00' }], eventos: [] };
    const a = await H.novaPagina(b, { extra: { admin: ADM, fotos: { 'u2/k9.jpg': { bytes: 1 } } }, viewport: { width: 1280, height: 900 } });
    a.reqs = []; a.on('request', (r) => a.reqs.push(r.url()));
    await a.clock.install({ time: T });
    await a.goto(ADMIN + '#usuarios'); await a.waitForSelector('#painel:not([hidden])'); await a.waitForTimeout(300);
    ok(!a.reqs.some((u) => /storage/.test(u)) && !(await a.locator('img[src*="fotos-checkin"]').count()), 'painel não carrega nem mostra fotos');
    await a.click('[data-excluir="u2"]'); await a.waitForSelector('#excluir-dialog[open]');
    await a.check('#excluir-entendi'); await a.click('#excluir-sim'); await a.waitForTimeout(500);
    const db = await H.banco(a);
    ok(!db.fotos['u2/k9.jpg'] && db.log.includes('storage:remove:fotos-checkin/u2/k9.jpg'), 'excluir usuário pelo painel apaga as fotos dele');
    await a.context().close();
  }
  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
