import * as F from '../../supabase/functions/resumo-semanal/index.ts';
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };

// ---------- Datas ----------
const sexta = new Date('2026-10-23T12:00:00Z'); // sexta 9h em Brasília
let p = F.periodo(sexta);
ok(p.hoje === '2026-10-23' && p.ini === '2026-10-16' && p.fim === '2026-10-22' && p.antIni === '2026-10-09' && p.antFim === '2026-10-15', 'sexta: de sexta a quinta', JSON.stringify(p));
p = F.periodo(new Date('2026-10-23T02:30:00Z')); // ainda quinta 23h30 em Brasília
ok(p.hoje === '2026-10-22', 'usa o fuso de São Paulo', p.hoje);
p = F.periodo(new Date('2026-03-06T12:00:00Z'));
ok(p.ini === '2026-02-27' && p.fim === '2026-03-05', 'virada de mês (fevereiro)', `${p.ini}..${p.fim}`);
p = F.periodo(new Date('2027-01-01T12:00:00Z'));
ok(p.ini === '2026-12-25' && p.fim === '2026-12-31', 'virada de ano', `${p.ini}..${p.fim}`);
ok(F.fmtDia('2026-10-16') === '16 de out', 'fmtDia');

// ---------- Resumo ----------
const P = F.periodo(sexta);
const u = { id: '11111111-1111-1111-1111-111111111111', nome: 'Marcelo Bauer', email: 'm@x.com', semana: [[], ['t1'], ['t2', 'jiu'], ['bike'], ['t3', 'jiu'], [], []], dias_jiu: [2, 4] };
const cks = [
  { usuario_id: u.id, tipo: 't1', inicio: '2026-10-19T07:00:00' }, // seg
  { usuario_id: u.id, tipo: 'jiu', inicio: '2026-10-20T19:00:00' }, // ter
  { usuario_id: u.id, tipo: 't2', inicio: '2026-10-20T07:00:00' }, // ter
  { usuario_id: u.id, tipo: 'bike', inicio: '2026-10-22T23:30:00' }, // qui, último dia
  { usuario_id: u.id, tipo: 't3', inicio: '2026-10-23T07:00:00' }, // sexta (hoje): fora
  { usuario_id: u.id, tipo: 't1', inicio: '2026-10-12T07:00:00' }, // semana anterior
  { usuario_id: 'outro', tipo: 't1', inicio: '2026-10-19T07:00:00' },
];
const recs = [{ usuario_id: u.id, dados: { exercicio: 'Supino' }, criado_em: '' }, { usuario_id: u.id, dados: { exercicio: 'Supino' }, criado_em: '' }, { usuario_id: u.id, dados: { exercicio: 'Remada <b>' }, criado_em: '' }];
const r = F.montarResumo(u, cks, recs, P);
ok(r.total === 4 && r.anterior === 1, 'conta 4 na semana e 1 na anterior', `${r.total}/${r.anterior}`);
ok(r.porGrupo.musc === 2 && r.porGrupo.jiu === 1 && r.porGrupo.bike === 1, 'por tipo', JSON.stringify(r.porGrupo));
ok(r.diasTexto === 'seg, ter, qui', 'dias', r.diasTexto);
ok(r.planejadas === 6 && Math.round(r.aderencia * 100) === 67, 'aderência pela semana montada', `${r.planejadas} ${r.aderencia}`);
ok(r.recordes.join('|') === 'Supino|Remada <b>', 'recordes sem repetir', r.recordes.join('|'));
ok(r.nome === 'Marcelo' && r.periodo === '16 de out a 22 de out', 'nome e período', `${r.nome} ${r.periodo}`);
ok(F.comparacao(r) === '3 treinos a mais que na semana anterior.', 'comparação', F.comparacao(r));
ok(F.planejadasPorSemana({ semana: null, dias_jiu: [2, 4] }) === 6 && F.planejadasPorSemana({ semana: null, dias_jiu: [6] }) === 4, 'semana padrão');
const r9 = F.montarResumo(u, cks.map((c) => ({ ...c })).concat(Array.from({ length: 8 }, () => ({ usuario_id: u.id, tipo: 't1', inicio: '2026-10-21T08:00:00' }))), [], P);
ok(r9.aderencia === 1, 'aderência limitada a 100%');

