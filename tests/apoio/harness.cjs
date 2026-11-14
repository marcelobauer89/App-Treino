// Monta páginas de teste: servidor local, fonte local e Supabase falso no lugar da biblioteca (js/vendor/).
const fs = require('fs'), path = require('path'), http = require('http');
const F = path.join(__dirname, 'fontes');
// Raiz do repositório e pastas dos testes. Cada execução pode usar outra porta (PORTA_TESTE), para rodar várias ao mesmo tempo.
const RAIZ = path.resolve(__dirname, '..', '..');
const APOIO = __dirname;
const SAIDA = path.join(__dirname, '..', 'saida');
fs.mkdirSync(SAIDA, { recursive: true });
const PORTA = Number(process.env.PORTA_TESTE) || 8765;
const PAGINA = `http://localhost:${PORTA}/index.html`;
const CDN = /\/js\/vendor\/supabase-[\d.]+\.js$/;
const MOCK = fs.readFileSync(path.join(__dirname, 'mock-supabase.js'), 'utf8');

function servidor() {
  const s = http.createServer((req, res) => {
    const arq = path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404); return res.end(); }
    const tipos = { html: 'text/html; charset=utf-8', js: 'application/javascript', png: 'image/png', webmanifest: 'application/manifest+json', css: 'text/css; charset=utf-8', woff2: 'font/woff2' };
    res.writeHead(200, { 'content-type': tipos[arq.split('.').pop()] || 'text/plain' });
    fs.createReadStream(arq).pipe(res);
  });
  return new Promise((ok) => s.listen(PORTA, () => ok(s)));
}

// novidade_oculta: os testes antigos usam uma conta que já escondeu o aviso dos treinos personalizados.
const PERFIL = { id: 'u1', nome: 'Marcelo Bauer', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], novidade_oculta: '2026-10-01T00:00:00Z' };
const SESSAO = { user: { id: 'u1', email: 'marcelo@exemplo.com', user_metadata: { full_name: 'Marcelo Bauer' } } };

// opcoes: { scheme, logado (padrão true), local: {chave: valor}, configurar (padrão true), celebracao (padrão false) }
async function novaPagina(b, opcoes = {}) {
  const { scheme = 'light', logado = true, local = {}, configurar = true, checkins = [], extra = {}, viewport = { width: 375, height: 760 }, userAgent } = opcoes;
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 2, colorScheme: scheme, ...(userAgent ? { userAgent } : {}) });
  await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(F, 'archivo.css'), 'utf8') }));
  await ctx.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(path.join(F, path.basename(new URL(r.request().url()).pathname))) }));
  await ctx.route(CDN, (r) => r.fulfill({ contentType: 'application/javascript', body: MOCK }));
  // YouTube fica bloqueado aqui: miniatura e player falsos.
  await ctx.route('https://i.ytimg.com/**', (r) => r.fulfill({ contentType: 'image/jpeg', body: fs.readFileSync(path.join(__dirname, 'thumb.jpg')) }));
  await ctx.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ contentType: 'text/html', body: `<body style="margin:0;background:#c0392b;color:#fff;font:20px sans-serif;display:grid;place-items:center;height:100vh">PLAYER ${new URL(r.request().url()).pathname.split('/').pop()}</body>` }));
  // ambiente.js: os testes rodam em localhost (que seria o dev); aqui vira produção apontando para o banco falso.
  await ctx.route(new RegExp(`^http://localhost:${PORTA}/ambiente\\.js`), async (r) => {
    const resp = await r.fetch();
    const destino = configurar ? "'https://teste.supabase.co'" : "'https://SEU-PROJETO.supabase.co'";
    const js = (await resp.text()).replace(/var dev = [^;]+;/, `var dev = ${opcoes.dev ? 'true' : 'false'};`)
      .replace("'https://mlovfgbndtpeczgnvivi.supabase.co'", destino).replace(/(desenvolvimento: \{\s*url: )'[^']*'/, (_, x) => x + (opcoes.dev ? destino : "'https://projeto-dev.supabase.co'"));
    r.fulfill({ response: resp, body: js });
  });
  await ctx.route(new RegExp(`^http://localhost:${PORTA}/(index|admin)\\.html`), async (r) => {
    const resp = await r.fetch();
    const destino = configurar ? "'https://teste.supabase.co'" : "'https://SEU-PROJETO.supabase.co'";
    const html = (await resp.text()).replace("'https://mlovfgbndtpeczgnvivi.supabase.co'", destino);
    r.fulfill({ response: resp, body: html });
  });
  // versao.json (publicado pelo GitHub Pages): vazio nos testes = atualização automática desligada (test79 testa).
  await ctx.route(new RegExp(`^http://localhost:${PORTA}/versao\\.json`), (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
  // Função do resumo: chave pública das notificações (vazia = não configuradas).
  await ctx.route('https://teste.supabase.co/functions/v1/**', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ chave: opcoes.vapid || null }) }));
  // Vídeos vêm do banco (meus_videos) para perfis com videos_liberados. Os testes antigos usam a lista guardada
  // e entram liberados; semVideos: true testa sem vídeos.
  const VIDEOS_GUARDADOS = Object.entries(JSON.parse(fs.readFileSync(path.join(__dirname, 'videos-exemplo.json'), 'utf8')).videos)
    .map(([exercicio, video_id]) => ({ exercicio, video_id }));
  const db = { sessao: logado ? SESSAO : null, perfis: logado ? [PERFIL] : [], checkins, falhar: false, log: [], videos: VIDEOS_GUARDADOS, ...extra };
  db.perfis = (db.perfis || []).map((x) => ('videos_liberados' in x ? x : { ...x, videos_liberados: !opcoes.semVideos }));
  // Perfis sem o campo (testes antigos) já vêm com o aviso escondido; para testá-lo, defina novidade_oculta (null ou undefined = sem coluna).
  db.perfis = (db.perfis || []).map((x) => ('novidade_oculta' in x ? x : { ...x, novidade_oculta: PERFIL.novidade_oculta }));
  // Perfis sem o campo (testes antigos) já esconderam o aviso da Evolução; para testá-lo, defina novidades_ocultas: [].
  db.perfis = db.perfis.map((x) => ('novidades_ocultas' in x ? x : { ...x, novidades_ocultas: ['evolucao'] }));
  // Perfis sem o campo liberado (testes antigos) entram liberados; para testar convites, defina liberado: false.
  db.perfis = db.perfis.map((x) => ('liberado' in x ? x : { ...x, liberado: true }));
  // Testes antigos: política já aceita e consentimento de saúde dado (os campos aparecem como antes).
  db.perfis = db.perfis.map((x) => ({ politica_versao: '2026-10-27', consentimento_saude: 'sim', ...x }));
  // A celebração do check-in fica desligada nos testes antigos; celebracao: true liga (test72).
  if (!opcoes.celebracao) await ctx.addInitScript(() => { window.__semCelebracao = true; });
  // semearDev: true (com dev: true) já grava o banco falso e o "local" com o prefixo "dev:" do ambiente de desenvolvimento.
  await ctx.addInitScript(([db, local, dev]) => {
    if (sessionStorage.getItem('semeado')) return;
    const pre = dev ? 'dev:' : '';
    localStorage.setItem(`${pre}mock-supabase`, JSON.stringify(db));
    for (const [k, v] of Object.entries(local)) localStorage.setItem(`${pre}${k}`, v);
    sessionStorage.setItem('semeado', '1');
  }, [db, local, !!opcoes.semearDev]);
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && p.errs.push(m.text()));
  return p;
}

