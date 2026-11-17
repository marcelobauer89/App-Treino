// Check-in vindo do app do dojo (Edge Function "checkin-externo"): confere o pedido e repassa ao banco.
import { tratar, lerCorpo } from '../../supabase/functions/checkin-externo/index.ts';
let fails = 0;
const ok = (c, l, x = '') => { if (!c) fails++; console.log(`${c ? 'PASS' : 'FAIL'} ${l}${x ? ' — ' + x : ''}`); };
const pedido = (corpo, { chave = 'chave-teste', metodo = 'POST' } = {}) => new Request('https://fn.test/checkin-externo', {
  method: metodo, headers: { 'content-type': 'application/json', ...(chave ? { 'x-api-key': chave } : {}) },
  ...(metodo === 'POST' ? { body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) } : {}),
});
const BOM = { codigo: 'GT-ABCD-EFGH', id_externo: 'aula-123', inicio: '2026-11-10T19:00:00-03:00' };
let chamadas = [];
const banco = (resultado, error = null) => async (args) => { chamadas.push(args); return { data: resultado, error }; };

let r = await tratar(pedido(BOM), banco('criado'));
ok(r.status === 201 && (await r.json()).resultado === 'criado', 'check-in válido responde 201 criado');
ok(chamadas[0].p_chave === 'chave-teste' && chamadas[0].p_codigo === 'GT-ABCD-EFGH' && chamadas[0].p_id_externo === 'aula-123'
  && chamadas[0].p_inicio === BOM.inicio && chamadas[0].p_fim === null, 'repassa chave, código, id, início e fim ao banco', JSON.stringify(chamadas[0]));

r = await tratar(pedido({ ...BOM, id_externo: 987, fim: '2026-11-10T23:30:00Z' }), banco('duplicado'));
ok(r.status === 200 && (await r.json()).resultado === 'duplicado', 'repetido responde 200 duplicado');
ok(chamadas[1].p_id_externo === '987' && chamadas[1].p_fim === '2026-11-10T23:30:00Z', 'id numérico vira texto e o fim vai junto');

chamadas = [];
r = await tratar(pedido(BOM, { chave: '' }), banco('criado'));
ok(r.status === 401 && !chamadas.length, 'sem x-api-key: 401 e não chama o banco');
r = await tratar(pedido(BOM, { metodo: 'GET' }), banco('criado'));
ok(r.status === 405 && !chamadas.length, 'GET: 405');
r = await tratar(pedido('{nada'), banco('criado'));
ok(r.status === 422 && !chamadas.length, 'JSON inválido: 422');
ok(!lerCorpo({ ...BOM, inicio: '2026-11-10T19:00:00' }), 'início sem fuso é recusado');
ok(!lerCorpo({ ...BOM, inicio: 'ontem' }), 'início que não é data é recusado');
ok(!lerCorpo({ ...BOM, codigo: '' }) && !lerCorpo({ ...BOM, id_externo: 'x'.repeat(101) }), 'sem código ou id longo demais é recusado');
ok(!!lerCorpo({ ...BOM, inicio: '2026-11-10T22:00:00.000Z', fim: '' }), 'aceita UTC com milissegundos e fim vazio');

for (const [res, st] of [['chave_invalida', 401], ['codigo_invalido', 404], ['nao_liberado', 403], ['dados_invalidos', 422]]) {
  r = await tratar(pedido(BOM), banco(res));
  ok(r.status === st, `${res} → ${st}`);
}
const erroOriginal = console.error; console.error = () => {};
r = await tratar(pedido(BOM), banco(null, { message: 'falhou' }));
console.error = erroOriginal;
ok(r.status === 500, 'erro do banco → 500');

console.log(fails ? `\n${fails} falha(s)` : '\nCheck-in externo: tudo OK');
process.exit(fails ? 1 : 0);
