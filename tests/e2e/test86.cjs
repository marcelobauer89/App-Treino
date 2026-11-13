// Identidade "Gestão de Treinos": um nome só (sem OSS e App Treino), descrição sem "Jiu Jitsu",
// conta nova sem jiu na semana padrão, objetivo Jiu Jitsu no fim da lista e a cor da marca sem "tatame".
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const ler = (f) => fs.readFileSync(path.join(H.RAIZ, f), 'utf8');
const DESC = 'Seu treino de academia e dos seus esportes num lugar só.';

(async () => {
  // Arquivos publicados: nome e descrição.
  const index = ler('index.html'), manifesto = JSON.parse(ler('manifest.webmanifest')), politica = ler('privacidade.html'), painel = ler('admin.html');
  ok(index.includes('<title>Gestão de Treinos</title>') && index.includes(`content="${DESC}"`), 'index: título e descrição novos');
  ok(manifesto.name === 'Gestão de Treinos' && manifesto.description === DESC, 'manifesto: nome e descrição', `${manifesto.name} / ${manifesto.description}`);
  for (const [nome, txt] of [['index.html', index], ['privacidade.html', politica], ['admin.html', painel], ['manifest.webmanifest', JSON.stringify(manifesto)]]) {
    ok(!/\bOSS\b|App Treino|Jiu Jitsu e academia|tatame/.test(txt.replace(/App-Treino/g, '')), `${nome}: sem OSS, App Treino e tatame`);
  }
  for (const f of ['css/app.css', 'css/admin.css', 'js/checkin.js', 'js/voce.js', 'js/admin.js']) ok(!ler(f).includes('--tatame'), `${f}: cor da marca sem "tatame"`);

  const srv = await H.servidor(); const b = await chromium.launch();

  // Conta nova (o banco agora cria dias_jiu vazio): semana padrão sem jiu e boas-vindas com a descrição nova.
  const p = await H.novaPagina(b, { viewport: { width: 390, height: 844 },
    extra: { perfis: [{ id: 'u1', nome: 'Ana', email: 'ana@exemplo.com', foto: '', tema: 'auto', dias_jiu: [], novidade_oculta: null, politica_versao: null }] } });
  await p.goto(H.PAGINA); await H.prontos(p); await p.waitForTimeout(300);
  const semana = await p.evaluate(() => JSON.stringify(config.semana));
  ok(semana === JSON.stringify([[], ['t2'], [], ['t1'], [], ['t3'], ['bike']]), 'conta nova: semana padrão sem jiu', semana);
  ok((await p.innerText('#jornada-body')).includes(DESC), 'boas-vindas: descrição nova');
  ok(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--marca').trim() !== ''), 'cor da marca definida (--marca)');
  await p.click('[data-jd-comecar]'); await p.waitForTimeout(100);
  await p.click('[data-jd-entendi]'); await p.waitForTimeout(400);
  const cartoes = (await p.locator('.jornada .jornada-topo b').allInnerTexts()).map((t) => t.trim());
  const sem = cartoes.filter((c) => c !== 'Montar do zero');
  ok(sem[0] === 'Hipertrofia' && sem[sem.length - 1] === 'Jiu Jitsu', 'objetivos: Hipertrofia primeiro e Jiu Jitsu por último', cartoes.join(' | '));
  ok(!p.errs.length, 'sem erros na página', p.errs.join(' | '));

  await b.close(); srv.close();
  console.log(fails ? `${fails} FALHA(S)` : 'TUDO OK');
  process.exit(fails ? 1 : 0);
})();