// ---------- E-mail ----------
const links = { app: 'https://app.test/', sair: 'https://fn.test/?sair=x&t=y' };
let e = F.montarEmail(r, links);
ok(e.assunto === 'Seu resumo da semana: 4 treinos', 'assunto', e.assunto);
ok(e.html.includes('Olá, Marcelo! 👋') && e.html.includes('>4</span>') && e.html.includes('▲ 3 a mais') && e.html.includes('4 de 6 treinos') && e.html.includes('>67%<'), 'HTML com números e comparação');
ok(e.html.includes('Seu resumo da semana') && e.html.includes('16 de out a 22 de out'), 'cabeçalho com período');
ok(e.html.includes('Quase lá') === false && e.html.includes('Bom ritmo'), 'mensagem do plano (67%)');
ok(e.html.includes('2 novos recordes na semana') && e.html.includes('▸ Supino'), 'cartão de recordes');
ok(e.html.includes('Abrir o App Treino →'), 'botão');
// faixa: 7 colunas, sex..qui, com os selos dos dias de treino
const sem = r.semana7;
ok(sem.length === 7 && sem.map((d) => d.sigla).join() === 'sex,sáb,dom,seg,ter,qua,qui' && sem[0].num === 16 && sem[6].num === 22, 'faixa de sex a qui', sem.map((d) => `${d.sigla}${d.num}`).join());
ok(sem[3].tipos.join() === 't1' && sem[4].tipos.join() === 't2,jiu' && sem[6].tipos.join() === 'bike' && sem[0].tipos.length === 0, 'tipos por dia em ordem', JSON.stringify(sem.map((d) => d.tipos)));
const selos = [...e.html.matchAll(/border-radius:8px;background:#[0-9a-f]{6};color:#0b0d10;font-size:14px;font-weight:800;text-align:center">([^<]+)</g)].map((m) => m[1]);
ok(selos.join('') === '12JC', 'selos na faixa', selos.join(''));
ok((e.html.match(/border:1px dashed/g) || []).length === 4, '4 dias sem treino tracejados (sex, sáb, dom, qua)');
// mensagens
const comAder = (t, pl) => F.mensagem({ total: t, planejadas: pl, aderencia: Math.min(1, t / pl) });
ok(comAder(6, 6) === 'Plano cumprido! 🔥' && comAder(5, 6) === 'Quase lá! Faltou 1 treino.' && comAder(5, 7) === 'Quase lá! Faltaram 2 treinos.' && comAder(1, 6).startsWith('Cada treino conta'), 'mensagens por aderência');
// dia com 3 treinos mostra +1
const r3 = F.montarResumo(u, ['t1', 'jiu', 'bike'].map((t, i) => ({ usuario_id: u.id, tipo: t, inicio: `2026-10-21T0${i + 6}:00:00` })), [], P);
ok(F.montarEmail(r3, links).html.includes('>+1<'), 'mais de 2 treinos no dia: +1');
ok(e.html.includes('href="https://app.test/"') && e.html.includes('href="https://fn.test/?sair=x&amp;t=y"'), 'links no HTML');
ok(e.html.includes('Remada &lt;b&gt;') && !e.html.includes('Remada <b>'), 'escapa texto');
ok(e.texto.includes('treinou 4 vezes') && e.texto.includes('https://fn.test/?sair=x&t=y') && e.texto.includes('Recordes da semana: Supino'), 'versão texto');
const r0 = F.montarResumo({ ...u, nome: '' }, [], [], P);
e = F.montarEmail(r0, links);
ok(e.assunto === 'Semana nova, recomeço: bora treinar?' && e.html.includes('Semana nova, recomeço') && e.html.includes('Não apareceu nenhum treino no app de 16 de out a 22 de out') && e.html.includes('Olá! 👋') && !e.html.includes('recorde') && e.html.includes('Marcar meu próximo treino'), 'versão sem treino');
ok(F.comparacao(r0) === '', 'sem comparação quando tudo zero');
const r1 = F.montarResumo(u, [{ usuario_id: u.id, tipo: 'jiu', inicio: '2026-10-17T10:00:00' }, { usuario_id: u.id, tipo: 't1', inicio: '2026-10-15T23:59:00' }], [], P);
ok(F.montarEmail(r1, links).assunto === 'Seu resumo da semana: 1 treino' && F.comparacao(r1) === 'O mesmo número da semana anterior.', 'singular e igual', F.comparacao(r1));
const fs = await import('node:fs');
fs.writeFileSync('previa.html', F.montarEmail(r, links).html);
fs.writeFileSync('previa-zero.html', F.montarEmail(r0, links).html);

// ---------- Assinatura ----------
const a1 = await F.assinar(u.id, 'segredo');
ok(/^[0-9a-f]{32}$/.test(a1) && a1 === await F.assinar(u.id, 'segredo') && a1 !== await F.assinar(u.id, 'outro'), 'HMAC estável e depende do segredo');

// ---------- Handler com banco e envio falsos ----------
function bancoFalso(tabelas) {
  const log = [];
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; }
    select() { return this; }
    eq(c, v) { this.f.push((r) => r[c] === v); return this; }
    gt(c, v) { this.f.push((r) => r[c] > v); return this; }
    ilike(c, v) { const alvo = v.replace(/\\([\\%_])/g, '$1').toLowerCase(); log.push(`ilike:${v}`); this.f.push((r) => String(r[c]).toLowerCase() === alvo); return this; }
    gte(c, v) { this.f.push((r) => String(r[c]) >= v); return this; }
    lt(c, v) { this.f.push((r) => String(r[c]) < v); return this; }
    insert(v) { this.op = 'insert'; this.v = v; return this; }
    update(v) { this.op = 'update'; this.v = v; return this; }
    delete() { this.op = 'delete'; return this; }
    then(ok) {
      const lin = tabelas[this.t] || (tabelas[this.t] = []);
      log.push(`${this.op}:${this.t}`);
      if (tabelas.falhar === this.t) return Promise.resolve({ data: null, error: { message: `falha ${this.t}` } }).then(ok);
      if (this.op === 'insert') { lin.push({ ...this.v }); return Promise.resolve({ data: null, error: null }).then(ok); }
      const sel = lin.filter((r) => this.f.every((f) => f(r)));
      if (this.op === 'update') { sel.forEach((r) => Object.assign(r, this.v)); return Promise.resolve({ data: null, error: null }).then(ok); }
      if (this.op === 'delete') { tabelas[this.t] = lin.filter((r) => !sel.includes(r)); return Promise.resolve({ data: null, error: null }).then(ok); }
      return Promise.resolve({ data: sel.map((r) => ({ ...r })), error: null }).then(ok);
    }
  }
  return { from: (t) => new Q(t), log, tabelas };
}
const U2 = '22222222-2222-2222-2222-222222222222', U3 = '33333333-3333-3333-3333-333333333333', U4 = '44444444-4444-4444-4444-444444444444', U5 = '55555555-5555-5555-5555-555555555555';
const novoBanco = () => bancoFalso({
  perfis: [
    { ...u, emails_resumo: true, acessos: 10, ultimo_acesso: '2026-10-22T20:00:00Z' },
    { id: U2, nome: 'Ana', email: 'ana@x.com', semana: null, dias_jiu: [2, 4], emails_resumo: true, acessos: 3, ultimo_acesso: '2026-10-22T20:00:00Z' },
    { id: U3, nome: 'Desligado', email: 'd@x.com', semana: null, dias_jiu: [], emails_resumo: false, acessos: 5, ultimo_acesso: '2026-10-22T20:00:00Z' },
    { id: U4, nome: 'Nunca usou', email: 'n@x.com', semana: null, dias_jiu: [], emails_resumo: true, acessos: 0 },
    { id: U5, nome: 'Falha', email: 'falha@x.com', semana: null, dias_jiu: [], emails_resumo: true, acessos: 2, ultimo_acesso: '2026-10-22T20:00:00Z' },
  ],
  checkins: cks,
  eventos: [{ usuario_id: u.id, tipo: 'recorde', dados: { exercicio: 'Supino' }, criado_em: '2026-10-20T10:00:00-03:00' },
    { usuario_id: u.id, tipo: 'recorde', dados: { exercicio: 'Antigo' }, criado_em: '2026-10-10T10:00:00-03:00' },
    { usuario_id: u.id, tipo: 'tela', dados: {}, criado_em: '2026-10-20T10:00:00-03:00' }],
  emails_enviados: [],
});
const ENV = { RESUMO_TOKEN: 'tok-123', APP_URL: 'https://app.test/', FUNCAO_URL: 'https://proj.supabase.co/functions/v1/resumo-semanal' };
const criar = (db) => {
  const caixa = [];
  const enviar = async (m) => { if (m.para === 'falha@x.com') throw new Error('SMTP recusou'); caixa.push(m); };
  return { h: F.criarHandler({ db, enviar, env: ENV, agora: () => sexta }), caixa };
};
const post = (corpo, token = 'tok-123') => new Request('https://proj.supabase.co/functions/v1/resumo-semanal', { method: 'POST', headers: token ? { 'x-resumo-token': token } : {}, body: JSON.stringify(corpo) });

