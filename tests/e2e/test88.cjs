// Segurança do site publicado: CSP igual nas três páginas, nenhum <script> inline nem onclick=,
// biblioteca do Supabase guardada no site (sem CDN) e o app abre sem nenhuma violação de CSP.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const ler = (f) => fs.readFileSync(path.join(H.RAIZ, f), 'utf8');
const csp = (html) => (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1];

(async () => {
  const paginas = ['index.html', 'admin.html', 'privacidade.html'];
  const regras = paginas.map((f) => csp(ler(f)));
  ok(regras.every(Boolean) && new Set(regras).size === 1, 'CSP presente e igual nas três páginas');
  ok(/script-src 'self';/.test(regras[0] || '') && !/script-src[^;]*unsafe/.test(regras[0] || ''), "scripts só do próprio site (sem 'unsafe-inline')");
  for (const f of paginas) {
    const html = ler(f);
    ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), `${f}: sem <script> inline`);
    ok(!/<script[^>]+src="https?:/.test(html), `${f}: sem script de outro site`);
    ok(!/\son[a-z]+="/.test(html), `${f}: sem onclick= e afins`);
  }
  ok(ler('index.html').includes('src="js/vendor/supabase-') && ler('admin.html').includes('src="js/vendor/supabase-'), 'biblioteca do Supabase em js/vendor/');
  const pub = ler('.github/workflows/publicar.yml');
  ok(['supabase', 'docs', 'CLAUDE.md', 'tests'].every((x) => pub.includes(`--exclude ${x}`)), 'publicação deixa de fora supabase/, docs/, CLAUDE.md e tests/');

  // Abrindo o app e a política: nenhuma violação de CSP.
  const srv = await H.servidor(); const b = await chromium.launch();
  const p = await H.novaPagina(b);
  await p.addInitScript(() => { window.__violacoes = []; document.addEventListener('securitypolicyviolation', (e) => window.__violacoes.push(`${e.violatedDirective} ${e.blockedURI}`)); });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
  ok(await p.evaluate(() => typeof supabase === 'object' && !!document.documentElement.dataset), 'app abriu com a biblioteca do site');
  const v1 = await p.evaluate(() => window.__violacoes);
  ok(!v1.length, 'app: nenhuma violação de CSP', v1.join(' | '));
  await p.goto(H.PAGINA.replace('index.html', 'privacidade.html')); await p.waitForTimeout(300);
  const v2 = await p.evaluate(() => window.__violacoes);
  ok(!v2.length, 'política: nenhuma violação de CSP', v2.join(' | '));
  ok(!p.errs.length, 'sem erros na página', p.errs.join(' | '));

  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'TUDO OK');
  process.exit(fails ? 1 : 0);
})();
