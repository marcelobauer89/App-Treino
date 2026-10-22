// Resumo semanal por e-mail do App Treino (Supabase Edge Function "resumo-semanal").
//
// Toda sexta às 9h (Brasília) o agendamento em supabase/agendamentos/resumo-semanal.sql chama esta função.
// Ela monta, para cada pessoa, o resumo dos últimos 7 dias (de sexta a quinta) e envia pelo Gmail.
//
// Segredos (Supabase → Edge Functions → Secrets): GMAIL_USER, GMAIL_APP_PASSWORD, RESUMO_TOKEN, APP_URL
// e FUNCAO_URL (o endereço desta função, mostrado na página dela no painel).
// SUPABASE_URL e a chave de serviço já vêm prontos na função. Nada disso vai para o repositório.
//
// Chamadas:
//   POST com o header x-resumo-token        → envia os resumos (corpo {} ou {"previa": "email"} ou {"simular": true})
//   GET/POST ?sair=<id>&t=<assinatura>      → descadastro em um clique (link do rodapé do e-mail)
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import nodemailer from 'npm:nodemailer@6.9.16';

export const TIPO = 'resumo_semanal';
const FUSO = 'America/Sao_Paulo';
const TIPOS: Record<string, { nome: string; grupo: string }> = {
  t1: { nome: 'Treino 1', grupo: 'musc' }, t2: { nome: 'Treino 2', grupo: 'musc' }, t3: { nome: 'Treino 3', grupo: 'musc' },
  jiu: { nome: 'Jiu-jitsu', grupo: 'jiu' }, bike: { nome: 'Cardio', grupo: 'bike' },
};
const GRUPOS: [string, string, string][] = [['musc', 'Musculação', '#2a78d6'], ['jiu', 'Jiu-jitsu', '#eb6834'], ['bike', 'Cardio', '#1baf7a']];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// ---------- Datas (dias como texto AAAA-MM-DD, no fuso de São Paulo) ----------
export function hojeEm(agora: Date, fuso = FUSO): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(agora).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();
export function fmtDia(dia: string): string {
  const [, m, d] = dia.split('-').map(Number);
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${d} de ${meses[m - 1]}`;
}

// Últimos 7 dias completos: de 7 dias atrás até ontem. Rodando na sexta, vai de sexta a quinta.
export function periodo(agora: Date) {
  const hoje = hojeEm(agora);
  const fim = somarDias(hoje, -1);
  const ini = somarDias(hoje, -7);
  return { hoje, ini, fim, antIni: somarDias(ini, -7), antFim: somarDias(ini, -1) };
}

// ---------- Cálculo do resumo (mesma regra do painel de monitoramento) ----------
type Perfil = { id: string; nome: string; email: string; semana: unknown; dias_jiu: number[] | null };
type Checkin = { usuario_id: string; tipo: string; inicio: string };
type Recorde = { usuario_id: string; dados: { exercicio?: string } | null; criado_em: string };

export function planejadasPorSemana(u: Perfil): number {
  if (Array.isArray(u.semana) && u.semana.length === 7) return (u.semana as unknown[][]).flat().length;
  const jiu = (u.dias_jiu || [2, 4]).map(Number).filter((d) => d >= 1 && d <= 6);
  return 3 + jiu.length + (jiu.includes(6) ? 0 : 1);
}

export function montarResumo(u: Perfil, checkins: Checkin[], recordes: Recorde[], p: ReturnType<typeof periodo>) {
  const meus = checkins.filter((c) => c.usuario_id === u.id);
  const dia = (c: Checkin) => String(c.inicio).slice(0, 10);
  const daSemana = meus.filter((c) => dia(c) >= p.ini && dia(c) <= p.fim);
  const anterior = meus.filter((c) => dia(c) >= p.antIni && dia(c) <= p.antFim).length;
  const porGrupo: Record<string, number> = { musc: 0, jiu: 0, bike: 0 };
  daSemana.forEach((c) => { porGrupo[(TIPOS[c.tipo] || TIPOS.t1).grupo] += 1; });
  const dias = [...new Set(daSemana.map(dia))].sort();
  const planejadas = planejadasPorSemana(u);
  const nomesRecorde = [...new Set(recordes.filter((r) => r.usuario_id === u.id && r.dados && r.dados.exercicio)
    .map((r) => String(r.dados!.exercicio)))];
  return {
    nome: (u.nome || '').trim().split(/\s+/)[0] || '',
    total: daSemana.length,
    anterior,
    porGrupo,
    dias,
    diasTexto: dias.map((d) => DIAS[diaDaSemana(d)]).join(', '),
    planejadas,
    aderencia: planejadas ? Math.min(1, daSemana.length / planejadas) : 0,
    recordes: nomesRecorde,
    periodo: `${fmtDia(p.ini)} a ${fmtDia(p.fim)}`,
  };
}
export type Resumo = ReturnType<typeof montarResumo>;

// ---------- E-mail (HTML com estilos inline, em tabelas, e versão em texto) ----------
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function comparacao(r: Resumo): string {
  const dif = r.total - r.anterior;
  if (r.anterior === 0 && r.total === 0) return '';
  if (dif === 0) return 'O mesmo número da semana anterior.';
  return dif > 0 ? `${plural(dif, 'treino', 'treinos')} a mais que na semana anterior.` : `${plural(-dif, 'treino', 'treinos')} a menos que na semana anterior.`;
}

export function assunto(r: Resumo): string {
  return r.total ? `Seu resumo da semana: ${plural(r.total, 'treino', 'treinos')}` : 'Semana nova, recomeço: bora treinar?';
}

export function montarEmail(r: Resumo, links: { app: string; sair: string }) {
  const ola = r.nome ? `Olá, ${esc(r.nome)}!` : 'Olá!';
  const pct = Math.round(r.aderencia * 100);
  const comp = comparacao(r);
  const fonte = "font-family:Archivo,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const corpoComTreino = `
    <p style="margin:0 0 4px;font-size:15px;color:#4b5361">Nos últimos 7 dias (${esc(r.periodo)}) você treinou</p>
    <p style="margin:0;font-size:56px;line-height:1;font-weight:800;color:#101318">${r.total}<span style="font-size:18px;font-weight:600;color:#4b5361"> ${r.total === 1 ? 'vez' : 'vezes'}</span></p>
    ${comp ? `<p style="margin:8px 0 0;font-size:15px;color:#4b5361">${esc(comp)}</p>` : ''}
    <p style="margin:20px 0 0;font-size:14px;line-height:1.9;color:#101318">
      ${GRUPOS.map(([g, n, cor]) => `<span style="display:inline-block;margin-right:16px;white-space:nowrap"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${cor};margin-right:6px"></span>${n}: <b>${r.porGrupo[g]}</b></span>`).join('')}
    </p>
    ${r.dias.length ? `<p style="margin:12px 0 0;font-size:14px;color:#4b5361">Dias de treino: ${esc(r.diasTexto)}</p>` : ''}
    <p style="margin:24px 0 6px;font-size:15px;color:#101318"><b>Plano da semana:</b> ${r.total} de ${r.planejadas} treinos (${pct}%)</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed"><tr>
      ${pct > 0 ? `<td width="${pct}%" style="background:#2563eb;height:8px;line-height:8px;font-size:0">&nbsp;</td>` : ''}
      ${pct < 100 ? '<td style="background:#e8effd;height:8px;line-height:8px;font-size:0">&nbsp;</td>' : ''}
    </tr></table>
    ${r.recordes.length ? `<p style="margin:24px 0 6px;font-size:15px;color:#101318"><b>🏆 Recordes da semana</b></p>
    <p style="margin:0;font-size:15px;color:#4b5361">${r.recordes.map(esc).join(', ')}</p>` : ''}`;
  const corpoSemTreino = `
    <p style="margin:0 0 12px;font-size:17px;color:#101318">Nos últimos 7 dias (${esc(r.periodo)}) não apareceu nenhum treino no app.</p>
    <p style="margin:0;font-size:15px;color:#4b5361">Toda semana é uma chance de recomeçar. Seu plano tem ${plural(r.planejadas, 'treino', 'treinos')} por semana; que tal marcar o primeiro hoje?</p>`;
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assunto(r))}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;${fonte}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;border-collapse:collapse"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:collapse">
    <tr><td style="padding:0 4px 12px;font-size:22px;font-weight:800;letter-spacing:.5px;color:#2563eb">OSS</td></tr>
    <tr><td style="background:#ffffff;border:1px solid #dde1e7;border-radius:16px;padding:28px 24px">
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#101318">${ola}</h1>
      ${r.total ? corpoComTreino : corpoSemTreino}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border-collapse:collapse"><tr>
        <td style="background:#2563eb;border-radius:10px"><a href="${esc(links.app)}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Abrir o App Treino</a></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 4px 0;font-size:12px;line-height:1.5;color:#4b5361">
      Você recebe este e-mail porque o resumo semanal está ligado no App Treino (Você → Conta).
      <a href="${esc(links.sair)}" style="color:#1d4ed8">Não quero mais receber</a>.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  const texto = [
    r.nome ? `Olá, ${r.nome}!` : 'Olá!', '',
    r.total
      ? [`Nos últimos 7 dias (${r.periodo}) você treinou ${r.total} ${r.total === 1 ? 'vez' : 'vezes'}.`, comp,
        GRUPOS.map(([g, n]) => `${n}: ${r.porGrupo[g]}`).join(' · '),
        r.dias.length ? `Dias de treino: ${r.diasTexto}` : '',
        `Plano da semana: ${r.total} de ${r.planejadas} treinos (${pct}%)`,
        r.recordes.length ? `Recordes da semana: ${r.recordes.join(', ')}` : ''].filter(Boolean).join('\n')
      : `Nos últimos 7 dias (${r.periodo}) não apareceu nenhum treino no app.\nToda semana é uma chance de recomeçar. Seu plano tem ${plural(r.planejadas, 'treino', 'treinos')} por semana; que tal marcar o primeiro hoje?`,
    '', `Abrir o App Treino: ${links.app}`, '',
    `Não quer mais receber o resumo semanal? ${links.sair}`,
  ].join('\n');
  return { assunto: assunto(r), html, texto };
}

// ---------- Assinatura do link de descadastro (HMAC-SHA256 do id com o RESUMO_TOKEN) ----------
export async function assinar(id: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(id)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
// Comparação em tempo constante, para não vazar a assinatura pelo tempo de resposta.
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i += 1) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// ---------- Handler ----------
type Env = { RESUMO_TOKEN: string; APP_URL: string; FUNCAO_URL: string };
type Envio = { para: string; assunto: string; html: string; texto: string; sair: string };
type Deps = { db: any; enviar: (e: Envio) => Promise<void>; env: Env; agora?: () => Date };

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export function criarHandler({ db, enviar, env, agora = () => new Date() }: Deps) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    // Descadastro em um clique (link do e-mail ou botão "Cancelar inscrição" do Gmail).
    if (url.searchParams.has('sair')) {
      const id = url.searchParams.get('sair') || '';
      const t = url.searchParams.get('t') || '';
      if (!/^[0-9a-f-]{36}$/i.test(id) || !iguais(t, await assinar(id, env.RESUMO_TOKEN))) {
        return new Response('Link inválido.', { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
      const { error } = await db.from('perfis').update({ emails_resumo: false }).eq('id', id);
      if (error) return new Response('Não foi possível concluir agora. Tente de novo mais tarde.', { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      if (req.method === 'POST') return new Response('ok', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      return new Response(null, { status: 302, headers: { location: `${env.APP_URL}?resumo=desligado` } });
    }

    if (req.method !== 'POST' || !env.RESUMO_TOKEN || !iguais(req.headers.get('x-resumo-token') || '', env.RESUMO_TOKEN)) {
      return json({ erro: 'não autorizado' }, 401);
    }
    let corpo: { previa?: string; simular?: boolean } = {};
    try { corpo = await req.json(); } catch (_) { corpo = {}; }

    const p = periodo(agora());
    const perfisQ = db.from('perfis').select('id, nome, email, semana, dias_jiu, emails_resumo, acessos');
    const { data: perfis, error: e1 } = corpo.previa
      ? await perfisQ.eq('email', corpo.previa)
      : await perfisQ.eq('emails_resumo', true).gt('acessos', 0);
    if (e1) return json({ erro: e1.message }, 500);
    if (corpo.previa && !perfis.length) return json({ erro: 'e-mail não encontrado entre os usuários' }, 404);

    const { data: checkins, error: e2 } = await db.from('checkins').select('usuario_id, tipo, inicio')
      .gte('inicio', `${p.antIni}T00:00:00`).lt('inicio', `${p.hoje}T00:00:00`);
    const { data: recordes, error: e3 } = await db.from('eventos').select('usuario_id, dados, criado_em').eq('tipo', 'recorde')
      .gte('criado_em', `${p.ini}T00:00:00-03:00`).lt('criado_em', `${p.hoje}T00:00:00-03:00`);
    const { data: jaEnviados, error: e4 } = await db.from('emails_enviados').select('usuario_id').eq('tipo', TIPO).eq('referencia', p.fim);
    const erro = e2 || e3 || e4;
    if (erro) return json({ erro: erro.message }, 500);
    const enviados = new Set((jaEnviados || []).map((x: { usuario_id: string }) => x.usuario_id));

    const resultado = { periodo: { ini: p.ini, fim: p.fim }, enviados: 0, pulados: 0, falhas: [] as { email: string; erro: string }[], simulacao: [] as unknown[] };
    for (const u of perfis as Perfil[]) {
      if (!u.email || (!corpo.previa && enviados.has(u.id))) { resultado.pulados += 1; continue; }
      const r = montarResumo(u, checkins || [], recordes || [], p);
      const sair = `${env.FUNCAO_URL}?sair=${u.id}&t=${await assinar(u.id, env.RESUMO_TOKEN)}`;
      const email = montarEmail(r, { app: env.APP_URL, sair });
      if (corpo.simular) { resultado.simulacao.push({ email: u.email, assunto: email.assunto, treinos: r.total, aderencia: Math.round(r.aderencia * 100) }); continue; }
      try {
        await enviar({ para: u.email, ...email, sair });
        if (!corpo.previa) {
          const { error } = await db.from('emails_enviados').insert({ usuario_id: u.id, tipo: TIPO, referencia: p.fim });
          if (error) console.warn('registro do envio falhou', u.id, error.message);
        }
        resultado.enviados += 1;
      } catch (e) {
        resultado.falhas.push({ email: u.email, erro: String((e as Error)?.message || e) });
      }
    }
    return json(resultado);
  };
}

// ---------- Execução no Supabase ----------
declare const Deno: any;
// RESUMO_SEM_SERVIDOR só existe nos testes, para importar as funções sem subir o servidor.
if (typeof Deno !== 'undefined' && Deno.serve && !Deno.env.get('RESUMO_SEM_SERVIDOR')) iniciar();

function iniciar() {
  const env = (k: string) => Deno.env.get(k) || '';
  // Chave de serviço: a variável antiga ou a primeira das chaves secretas novas (sb_secret_...).
  let chave = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!chave && env('SUPABASE_SECRET_KEYS')) {
    try { chave = Object.values(JSON.parse(env('SUPABASE_SECRET_KEYS')))[0] as string; } catch (_) { /* segue sem chave */ }
  }
  const faltando = ['SUPABASE_URL', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'RESUMO_TOKEN'].filter((k) => !env(k));
  if (!chave) faltando.push('SUPABASE_SERVICE_ROLE_KEY');
  if (faltando.length) {
    Deno.serve(() => json({ erro: `Configuração incompleta. Cadastre em Edge Functions → Secrets: ${faltando.join(', ')}` }, 500));
    return;
  }
  const db = createClient(env('SUPABASE_URL'), chave, { auth: { persistSession: false, autoRefreshToken: false } });
  const gmail = env('GMAIL_USER');
  // Gmail pela porta 465 (SSL): o Supabase bloqueia as portas 25 e 587.
  const transporte = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: gmail, pass: env('GMAIL_APP_PASSWORD').replace(/\s+/g, '') },
  });
  const enviar = async (e: Envio) => {
    await transporte.sendMail({
      from: `"App Treino" <${gmail}>`, to: e.para, subject: e.assunto, html: e.html, text: e.texto,
      headers: { 'List-Unsubscribe': `<${e.sair}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
  };
  Deno.serve(criarHandler({
    db, enviar,
    env: {
      RESUMO_TOKEN: env('RESUMO_TOKEN'),
      APP_URL: env('APP_URL') || 'https://marcelobauer89.github.io/App-Treino/',
      // Endereço desta função, para o link de descadastro. O painel do Supabase pode gerar outro final
      // (ex.: .../functions/v1/rapid-worker); nesse caso, cadastre o endereço no segredo FUNCAO_URL.
      FUNCAO_URL: env('FUNCAO_URL') || `${env('SUPABASE_URL')}/functions/v1/resumo-semanal`,
    },
  }));
}