let db = novoBanco(); let { h, caixa } = criar(db);
let res = await h(post({}, 'errado'));
ok(res.status === 401 && caixa.length === 0, 'token errado: 401');
res = await h(post({}, null));
ok(res.status === 401, 'sem token: 401');
res = await h(new Request('https://x/', { method: 'GET' }));
ok(res.status === 401, 'GET sem sair: 401');

res = await h(post({ simular: true }));
let j = await res.json();
ok(j.modo === 'simular', 'modo simular na resposta');
ok(res.status === 200 && caixa.length === 0 && j.simulacao.length === 3 && j.simulacao.map((s) => s.email).sort().join() === 'ana@x.com,falha@x.com,m@x.com', 'simular não envia e lista quem receberia', JSON.stringify(j.simulacao));
ok(db.tabelas.emails_enviados.length === 0, 'simular não registra');

res = await h(post({}));
j = await res.json();
ok(res.status === 400 && caixa.length === 0 && db.tabelas.emails_enviados.length === 0 && /enviar, previa ou simular/.test(j.erro), 'corpo vazio: 400 e não envia nada', JSON.stringify(j));
res = await h(new Request('https://proj.supabase.co/functions/v1/resumo-semanal', { method: 'POST', headers: { 'x-resumo-token': 'tok-123' } }));
ok(res.status === 400 && caixa.length === 0, 'sem corpo: 400 e não envia nada');
res = await h(new Request('https://proj.supabase.co/functions/v1/resumo-semanal', { method: 'POST', headers: { 'x-resumo-token': 'tok-123' }, body: 'lixo{' }));
j = await res.json();
ok(res.status === 400 && j.recebido === 'lixo{' && caixa.length === 0, 'corpo inválido: 400 mostra o que recebeu');
ok((await (await h(post({ enviar: false }))).json()).erro, 'enviar:false não envia');
res = await h(post({ enviar: true }));
j = await res.json();
ok(j.modo === 'envio' && j.enviados === 2 && j.falhas.length === 1 && j.falhas[0].email === 'falha@x.com' && /SMTP recusou/.test(j.falhas[0].erro), 'envia 2, falha 1 sem parar os outros', JSON.stringify(j));
ok(caixa.map((m) => m.para).sort().join() === 'ana@x.com,m@x.com', 'não envia para desligado nem para quem nunca usou');
const mMarcelo = caixa.find((m) => m.para === 'm@x.com');
ok(mMarcelo.assunto === 'Seu resumo da semana: 4 treinos' && mMarcelo.html.includes('Supino') && !mMarcelo.html.includes('Antigo'), 'e-mail do Marcelo com recorde só da semana');
ok(mMarcelo.sair.startsWith(`${ENV.FUNCAO_URL}?sair=${u.id}&t=`) && mMarcelo.html.includes(mMarcelo.sair.replace(/&/g, '&amp;')), 'link de descadastro assinado');
const mAna = caixa.find((m) => m.para === 'ana@x.com');
ok(mAna.assunto.startsWith('Semana nova'), 'Ana sem treino: versão de incentivo');
ok(db.tabelas.emails_enviados.length === 2 && db.tabelas.emails_enviados.every((x) => x.tipo === 'resumo_semanal' && x.referencia === '2026-10-22'), 'registra envios com a referência', JSON.stringify(db.tabelas.emails_enviados));

