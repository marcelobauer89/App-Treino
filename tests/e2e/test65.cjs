// Vídeos dos exercícios liberados por usuário: o app só recebe os vídeos de quem está liberado; o admin liga e desliga.
const { chromium } = require('playwright');
const fs = require('fs');
const H = require('../apoio/harness.cjs');
const ADMIN = H.PAGINA.replace('index.html', 'admin.html');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const PERFIL = (liberado) => ({ id: 'u1', nome: 'Ana', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], videos_liberados: liberado });
const abrir = (b, extra, op = {}) => H.novaPagina(b, { viewport: { width: 390, height: 844 }, ...op, extra })
  .then(async (p) => { await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300); return p; });
const usuario = (id, nome, videos) => ({ id, nome, email: `${id}@x.com`, cadastro: '2026-08-01T12:00:00Z', ultimo_acesso: '2026-10-28T10:00:00', acessos: 5, semana: null, dias_jiu: [2, 4], sem_peso: [], emails_resumo: true, liberado: true, videos_liberados: videos });

(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  // O app não traz mais a lista de vídeos no código nem no repositório.
  const html = H.fonte();
  const ids = JSON.parse(fs.readFileSync(`${H.APOIO}/videos-exemplo.json`, 'utf8')).videos;
  const vazados = Object.values(ids).filter((id) => html.includes(id));
  ok(!vazados.length && /const VIDEOS = \{\};/.test(html), 'nenhum id de vídeo no index.html', vazados.join(','));
  ok(!fs.existsSync(H.RAIZ + '/docs/videos-exercicios.json'), 'lista de vídeos fora do repositório');

  // 1. Não liberado: sem vídeos e sem chamar nada além do meus_videos.
  let p = await abrir(b, { perfis: [PERFIL(false)] });
  ok((await p.locator('.ex-video').count()) === 0, 'não liberado: exercícios sem vídeo');
  ok(!p.errs.length, 'não liberado: sem erros', p.errs.join(' | '));
  await p.context().close();

  // 2. Liberado: vê os vídeos da execução.
  p = await abrir(b, { perfis: [PERFIL(true)] });
  const n = await p.locator('.ex-video').count();
  ok(n > 0, 'liberado: exercícios com vídeo', String(n));
  ok(/i\.ytimg\.com\/vi\/[\w-]{11}\//.test(await p.locator('.ex-video img').first().getAttribute('src')), 'liberado: miniatura do vídeo');
  ok(!p.errs.length, 'liberado: sem erros', p.errs.join(' | '));
  await p.context().close();

  // 3. Banco sem a função meus_videos (schema antigo): app abre normal, sem vídeos.
  p = await abrir(b, { perfis: [PERFIL(true)], semFuncaoVideos: true });
  ok((await p.locator('.ex-video').count()) === 0 && (await p.locator('.treino-btn').count()) === 3 && !p.errs.length, 'sem a função: app normal, sem vídeos', p.errs.join(' | '));
  await p.context().close();

  // 4. Admin: libera e tira os vídeos de um usuário pela ficha; a tabela mostra a etiqueta "Vídeos".
  for (const scheme of ['light', 'dark']) for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const tag = `${scheme}-${viewport.width}`;
    const ADM = { ids: ['u1'], usuarios: [usuario('u1', 'Marcelo', false), usuario('u2', 'Ana', false), usuario('u3', 'Bruno', true)], checkins: [], eventos: [], emails: [], convites: [] };
    p = await H.novaPagina(b, { scheme, viewport, extra: { admin: ADM } });
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(200);
    await p.click('#tab-usuarios').catch(() => {});
    await p.waitForTimeout(150);
    ok((await p.locator('[data-usuario="u3"] .tag-videos').count()) === 1 && (await p.locator('[data-usuario="u2"] .tag-videos').count()) === 0, `${tag}: etiqueta Vídeos só em quem está liberado`);
    await p.click('[data-abrir="u2"]'); await p.waitForTimeout(200);
    ok(/Não liberados/.test(await p.locator('#det-videos-t + .det-acesso').innerText()), `${tag}: ficha mostra "Não liberados"`);
    await p.locator('#det-videos-t').scrollIntoViewIfNeeded();
    await p.locator('section[aria-labelledby="det-videos-t"]').screenshot({ path: `videos-admin-${tag}.png` });
    await p.click('[data-liberar-videos="sim"]'); await p.waitForTimeout(400);
    let db = await H.banco(p);
    ok(db.admin.usuarios.find((u) => u.id === 'u2').videos_liberados === true && db.log.some((l) => l.startsWith('admin_liberar_videos:{"alvo":"u2","liberar":true')), `${tag}: Liberar vídeos chama a função`);
    ok(/Liberados/.test(await p.locator('#det-videos-t + .det-acesso').innerText()) && await p.locator('[data-liberar-videos="nao"]').isVisible(), `${tag}: ficha atualiza para Liberados`);
    ok(/Vídeos liberados para Ana/.test(await p.locator('#toast, .toast').first().innerText().catch(() => '')), `${tag}: aviso de confirmação`);
    await p.click('[data-liberar-videos="nao"]'); await p.waitForTimeout(400);
    db = await H.banco(p);
    ok(db.admin.usuarios.find((u) => u.id === 'u2').videos_liberados === false, `${tag}: Tirar vídeos desliga`);
    ok(!p.errs.length, `${tag}: sem erros`, p.errs.join(' | '));
    await p.context().close();
  }

  // 5. Erro ao liberar (usuário sumiu): mensagem na ficha e o botão volta.
  const ADM2 = { ids: ['u1'], usuarios: [usuario('u1', 'Marcelo', false), usuario('u2', 'Ana', false)], checkins: [], eventos: [], emails: [], convites: [] };
  p = await H.novaPagina(b, { extra: { admin: ADM2 } });
  await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(200);
  await p.click('#tab-usuarios').catch(() => {});
  await p.click('[data-abrir="u2"]'); await p.waitForTimeout(150);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('mock-supabase')); d.admin.usuarios = d.admin.usuarios.filter((u) => u.id !== 'u2'); localStorage.setItem('mock-supabase', JSON.stringify(d)); });
  await p.click('[data-liberar-videos="sim"]'); await p.waitForTimeout(300);
  ok(/não encontrado/.test(await p.locator('#det-videos-erro').innerText()) && await p.locator('[data-liberar-videos="sim"]').isEnabled(), 'erro aparece na ficha e o botão volta');
  await p.context().close();

  // 6. Usuário sem a coluna (admin_usuarios antigo): a seção não aparece.
  const velho = usuario('u2', 'Ana', false); delete velho.videos_liberados;
  p = await H.novaPagina(b, { extra: { admin: { ...ADM2, usuarios: [usuario('u1', 'Marcelo', false), velho] } } });
  await p.goto(ADMIN); await p.waitForSelector('#painel:not([hidden])'); await p.waitForTimeout(200);
  await p.click('#tab-usuarios').catch(() => {});
  await p.click('[data-abrir="u2"]'); await p.waitForTimeout(150);
  ok(!(await p.locator('#det-videos-t').count()), 'sem a coluna: seção de vídeos não aparece');
  await p.context().close();

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
