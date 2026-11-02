// Aviso de pedido de acesso aos administradores (Edge Function, modo "pedido").
import * as F from '../../supabase/functions/resumo-semanal/index.ts';
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
function banco(t) {
  class Q {
    constructor(n) { this.n = n; this.f = []; this.op = 'select'; }
    select() { return this; }
    eq(c, v) { this.f.push((r) => r[c] === v); return this; }
    in(c, v) { this.f.push((r) => v.includes(r[c])); return this; }
    insert(v) { this.op = 'insert'; this.v = v; return this; }
    then(ok) {
      const lin = t[this.n] || (t[this.n] = []);
      if (this.op === 'insert') { lin.push({ ...this.v }); return Promise.resolve({ data: null, error: null }).then(ok); }
      return Promise.resolve({ data: lin.filter((r) => this.f.every((f) => f(r))).map((r) => ({ ...r })), error: null }).then(ok);
    }
  }
  return { from: (n) => new Q(n), t };
}
const ADM = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', PED = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', LIB = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const novo = () => banco({
  perfis: [
    { id: ADM, nome: 'Marcelo Bauer', email: 'admin@x.com', liberado: true, acesso_pedido_em: null },
    { id: PED, nome: 'Alessandra <Machado>', email: 'ale@x.com', liberado: false, acesso_pedido_em: '2026-10-28T13:05:00+00:00' },
    { id: LIB, nome: 'Já liberado', email: 'lib@x.com', liberado: true, acesso_pedido_em: null },
  ],
  admins: [{ usuario_id: ADM }],
  emails_enviados: [],
});
const ENV = { RESUMO_TOKEN: 'tok', APP_URL: 'https://app.test/App-Treino/', FUNCAO_URL: 'https://fn.test' };
const criar = (db) => { const caixa = []; return { h: F.criarHandler({ db, enviar: async (m) => { caixa.push(m); }, env: ENV }), caixa }; };
const post = (corpo, token = 'tok', query = '') => new Request(`https://fn.test/${query}`, { method: 'POST', headers: token ? { 'x-resumo-token': token } : {}, body: corpo ? JSON.stringify(corpo) : '' });

let db = novo(); let { h, caixa } = criar(db);
let r = await h(post({ pedido: PED }, 'errado'));
ok(r.status === 401 && !caixa.length, 'sem o token certo: 401 e nada enviado');
r = await h(post({ pedido: PED })); let j = await r.json();
ok(r.status === 200 && j.avisados === 1 && caixa.length === 1 && caixa[0].para === 'admin@x.com', 'avisa o administrador', JSON.stringify(j));
const m = caixa[0];
ok(m.assunto === 'Novo pedido de acesso: Alessandra <Machado>', 'assunto com o nome', m.assunto);
ok(m.html.includes('Alessandra &lt;Machado&gt;') && !m.html.includes('<Machado>') && m.html.includes('ale@x.com'), 'HTML com nome escapado e e-mail');
ok(m.html.includes('https://app.test/App-Treino/admin.html#convites') && m.texto.includes('admin.html#convites'), 'link para a aba Convites');
ok(m.html.includes('28/10') && m.html.includes('10:05'), 'data e hora em Brasília', (m.html.match(/Pediu acesso em ([^<]+)/) || [])[1]);
ok(!m.sair, 'sem link de descadastro (é aviso para o admin)');
ok(db.t.emails_enviados.length === 1 && db.t.emails_enviados[0].tipo === 'aviso_pedido', 'registra o aviso');
r = await h(post({ pedido: PED })); j = await r.json();
ok(j.avisados === 0 && /já avisado/.test(j.motivo) && caixa.length === 1, 'mesmo pedido não avisa de novo', JSON.stringify(j));
db.t.perfis[1].acesso_pedido_em = '2026-10-29T09:00:00+00:00';
r = await h(post(null, 'tok', `?pedido=${PED}`)); j = await r.json();
ok(j.avisados === 1 && caixa.length === 2, 'novo pedido (outra data), pela URL: avisa de novo', JSON.stringify(j));
r = await h(post({ pedido: LIB })); j = await r.json();
ok(j.avisados === 0 && /sem pedido pendente/.test(j.motivo), 'quem já está liberado: não avisa');
r = await h(post({ pedido: 'x; drop' }));
ok(r.status === 400, 'id inválido: 400');
db = novo(); db.t.admins = []; ({ h, caixa } = criar(db));
j = await (await h(post({ pedido: PED }))).json();
ok(j.avisados === 0 && /nenhum administrador/.test(j.motivo), 'sem administradores: não envia');
// resumo continua exigindo pedido explícito
db = novo(); ({ h, caixa } = criar(db));
r = await h(post({}));
ok(r.status === 400 && !caixa.length, 'corpo vazio continua sem enviar nada');
console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK'); process.exit(fails ? 1 : 0);