caixa.length = 0;
res = await h(post({ enviar: true }));
j = await res.json();
ok(j.enviados === 0 && caixa.length === 0 && j.pulados === 2, 'rodar de novo não reenvia (só tenta a falha)', JSON.stringify(j));

// prévia
caixa.length = 0;
res = await h(post({ previa: 'm@x.com' }));
j = await res.json();
ok(j.modo === 'previa' && j.enviados === 1 && caixa.length === 1 && caixa[0].para === 'm@x.com' && db.tabelas.emails_enviados.length === 2, 'prévia envia mesmo já enviado e não registra');
// pela URL, sem corpo
caixa.length = 0;
const semCorpo = (qs) => new Request(`https://proj.supabase.co/functions/v1/resumo-semanal?${qs}`, { method: 'POST', headers: { 'x-resumo-token': 'tok-123' } });
j = await (await h(semCorpo('previa=M%40X.com'))).json();
ok(j.modo === 'previa' && j.enviados === 1 && caixa[0].para === 'm@x.com', 'prévia pela URL, sem diferenciar maiúsculas', JSON.stringify(j));
caixa.length = 0;
j = await (await h(semCorpo('simular=1'))).json();
ok(j.modo === 'simular' && j.simulacao.length === 1 && j.simulacao[0].email === 'falha@x.com' && caixa.length === 0, 'simular pela URL (só quem ainda não recebeu)', JSON.stringify(j.simulacao));
const dbU = novoBanco(); const hu = criar(dbU);
j = await (await hu.h(semCorpo('enviar=1'))).json();
ok(j.modo === 'envio' && j.enviados === 2, 'enviar pela URL (como o agendamento)');
// a URL vale mesmo com corpo vazio do pg_net
j = await (await hu.h(new Request('https://proj.supabase.co/functions/v1/resumo-semanal?previa=ana@x.com', { method: 'POST', headers: { 'x-resumo-token': 'tok-123' }, body: '{}' }))).json();
ok(j.modo === 'previa' && j.enviados === 1, 'URL tem prioridade sobre corpo {}');
// e-mail com _ não casa com outro
const dbE = novoBanco(); dbE.tabelas.perfis.push({ id: '66666666-6666-6666-6666-666666666666', nome: 'X', email: 'aXb@x.com', semana: null, dias_jiu: [], emails_resumo: true, acessos: 1, ultimo_acesso: '2026-10-22T20:00:00Z' });
res = await criar(dbE).h(post({ previa: 'a_b@x.com' }));
ok(res.status === 404 && dbE.log.includes('ilike:a\\_b@x.com'), 'underscore escapado no ilike', dbE.log.filter((l) => l.startsWith('ilike')).join());
res = await h(post({ previa: 'naoexiste@x.com' }));
ok(res.status === 404, 'prévia com e-mail desconhecido: 404');
res = await h(post({ previa: 'd@x.com' }));
ok((await res.json()).enviados === 1, 'prévia ignora a opção desligada');

