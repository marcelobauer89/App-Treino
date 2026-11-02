// App: carregamento com o molde da tela Treino, etapas na ordem e entrada em cascata; login, convite e erro como antes.
const { chromium } = require('playwright');
const H = require('../apoio/harness.cjs');
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const S = H.SAIDA;
// Guarda as etapas mostradas e se o molde estava visível em cada uma.
const espiar = () => {
  window.__etapas = [];
  new MutationObserver(() => {
    const e = document.getElementById('carga-etapa');
    if (e && e.textContent && window.__etapas[window.__etapas.length - 1] !== e.textContent) window.__etapas.push(e.textContent);
  }).observe(document, { subtree: true, childList: true, characterData: true });
};
(async () => {
  const srv = await H.servidor(); const b = await chromium.launch();

  for (const scheme of ['light', 'dark']) {
    for (const width of [390, 1280]) {
      const p = await H.novaPagina(b, { scheme, viewport: { width, height: 844 }, extra: { atrasoDados: 900 } });
      await p.addInitScript(espiar);
      await p.goto(H.PAGINA);
      await p.waitForSelector('#tela-carga:not([hidden]) .esq', { timeout: 3000 });
      const info = await p.evaluate(() => {
        const c = document.getElementById('tela-carga');
        const r = c.getBoundingClientRect();
        return { busy: c.getAttribute('aria-busy'), entrar: document.getElementById('tela-entrar').hidden, larg: r.width,
          esqOculto: c.querySelector('.esq').getAttribute('aria-hidden'), etapa: document.getElementById('carga-etapa').getAttribute('role'),
          anim: getComputedStyle(c.querySelector('.esq-b'), '::after').animationName, cores: [...c.querySelectorAll('.esq-abas i')].map((i) => getComputedStyle(i).boxShadow).filter((x) => x !== 'none').length,
          rolagem: document.documentElement.scrollWidth > innerWidth };
      });
      const tag = `${scheme} ${width}`;
      ok(info.busy === 'true' && info.entrar && info.esqOculto === 'true' && info.etapa === 'status', `${tag}: molde no lugar da entrada, aria-busy e etapa em role=status`, JSON.stringify(info));
      ok(info.anim === 'brilho' && info.cores === 5, `${tag}: brilho passando e as 5 cores dos treinos`, `${info.anim} ${info.cores}`);
      ok(info.larg >= Math.min(width, 760) - 40 && !info.rolagem, `${tag}: molde ocupa a largura, sem rolagem lateral`, String(info.larg));
      await p.screenshot({ path: `${S}/app-carga-${scheme}-${width}.png` });
      await H.prontos(p);
      await p.waitForTimeout(120);
      const depois = await p.evaluate(() => ({ etapas: window.__etapas, carga: document.getElementById('tela-carga').hidden, vazio: !document.getElementById('tela-carga').innerHTML,
        busy: document.getElementById('tela-carga').hasAttribute('aria-busy'), entra: document.body.classList.contains('entra'),
        itens: document.querySelectorAll('#tela-treino .entra-item').length }));
      ok(JSON.stringify(depois.etapas) === JSON.stringify(['Buscando seus treinos…', 'Conferindo seu acesso…', 'Montando sua semana…']), `${tag}: etapas na ordem`, depois.etapas.join(' | '));
      ok(depois.carga && depois.vazio && !depois.busy, `${tag}: molde some quando os dados chegam`);
      ok(depois.entra && depois.itens >= 4, `${tag}: blocos da tela Treino entram em cascata`, String(depois.itens));
      await p.screenshot({ path: `${S}/app-entra-${scheme}-${width}.png` });
      await p.waitForTimeout(1200);
      const fim = await p.evaluate(() => ({ entra: document.body.classList.contains('entra'), itens: document.querySelectorAll('.entra-item').length,
        op: [...document.querySelectorAll('#tela-treino > header, #tela-treino main > *')].every((el) => getComputedStyle(el).opacity === '1') }));
      ok(!fim.entra && !fim.itens && fim.op, `${tag}: a cascata termina e tudo fica visível`);
      // Trocar de tela não anima de novo.
      await p.click('[data-tela="dashboard"]'); await p.waitForTimeout(80);
      ok(!(await p.evaluate(() => document.body.classList.contains('entra'))), `${tag}: trocar de tela não repete a cascata`);
      ok(!p.errs.length, `${tag}: sem erros no console`, p.errs.join(' | '));
      await p.context().close();
    }
  }

  // Abrindo direto no Dashboard: a cascata vale para a tela aberta.
  let p = await H.novaPagina(b, { extra: { atrasoDados: 300 } });
  await p.goto(H.PAGINA + '#dashboard'); await H.prontos(p); await p.waitForTimeout(60);
  ok(await p.evaluate(() => document.querySelectorAll('#tela-dashboard .entra-item').length >= 2), 'Dashboard aberto direto também entra em cascata');
  await p.context().close();

  // Movimento reduzido: nada anima.
  p = await H.novaPagina(b, { extra: { atrasoDados: 900 } });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(H.PAGINA);
  await p.waitForSelector('#tela-carga:not([hidden]) .esq');
  const parado = await p.evaluate(() => [...document.querySelectorAll('#tela-carga *')].every((el) => {
    const a = getComputedStyle(el).animationName, d = getComputedStyle(el, '::after').animationName, f = getComputedStyle(el, '::before').animationName;
    return a === 'none' && d === 'none' && f === 'none';
  }));
  ok(parado, 'movimento reduzido: molde parado');
  await H.prontos(p); await p.waitForTimeout(50);
  ok(await p.evaluate(() => [...document.querySelectorAll('#tela-treino *')].every((el) => getComputedStyle(el).animationName === 'none')), 'movimento reduzido: sem cascata');
  await p.context().close();

  // Sem sessão: vai direto ao login, sem o molde.
  p = await H.novaPagina(b, { logado: false });
  await p.addInitScript(espiar);
  await p.goto(H.PAGINA); await p.waitForSelector('#entrar-google:not([hidden])');
  ok(await p.evaluate(() => !window.__etapas.length && document.getElementById('tela-carga').hidden && !document.getElementById('tela-entrar').hidden), 'sem sessão: login, sem molde');
  ok(!p.errs.length, 'login: sem erros', p.errs.join(' | '));
  await p.context().close();

  // Sem acesso liberado: o molde dá lugar ao convite.
  p = await H.novaPagina(b, { extra: { perfis: [{ id: 'u1', nome: 'Marcelo', email: 'marcelo@exemplo.com', foto: '', tema: 'auto', dias_jiu: [2, 4], liberado: false }] } });
  await p.goto(H.PAGINA); await p.waitForSelector('#convite-form:not([hidden])');
  ok(await p.evaluate(() => document.getElementById('tela-carga').hidden && !document.getElementById('tela-entrar').hidden && document.body.classList.contains('deslogado')), 'sem acesso: convite aparece e o molde some');
  await p.context().close();

  // Erro ao carregar: mensagem e "Tentar de novo", que volta ao molde e entra.
  p = await H.novaPagina(b, { extra: { falharLeitura: 1, atrasoDados: 300 } });
  await p.goto(H.PAGINA); await p.waitForSelector('#entrar-tentar:not([hidden])');
  ok(await p.evaluate(() => document.getElementById('tela-carga').hidden && /Não foi possível carregar/.test(document.getElementById('entrar-status').textContent)), 'erro: mensagem e botão, sem molde');
  await p.click('#entrar-tentar');
  ok(await p.evaluate(() => !document.getElementById('tela-carga').hidden && document.getElementById('tela-entrar').hidden), 'Tentar de novo: volta ao molde');
  await H.prontos(p);
  ok(await p.evaluate(() => document.getElementById('tela-carga').hidden), 'Tentar de novo: entra no app');
  await p.context().close();

  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
  process.exit(fails ? 1 : 0);
})();
