// Check-in vindo de um app parceiro (Supabase Edge Function "checkin-externo"), hoje o app do dojo.
//
// A cada check-in de jiu no app do dojo, o servidor dele chama esta função. Ela confere a chave do parceiro e o
// código de vínculo que a pessoa gerou em Você → Integrações, e grava o check-in pela função
// registrar_checkin_externo do banco (supabase/schema.sql). Como chamar: docs/INTEGRACAO-DOJO.md.
//
// Publicar sem exigir login do Supabase (a autenticação é a chave do parceiro): no painel, Edge Functions →
// Deploy a new function → Via Editor, nome checkin-externo, colar este arquivo e desligar Verify JWT
// (ou, pela linha de comando: supabase functions deploy checkin-externo --no-verify-jwt).
// SUPABASE_URL e a chave de serviço já vêm prontos na função. Nada de segredo vai para o repositório.
//
// POST, header x-api-key: <chave do parceiro>, corpo JSON:
//   { "codigo": "GT-XXXX-XXXX", "id_externo": "id do check-in no app do dojo", "inicio": "2026-11-17T19:00:00-03:00",
//     "fim": "2026-11-17T20:30:00-03:00" (opcional) }
// Respostas (JSON { "resultado": ... }): 201 criado · 200 duplicado · 401 chave_invalida · 404 codigo_invalido
//   · 403 nao_liberado · 422 dados_invalidos · 405 metodo · 500 erro.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const STATUS: Record<string, number> = {
  criado: 201, duplicado: 200, chave_invalida: 401, codigo_invalido: 404, nao_liberado: 403, dados_invalidos: 422,
};
// Data e hora com fuso (Z ou ±HH:MM): sem fuso não dá para saber o horário de Brasília.
const ISO_COM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/;

const responder = (resultado: string, status = STATUS[resultado] || 500) =>
  new Response(JSON.stringify({ resultado }), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export function lerCorpo(corpo: unknown): { codigo: string; id_externo: string; inicio: string; fim: string | null } | null {
  if (!corpo || typeof corpo !== 'object') return null;
  const c = corpo as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
  const codigo = texto(c.codigo);
  const idExterno = texto(c.id_externo);
  const inicio = texto(c.inicio);
  const fim = c.fim == null || c.fim === '' ? null : texto(c.fim);
  if (!codigo || codigo.length > 40 || !idExterno || idExterno.length > 100) return null;
  if (!ISO_COM_FUSO.test(inicio) || isNaN(Date.parse(inicio))) return null;
  if (fim !== null && (!ISO_COM_FUSO.test(fim) || isNaN(Date.parse(fim)))) return null;
  return { codigo, id_externo: idExterno, inicio, fim };
}

export async function tratar(req: Request, rpc: (args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>) {
  if (req.method !== 'POST') return responder('metodo', 405);
  const chave = (req.headers.get('x-api-key') || '').trim();
  if (!chave) return responder('chave_invalida');
  let corpo: unknown = null;
  try { corpo = await req.json(); } catch (_) { /* corpo inválido */ }
  const d = lerCorpo(corpo);
  if (!d) return responder('dados_invalidos');
  const { data, error } = await rpc({ p_chave: chave, p_codigo: d.codigo, p_id_externo: d.id_externo, p_inicio: d.inicio, p_fim: d.fim });
  if (error) { console.error('registrar_checkin_externo', error); return responder('erro', 500); }
  return responder(String(data));
}

// Só sobe o servidor dentro do Supabase (nos testes, em Node, não existe Deno). Igual à resumo-semanal.
// A chave de serviço vem em SUPABASE_SERVICE_ROLE_KEY ou, nos projetos com as chaves novas, em SUPABASE_SECRET_KEYS.
if (typeof Deno !== 'undefined' && Deno.serve) {
  const env = (k: string) => Deno.env.get(k) || '';
  let chave = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!chave && env('SUPABASE_SECRET_KEYS')) {
    try { chave = Object.values(JSON.parse(env('SUPABASE_SECRET_KEYS')))[0] as string; } catch (_) { /* segue sem chave */ }
  }
  if (!env('SUPABASE_URL') || !chave) {
    console.error('checkin-externo: faltam SUPABASE_URL ou a chave de serviço');
    Deno.serve(() => responder('erro', 500));
  } else {
    const sb = createClient(env('SUPABASE_URL'), chave, { auth: { persistSession: false, autoRefreshToken: false } });
    Deno.serve((req) => tratar(req, (args) => sb.rpc('registrar_checkin_externo', args)));
  }
}