// erro de banco
const dbF = novoBanco(); dbF.tabelas.falhar = 'checkins';
res = await criar(dbF).h(post({ enviar: true }));
ok(res.status === 500 && /falha checkins/.test((await res.json()).erro), 'erro de banco: 500 com mensagem');

// abertura e clique
{
  const dbA = novoBanco(); const hA = criar(dbA);
  await hA.h(post({ enviar: true }));
  const m = hA.caixa.find((x) => x.para === 'm@x.com');
  const px = (m.html.match(/<img src="([^"]+)"/) || [])[1].replace(/&amp;/g, '&');
  const bt = (m.html.match(/<a href="([^"]+)"[^>]*>Abrir o App Treino/) || [])[1].replace(/&amp;/g, '&');
  ok(px.startsWith(`${ENV.FUNCAO_URL}?aberto=${u.id}&ref=2026-10-22&t=`) && bt.startsWith(`${ENV.FUNCAO_URL}?clique=${u.id}&ref=2026-10-22&t=`), 'e-mail traz pixel e botão rastreados', `${px} | ${bt}`);
  ok(m.html.includes('Registramos se ele foi aberto'), 'rodapé avisa o registro de abertura');
  const linhaM = () => dbA.tabelas.emails_enviados.find((x) => x.usuario_id === u.id);
  let r1 = await hA.h(new Request(px));
  ok(r1.status === 200 && r1.headers.get('content-type') === 'image/gif' && (await r1.arrayBuffer()).byteLength > 20, 'pixel devolve GIF');
  ok(linhaM().aberturas === 1 && /^2026-10-23T12:00/.test(linhaM().aberto_em), 'abertura registrada', JSON.stringify(linhaM()));
  const primeira = linhaM().aberto_em;
  await hA.h(new Request(px));
  ok(linhaM().aberturas === 2 && linhaM().aberto_em === primeira, 'segunda abertura só soma');
  r1 = await hA.h(new Request(bt));
  ok(r1.status === 302 && r1.headers.get('location') === 'https://app.test/' && linhaM().cliques === 1 && linhaM().clicado_em, 'clique registra e leva ao app');
  // assinatura errada: devolve GIF/redirect sem registrar
  r1 = await hA.h(new Request(px.replace(/t=[0-9a-f]+/, 't=00000000000000000000000000000000')));
  ok(r1.status === 200 && linhaM().aberturas === 2, 'pixel com assinatura errada não registra');
  r1 = await hA.h(new Request(bt.replace(/ref=[0-9-]+/, 'ref=2026-10-15')));
  ok(r1.status === 302 && linhaM().cliques === 1, 'trocar a referência invalida a assinatura');
  r1 = await hA.h(new Request(px.replace('aberto=', 'clique=')));
  ok(r1.status === 302 && linhaM().cliques === 1, 'assinatura de abertura não vale como clique');
  // clique sem abertura antes marca aberto
  const ana = () => dbA.tabelas.emails_enviados.find((x) => x.usuario_id === U2);
  const btAna = (hA.caixa.find((x) => x.para === 'ana@x.com').html.match(/<a href="([^"]+)"[^>]*>Marcar meu/) || [])[1].replace(/&amp;/g, '&');
  await hA.h(new Request(btAna));
  ok(ana().cliques === 1 && ana().aberto_em && !ana().aberturas, 'clique conta como aberto', JSON.stringify(ana()));
  // prévia: links com ref "previa" não registram nada
  hA.caixa.length = 0;
  await hA.h(post({ previa: 'm@x.com' }));
  const pxPrev = (hA.caixa[0].html.match(/<img src="([^"]+)"/) || [])[1].replace(/&amp;/g, '&');
  ok(pxPrev.includes('ref=previa'), 'prévia usa ref previa');
  r1 = await hA.h(new Request(pxPrev));
  ok(r1.status === 200 && linhaM().aberturas === 2, 'abrir a prévia não conta');
  // erro de banco no registro não quebra o pixel
  const dbX = novoBanco(); const hX = criar(dbX); await hX.h(post({ enviar: true }));
  const pxX = (hX.caixa.find((x) => x.para === 'm@x.com').html.match(/<img src="([^"]+)"/) || [])[1].replace(/&amp;/g, '&');
  dbX.tabelas.falhar = 'emails_enviados';
  r1 = await hX.h(new Request(pxX));
  ok(r1.status === 200 && r1.headers.get('content-type') === 'image/gif', 'falha ao registrar ainda devolve o GIF');
}