const banco = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('mock-supabase')));
// Check-ins do banco falso no formato do app.
async function store(p) {
  const db = await banco(p);
  const m = (s) => (s ? s.slice(0, 16) : null);
  return db.checkins.map((r) => ({ id: r.id, tipo: r.tipo, inicio: m(r.inicio), fim: m(r.fim), semHorario: r.sem_horario, recuperacao: r.recuperacao, obs: r.obs, retroativo: r.retroativo, series: r.series, usuario_id: r.usuario_id }));
}
const prontos = (p) => p.waitForFunction(() => !document.body.classList.contains('deslogado'));
// Espera a fila de gravação (inclui a pausa de 800 ms das cargas).
const gravacoes = async (p) => { await p.clock.runFor(1000).catch(() => {}); await p.waitForTimeout(150); };

// Abre uma tela de Você (dados, aparencia, treinos, semana, notificacoes, privacidade) pela lista.
async function voce(p, pagina) {
  if (!(await p.evaluate(() => location.hash.startsWith('#voce')))) { await p.click('[data-tela="voce"]'); await p.waitForTimeout(80); }
  if (await p.evaluate(() => location.hash !== '#voce')) { await p.evaluate(() => { location.hash = '#voce'; }); await p.waitForTimeout(80); }
  if (pagina) { await p.click(`[data-voce="${pagina}"]`); await p.waitForTimeout(80); }
}
// Boas-vindas: marca o objetivo (ou 'zero') e confirma no rodapé. Com um objetivo, espera a animação terminar.
async function escolherBV(p, id) {
  await p.click(`[data-jd-marcar="${id}"]`);
  await p.click('[data-jd-confirmar]');
  for (let i = 0; id !== 'zero' && i < 150 && await p.locator('#jornada-dialog[open]').count(); i++) {
    await p.clock.runFor(500).catch(() => {});
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(150);
}
// Editor de treinos: toca em Salvar e, se a animação "Atualizando seus treinos" abrir, espera ela terminar
// (avança o relógio falso quando o teste usa um).
async function salvarEditor(p) {
  await p.click('[data-ed-salvar]');
  await p.waitForTimeout(80);
  for (let i = 0; i < 150 && await p.locator('#jornada-dialog[open]').count(); i++) {
    await p.clock.runFor(500).catch(() => {});
    await p.waitForTimeout(120);
  }
}
// Catálogo do banco (tabelas exercicios e jornadas) igual à carga inicial do schema.sql, para os testes que o usam.
// Sem ele no banco falso, o app fica com a cópia que vem no index.html (como antes de rodar o SQL).
function catalogo() {
  delete require.cache[require.resolve('../../supabase/gerar-catalogo.cjs')];
  const c = require('../../supabase/gerar-catalogo.cjs');
  return {
    exercicios: c.exercicios.map((e) => ({ ...e, variacoes: [...e.variacoes], objetivos: [...e.objetivos], nomes_antigos: [], ativo: true })),
    jornadas: c.jornadas.map((j) => ({ ...JSON.parse(JSON.stringify(j)), ativo: true })),
  };
}
// Código-fonte do app inteiro (index.html, css/ e js/ na ordem de carga), para os testes que leem o código.
function fonte() {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const arqs = [...html.matchAll(/(?:href|src)="((?:css|js)\/[^"?]+)/g)].map((m) => m[1]);
  return [html, ...arqs.map((a) => fs.readFileSync(path.join(RAIZ, a), 'utf8'))].join('\n');
}
module.exports = { fonte, catalogo, RAIZ, APOIO, SAIDA, servidor, novaPagina, banco, store, prontos, gravacoes, voce, escolherBV, salvarEditor, PAGINA };
