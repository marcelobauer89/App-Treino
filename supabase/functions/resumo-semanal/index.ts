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
//   POST com o header x-resumo-token e o que fazer, no corpo JSON ou na URL:
//     {"enviar": true} / ?enviar=1          → envia os resumos para todos (é o que o agendamento usa)
//     {"previa": "email"} / ?previa=email   → envia só para esse e-mail, sem registrar
//     {"simular": true} / ?simular=1        → só mostra quem receberia
//   Sem nenhum desses, responde 400 e não envia nada.
//   GET/POST ?sair=<id>&t=<assinatura>      → descadastro em um clique (link do rodapé do e-mail)
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import nodemailer from 'npm:nodemailer@6.9.16';

export const TIPO = 'resumo_semanal';
const FUSO = 'America/Sao_Paulo';
// Selos e cores iguais aos do app (1 a 5 = treinos de musculação; J = jiu-jitsu; C = cardio; M = muay thai; S = surf).
const TIPOS: Record<string, { nome: string; grupo: string; selo: string }> = {
  t1: { nome: 'Treino 1', grupo: 'musc', selo: '1' }, t2: { nome: 'Treino 2', grupo: 'musc', selo: '2' }, t3: { nome: 'Treino 3', grupo: 'musc', selo: '3' },
  t4: { nome: 'Treino 4', grupo: 'musc', selo: '4' }, t5: { nome: 'Treino 5', grupo: 'musc', selo: '5' },
  jiu: { nome: 'Jiu-jitsu', grupo: 'jiu', selo: 'J' }, bike: { nome: 'Cardio', grupo: 'bike', selo: 'C' },
  muay: { nome: 'Muay Thai', grupo: 'muay', selo: 'M' }, surf: { nome: 'Surf', grupo: 'surf', selo: 'S' },
};
const GRUPOS: [string, string, string][] = [['musc', 'Musculação', '#2a78d6'], ['jiu', 'Jiu-jitsu', '#eb6834'], ['bike', 'Cardio', '#1baf7a'], ['muay', 'Muay Thai', '#eda100'], ['surf', 'Surf', '#c84aa4']];
// Muay Thai e Surf só aparecem no e-mail de quem fez ou planejou; os outros continuam com 3 cartões.
const gruposDe = (r: { porGrupo: Record<string, number>; muayNoPlano?: boolean; surfNoPlano?: boolean }) =>
  GRUPOS.filter(([g]) => (g !== 'muay' || r.porGrupo.muay > 0 || r.muayNoPlano) && (g !== 'surf' || r.porGrupo.surf > 0 || r.surfNoPlano));
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
  const porGrupo: Record<string, number> = { musc: 0, jiu: 0, bike: 0, muay: 0, surf: 0 };
  daSemana.forEach((c) => { porGrupo[(TIPOS[c.tipo] || TIPOS.t1).grupo] += 1; });
  const dias = [...new Set(daSemana.map(dia))].sort();
  const planejadas = planejadasPorSemana(u);
  const nomesRecorde = [...new Set(recordes.filter((r) => r.usuario_id === u.id && r.dados && r.dados.exercicio)
    .map((r) => String(r.dados!.exercicio)))];
  // Os 7 dias do período, com os treinos de cada um na ordem em que foram feitos.
  const semana7 = Array.from({ length: 7 }, (_, i) => {
    const d = somarDias(p.ini, i);
    return {
      dia: d, sigla: DIAS[diaDaSemana(d)], num: Number(d.slice(8, 10)),
      tipos: daSemana.filter((c) => dia(c) === d).sort((a, b) => (a.inicio < b.inicio ? -1 : 1)).map((c) => c.tipo),
    };
  });
  return {
    nome: (u.nome || '').trim().split(/\s+/)[0] || '',
    total: daSemana.length,
    anterior,
    porGrupo,
    muayNoPlano: Array.isArray(u.semana) && (u.semana as unknown[][]).flat().includes('muay'),
    surfNoPlano: Array.isArray(u.semana) && (u.semana as unknown[][]).flat().includes('surf'),
    dias,
    diasTexto: dias.map((d) => DIAS[diaDaSemana(d)]).join(', '),
    planejadas,
    aderencia: planejadas ? Math.min(1, daSemana.length / planejadas) : 0,
    recordes: nomesRecorde,
    semana7,
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

// Frase curta conforme o quanto do plano foi feito.
export function mensagem(r: Resumo): string {
  const faltam = Math.max(0, r.planejadas - r.total);
  if (r.aderencia >= 1) return 'Plano cumprido! 🔥';
  if (r.aderencia >= 0.7) return `Quase lá! ${faltam === 1 ? 'Faltou 1 treino' : `Faltaram ${faltam} treinos`}.`;
  if (r.aderencia >= 0.4) return 'Bom ritmo. Dá para subir na próxima!';
  return 'Cada treino conta. Bora subir na próxima!';
}

const COR = {
  azul: '#2563eb', azulTinta: '#1d4ed8', azulSuave: '#e8effd', tinta: '#101318', tinta2: '#4b5361', fio: '#dde1e7', fundo: '#f3f4f6',
  verde: '#166534', verdeSuave: '#e7f8ee', ambar: '#92400e', ambarSuave: '#fef3c7', selo: '#0b0d10',
};
const corDoTipo = (t: string) => (GRUPOS.find(([g]) => g === (TIPOS[t] || TIPOS.t1).grupo) as [string, string, string])[2];

// links.app é o destino do botão (o link de clique registrado, quando houver); links.pixel, a imagem
// invisível que registra a abertura.
export function montarEmail(r: Resumo, links: { app: string; sair: string; pixel?: string }) {
  const pct = Math.round(r.aderencia * 100);
  const comp = comparacao(r);
  const dif = r.total - r.anterior;
  const fonte = "font-family:Archivo,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const titulo = (t: string) => `<p style="margin:28px 0 10px;font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${COR.tinta2}">${t}</p>`;

  // Indicador ▲/▼ em relação à semana anterior.
  const chip = dif === 0 && r.anterior === 0 ? '' : `
    <span style="display:inline-block;padding:6px 12px;border-radius:999px;font-size:14px;font-weight:800;white-space:nowrap;${
      dif > 0 ? `background:${COR.verdeSuave};color:${COR.verde}` : dif < 0 ? `background:${COR.ambarSuave};color:${COR.ambar}` : `background:${COR.fundo};color:${COR.tinta2}`
    }">${dif > 0 ? `▲ ${dif} a mais` : dif < 0 ? `▼ ${-dif} a menos` : '= igual'}</span>
    <span style="display:block;margin-top:4px;font-size:12px;color:${COR.tinta2}">que na semana anterior</span>`;

  // Faixa com os 7 dias: um selo colorido por treino; dia sem treino fica tracejado.
  const selo = (t: string) => `<div style="margin:6px auto 0;width:30px;height:30px;line-height:30px;border-radius:8px;background:${corDoTipo(t)};color:${COR.selo};font-size:14px;font-weight:800;text-align:center">${esc((TIPOS[t] || TIPOS.t1).selo)}</div>`;
  const vazio = `<div style="margin:6px auto 0;width:28px;height:28px;line-height:28px;border-radius:8px;border:1px dashed ${COR.fio};color:#9aa1ad;font-size:14px;text-align:center">–</div>`;
  const faixa = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:3px 0;table-layout:fixed;margin:0 -3px"><tr>
      ${r.semana7.map((d) => `<td align="center" valign="top" style="padding:8px 0;${d.tipos.length ? `background:${COR.azulSuave};` : ''}border-radius:10px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:${COR.tinta2}">${esc(d.sigla)}</div>
        <div style="font-size:15px;font-weight:800;color:${COR.tinta}">${d.num}</div>
        ${d.tipos.length ? d.tipos.slice(0, 2).map(selo).join('') + (d.tipos.length > 2 ? `<div style="margin-top:4px;font-size:11px;font-weight:700;color:${COR.tinta2}">+${d.tipos.length - 2}</div>` : '') : vazio}
      </td>`).join('')}
    </tr></table>
    <p style="margin:10px 0 0;font-size:12px;line-height:1.6;color:${COR.tinta2}">
      ${gruposDe(r).map(([g, n, cor]) => `<span style="display:inline-block;white-space:nowrap;margin:0 12px 4px 0">${Object.values(TIPOS).filter((t) => t.grupo === g)
        .map((t) => `<span style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:5px;background:${cor};color:${COR.selo};font-size:11px;font-weight:800;text-align:center;margin-right:3px">${t.selo}</span>`).join('')} ${n}</span>`).join('')}
    </p>`;

  // Barra do plano.
  const barra = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
      <td style="font-size:15px;font-weight:800;color:${COR.tinta}">${r.total} de ${r.planejadas} treinos</td>
      <td align="right" style="font-size:22px;font-weight:800;color:${COR.azulTinta}">${pct}%</td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-collapse:separate;table-layout:fixed;border-radius:6px;background:${COR.azulSuave}"><tr>
      ${pct > 0 ? `<td width="${pct}%" style="background:${COR.azul};height:12px;line-height:12px;font-size:0;border-radius:6px">&nbsp;</td>` : ''}
      ${pct < 100 ? '<td style="height:12px;line-height:12px;font-size:0">&nbsp;</td>' : ''}
    </tr></table>
    <p style="margin:8px 0 0;font-size:14px;color:${COR.tinta2}">${esc(mensagem(r))}</p>`;

  // Um cartão por modalidade.
  const cartoes = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed"><tr>
      ${gruposDe(r).map(([g, n, cor], i, todos) => `<td style="padding:0 ${i < todos.length - 1 ? 6 : 0}px 0 ${i > 0 ? 6 : 0}px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr>
          <td align="center" style="border:1px solid ${COR.fio};border-top:4px solid ${cor};border-radius:10px;padding:12px 4px">
            <div style="font-size:26px;line-height:1.1;font-weight:800;color:${COR.tinta}">${r.porGrupo[g]}</div>
            <div style="font-size:12px;color:${COR.tinta2}">${n}</div>
          </td></tr></table>
      </td>`).join('')}
    </tr></table>`;

  const recordes = r.recordes.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-collapse:separate"><tr>
      <td style="background:${COR.ambarSuave};border-radius:12px;padding:16px 18px">
        <p style="margin:0 0 6px;font-size:15px;font-weight:800;color:${COR.ambar}">🏆 ${r.recordes.length === 1 ? 'Novo recorde' : `${r.recordes.length} novos recordes`} na semana</p>
        ${r.recordes.map((n) => `<p style="margin:4px 0 0;font-size:15px;color:${COR.tinta}">▸ ${esc(n)}</p>`).join('')}
      </td></tr></table>` : '';

  const corpoComTreino = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse"><tr>
      <td valign="bottom">
        <span style="font-size:60px;line-height:1;font-weight:800;color:${COR.tinta}">${r.total}</span>
        <span style="font-size:18px;font-weight:700;color:${COR.tinta2}"> ${r.total === 1 ? 'treino' : 'treinos'}</span>
      </td>
      <td valign="bottom" align="right">${chip}</td>
    </tr></table>
    ${titulo('Sua semana')}${faixa}
    ${titulo('Plano da semana')}${barra}
    ${titulo('Por modalidade')}${cartoes}
    ${recordes}`;
  const corpoSemTreino = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-collapse:separate"><tr>
      <td style="background:${COR.azulSuave};border-radius:14px;padding:22px 20px">
        <div style="font-size:36px;line-height:1">💪</div>
        <p style="margin:10px 0 6px;font-size:20px;font-weight:800;color:${COR.tinta}">Semana nova, recomeço</p>
        <p style="margin:0;font-size:15px;line-height:1.5;color:${COR.tinta2}">Não apareceu nenhum treino no app de ${esc(r.periodo)}. Seu plano tem ${plural(r.planejadas, 'treino', 'treinos')} por semana; que tal marcar o primeiro hoje?</p>
      </td></tr></table>`;

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(assunto(r))}</title></head>
<body style="margin:0;padding:0;background:${COR.fundo};${fonte}">
<div style="display:none;max-height:0;overflow:hidden">${esc(r.total ? `${plural(r.total, 'treino', 'treinos')} de ${r.periodo}. ${mensagem(r)}` : 'Toda semana é uma chance de recomeçar.')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo};border-collapse:collapse"><tr><td align="center" style="padding:20px 10px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:separate">
    <tr><td style="background:${COR.azul};border-radius:16px 16px 0 0;padding:22px 22px 20px">
      <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:2px;color:#c7d7fb">OSS · APP TREINO</p>
      <p style="margin:6px 0 0;font-size:26px;line-height:1.2;font-weight:800;color:#ffffff">Seu resumo da semana</p>
      <p style="margin:4px 0 0;font-size:15px;color:#dbe6fd">${esc(r.periodo)}</p>
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${COR.fio};border-top:0;border-radius:0 0 16px 16px;padding:22px 22px 26px">
      <p style="margin:0;font-size:18px;font-weight:700;color:${COR.tinta}">${r.nome ? `Olá, ${esc(r.nome)}! 👋` : 'Olá! 👋'}</p>
      ${r.total ? corpoComTreino : corpoSemTreino}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-collapse:separate"><tr>
        <td align="center" style="background:${COR.azul};border-radius:12px"><a href="${esc(links.app)}" style="display:block;padding:16px 20px;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none">${r.total ? 'Abrir o App Treino →' : 'Marcar meu próximo treino →'}</a></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 6px 0;font-size:12px;line-height:1.5;color:${COR.tinta2};text-align:center">
      Você recebe este e-mail porque o resumo semanal está ligado no App Treino (Você → Conta).
      Registramos se ele foi aberto e se o botão foi tocado, para melhorar o resumo.<br>
      <a href="${esc(links.sair)}" style="color:${COR.azulTinta}">Não quero mais receber</a>
      ${links.pixel ? `<img src="${esc(links.pixel)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;margin:0 auto">` : ''}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  const texto = [
    r.nome ? `Olá, ${r.nome}!` : 'Olá!', '',
    `Seu resumo da semana (${r.periodo})`, '',
    r.total
      ? [`Você treinou ${r.total} ${r.total === 1 ? 'vez' : 'vezes'}.`, comp,
        r.dias.length ? `Dias de treino: ${r.diasTexto}` : '',
        `Plano da semana: ${r.total} de ${r.planejadas} treinos (${pct}%). ${mensagem(r)}`,
        gruposDe(r).map(([g, n]) => `${n}: ${r.porGrupo[g]}`).join(' · '),
        r.recordes.length ? `Recordes da semana: ${r.recordes.join(', ')}` : ''].filter(Boolean).join('\n')
      : `Semana nova, recomeço.\nNão apareceu nenhum treino no app de ${r.periodo}. Seu plano tem ${plural(r.planejadas, 'treino', 'treinos')} por semana; que tal marcar o primeiro hoje?`,
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

// GIF transparente de 1×1 px.
const PIXEL = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) => c.charCodeAt(0));

// Guarda a primeira abertura/clique e conta as repetições. Clicar também conta como aberto.
export async function registrarInteracao(db: any, id: string, ref: string, acao: 'aberto' | 'clique', quando: Date) {
  const { data, error } = await db.from('emails_enviados').select('aberto_em, aberturas, clicado_em, cliques')
    .eq('usuario_id', id).eq('tipo', TIPO).eq('referencia', ref);
  if (error) throw new Error(error.message);
  const linha = (data || [])[0];
  if (!linha) return false; // prévia ou link antigo: não há envio registrado
  const agoraIso = quando.toISOString();
  const campos = acao === 'clique'
    ? { clicado_em: linha.clicado_em || agoraIso, cliques: (linha.cliques || 0) + 1, aberto_em: linha.aberto_em || agoraIso }
    : { aberto_em: linha.aberto_em || agoraIso, aberturas: (linha.aberturas || 0) + 1 };
  const { error: e2 } = await db.from('emails_enviados').update(campos).eq('usuario_id', id).eq('tipo', TIPO).eq('referencia', ref);
  if (e2) throw new Error(e2.message);
  return true;
}

const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export function criarHandler({ db, enviar, env, agora = () => new Date() }: Deps) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    // Abertura (imagem invisível) e clique no botão do e-mail. A assinatura impede registros falsos;
    // a imagem é sempre devolvida, mesmo com link inválido, para não revelar nada.
    if (url.searchParams.has('aberto') || url.searchParams.has('clique')) {
      const acao = url.searchParams.has('clique') ? 'clique' : 'aberto';
      const id = url.searchParams.get(acao) || '';
      const ref = url.searchParams.get('ref') || '';
      const valido = /^[0-9a-f-]{36}$/i.test(id) && /^\d{4}-\d{2}-\d{2}$/.test(ref)
        && iguais(url.searchParams.get('t') || '', await assinar(`${acao}:${id}:${ref}`, env.RESUMO_TOKEN));
      if (valido) {
        try { await registrarInteracao(db, id, ref, acao, agora()); } catch (e) { console.warn('registro de', acao, 'falhou', String(e)); }
      }
      if (acao === 'clique') return new Response(null, { status: 302, headers: { location: env.APP_URL } });
      return new Response(PIXEL, { headers: { 'content-type': 'image/gif', 'cache-control': 'no-store, max-age=0' } });
    }

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
    // O que fazer vem no corpo JSON ou nos parâmetros da URL (?previa=email, ?simular=1, ?enviar=1).
    // Sem um pedido explícito, nada é enviado: um corpo vazio nunca dispara o envio para todos.
    const texto = await req.text().catch(() => '');
    let lido: Record<string, unknown> = {};
    try { const j = JSON.parse(texto); if (j && typeof j === 'object') lido = j; } catch (_) { /* corpo vazio ou inválido */ }
    const q = url.searchParams;
    const sim = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true';
    const corpo = {
      previa: String(q.get('previa') || lido.previa || '').trim().toLowerCase(),
      simular: sim(q.get('simular')) || sim(lido.simular),
      enviar: sim(q.get('enviar')) || sim(lido.enviar),
    };
    const modo = corpo.previa ? 'previa' : corpo.simular ? 'simular' : corpo.enviar ? 'envio' : '';
    if (!modo) return json({ erro: 'diga o que fazer: enviar, previa ou simular', recebido: texto.slice(0, 200) }, 400);

    const p = periodo(agora());
    const perfisQ = db.from('perfis').select('id, nome, email, semana, dias_jiu, emails_resumo, acessos');
    const { data: perfis, error: e1 } = corpo.previa
      ? await perfisQ.ilike('email', corpo.previa.replace(/[\\%_]/g, '\\$&')) // sem diferenciar maiúsculas
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

    const resultado = { modo, periodo: { ini: p.ini, fim: p.fim }, enviados: 0, pulados: 0, falhas: [] as { email: string; erro: string }[], simulacao: [] as unknown[] };
    for (const u of perfis as Perfil[]) {
      if (!u.email || (!corpo.previa && enviados.has(u.id))) { resultado.pulados += 1; continue; }
      const r = montarResumo(u, checkins || [], recordes || [], p);
      const sair = `${env.FUNCAO_URL}?sair=${u.id}&t=${await assinar(u.id, env.RESUMO_TOKEN)}`;
      // Na prévia não há envio registrado, então abertura e clique não contam (referência "previa").
      const ref = corpo.previa ? 'previa' : p.fim;
      const rastro = async (acao: string) => `${env.FUNCAO_URL}?${acao}=${u.id}&ref=${ref}&t=${await assinar(`${acao}:${u.id}:${ref}`, env.RESUMO_TOKEN)}`;
      const email = montarEmail(r, { app: await rastro('clique'), sair, pixel: await rastro('aberto') });
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