// descadastro
const t = await F.assinar(U2, 'tok-123');
res = await h(new Request(`https://x/resumo?sair=${U2}&t=deadbeefdeadbeefdeadbeefdeadbeef`));
ok(res.status === 400 && db.tabelas.perfis.find((x) => x.id === U2).emails_resumo === true, 'assinatura errada não descadastra');
res = await h(new Request(`https://x/resumo?sair=${U2}&t=${await F.assinar(U3, 'tok-123')}`));
ok(res.status === 400, 'assinatura de outra pessoa não vale');
res = await h(new Request(`https://x/resumo?sair=${U2}&t=${t}`));
ok(res.status === 302 && res.headers.get('location') === 'https://app.test/?resumo=desligado' && db.tabelas.perfis.find((x) => x.id === U2).emails_resumo === false, 'GET descadastra e volta ao app');
db.tabelas.perfis.find((x) => x.id === U2).emails_resumo = true;
res = await h(new Request(`https://x/resumo?sair=${U2}&t=${t}`, { method: 'POST', body: 'List-Unsubscribe=One-Click' }));
ok(res.status === 200 && db.tabelas.perfis.find((x) => x.id === U2).emails_resumo === false, 'POST um clique (Gmail) descadastra');
res = await h(new Request(`https://x/resumo?sair=nao-uuid&t=${t}`));
ok(res.status === 400, 'id inválido: 400');

// ---------- Muay Thai ----------
{
  const rm = F.montarResumo(u, [{ usuario_id: u.id, tipo: 'muay', inicio: '2026-10-21T19:00:00' }, { usuario_id: u.id, tipo: 't1', inicio: '2026-10-19T07:00:00' }], [], P);
  ok(rm.porGrupo.muay === 1 && rm.porGrupo.musc === 1, 'muay thai conta no grupo próprio', JSON.stringify(rm.porGrupo));
  const em = F.montarEmail(rm, links);
  ok(em.html.includes('Muay Thai') && em.html.includes('#eda100') && /Muay Thai: 1/.test(em.texto), 'e-mail com cartão e selo M de muay thai');
  ok(!F.montarEmail(r, links).html.includes('Muay Thai') && !/Muay Thai/.test(F.montarEmail(r, links).texto), 'quem não faz muay thai continua com 3 cartões');
  const rp = F.montarResumo({ ...u, semana: [[], ['muay'], [], [], [], [], []] }, [{ usuario_id: u.id, tipo: 't1', inicio: '2026-10-19T07:00:00' }], [], P);
  ok(F.montarEmail(rp, links).html.includes('Muay Thai'), 'muay thai no plano mostra o cartão mesmo com 0');
  fs.writeFileSync('previa-muay.html', em.html);
}

// Quem não recebe: não liberado e 4 semanas sem abrir o app (a prévia vai sempre).
{
  const base = { semana: null, dias_jiu: [2, 4], emails_resumo: true, acessos: 4 };
  ok(F.motivoParaNaoEnviar({ ...base, id: 'a', liberado: false, ultimo_acesso: '2026-10-22T20:00:00Z' }, '2026-10-23') === 'nao_liberado', 'não liberado não recebe');
  ok(F.motivoParaNaoEnviar({ ...base, id: 'b', ultimo_acesso: '2026-09-26T15:00:00Z' }, '2026-10-23') === null, 'abriu o app há 27 dias: recebe');
  ok(F.motivoParaNaoEnviar({ ...base, id: 'c', ultimo_acesso: '2026-09-24T15:00:00Z' }, '2026-10-23') === 'sumiu', 'abriu o app há 29 dias: não recebe');
  ok(F.motivoParaNaoEnviar({ ...base, id: 'd', ultimo_acesso: '2026-09-25T02:00:00Z' }, '2026-10-23') === 'sumiu', 'conta o dia em Brasília (24/09 23h não entra)');
  ok(F.motivoParaNaoEnviar({ ...base, id: 'e', ultimo_acesso: null }, '2026-10-23') === 'sumiu', 'sem último acesso: não recebe');
  ok(F.motivoParaNaoEnviar({ ...base, id: 'f', liberado: null, ultimo_acesso: '2026-10-20T10:00:00Z' }, '2026-10-23') === null, 'liberado vazio (schema antigo) continua recebendo');
  const db2 = novoBanco();
  db2.tabelas.perfis.push(
    { ...base, id: '77777777-7777-7777-7777-777777777771', nome: 'Pendente', email: 'pendente@x.com', liberado: false, ultimo_acesso: '2026-10-22T10:00:00Z' },
    { ...base, id: '77777777-7777-7777-7777-777777777772', nome: 'Sumiu', email: 'sumiu@x.com', liberado: true, ultimo_acesso: '2026-08-01T10:00:00Z' },
    { ...base, id: '77777777-7777-7777-7777-777777777773', nome: 'Voltou', email: 'voltou@x.com', liberado: true, ultimo_acesso: '2026-09-30T10:00:00Z' });
  let { h: h2, caixa: c2 } = criar(db2);
  let r2 = await (await h2(post({ simular: true }))).json();
  const fora = Object.fromEntries(r2.simulacao.filter((x) => x.fora).map((x) => [x.email, x.fora]));
  ok(fora['pendente@x.com'] === 'nao_liberado' && fora['sumiu@x.com'] === 'sumiu' && !fora['voltou@x.com'], 'simular mostra quem fica de fora e o motivo', JSON.stringify(fora));
  ok(r2.ignorados.nao_liberado === 1 && r2.ignorados.sumiu === 1, 'resposta conta os ignorados por motivo', JSON.stringify(r2.ignorados));
  r2 = await (await h2(post({ enviar: true }))).json();
  const para = c2.map((m) => m.para);
  ok(!para.includes('pendente@x.com') && !para.includes('sumiu@x.com') && para.includes('voltou@x.com') && para.includes('ana@x.com'), 'envio pula o não liberado e quem sumiu', para.join(','));
  ok(!db2.tabelas.emails_enviados.some((e) => e.usuario_id.startsWith('77777777') && e.usuario_id !== '77777777-7777-7777-7777-777777777773'), 'nada registrado para quem ficou de fora');
  ({ h: h2, caixa: c2 } = criar(db2));
  await h2(post({ previa: 'sumiu@x.com' }));
  ok(c2.length === 1 && c2[0].para === 'sumiu@x.com', 'prévia vai mesmo para quem sumiu');
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
process.exit(fails ? 1 : 0);
