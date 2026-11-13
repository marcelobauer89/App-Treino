// js/admin.js: o monitoramento (admin.html), só para administradores. Seções em docs/MAPA.md.
(() => {
  // ---------- Conexão (mesmo projeto do app, definido no ambiente.js) ----------
  const SUPABASE_URL = window.AMBIENTE.url;
  const SUPABASE_KEY = window.AMBIENTE.chave;
  const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'pkce' } }) : null;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deYmd = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
  const somarDias = (s, n) => { const d = deYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const hoje = () => ymd(new Date());
  const diasEntre = (a, b) => Math.round((deYmd(b) - deYmd(a)) / 864e5);
  const fmtData = (s, op = { day: 'numeric', month: 'short' }) => deYmd(s).toLocaleDateString('pt-BR', op).replace(/\./g, '');
  const fmtNum = (n, casas = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  // Datas: check-ins guardam hora local sem fuso ("AAAA-MM-DDTHH:MM:SS"); eventos e acessos têm fuso.
  const diaDeCheckin = (c) => String(c.inicio).slice(0, 10);
  const diaDeInstante = (iso) => (iso ? ymd(new Date(iso)) : null);

  const TIPOS = {
    t1: { nome: 'Treino 1', selo: '1', grupo: 'musc' }, t2: { nome: 'Treino 2', selo: '2', grupo: 'musc' },
    t3: { nome: 'Treino 3', selo: '3', grupo: 'musc' }, t4: { nome: 'Treino 4', selo: '4', grupo: 'musc' },
    t5: { nome: 'Treino 5', selo: '5', grupo: 'musc' }, t6: { nome: 'Treino 6', selo: '6', grupo: 'musc' }, jiu: { nome: 'Jiu Jitsu', selo: 'J', grupo: 'jiu' },
    bike: { nome: 'Cardio', selo: 'C', grupo: 'bike' }, muay: { nome: 'Muay Thai', selo: 'M', grupo: 'muay' },
    surf: { nome: 'Surf', selo: 'S', grupo: 'surf' },
    futebol: { nome: 'Futebol', selo: 'F', grupo: 'futebol' }, futvolei: { nome: 'Futvôlei', selo: 'V', grupo: 'futvolei' },
  };
  const GRUPOS = [['musc', 'Musculação'], ['jiu', 'Jiu Jitsu'], ['bike', 'Cardio'], ['muay', 'Muay Thai'], ['surf', 'Surf'], ['futebol', 'Futebol'], ['futvolei', 'Futvôlei']];
  const CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];

  const ICON = {
    lapis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    lixeira: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>',
    xis: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    sobe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
    desce: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
    lua: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    seta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    abrir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M11 18h2"/></svg>',
    peso: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
    trofeu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/></svg>',
    ponto: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4"/></svg>',
  };

  // ---------- Estado ----------
  let dados = null; // { usuarios, checkins, eventos }
  let meuId = null; // administrador logado: a própria conta não é excluída por aqui
  let periodo = '30';
  let ordem = { col: 'ultimo', dir: -1 };
  let busca = '';
  // Filtro da aba Usuários, lembrado neste aparelho.
  let soCheckin = false;
  try { soCheckin = localStorage.getItem('bauer-admin-so-checkin') === '1'; } catch (_) {}

  // Esqueleto da Visão geral enquanto os dados chegam; a etapa aparece em cima e é lida pelo leitor de tela.
  const ESQ_CORES = ['musc', 'jiu', 'bike', 'muay', 'surf'];
  function esqueletoHTML() {
    const b = (cls = '') => `<span class="esq-b ${cls}"></span>`;
    const card = () => `<div class="esq-card">${b('t')}${b('v')}${b('c')}</div>`;
    const barras = (n0) => `<div class="esq-barras">${Array.from({ length: 12 }, (_, i) => {
      const n = n0 + i;
      return `<i style="--h:${35 + ((n * 37) % 60)}%;--n:${n};--cor:var(--${ESQ_CORES[n % ESQ_CORES.length]})"></i>`;
    }).join('')}</div>`;
    const grafico = (n0) => `<div class="esq-card">${b('t')}${barras(n0)}</div>`;
    const linha = () => `<div class="esq-linha">${b('a')}${b('n')}${b('x')}</div>`;
    return `<div class="esq" aria-hidden="true">
      <div class="esq-abas">${b()}${b()}${b()}${b()}</div>
      <div class="esq-kpis">${card()}${card()}${card()}${card()}</div>
      <div class="esq-graficos">${grafico(0)}${grafico(5)}</div>
      <div class="esq-card">${b('t')}${linha()}${linha()}${linha()}</div>
    </div>`;
  }
  function mostrarCarregando(etapa) {
    const el = $('estado');
    if (!el.classList.contains('carregando')) {
      el.innerHTML = `<p class="esq-etapa" role="status" id="esq-etapa"></p>${esqueletoHTML()}`;
      el.classList.add('carregando');
      el.setAttribute('aria-busy', 'true');
    }
    $('esq-etapa').textContent = etapa;
    el.hidden = false;
    $('painel').hidden = true;
    $('controles').hidden = true;
  }
  function mostrarEstado(html) {
    $('estado').classList.remove('carregando');
    $('estado').removeAttribute('aria-busy');
    $('estado').innerHTML = html;
    $('estado').hidden = false;
    $('painel').hidden = true;
    $('controles').hidden = true;
  }

  // ---------- Acesso ----------
  async function iniciar() {
    if (!sb) return mostrarEstado('<p>Não foi possível carregar a biblioteca do Supabase. Confira a internet e recarregue a página.</p>');
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      return mostrarEstado(`
        <p>Entre com a sua conta Google de administrador para ver o monitoramento.</p>
        <button class="btn" type="button" id="entrar">Entrar com Google</button>`);
    }
    meuId = session.user.id;
    mostrarCarregando('Conferindo seu acesso…');
    const { data: admin, error } = await sb.rpc('eh_admin');
    if (error) return mostrarEstado(`<p>Não foi possível verificar o acesso. Confira se o <code>supabase/schema.sql</code> foi aplicado.</p>${botaoTentar()}`);
    if (!admin) {
      return mostrarEstado(`
        <p><b>Acesso restrito.</b> A conta ${esc(session.user.email)} não é administradora.</p>
        <button class="btn-sec" type="button" id="sair">Entrar com outra conta</button>`);
    }
    aplicarEstiloDaConta();
    await carregar();
  }
  // O estilo das cores da conta (escolhido no app). A cópia do navegador já foi aplicada no início;
  // aqui vale o que está salvo na conta, para o monitoramento abrir igual em outro aparelho.
  async function aplicarEstiloDaConta() {
    try {
      const { data, error } = await sb.from('perfis').select('estilo').eq('id', meuId).maybeSingle();
      if (error || !data || typeof data.estilo !== 'string') return;
      const e = data.estilo;
      if (e !== 'padrao' && /^[a-z_]+$/.test(e)) document.documentElement.dataset.estilo = e;
      else delete document.documentElement.dataset.estilo;
      try { localStorage.setItem('bauer-estilo', e); } catch (_) {}
    } catch (_) {}
  }
  const botaoTentar = () => '<button class="btn-sec" type="button" id="tentar">Tentar de novo</button>';

  // O Supabase devolve no máximo 1.000 linhas por chamada: busca em páginas até a lista acabar,
  // senão os eventos e check-ins mais novos ficam de fora quando o banco passa disso.
  const POR_PAGINA = 1000;
  async function todas(nome, args) {
    const linhas = [];
    for (let de = 0; ; de += POR_PAGINA) {
      const r = await sb.rpc(nome, args).range(de, de + POR_PAGINA - 1);
      if (r.error) return r;
      const pagina = r.data || [];
      // Funções que devolvem um valor só (não uma lista) chegam como estão.
      if (!Array.isArray(r.data)) return r;
      linhas.push(...pagina);
      if (pagina.length < POR_PAGINA) return { data: linhas, error: null };
    }
  }

  // Eventos são a lista que mais cresce: o painel busca só os do período escolhido e do anterior (para a comparação),
  // e no mínimo os últimos 35 dias ("Quem sumiu" olha 4 semanas + 7 dias). Só "Tudo" baixa o histórico inteiro.
  // Trocar para um período mais longo do que o já buscado busca de novo.
  let eventosDesde; // 'AAAA-MM-DD' do primeiro dia buscado; null = histórico inteiro; undefined = ainda não buscou
  function eventosNecessarios(p) {
    if (p === 'tudo') return null;
    const n = p === 'hoje' ? 1 : Number(p);
    return somarDias(hoje(), -Math.max(2 * n, 35));
  }
  const eventosCobrem = (p) => eventosDesde === null || (eventosDesde !== undefined && eventosNecessarios(p) !== null && eventosDesde <= eventosNecessarios(p));

  async function carregar() {
    const primeira = !dados;
    if (primeira) mostrarCarregando('Buscando usuários, check-ins e e-mails…');
    $('atualizar').disabled = true;
    $('atualizar').classList.add('girando');
    const desde = eventosNecessarios(periodo);
    const argsEventos = desde ? { desde: deYmd(desde).toISOString() } : undefined;
    const [u, c, e, em, cv] = await Promise.all([['admin_usuarios'], ['admin_checkins'], ['admin_eventos', argsEventos], ['admin_emails'], ['admin_convites']].map(([nome, args]) => todas(nome, args)));
    $('atualizar').disabled = false;
    $('atualizar').classList.remove('girando');
    if (u.error || c.error || e.error) {
      return mostrarEstado(`<p>Não foi possível carregar os dados. ${esc((u.error || c.error || e.error).message)}</p>${botaoTentar()}`);
    }
    // Sem a função admin_emails (schema antigo), só a aba E-mails fica sem dados.
    eventosDesde = desde;
    dados = { usuarios: u.data || [], checkins: (c.data || []).filter((x) => TIPOS[x.tipo]), eventos: e.data || [],
      emails: em.error ? null : (em.data || []).filter((x) => x.tipo === 'resumo_semanal'), erroEmails: em.error ? em.error.message : '',
      convites: cv.error ? null : cv.data || [] };
    const agora = new Date();
    $('atualizado').textContent = `Atualizado às ${pad(agora.getHours())}:${pad(agora.getMinutes())}`;
    if (primeira) {
      mostrarCarregando('Montando os gráficos…');
      await new Promise((ok) => requestAnimationFrame(() => ok()));
    }
    $('estado').hidden = true;
    $('estado').classList.remove('carregando');
    $('estado').removeAttribute('aria-busy');
    $('painel').hidden = false;
    $('controles').hidden = false;
    render();
    if (primeira) entrarEmCascata();
    ligarOnline();
    carregarExercicios();
  }

  // Primeira abertura: os blocos da aba visível entram um depois do outro (sem movimento, se o sistema pedir).
  function entrarEmCascata() {
    const painel = $('painel');
    const aba = painel.querySelector('[role="tabpanel"]:not([hidden])');
    const blocos = [painel.querySelector('.abas'), ...(aba ? aba.querySelectorAll(':scope > section, .kpi, .graficos > section') : [])].filter(Boolean);
    blocos.forEach((el, i) => { el.classList.add('entra-item'); el.style.setProperty('--i', String(i)); });
    painel.classList.add('entra');
    setTimeout(() => {
      painel.classList.remove('entra');
      blocos.forEach((el) => { el.classList.remove('entra-item'); el.style.removeProperty('--i'); });
    }, 600 + blocos.length * 55);
  }

  // ---------- On-line agora (Supabase Realtime Presence) ----------
  // Cada pessoa publica a própria presença no canal privado "online:<id>"; o admin escuta o canal de cada usuário.
  const NOMES_TELA = { treino: 'Treino', dashboard: 'Dashboard', voce: 'Você' };
  const canais = new Map(); // id do usuário → canal
  const online = new Map(); // id do usuário → { tela, desde, sistema }
  let detalheId = null, verErroOnline = false;
  async function ligarOnline() {
    if (!sb.channel) return;
    try { if (sb.realtime && sb.realtime.setAuth) await sb.realtime.setAuth(); } catch (_) {}
    dados.usuarios.forEach((u) => {
      if (canais.has(u.id)) return;
      const canal = sb.channel(`online:${u.id}`, { config: { private: true } });
      canal.on('presence', { event: 'sync' }, () => {
        // Mais de um aparelho aberto: vale o que entrou por último.
        const metas = Object.values(canal.presenceState()).flat().sort((a, b) => ((a.desde || '') < (b.desde || '') ? 1 : -1));
        if (metas.length) online.set(u.id, metas[0]); else online.delete(u.id);
        atualizarOnline();
      });
      canal.subscribe((status, err) => {
        canal.situacaoOnline = status;
        canal.erroOnline = status === 'SUBSCRIBED' ? '' : `${status}${err ? `: ${err.message || err}` : ''}`;
        if (status !== 'SUBSCRIBED') console.warn(`Realtime online:${u.id}`, canal.erroOnline);
        atualizarOnline();
      });
      canais.set(u.id, canal);
    });
    atualizarOnline();
  }
  function desligarOnline() {
    canais.forEach((c) => sb.removeChannel(c));
    canais.clear();
    online.clear();
  }
  function noApp(desde) {
    const min = Math.max(0, Math.floor((Date.now() - new Date(desde)) / 6e4));
    if (!desde || Number.isNaN(min)) return '';
    if (min < 1) return 'agora mesmo';
    return min < 60 ? `há ${min} min` : `há ${Math.floor(min / 60)} h ${min % 60} min`;
  }
  const descricaoOnline = (m) => [NOMES_TELA[m.tela] || m.tela, noApp(m.desde)].filter(Boolean).join(' · ');
  const seloOnline = (id) => (online.has(id)
    ? `<span class="situacao online"><span class="ponto on" aria-hidden="true"></span>On-line · ${esc(descricaoOnline(online.get(id)))}</span>` : '');
  // Ponto verde pulsando na aba Visão geral quando há alguém on-line e outra aba está aberta.
  function atualizarAbaOnline() {
    const n = dados ? dados.usuarios.filter((u) => online.has(u.id)).length : 0;
    const el = $('aba-online');
    el.hidden = !n || aba === 'geral';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `${n} ${n === 1 ? 'pessoa' : 'pessoas'} on-line agora`);
  }
  function atualizarOnline() {
    if (!dados) return;
    atualizarAbaOnline();
    // Status por canal: "Ao vivo" só quando todos conectaram; se parte falhou, mostra quantos e o erro.
    const FALHAS = ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'];
    const todos = [...canais.entries()];
    const conectados = todos.filter(([, c]) => c.situacaoOnline === 'SUBSCRIBED').length;
    const falharam = todos.filter(([, c]) => FALHAS.includes(c.situacaoOnline));
    const estado = todos.length && falharam.length === todos.length ? 'erro'
      : falharam.length && conectados + falharam.length === todos.length ? 'parcial'
        : conectados ? 'vivo' : 'conectando';
    const nomeDe = (id) => { const u = dados.usuarios.find((x) => x.id === id); return u ? (u.nome || u.email) : id; };
    const detalheErro = falharam.length
      ? `<p class="on-vazio on-erro"${estado === 'parcial' && !verErroOnline ? ' hidden' : ''}>Não conectou: ${esc(falharam.map(([id]) => nomeDe(id)).join(', '))}. Erro: ${esc(falharam[0][1].erroOnline)}</p>` : '';
    const lista = dados.usuarios.filter((u) => online.has(u.id))
      .sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, 'pt-BR'));
    $('online').classList.toggle('tem', lista.length > 0);
    $('on-conta').textContent = estado === 'erro' ? '' : `· ${lista.length}`;
    $('on-status').innerHTML = estado === 'vivo' ? 'Ao vivo' : estado === 'erro' ? ''
      : estado === 'parcial' ? `Ao vivo em ${conectados} de ${todos.length} usuários · <button class="link-btn" type="button" id="ver-erro-online" aria-expanded="${verErroOnline}">${verErroOnline ? 'Ocultar detalhes' : 'Ver detalhes'}</button>`
        : 'Conectando…';
    $('on-corpo').innerHTML = (estado === 'erro'
      ? `<p class="on-vazio">Ao vivo indisponível. <button class="link-btn" type="button" id="tentar-online">Tentar de novo</button></p>${detalheErro}`
      : estado === 'parcial' ? detalheErro : '') + (estado === 'erro' ? '' : lista.length ? `<ul class="on-lista">${lista.map((u) => `<li><button type="button" data-abrir="${u.id}">
          <span class="avatar on" aria-hidden="true">${esc(iniciais(u.nome, u.email))}</span>
          <span><b>${esc(u.nome || u.email)}</b><small>${esc(descricaoOnline(online.get(u.id)))}</small></span></button></li>`).join('')}</ul>`
        : `<p class="on-vazio">${estado === 'conectando' ? 'Conectando ao vivo…' : 'Ninguém on-line agora.'}</p>`);
    document.querySelectorAll('#usuarios-corpo tr[data-usuario]').forEach((tr) => {
      const on = online.has(tr.dataset.usuario);
      tr.querySelector('.avatar').classList.toggle('on', on);
      tr.querySelector('.on-sr').hidden = !on;
    });
    if ($('detalhe').open && $('det-online')) $('det-online').innerHTML = seloOnline(detalheId);
  }
  setInterval(atualizarOnline, 30000);

  // ---------- Cálculos ----------
  // Atividades planejadas por semana: semana montada em Você ou, sem ela, a padrão com os dias de jiu.
  function planejadasPorSemana(u) {
    if (Array.isArray(u.semana) && u.semana.length === 7) return u.semana.flat().length;
    const jiu = (u.dias_jiu || [2, 4]).map(Number).filter((d) => d >= 1 && d <= 6);
    return 3 + jiu.length + (jiu.includes(6) ? 0 : 1);
  }
  function janela(dias) {
    const fim = hoje();
    if (dias === 'tudo') {
      const datas = [...dados.checkins.map(diaDeCheckin), ...dados.eventos.map((e) => diaDeInstante(e.criado_em)),
        ...dados.usuarios.map((u) => diaDeInstante(u.cadastro))].filter(Boolean).sort();
      const ini = datas[0] && datas[0] < fim ? datas[0] : somarDias(fim, -6);
      return { ini, fim, dias: diasEntre(ini, fim) + 1, anterior: null };
    }
    const n = dias === 'hoje' ? 1 : Number(dias);
    const ini = somarDias(fim, -(n - 1));
    return { ini, fim, dias: n, anterior: { ini: somarDias(ini, -n), fim: somarDias(ini, -1), dias: n } };
  }
  const dentro = (d, j) => d && d >= j.ini && d <= j.fim;
  // Dias com atividade de cada usuário: check-ins, eventos e o último acesso.
  function diasAtivos() {
    const m = new Map(dados.usuarios.map((u) => [u.id, new Set()]));
    const marcar = (id, d) => { if (d && m.has(id)) m.get(id).add(d); };
    dados.checkins.forEach((c) => marcar(c.usuario_id, diaDeCheckin(c)));
    dados.eventos.forEach((e) => marcar(e.usuario_id, diaDeInstante(e.criado_em)));
    dados.usuarios.forEach((u) => marcar(u.id, diaDeInstante(u.ultimo_acesso)));
    return m;
  }
  // Treinos planejados no período. Num dia só (Hoje), vale o que a semana montada prevê para aquele dia
  // da semana; sem semana montada, a média da semana padrão.
  function planejadasNoPeriodo(u, j) {
    if (j.dias === 1 && Array.isArray(u.semana) && u.semana.length === 7) return (u.semana[deYmd(j.ini).getDay()] || []).length;
    return planejadasPorSemana(u) * (j.dias / 7);
  }
  // Aderência de uma pessoa: feito ÷ planejado, até 100%. Sem nada planejado (dia de descanso), não conta: null.
  const aderenciaDe = (feitos, plan) => (plan ? Math.min(1, feitos / plan) : null);
  function metricas(j, ativosMap) {
    const ativos = dados.usuarios.filter((u) => [...ativosMap.get(u.id)].some((d) => dentro(d, j)));
    const cks = dados.checkins.filter((c) => dentro(diaDeCheckin(c), j));
    const semanas = j.dias / 7;
    const treinosSemana = ativos.length ? cks.length / ativos.length / semanas : 0;
    const treinosPorUsuario = ativos.length ? cks.length / ativos.length : 0;
    const ader = ativos.map((u) => aderenciaDe(cks.filter((c) => c.usuario_id === u.id).length, planejadasNoPeriodo(u, j)))
      .filter((x) => x !== null);
    const aderencia = ader.length ? ader.reduce((a, b) => a + b, 0) / ader.length : null;
    return { ativos: ativos.length, checkins: cks.length, treinosSemana, treinosPorUsuario, aderencia };
  }
  // Retenção: de quem usou de 8 a 14 dias atrás, quantos voltaram nos últimos 7 dias.
  function retencao(ativosMap) {
    const fim = hoje();
    const atual = { ini: somarDias(fim, -6), fim };
    const ant = { ini: somarDias(fim, -13), fim: somarDias(fim, -7) };
    const base = dados.usuarios.filter((u) => [...ativosMap.get(u.id)].some((d) => dentro(d, ant)));
    const voltaram = base.filter((u) => [...ativosMap.get(u.id)].some((d) => dentro(d, atual)));
    return { base: base.length, voltaram: voltaram.length };
  }

  // Quem sumiu (possíveis churn): usou o app nos últimos 28 dias, mas não nos últimos 7 (relativo a hoje, não ao período).
  // Uso é qualquer atividade (diasAtivos: check-ins, eventos do app e o último acesso), não só o check-in:
  // quem abriu o app ou registrou pesos sem fazer check-in não sumiu.
  function sumidos(ativosMap) {
    const fim = hoje();
    const lim7 = somarDias(fim, -6), lim28 = somarDias(fim, -27);
    let base = 0;
    const lista = [];
    dados.usuarios.forEach((u) => {
      if (u.id === meuId) return;
      const dias = [...(ativosMap.get(u.id) || [])].filter((d) => d <= fim).sort();
      const recentes = dias.filter((d) => d >= lim28);
      if (!recentes.length) return;
      base += 1;
      if (recentes.some((d) => d >= lim7)) return;
      const ultimoUso = dias[dias.length - 1];
      const meus = dados.checkins.filter((c) => c.usuario_id === u.id && diaDeCheckin(c) <= fim);
      const ultimo = meus.length ? meus.reduce((a, c) => (diaDeCheckin(c) > diaDeCheckin(a) ? c : a)) : null;
      // Ritmo antes de sumir: dias de uso por semana nas 3 semanas entre 28 e 8 dias atrás.
      lista.push({ u, ultimo, ultimoUso, dias: diasEntre(ultimoUso, fim), ritmo: recentes.length / 3 });
    });
    lista.sort((a, b) => b.ritmo - a.ritmo || b.dias - a.dias);
    return { base, lista };
  }
  // Recordes pessoais no período (eventos "recorde": quem, quando, exercício; sem o peso).
  const recordesDe = (j) => dados.eventos.filter((e) => e.tipo === 'recorde' && dentro(diaDeInstante(e.criado_em), j));
  let evoluiuTodos = false;

  // ---------- Render ----------
  function render() {
    fecharInfo();
    const j = janela(periodo);
    const ativosMap = diasAtivos();
    renderKpis(j, ativosMap);
    renderGraficos(j, ativosMap);
    renderListasGeral(j, ativosMap);
    renderTreinos(j);
    renderJornadas(j);
    renderUsuarios(j, ativosMap);
    renderSaude(j);
    renderEmails(j);
    renderConvites();
    atualizarOnline();
  }

  function delta(atual, anterior, { pct = false } = {}) {
    if (anterior == null) return '';
    const dif = atual - anterior;
    const cls = Math.abs(dif) < 1e-9 ? 'igual' : dif > 0 ? 'sobe' : 'desce';
    const txt = pct ? `${fmtNum(Math.abs(dif) * 100)} p.p.` : fmtNum(Math.abs(dif), Number.isInteger(dif) ? 0 : 1);
    const icone = cls === 'sobe' ? ICON.sobe : cls === 'desce' ? ICON.desce : '';
    const palavra = cls === 'igual' ? 'igual ao período anterior' : `${cls === 'sobe' ? 'mais' : 'menos'} que o período anterior`;
    return `<span class="delta ${cls}">${icone}${cls === 'igual' ? '=' : txt}<span class="sr">&nbsp;${palavra}</span></span>`;
  }

  // Card de número com ícone de informação; prefixo separa os ids de cada aba (k, s, e).
  function fabricaDeCards(prefixo) {
    let n = 0;
    return (titulo, valor, { longo, curto = longo, d, largo = false, destaque = false, info }) => {
      n += 1;
      const id = `info-${prefixo}${n}`;
      return `
      <div class="kpi${largo ? ' largo' : ''}${destaque ? ' destaque' : ''}"><dt>${titulo}<button class="info" type="button" data-info="${id}" aria-expanded="false" aria-controls="${id}" aria-label="Como funciona: ${titulo}">${ICON.info}</button></dt>
      <dd class="info-txt" id="${id}" role="note" hidden>${info}</dd>
      <dd><span class="valor">${valor}</span></dd>
      <dd class="ctx"><span class="longo">${longo}${d ? ' · ' : ''}</span><span class="curto">${curto}</span>${d || ''}</dd></div>`;
    };
  }
  const rotuloDoPeriodo = () => (periodo === 'tudo' ? 'desde o início' : periodo === 'hoje' ? 'hoje' : `nos últimos ${periodo} dias`);
  const comparaDoPeriodo = () => (periodo === 'tudo' ? 'No período Tudo não há comparação.' : periodo === 'hoje' ? 'A seta compara com ontem.' : `A seta compara com os ${periodo} dias anteriores.`);

  function renderKpis(j, ativosMap) {
    const m = metricas(j, ativosMap);
    const a = j.anterior ? metricas(j.anterior, ativosMap) : null;
    const r = retencao(ativosMap);
    const s = sumidos(ativosMap);
    const rec = recordesDe(j), recAnt = j.anterior ? recordesDe(j.anterior) : null;
    const pessoasRec = new Set(rec.map((e) => e.usuario_id)).size;
    const total = dados.usuarios.length;
    const ehHoje = periodo === 'hoje';
    const rotuloPeriodo = periodo === 'tudo' ? 'desde o início' : ehHoje ? 'hoje' : `nos últimos ${periodo} dias`;
    // No celular o contexto usa a versão curta (o período já aparece no seletor).
    // Sem período anterior ("Tudo"), d chega null e não mostra variação.
    const tile = fabricaDeCards('k');
    const compara = periodo === 'tudo' ? 'No período Tudo não há comparação.' : ehHoje ? 'A seta compara com ontem.' : `A seta compara com os ${periodo} dias anteriores.`;
    const um = (v) => Math.round(v * 10) / 10;
    $('kpis').innerHTML = [
      tile('Aderência ao plano', m.aderencia === null ? '—' : `${fmtNum(m.aderencia * 100)}<small>%</small>`, { longo: ehHoje ? 'feito ÷ planejado para hoje' : 'feito ÷ planejado na semana montada', curto: 'do planejado', destaque: true,
        d: a && m.aderencia !== null && a.aderencia !== null && delta(m.aderencia, a.aderencia, { pct: true }),
        info: `Quanto do plano foi cumprido, em média, por quem usou o app. Para cada pessoa: check-ins ÷ treinos planejados ${ehHoje ? 'para hoje (o dia da semana na semana montada em Você ou, sem ela, a média da semana padrão)' : 'no período (pela semana montada em Você ou, sem ela, pela semana padrão)'}, com limite de 100%. Quem não tinha nada planejado${ehHoje ? ' hoje (dia de descanso)' : ''} não entra na média. ${periodo === 'tudo' ? 'No período Tudo não há comparação.' : `A seta mostra a diferença em pontos percentuais (p.p.) para ${ehHoje ? 'ontem' : 'o período anterior'}.`}` }),
      tile('Usuários ativos', `${m.ativos}<small> de ${total}</small>`, { longo: rotuloPeriodo, curto: '', destaque: true, d: a && delta(m.ativos, a.ativos),
        info: `Quantas pessoas abriram o app ou fizeram check-in pelo menos uma vez no período. O número menor é o total de cadastrados. ${compara}` }),
      tile('Check-ins', fmtNum(m.checkins), { longo: rotuloPeriodo, curto: '', d: a && delta(m.checkins, a.checkins),
        info: `Total de check-ins feitos no período, somando todos os usuários e tipos de treino (musculação, Jiu Jitsu, cardio, muay thai, surf, futebol e futvôlei), inclusive os registrados depois. ${compara}` }),
      // Num dia só, "por semana" multiplicaria o dia por 7; com Hoje o card mostra os treinos por usuário.
      ehHoje
        ? tile('Treinos por usuário', fmtNum(m.treinosPorUsuario, 1), { longo: 'por usuário ativo, hoje', curto: 'por ativo', d: a && delta(um(m.treinosPorUsuario), um(a.treinosPorUsuario)),
          info: `Média de treinos de hoje de quem usou o app hoje: check-ins de hoje ÷ usuários ativos hoje. ${compara}` })
        : tile('Treinos por semana', fmtNum(m.treinosSemana, 1), { longo: 'por usuário ativo', curto: 'por ativo', d: a && delta(um(m.treinosSemana), um(a.treinosSemana)),
          info: `Média de treinos por semana de quem usou o app: check-ins do período ÷ usuários ativos ÷ semanas do período. ${compara}` }),
      tile('Voltaram nesta semana', r.base ? `${fmtNum(r.voltaram / r.base * 100)}<small>%</small>` : '—',
        { longo: r.base ? `${r.voltaram} de ${r.base} que usaram na semana anterior` : 'sem uso na semana anterior', largo: true,
          info: 'Das pessoas que usaram o app entre 8 e 14 dias atrás, quantas voltaram a usar nos últimos 7 dias. Mostra se o app está segurando os usuários. Não muda com o período escolhido.' }),
      tile('Sumiram', s.base ? `${s.lista.length}<small> de ${s.base}</small>` : '—',
        { longo: s.base ? 'sem usar o app há 7 dias ou mais' : 'ninguém usou o app nas últimas 4 semanas', curto: 'sem usar há 7+ dias',
          info: 'Possíveis churn: pessoas que usaram o app nas últimas 4 semanas, mas não abriram nem registraram nada nos últimos 7 dias (check-in, pesos ou só abrir o app contam como uso). O número menor é quem usou o app nas últimas 4 semanas. A lista está em "Quem sumiu", mais abaixo. Não muda com o período escolhido.' }),
      tile('Recordes', fmtNum(rec.length), { longo: `de ${pessoasRec} ${pessoasRec === 1 ? 'pessoa' : 'pessoas'}`, curto: `${pessoasRec} ${pessoasRec === 1 ? 'pessoa' : 'pessoas'}`, d: recAnt && delta(rec.length, recAnt.length),
        info: `Vezes em que alguém superou o próprio peso máximo num exercício no período (o primeiro peso registrado não conta). Os pesos não aparecem no painel. Quem mais evoluiu está mais abaixo. ${compara}` }),
    ].join('');
  }

  function renderListasGeral(j, ativosMap = diasAtivos()) {
    const s = sumidos(ativosMap);
    $('sumiu-lista').innerHTML = s.lista.length ? s.lista.map((x) => `<div class="item-lista">
        <button class="item-topo" type="button" data-abrir-usuario="${x.u.id}">
          <span class="item-titulo">${esc(x.u.nome || x.u.email)}</span>
          <span class="item-num">${x.dias}<small>dias</small></span>
          <span class="item-sub">último uso ${relativo(x.ultimoUso)} · ${x.ultimo ? `último check-in ${relativo(diaDeCheckin(x.ultimo))} (${esc((TIPOS[x.ultimo.tipo] || {}).nome || x.ultimo.tipo)})` : 'nunca fez check-in'} · usava o app ${fmtNum(x.ritmo, Number.isInteger(x.ritmo) ? 0 : 1)}× por semana</span>
        </button></div>`).join('')
      : `<p class="vazio">${s.base ? 'Ninguém sumiu: todo mundo que usava o app usou nos últimos 7 dias.' : 'Ninguém usou o app nas últimas 4 semanas.'}</p>`;
    // Ranking de recordes no período.
    const rec = recordesDe(j);
    const porPessoa = new Map();
    rec.forEach((e) => {
      if (!porPessoa.has(e.usuario_id)) porPessoa.set(e.usuario_id, { id: e.usuario_id, n: 0, ex: new Map(), ultimo: '' });
      const g = porPessoa.get(e.usuario_id);
      g.n += 1;
      const ex = (e.dados || {}).exercicio || 'exercício';
      g.ex.set(ex, (g.ex.get(ex) || 0) + 1);
      if (e.criado_em > g.ultimo) g.ultimo = e.criado_em;
    });
    const ranking = [...porPessoa.values()].sort((a, b) => b.n - a.n || (a.ultimo < b.ultimo ? 1 : -1));
    const mostrados = evoluiuTodos ? ranking : ranking.slice(0, 5);
    const exs = (g) => { const l = [...g.ex.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n); return esc(l.slice(0, 3).join(', ')) + (l.length > 3 ? ` e mais ${l.length - 3}` : ''); };
    $('evoluiu-lista').innerHTML = ranking.length ? mostrados.map((g, i) => {
      const u = dados.usuarios.find((x) => x.id === g.id);
      return `<div class="item-lista">
        <button class="item-topo" type="button"${u ? ` data-abrir-usuario="${g.id}"` : ''}>
          <span class="item-titulo">${esc(u ? u.nome || u.email : 'Usuário removido')}</span>
          <span class="item-num"><span class="trofeu-num">${i === 0 ? ICON.trofeu : ''}${g.n}</span><small>${g.n === 1 ? 'recorde' : 'recordes'}</small></span>
          <span class="item-sub">${exs(g)}</span>
        </button></div>`;
    }).join('') + (ranking.length > 5 ? `<button class="link-btn ver-todos" type="button" data-evoluiu-todos aria-expanded="${evoluiuTodos}">${evoluiuTodos ? 'Mostrar menos' : `Ver todos (${ranking.length})`}</button>` : '')
      : '<p class="vazio">Nenhum recorde no período.</p>';
  }

  // Treinos mais feitos no período: check-ins por tipo (Musculação junta os treinos 1 a 6), do maior para o menor.
  function renderTreinos(j) {
    const cks = dados.checkins.filter((c) => dentro(diaDeCheckin(c), j));
    const grupos = GRUPOS.map(([g, nome]) => {
      const meus = cks.filter((c) => (TIPOS[c.tipo] ? TIPOS[c.tipo].grupo : 'musc') === g);
      const porTreino = new Map();
      if (g === 'musc') meus.forEach((c) => porTreino.set(c.tipo, (porTreino.get(c.tipo) || 0) + 1));
      return { g, nome, n: meus.length, pessoas: new Set(meus.map((c) => c.usuario_id)).size, porTreino };
    }).sort((a, b) => b.n - a.n);
    const lista = $('treinos-lista');
    if (!cks.length) { lista.innerHTML = '<p class="vazio">Nenhum check-in no período.</p>'; return; }
    const maior = grupos[0].n;
    // Tipos sem check-in no período viram uma linha só no fim (carga cognitiva), em vez de uma barra vazia cada.
    const zerados = grupos.filter((x) => !x.n);
    lista.innerHTML = grupos.filter((x) => x.n).map((x) => {
      const pct = Math.round(x.n / cks.length * 100);
      const treinos = [...x.porTreino.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .map(([t, n]) => `${esc(TIPOS[t].nome)}: ${n}`).join(' · ');
      const sub = x.n ? `${x.pessoas} ${x.pessoas === 1 ? 'pessoa' : 'pessoas'}${treinos ? ` · ${treinos}` : ''}` : 'nenhum check-in';
      return `<li class="${x.n ? '' : 'zerado'}">
          <span class="rt-nome"><i style="background:var(--${x.g})" aria-hidden="true"></i>${x.nome}</span>
          <span class="rt-trilho" aria-hidden="true">${x.n ? `<span class="rt-barra" style="width:${x.n / maior * 100}%;background:var(--${x.g})"></span>` : ''}</span>
          <span class="rt-num">${fmtNum(x.n)}<small>${pct}%</small></span>
          <span class="rt-sub">${sub}</span>
        </li>`;
    }).join('') + (zerados.length ? `<li class="rt-zerados">Sem check-in no período: ${zerados.map((x) => x.nome).join(', ')}</li>` : '');
  }

  // Jornadas prontas escolhidas no período: a última escolha de cada pessoa, da mais escolhida para a menos.
  const NOMES_JORNADA = { jiu: 'Jiu Jitsu', hipertrofia: 'Hipertrofia', forca: 'Força e potência', mobilidade: 'Mobilidade e prevenção' };
  const CORES_JORNADA = { jiu: 'jiu', hipertrofia: 'musc', forca: 'muay', mobilidade: 'bike' };
  function renderJornadas(j) {
    const ultima = new Map();
    dados.eventos.filter((e) => e.tipo === 'jornada_escolhida' && dentro(diaDeInstante(e.criado_em), j))
      .sort((a, b) => (a.criado_em < b.criado_em ? -1 : 1))
      .forEach((e) => ultima.set(e.usuario_id, e.dados || {}));
    const lista = $('jornadas-lista');
    if (!ultima.size) { lista.innerHTML = '<p class="vazio">Ninguém escolheu um objetivo no período.</p>'; return; }
    const escolhas = [...ultima.values()];
    const linhas = Object.keys(NOMES_JORNADA).map((id) => {
      const minhas = escolhas.filter((d) => d.jornada === id);
      return { id, n: minhas.length, troca: minhas.filter((d) => d.origem === 'trocar').length };
    }).sort((a, b) => b.n - a.n);
    const maior = linhas[0].n;
    lista.innerHTML = linhas.map((x) => `<li class="${x.n ? '' : 'zerado'}">
        <span class="rt-nome"><i style="background:var(--${CORES_JORNADA[x.id]})" aria-hidden="true"></i>${NOMES_JORNADA[x.id]}</span>
        <span class="rt-trilho" aria-hidden="true">${x.n ? `<span class="rt-barra" style="width:${x.n / maior * 100}%;background:var(--${CORES_JORNADA[x.id]})"></span>` : ''}</span>
        <span class="rt-num">${fmtNum(x.n)}<small>${Math.round(x.n / escolhas.length * 100)}%</small></span>
        <span class="rt-sub">${x.n ? `${x.n} ${x.n === 1 ? 'pessoa' : 'pessoas'}${x.troca ? ` · ${x.troca} na troca` : ''}` : 'ninguém'}</span>
      </li>`).join('');
  }

  // Agrupa por dia; períodos longos (mais de 60 dias) por semana, começando na segunda.
  function baldes(j) {
    // Hoje: 24 colunas, uma por hora.
    if (j.dias === 1) {
      const lista = Array.from({ length: 24 }, (_, h) => ({ ini: j.ini, fim: j.fim, hora: h, eixo: `${h}h`, rotulo: `${pad(h)}h–${pad((h + 1) % 24)}h` }));
      return { lista, unidade: 'hora' };
    }
    const porSemana = j.dias > 60;
    const lista = [];
    let d = j.ini;
    if (porSemana) {
      const dow = deYmd(d).getDay();
      d = somarDias(d, -((dow + 6) % 7));
    }
    while (d <= j.fim) {
      const fim = porSemana ? somarDias(d, 6) : d;
      lista.push({ ini: d, fim, eixo: `${deYmd(d).getDate()}/${deYmd(d).getMonth() + 1}`, rotulo: porSemana ? `sem. de ${fmtData(d)}` : fmtData(d, { day: 'numeric', month: 'short', weekday: 'short' }) });
      d = somarDias(fim, 1);
    }
    return { lista, unidade: porSemana ? 'semana' : 'dia' };
  }

  function renderGraficos(j, ativosMap) {
    const { lista, unidade } = baldes(j);
    document.querySelectorAll('[data-unidade]').forEach((el) => { el.textContent = unidade; });
    const porHora = unidade === 'hora';
    // Hora local: check-ins guardam a hora do aparelho; eventos e acessos vêm com fuso.
    const horaDeCheckin = (c) => Number(String(c.inicio).slice(11, 13));
    const noBalde = (d, h, b) => d >= b.ini && d <= b.fim && (!porHora || h === b.hora);
    const serie1 = lista.map((b) => {
      const cks = dados.checkins.filter((c) => noBalde(diaDeCheckin(c), horaDeCheckin(c), b));
      const v = Object.fromEntries(GRUPOS.map(([g]) => [g, 0]));
      cks.forEach((c) => { v[TIPOS[c.tipo] ? TIPOS[c.tipo].grupo : 'musc'] += 1; });
      return { ...b, v, total: cks.length };
    });
    let serie2;
    if (porHora) {
      // Pessoas diferentes com check-in, evento ou acesso em cada hora de hoje.
      const porH = Array.from({ length: 24 }, () => new Set());
      const marcar = (id, iso) => { if (iso && diaDeInstante(iso) === j.ini) porH[new Date(iso).getHours()].add(id); };
      dados.checkins.forEach((c) => { if (diaDeCheckin(c) === j.ini) porH[horaDeCheckin(c)].add(c.usuario_id); });
      dados.eventos.forEach((e) => marcar(e.usuario_id, e.criado_em));
      dados.usuarios.forEach((u) => marcar(u.id, u.ultimo_acesso));
      serie2 = lista.map((b) => ({ ...b, total: porH[b.hora].size }));
    } else {
      serie2 = lista.map((b) => ({
        ...b, total: dados.usuarios.filter((u) => [...ativosMap.get(u.id)].some((d) => d >= b.ini && d <= b.fim)).length,
      }));
    }
    $('g2-nota').textContent = `Ativo: abriu o app ou fez check-in ${unidade === 'hora' ? 'na hora' : unidade === 'semana' ? 'na semana' : 'no dia'}.`;
    const cadaUn = porHora ? 'cada hora de hoje' : `cada ${unidade} do período`;
    $('info-g1').textContent = `Quantos check-ins foram feitos em ${cadaUn}, somando todos os usuários. Cada cor é um tipo de treino: musculação, Jiu Jitsu, cardio, muay thai, surf, futebol e futvôlei. Passe o dedo ou o mouse numa barra para ver os números, ou toque em Ver tabela.${unidade === 'semana' ? ' Em períodos longos, cada barra soma uma semana, de segunda a domingo.' : ''}`;
    $('info-g2').textContent = `Quantas pessoas diferentes usaram o app em ${cadaUn}: abriram o app ou fizeram check-in. Cada pessoa conta uma vez por barra, mesmo que use o app várias vezes.${porHora ? ' Os horários seguem o relógio do seu aparelho.' : ''}`;
    // Legenda só com os tipos que tiveram check-in no período (menos ruído).
    const usados = GRUPOS.filter(([g]) => serie1.some((x) => x.v[g]));
    const legenda = document.querySelector('[aria-labelledby="g1-titulo"] .legenda');
    legenda.innerHTML = (usados.length ? usados : GRUPOS).map(([g, nome]) => `<li><i style="background:var(--${g})"></i>${nome}</li>`).join('');
    barras($('g1'), serie1, { empilhado: true, rotulo: 'check-ins' });
    barras($('g2'), serie2, { empilhado: false, rotulo: 'usuários ativos' });
    $('g1-tabela').innerHTML = tabelaHTML(['Período', ...GRUPOS.map((g) => g[1]), 'Total'],
      serie1.map((s) => [s.rotulo, ...GRUPOS.map(([g]) => s.v[g]), s.total]));
    $('g2-tabela').innerHTML = tabelaHTML(['Período', 'Usuários ativos'], serie2.map((s) => [s.rotulo, s.total]));
  }
  const tabelaHTML = (cab, linhas) => `<table class="dados"><thead><tr>${cab.map((c) => `<th scope="col">${c}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map((l) => `<tr>${l.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  // Gráfico de barras em SVG: barras finas com cantos de 4 px no topo, 2 px de folga entre segmentos,
  // grade discreta e dica ao passar o mouse ou o dedo.
  function barras(el, serie, { empilhado, rotulo, cor = 'var(--marca)' }) {
    const max = Math.max(1, ...serie.map((s) => s.total));
    if (!serie.some((s) => s.total)) {
      el.innerHTML = `<p class="vazio-graf">Sem ${rotulo} neste período.</p>`;
      return;
    }
    const W = Math.max(280, Math.round(el.clientWidth || 600)), H = 220, esq = 28, dir = 4, topo = empilhado ? 18 : 8, base = 24;
    const larg = (W - esq - dir) / serie.length;
    const bw = Math.max(2, Math.min(28, larg * 0.62));
    const passo = max <= 5 ? 1 : Math.ceil(max / 4);
    const topoEsc = Math.ceil(max / passo) * passo;
    const y = (v) => topo + (H - topo - base) * (1 - v / topoEsc);
    const linhasGrade = [];
    for (let v = 0; v <= topoEsc; v += passo) {
      linhasGrade.push(`<line class="grade" x1="${esq}" x2="${W - dir}" y1="${y(v)}" y2="${y(v)}"/>
        <text class="eixo" x="${esq - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`);
    }
    const cada = Math.ceil(serie.length / 6);
    const rotulos = serie.map((s, i) => (i % cada === 0
      ? `<text class="eixo" x="${esq + larg * i + larg / 2}" y="${H - 6}" text-anchor="middle">${s.eixo}</text>` : '')).join('');
    const barra = (x, y0, y1, cor, arred) => {
      const h = Math.max(0, y0 - y1);
      if (h <= 0) return '';
      const r = arred ? Math.min(4, bw / 2, h) : 0;
      return `<path d="M${x} ${y0} V${y1 + r} Q${x} ${y1} ${x + r} ${y1} H${x + bw - r} Q${x + bw} ${y1} ${x + bw} ${y1 + r} V${y0} Z" fill="${cor}"/>`;
    };
    const marcas = serie.map((s, i) => {
      const x = esq + larg * i + (larg - bw) / 2;
      if (!empilhado) return barra(x, y(0), y(s.total), cor, true);
      let acum = 0, out = '';
      const segs = GRUPOS.filter(([g]) => s.v[g]);
      segs.forEach(([g], k) => {
        const y0 = y(acum) - (k ? 2 : 0); // folga de 2 px entre segmentos
        acum += s.v[g];
        out += barra(x, y0, y(acum), `var(--${g})`, k === segs.length - 1);
      });
      // Total em cima de cada barra, quando cabe (lê-se o dia sem somar as cores).
      if (s.total && larg >= 14) out += `<text class="eixo total-barra" x="${x + bw / 2}" y="${y(s.total) - 4}" text-anchor="middle">${s.total}</text>`;
      return out;
    }).join('');
    const resumo = `${rotulo} por ${serie.length > 1 ? 'período' : 'dia'}: máximo ${max}, total ${serie.reduce((a, s) => a + s.total, 0)}.`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(resumo)} Use “Ver tabela” para os valores.">
      ${linhasGrade.join('')}<rect class="hover" x="0" y="${topo}" width="0" height="${H - topo - base}" visibility="hidden"/>${marcas}${rotulos}</svg>
      <div class="dica" hidden></div>`;
    const svg = el.querySelector('svg');
    const dica = el.querySelector('.dica');
    const faixa = svg.querySelector('.hover');
    const mostrar = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(serie.length - 1, Math.floor((px - esq) / larg)));
      const s = serie[i];
      faixa.setAttribute('x', esq + larg * i);
      faixa.setAttribute('width', larg);
      faixa.setAttribute('visibility', 'visible');
      dica.innerHTML = `<b>${esc(s.rotulo)}</b>${empilhado
        ? GRUPOS.map(([g, n]) => `<span><i style="background:var(--${g})"></i>${n}: ${s.v[g]}</span>`).join('') + `<span>Total: ${s.total}</span>`
        : `<span>${s.total} ${rotulo}</span>`}`;
      dica.hidden = false;
      const xr = (esq + larg * (i + 0.5)) * (r.width / W);
      const lim = el.clientWidth - dica.offsetWidth;
      dica.style.left = `${Math.max(0, Math.min(lim, xr + 12 > lim ? xr - dica.offsetWidth - 12 : xr + 12))}px`;
      dica.style.top = '0px';
    };
    svg.addEventListener('pointermove', mostrar);
    svg.addEventListener('pointerdown', mostrar);
    svg.addEventListener('pointerleave', () => { dica.hidden = true; faixa.setAttribute('visibility', 'hidden'); });
  }

  // ---------- Usuários ----------
  function situacao(ultimo) {
    if (!ultimo) return { chave: 'nunca', rotulo: 'Nunca usou', icone: ICON.lua, ordem: 3 };
    const d = diasEntre(ultimo, hoje());
    if (d <= 7) return { chave: 'ativo', rotulo: 'Ativo', icone: ICON.check, ordem: 0 };
    if (d <= 14) return { chave: 'risco', rotulo: 'Em risco', icone: ICON.alerta, ordem: 1 };
    return { chave: 'inativo', rotulo: 'Inativo', icone: ICON.lua, ordem: 2 };
  }
  function relativo(d) {
    if (!d) return '—';
    const n = diasEntre(d, hoje());
    return n <= 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`;
  }
  const iniciais = (nome, email) => {
    const p = String(nome || email || '?').trim().split(/\s+/);
    return ((p[0] || '')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  };
  const pctAder = (v) => (v === null ? '—' : `${fmtNum(v * 100)}%`);
  function linhasUsuarios(j, ativosMap) {
    return dados.usuarios.map((u) => {
      const dias = [...ativosMap.get(u.id)].sort();
      const ultimo = dias[dias.length - 1] || null;
      const meus = dados.checkins.filter((c) => c.usuario_id === u.id);
      const noPeriodo = meus.filter((c) => dentro(diaDeCheckin(c), j)).length;
      const ultimoTreino = meus.map(diaDeCheckin).sort().pop() || null;
      return {
        u, ultimo, sit: u.liberado === false
          ? { chave: 'bloqueado', rotulo: u.acesso_pedido_em ? 'Pediu acesso' : 'Bloqueado', icone: ICON.alerta, ordem: 4 } : situacao(ultimo), checkins: noPeriodo, aderencia: aderenciaDe(noPeriodo, planejadasNoPeriodo(u, j)),
        acessos: u.acessos || 0, ultimoTreino, total: meus.length,
      };
    });
  }
  function renderUsuarios(j, ativosMap) {
    const q = busca.trim().toLowerCase();
    const todas = linhasUsuarios(j, ativosMap);
    // "Só quem fez check-in no período": o mesmo número da coluna Check-ins, no período escolhido.
    const acha = (l) => !q || `${l.u.nome} ${l.u.email}`.toLowerCase().includes(q);
    const achados = todas.filter(acha);
    let linhas = soCheckin ? achados.filter((l) => l.checkins > 0) : achados;
    $('u-contagem').textContent = linhas.length === todas.length ? `${fmtNum(todas.length)} ${todas.length === 1 ? 'usuário' : 'usuários'}`
      : `${fmtNum(linhas.length)} de ${fmtNum(todas.length)} usuários`;
    const chave = {
      nome: (l) => (l.u.nome || l.u.email || '').toLowerCase(), situacao: (l) => l.sit.ordem, ultimo: (l) => l.ultimo || '',
      acessos: (l) => l.acessos, checkins: (l) => l.checkins, aderencia: (l) => (l.aderencia === null ? -1 : l.aderencia), treino: (l) => l.ultimoTreino || '',
    }[ordem.col];
    linhas.sort((a, b) => { const x = chave(a), y = chave(b); return (x < y ? -1 : x > y ? 1 : 0) * ordem.dir; });
    linhasAtuais = linhas;
    document.querySelectorAll('#usuarios th[data-col]').forEach((th) => {
      const ativo = th.dataset.col === ordem.col;
      if (ativo) th.setAttribute('aria-sort', ordem.dir > 0 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort');
      const b = th.querySelector('button');
      b.innerHTML = b.textContent + (ativo ? `<span style="display:inline-grid;transform:rotate(${ordem.dir > 0 ? 180 : 0}deg)">${ICON.seta}</span>` : '');
    });
    $('ordenar-cel').value = ordem.col;
    $('usuarios-corpo').innerHTML = linhas.length ? linhas.map((l) => `
      <tr data-usuario="${l.u.id}">
        <td><div class="quem"><span class="avatar${online.has(l.u.id) ? ' on' : ''}" aria-hidden="true">${esc(iniciais(l.u.nome, l.u.email))}</span>
          <button type="button" data-abrir="${l.u.id}"><b>${esc(l.u.nome || 'Sem nome')}${l.u.videos_liberados ? ' <span class="tag-videos">Vídeos</span>' : ''}</b><span class="sr on-sr"${online.has(l.u.id) ? '' : ' hidden'}>, on-line agora</span><small>${esc(l.u.email)}</small>
            <span class="resumo-cel">${l.ultimo ? relativo(l.ultimo) : 'sem uso'} · ${fmtNum(l.checkins)} check-in${l.checkins === 1 ? '' : 's'} · ${pctAder(l.aderencia)} do plano</span></button>
          <span class="chev" aria-hidden="true">${ICON.chev}</span></div></td>
        <td data-rotulo="Situação" class="cel-situacao"><span class="situacao ${l.sit.chave}">${l.sit.icone}${l.sit.rotulo}</span></td>
        <td data-rotulo="Último uso">${relativo(l.ultimo)}</td>
        <td data-rotulo="Acessos" class="num">${fmtNum(l.acessos)}</td>
        <td data-rotulo="Check-ins" class="num">${fmtNum(l.checkins)}</td>
        <td data-rotulo="Aderência"><span class="barra-ader"><span aria-hidden="true"><i style="width:${Math.round((l.aderencia || 0) * 100)}%"></i></span>${pctAder(l.aderencia)}</span></td>
        <td data-rotulo="Último treino">${l.ultimoTreino ? fmtData(l.ultimoTreino) : '—'}</td>
      </tr>`).join('') : `<tr><td colspan="7" class="nenhum">${achados.length ? 'Ninguém fez check-in no período.' : q ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado.'}</td></tr>`;
  }
  let linhasAtuais = [];

  function exportarCSV() {
    const cab = ['nome', 'email', 'situacao', 'ultimo_uso', 'acessos', 'checkins_periodo', 'aderencia_pct', 'ultimo_treino', 'checkins_total', 'cadastro'];
    const campo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const linhas = linhasAtuais.map((l) => [l.u.nome, l.u.email, l.sit.rotulo, l.ultimo || '', l.acessos, l.checkins,
      l.aderencia === null ? '' : Math.round(l.aderencia * 100), l.ultimoTreino || '', l.total, diaDeInstante(l.u.cadastro) || ''].map(campo).join(';'));
    const blob = new Blob([`﻿${cab.join(';')}\n${linhas.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `usuarios-${hoje()}-${periodo === 'tudo' || periodo === 'hoje' ? periodo : `${periodo}d`}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }


  // ---------- Saúde do app (só erros críticos) ----------
  const ORIGEM_ERRO = { js: 'Erro no app', promessa: 'Erro no app', salvar: 'Falha ao salvar', excluir_conta: 'Falha ao excluir conta' };
  const errosAbertos = new Set();
  const nomeDe = (id) => { const u = dados.usuarios.find((x) => x.id === id); return u ? (u.nome || u.email) : 'Usuário removido'; };
  const quandoCurto = (iso) => { const d = new Date(iso); return `${fmtData(ymd(d))}, ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  function haQuanto(iso) {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso)) / 6e4));
    if (min < 60) return min <= 1 ? 'agora há pouco' : `há ${min} min`;
    const h = Math.round(min / 60);
    return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} dia${Math.round(h / 24) === 1 ? '' : 's'}`;
  }
  const aparelho = (d) => [d.navegador, d.sistema].filter(Boolean).join(' · ') || 'aparelho desconhecido';
  const noPeriodoEv = (e, j) => dentro(diaDeInstante(e.criado_em), j);
  // Erros comuns no dia a dia (internet caindo, conexão ao vivo reconectando, ruído do navegador) não são
  // falhas do app: a pessoa já vê o aviso na hora e o app se recupera sozinho. Mesma regra do app; erros comuns gravados por versões antigas são ignorados aqui.
  const ERRO_COMUM = /failed to fetch|load failed|networkerror|network ?request failed|fetch failed|network connection was lost|timed? ?out|timeout|aborterror|aborted|offline|connection (closed|reset|refused)|jwt expired|refresh token|^script error\.?$|resizeobserver loop/i;
  const ehErroComum = (origem, mensagem) => origem === 'presenca' || ERRO_COMUM.test(String(mensagem || '').trim());
  const ehRuido = (e) => e.tipo === 'erro' && ehErroComum((e.dados || {}).origem, (e.dados || {}).mensagem);
  const errosDe = (j) => dados.eventos.filter((e) => e.tipo === 'erro' && !ehRuido(e) && noPeriodoEv(e, j));
  // Banco desatualizado (schema.sql não rodado depois de uma versão nova): a correção é rodar o SQL.
  const ehErroDeBanco = (msg) => /does not exist|could not find the function|violates .*constraint|permission denied|schema cache/i.test(msg || '');
  const erros24h = () => dados.eventos.filter((e) => e.tipo === 'erro' && !ehRuido(e) && Date.now() - new Date(e.criado_em) < 864e5).length;

  function renderSaude(j) {
    // Bolinha na aba: erros das últimas 24 h, em qualquer aba.
    const n24 = erros24h();
    const alerta = $('alerta-saude');
    alerta.hidden = !n24;
    alerta.textContent = n24;
    alerta.setAttribute('aria-label', `${n24} ${n24 === 1 ? 'erro crítico' : 'erros críticos'} nas últimas 24 horas`);

    const erros = errosDe(j);
    const ant = j.anterior ? errosDe(j.anterior) : null;
    const afetados = new Set(erros.map((e) => e.usuario_id)).size;
    const tile = fabricaDeCards('s');
    const compara = comparaDoPeriodo();
    // Para erros, subir é ruim: a seta inverte as cores.
    const deltaRuim = (a, b) => delta(a, b).replace(/delta (sobe|desce)/, (_, c) => `delta ${c === 'sobe' ? 'desce' : 'sobe'}`);
    $('kpis-saude').innerHTML = [
      tile('Erros críticos', fmtNum(erros.length), { longo: rotuloDoPeriodo(), curto: '', d: ant && deltaRuim(erros.length, ant.length),
        info: `Falhas do app que precisam de correção: erros de programação, gravações recusadas pelo banco (por exemplo, schema.sql não rodado depois de uma versão nova) e falha ao excluir conta. Quedas de internet, reconexões do "On-line agora" e login de novo são normais e não entram. ${compara}` }),
      tile('Usuários afetados', `${afetados}<small> de ${dados.usuarios.length}</small>`, { longo: rotuloDoPeriodo(), curto: '', d: ant && deltaRuim(afetados, new Set(ant.map((e) => e.usuario_id)).size),
        info: `Quantas pessoas diferentes tiveram pelo menos um erro crítico no período. ${compara}` }),
    ].join('');

    // Gráfico de erros por dia (ou hora, com Hoje; semana em períodos longos).
    const { lista, unidade } = baldes(j);
    const porHora = unidade === 'hora';
    const serie = lista.map((b) => ({ ...b, total: erros.filter((e) => {
      const d = diaDeInstante(e.criado_em);
      return d >= b.ini && d <= b.fim && (!porHora || new Date(e.criado_em).getHours() === b.hora);
    }).length }));
    if (!$('g3').hidden) barras($('g3'), serie, { empilhado: false, rotulo: 'erros', cor: 'var(--erro)' });
    $('g3-tabela').innerHTML = tabelaHTML(['Período', 'Erros'], serie.map((x) => [x.rotulo, x.total]));
    $('info-g3').textContent = `Quantos erros críticos aconteceram em ${porHora ? 'cada hora de hoje' : `cada ${unidade} do período`}, somando todos os usuários. Passe o dedo ou o mouse numa barra para ver o número, ou toque em Ver tabela.`;

    // Erros iguais (mesma origem e mensagem) viram um grupo.
    const grupos = new Map();
    erros.forEach((e) => {
      const d = e.dados || {};
      const chave = `${d.origem || '?'}|${String(d.mensagem || '').trim().slice(0, 160)}`;
      if (!grupos.has(chave)) grupos.set(chave, { chave, origem: d.origem, mensagem: String(d.mensagem || '').trim(), itens: [] });
      grupos.get(chave).itens.push(e);
    });
    const lista2 = [...grupos.values()].map((g) => {
      g.itens.sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
      const ap = {};
      g.itens.forEach((e) => { const k = aparelho(e.dados || {}); ap[k] = (ap[k] || 0) + 1; });
      g.aparelho = Object.entries(ap).sort((a, b) => b[1] - a[1])[0][0];
      g.usuarios = new Set(g.itens.map((e) => e.usuario_id)).size;
      g.ultima = g.itens[0].criado_em;
      g.agora = Date.now() - new Date(g.ultima) < 864e5;
      return g;
    }).sort((a, b) => (a.ultima < b.ultima ? 1 : -1));
    $('erros-lista').innerHTML = lista2.length ? lista2.map((g, i) => {
      const aberto = errosAbertos.has(g.chave);
      const mais = g.itens.length - 10;
      return `<div class="item-lista">
        <button class="item-topo" type="button" data-erro="${esc(g.chave)}" aria-expanded="${aberto}" aria-controls="erro-${i}">
          <span class="item-titulo">${esc(g.mensagem || '(sem mensagem)')}</span>
          <span class="item-num">${fmtNum(g.itens.length)}<small>${g.itens.length === 1 ? 'vez' : 'vezes'}</small></span>
          <span class="item-sub">${g.agora ? `<span class="chip-erro">${ICON.alerta}Acontecendo agora</span> ` : ''}${esc(ORIGEM_ERRO[g.origem] || g.origem || 'Erro')} · ${g.usuarios} ${g.usuarios === 1 ? 'usuário' : 'usuários'} · ${esc(g.aparelho)} · última ${haQuanto(g.ultima)}</span>
          ${ehErroDeBanco(g.mensagem) ? '<span class="item-dica">Banco desatualizado: rode de novo o supabase/schema.sql no Supabase.</span>' : ''}
        </button>
        <ul class="item-detalhe" id="erro-${i}"${aberto ? '' : ' hidden'}>${g.itens.slice(0, 10).map((e) => `<li><b><button class="link-btn" type="button" data-abrir-usuario="${e.usuario_id}">${esc(nomeDe(e.usuario_id))}</button></b><time>${quandoCurto(e.criado_em)}</time><span>${esc(aparelho(e.dados || {}))}</span></li>`).join('')}${mais > 0 ? `<li>e mais ${mais} ${mais === 1 ? 'vez' : 'vezes'}</li>` : ''}</ul>
      </div>`;
    }).join('') : '<p class="vazio">Nenhum erro crítico no período.</p>';
  }

  // ---------- E-mails (resumo semanal) ----------
  let edicaoSel = null;
  const pct = (a, b) => (b ? `${fmtNum(a / b * 100)}%` : '—');
  function edicoesDe(j) {
    const m = new Map();
    (dados.emails || []).forEach((x) => {
      if (!m.has(x.referencia)) m.set(x.referencia, { ref: x.referencia, linhas: [], enviadoEm: x.enviado_em });
      const ed = m.get(x.referencia);
      ed.linhas.push(x);
      if (x.enviado_em < ed.enviadoEm) ed.enviadoEm = x.enviado_em;
    });
    return [...m.values()].filter((ed) => dentro(diaDeInstante(ed.enviadoEm), j)).sort((a, b) => (a.ref < b.ref ? 1 : -1));
  }
  const rotuloEdicao = (ref) => `${fmtData(somarDias(ref, -6))} a ${fmtData(ref)}`;
  const situacaoEmail = (x) => (x.clicado_em ? { c: 'clicou', t: 'Clicou', i: ICON.check, em: x.clicado_em }
    : x.aberto_em ? { c: 'abriu', t: 'Abriu', i: ICON.olho, em: x.aberto_em } : { c: 'enviado', t: 'Enviado', i: ICON.email, em: x.enviado_em });

  // Próximo envio do resumo: toda sexta às 9h de Brasília (12h UTC; Brasília não tem horário de verão).
  // Resume os 7 dias até a véspera (sexta a quinta).
  function proximoEnvio(agora = new Date()) {
    const alvo = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), 12, 0, 0));
    alvo.setUTCDate(alvo.getUTCDate() + ((5 - alvo.getUTCDay() + 7) % 7));
    if (alvo <= agora) alvo.setUTCDate(alvo.getUTCDate() + 7);
    const diaBr = alvo.toISOString().slice(0, 10); // 12h UTC = 9h em Brasília, mesmo dia
    return { quando: alvo, dia: diaBr, ini: somarDias(diaBr, -7), fim: somarDias(diaBr, -1) };
  }
  function faltaPara(alvo) {
    const min = Math.max(0, Math.round((alvo - Date.now()) / 6e4));
    const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    if (d) return `daqui a ${d} ${d === 1 ? 'dia' : 'dias'}${h ? ` e ${h} h` : ''}`;
    if (h) return `daqui a ${h} h${m ? ` e ${m} min` : ''}`;
    return `daqui a ${m} min`;
  }
  // Mesma regra da função resumo-semanal: não liberado e quem não abre o app há 4 semanas ficam sem o resumo.
  function motivoSemResumo(u, dia) {
    if (u.liberado === false) return 'não liberado';
    if (!u.ultimo_acesso || diaDeInstante(u.ultimo_acesso) < somarDias(dia, -28)) return 'sem abrir o app há 4 semanas ou mais';
    return '';
  }
  function renderProximoEnvio() {
    const px = proximoEnvio();
    const hojeBr = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
    const quando = px.dia === hojeBr ? 'Hoje, sexta' : px.dia === somarDias(hojeBr, 1) ? 'Amanhã, sexta' : 'Sexta';
    const recebem = dados.usuarios.filter((u) => u.emails_resumo !== false && (u.acessos || 0) > 0 && !motivoSemResumo(u, px.dia));
    const nomes = recebem.map((u) => esc((u.nome || u.email).trim().split(/\s+/)[0]));
    $('proximo-envio').innerHTML = `
      <span class="prox-icone" aria-hidden="true">${ICON.email}</span>
      <div class="prox-texto">
        <h2 id="prox-titulo">Próximo resumo semanal</h2>
        <p class="prox-quando"><b>${quando}, ${fmtData(px.dia)}, às 9h</b> <span>(horário de Brasília) · ${faltaPara(px.quando)}</span></p>
        <p class="prox-detalhe">Resume de ${fmtData(px.ini)} a ${fmtData(px.fim)} e vai para <b>${recebem.length} ${recebem.length === 1 ? 'pessoa' : 'pessoas'}</b>${nomes.length ? `: ${nomes.join(', ')}` : ''}.</p>
      </div>`;
  }

  setInterval(() => { if (dados) renderProximoEnvio(); }, 60000);

  function renderEmails(j) {
    renderProximoEnvio();
    const aviso = $('emails-aviso');
    if (dados.emails === null) {
      aviso.innerHTML = `<p class="aviso-bloco">Para ver os e-mails, rode de novo o <code>supabase/schema.sql</code> no Supabase (ele cria a função admin_emails). ${esc(dados.erroEmails)}</p>`;
      ['kpis-emails', 'envios-lista', 'destinatarios'].forEach((id) => { $(id).innerHTML = ''; });
      return;
    }
    aviso.innerHTML = '';
    const eds = edicoesDe(j);
    const linhas = eds.flatMap((ed) => ed.linhas);
    const abertos = linhas.filter((x) => x.aberto_em).length;
    const clicaram = linhas.filter((x) => x.clicado_em).length;
    const comOpcao = dados.usuarios.filter((u) => typeof u.emails_resumo === 'boolean');
    const desligados = comOpcao.filter((u) => u.emails_resumo === false).length;
    const tile = fabricaDeCards('e');
    $('kpis-emails').innerHTML = [
      tile('Enviados', fmtNum(linhas.length), { longo: `${eds.length} ${eds.length === 1 ? 'resumo semanal' : 'resumos semanais'} · ${rotuloDoPeriodo()}`, curto: `${eds.length} ${eds.length === 1 ? 'semana' : 'semanas'}`,
        info: 'Quantos e-mails do resumo semanal foram enviados no período, somando todas as sextas. Cada pessoa recebe um por semana.' }),
      tile('Abertos', `${pct(abertos, linhas.length).replace('%', '<small>%</small>')}`, { longo: `${abertos} de ${linhas.length} e-mails`, curto: `${abertos} de ${linhas.length}`,
        info: 'Quantos e-mails foram abertos, medido por uma imagem invisível no e-mail. É aproximado: o Mail do iPhone/Mac pode carregar a imagem sozinho (conta como aberto) e quem bloqueia imagens não conta. Abertura registrada a partir dos envios com essa medição.' }),
      tile('Clicaram', `${pct(clicaram, linhas.length).replace('%', '<small>%</small>')}`, { longo: `${clicaram} tocaram em "Abrir o Gestão de Treinos"`, curto: `${clicaram} de ${linhas.length}`,
        info: 'Quantos e-mails tiveram o botão "Abrir o Gestão de Treinos" tocado. É exato e mostra interesse de verdade; clicar também conta como aberto.' }),
      tile('Resumo desligado', comOpcao.length ? `${desligados}<small> de ${dados.usuarios.length}</small>` : '—', { longo: 'pessoas que não recebem mais', curto: 'não recebem',
        info: 'Quantas pessoas desligaram o resumo semanal (em Você → Conta ou pelo link do e-mail). Não depende do período.' }),
    ].join('');

    if (!eds.length) {
      $('envios-lista').innerHTML = '<p class="vazio">Nenhum resumo enviado no período.</p>';
      $('destinatarios').innerHTML = '<p class="vazio">Escolha um período com envios para ver quem recebeu.</p>';
      $('dest-titulo').textContent = 'Quem recebeu';
      return;
    }
    if (!eds.some((ed) => ed.ref === edicaoSel)) edicaoSel = eds[0].ref;
    $('envios-lista').innerHTML = eds.map((ed) => {
      const ab = ed.linhas.filter((x) => x.aberto_em).length;
      const cl = ed.linhas.filter((x) => x.clicado_em).length;
      const sel = ed.ref === edicaoSel;
      return `<div class="item-lista"${sel ? ' aria-current="true"' : ''}>
        <button class="item-topo" type="button" data-edicao="${ed.ref}" aria-pressed="${sel}">
          <span class="item-titulo">Semana de ${rotuloEdicao(ed.ref)}</span>
          <span class="item-num">${ed.linhas.length}<small>${ed.linhas.length === 1 ? 'enviado' : 'enviados'}</small></span>
          <span class="item-sub">Enviado ${quandoCurto(ed.enviadoEm)} · abertos ${ab} (${pct(ab, ed.linhas.length)}) · cliques ${cl} (${pct(cl, ed.linhas.length)})</span>
        </button></div>`;
    }).join('');

    const ed = eds.find((x) => x.ref === edicaoSel);
    $('dest-titulo').textContent = `Quem recebeu · semana de ${rotuloEdicao(ed.ref)}`;
    const ordemSit = { clicou: 0, abriu: 1, enviado: 2 };
    const recebidos = ed.linhas.map((x) => ({ x, u: dados.usuarios.find((u) => u.id === x.usuario_id), s: situacaoEmail(x) }))
      .sort((a, b) => ordemSit[a.s.c] - ordemSit[b.s.c] || nomeDe(a.x.usuario_id).localeCompare(nomeDe(b.x.usuario_id), 'pt-BR'));
    const ids = new Set(ed.linhas.map((x) => x.usuario_id));
    const faltaram = dados.usuarios.filter((u) => !ids.has(u.id)).map((u) => `${esc(u.nome || u.email)} (${
      u.emails_resumo === false ? 'desligou o resumo' : !u.acessos ? 'ainda não usou o app' : motivoSemResumo(u, somarDias(ed.ref, 1)) || 'sem registro de envio'})`);
    $('destinatarios').innerHTML = recebidos.map(({ x, u, s }) => `<div class="item-lista"><div class="item-topo">
        <span class="item-titulo"><button class="link-btn" type="button" data-abrir-usuario="${x.usuario_id}">${esc(u ? (u.nome || u.email) : 'Usuário removido')}</button></span>
        <span class="estado-email ${s.c}">${s.i}${s.t}</span>
        <span class="item-sub">${esc(u ? u.email : '')}${s.c !== 'enviado' ? ` · ${s.t.toLowerCase()} ${quandoCurto(s.em)}` : ` · enviado ${quandoCurto(x.enviado_em)}`}${x.aberturas > 1 ? ` · ${x.aberturas} aberturas` : ''}${x.cliques > 1 ? ` · ${x.cliques} cliques` : ''}</span>
      </div></div>`).join('')
      + (faltaram.length ? `<p class="nota" style="padding:12px 0">Não receberam: ${faltaram.join(', ')}.</p>` : '');
  }

  // ---------- Abas ----------
  const ABAS = ['geral', 'usuarios', 'saude', 'emails', 'convites', 'exercicios'];
  let aba = ABAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'geral';
  // Gráficos são desenhados na largura real, então são redesenhados ao aparecer.
  function renderVisivel() {
    if (!dados) return;
    const j = janela(periodo);
    if (aba === 'geral') renderGraficos(j, diasAtivos());
    if (aba === 'saude') renderSaude(j);
  }
  function mostrarAba(nova, { focar = false, url = true } = {}) {
    aba = ABAS.includes(nova) ? nova : 'geral';
    document.querySelectorAll('[role="tab"]').forEach((b) => {
      const sel = b.dataset.aba === aba;
      b.setAttribute('aria-selected', String(sel));
      b.tabIndex = sel ? 0 : -1;
      if (sel && focar) b.focus();
    });
    ABAS.forEach((a) => { $(`aba-${a}`).hidden = a !== aba; });
    atualizarAbaOnline();
    if (url) history.replaceState(null, '', location.pathname + location.search + (aba === 'geral' ? '' : `#${aba}`));
    fecharInfo();
    renderVisivel();
  }
  document.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
    const i = ABAS.indexOf(aba);
    const prox = { ArrowRight: (i + 1) % ABAS.length, ArrowLeft: (i + ABAS.length - 1) % ABAS.length, Home: 0, End: ABAS.length - 1 }[e.key];
    if (prox === undefined) return;
    e.preventDefault();
    mostrarAba(ABAS[prox], { focar: true });
  });
  addEventListener('hashchange', () => mostrarAba(location.hash.slice(1), { url: false }));
  mostrarAba(aba, { url: false });

  // ---------- Detalhe do usuário ----------
  const NOMES_EVENTO = {
    app_atualizado: (d) => `O app se atualizou para a versão nova${d.para ? ` (${d.para})` : ''}`,
    sessao: (d) => `Abriu o app${d.navegador ? ` (${d.navegador}, ${d.sistema}${d.instalado ? ', instalado' : ''})` : ''}`,
    tela: (d) => `Abriu a tela ${NOMES_TELA[d.tela] || d.tela}`,
    evolucao_aberta: () => 'Abriu a Evolução (mês a mês) no Dashboard',
    exercicio_concluido: (d) => `Concluiu ${d.exercicio}${d.sem_peso ? ' (sem peso)' : ''}${d.origem === 'dash' ? ' pelo Dashboard' : ''}`,
    recorde: (d) => `Novo recorde em ${d.exercicio}`,
    checkin_criado: (d) => `Fez check-in de ${(TIPOS[d.tipo] || {}).nome || d.tipo}${d.retroativo ? ' (retroativo)' : ''}`,
    checkin_editado: (d) => `Editou check-in de ${(TIPOS[d.tipo] || {}).nome || d.tipo}`,
    checkin_excluido: (d) => `Excluiu check-in de ${(TIPOS[d.tipo] || {}).nome || d.tipo}`,
    checkin_encerrado: (d) => `Encerrou check-in de ${(TIPOS[d.tipo] || {}).nome || d.tipo}`,
    video: (d) => `Viu o vídeo de ${d.exercicio}`,
    sem_peso: (d) => `${d.ativo ? 'Marcou' : 'Desmarcou'} ${d.exercicio} como sem peso`,
    semana_alterada: () => 'Alterou a semana',
    excluir_conta: () => 'Abriu a opção de excluir a conta',
    convite_usado: (d) => ({ ok: 'Entrou com um convite', ja_liberado: 'Abriu um convite (já tinha acesso)', invalido: 'Tentou um código de convite inválido', usado: 'Tentou um convite já usado', expirado: 'Tentou um convite expirado', cancelado: 'Tentou um convite cancelado' }[d.resultado] || 'Tentou usar um convite'),
    acesso_pedido: () => 'Pediu acesso ao app',
    novidade_evolucao: (d) => ({ viu: 'Viu o aviso da Evolução', ver: 'Abriu a Evolução pelo aviso', depois: 'Deixou o aviso da Evolução para depois', fechou: 'Fechou o aviso da Evolução' }[d.escolha] || 'Respondeu ao aviso da Evolução') + (d.ocultou ? ' e pediu para não mostrar mais' : ''),
    novidade_treinos: (d) => ({ viu: 'Viu o aviso dos treinos personalizados', personalizar: 'Quis personalizar os treinos', montar: 'Escolheu montar os treinos', manter: 'Manteve o treino atual', fechou: 'Fechou o aviso dos treinos personalizados' }[d.escolha] || 'Respondeu ao aviso dos treinos') + (d.ocultou ? ' e pediu para não mostrar mais' : ''),
    editor_treinos: () => 'Abriu Meus treinos',
    jornadas_abertas: (d) => (d.origem === 'boas-vindas' ? 'Viu os objetivos nas boas-vindas' : 'Abriu Mudar meu objetivo'),
    jornada_escolhida: (d) => `Escolheu o objetivo ${NOMES_JORNADA[d.jornada] || d.jornada}`,
    temporizador: (d) => (d.ativo ? 'Ligou o temporizador de descanso' : 'Desligou o temporizador de descanso'),
    descanso: (d) => `${{ iniciado: 'Iniciou', pulado: 'Pulou', completo: 'Completou' }[d.acao] || 'Usou'} um descanso de ${d.segundos} s`,
    treinos_desfeitos: (d) => (d.origem === 'desfazer' ? 'Desfez a alteração dos treinos' : 'Restaurou a versão anterior dos treinos'),
    treinos_salvos: (d) => (d.plano_pronto ? 'Voltou ao plano pronto' : `Salvou ${d.treinos} ${d.treinos === 1 ? 'treino' : 'treinos'} personalizados`),
    resumo_email: (d) => (d.ativo ? 'Ligou o resumo semanal por e-mail' : 'Desligou o resumo semanal por e-mail'),
    tema: (d) => `Mudou o tema para ${d.tema}`,
    estilo: (d) => `Mudou o estilo para ${({ padrao: 'Padrão', neon: 'Neon', brasa: 'Brasa', cyber: 'Cyber', ultra: 'Ultravioleta', gelo: 'Gelo', violeta: 'Violeta', miami: 'Miami', lua_de_sangue: 'Lua de Sangue' })[d.estilo] || d.estilo}`,
    foto: (d) => ({ nova: 'Adicionou foto', trocada: 'Trocou a foto', removida: 'Removeu a foto' })[d.acao] || 'Alterou a foto',
    erro: (d) => `Erro (${d.origem}): ${d.mensagem}`,
    sessao_perdida: (d) => `Precisou entrar de novo sem ter saído (${d.horas_desde} h sem usar, ${d.navegador}, ${d.sistema})`,
    saiu: () => 'Saiu da conta',
  };
  const ICONE_EVENTO = { sessao: 'abrir', exercicio_concluido: 'peso', recorde: 'trofeu', checkin_criado: 'cal', checkin_editado: 'cal', checkin_excluido: 'cal', checkin_encerrado: 'cal', erro: 'alerta' };
  // Atividade recente: 7 por vez, agrupada por dia (Hoje, Ontem, "ter, 21 de out"); ao lado, só a hora.
  const POR_VEZ = 7;
  let atividade = { itens: [], mostrados: POR_VEZ };
  const hora = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  function nomeDoDia(dia) {
    if (dia === hoje()) return 'Hoje';
    if (dia === somarDias(hoje(), -1)) return 'Ontem';
    return fmtData(dia, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function renderAtividade(focarEm) {
    const el = $('det-atividade');
    if (!el) return;
    const { itens, mostrados } = atividade;
    if (!itens.length) { el.innerHTML = '<p class="nota">Nenhuma atividade registrada.</p>'; return; }
    const grupos = [];
    itens.slice(0, mostrados).forEach((it, i) => {
      const dia = ymd(new Date(it.em));
      if (!grupos.length || grupos[grupos.length - 1].dia !== dia) grupos.push({ dia, linhas: [] });
      grupos[grupos.length - 1].linhas.push(`<li class="${it.alerta ? 'alerta' : ''}" data-i="${i}" tabindex="-1">${ICON[it.icone]}<span>${esc(it.texto)}</span><time datetime="${esc(it.em)}">${hora(it.em)}</time></li>`);
    });
    const faltam = itens.length - mostrados;
    el.innerHTML = grupos.map((g) => `<h4 class="atv-dia">${esc(nomeDoDia(g.dia))}</h4><ul class="linha-tempo">${g.linhas.join('')}</ul>`).join('')
      + (faltam > 0 ? `<button class="btn-sec mais-atividade" type="button" data-mais-atividade>Mostrar mais (${faltam})</button>` : '');
    if (focarEm != null) { const li = el.querySelector(`li[data-i="${focarEm}"]`); if (li) li.focus(); }
  }

  function abrirDetalhe(id) {
    detalheId = id;
    const j = janela(periodo);
    const ativosMap = diasAtivos();
    const l = linhasUsuarios(j, ativosMap).find((x) => x.u.id === id);
    if (!l) return;
    const { u } = l;
    // Mapa: check-ins por dia nas últimas 8 semanas (colunas = semanas, linhas = Seg..Dom).
    const fim = hoje();
    const segAtual = somarDias(fim, -((deYmd(fim).getDay() + 6) % 7));
    const ini = somarDias(segAtual, -49);
    const porDia = {};
    dados.checkins.filter((c) => c.usuario_id === id).forEach((c) => { const d = diaDeCheckin(c); porDia[d] = (porDia[d] || 0) + 1; });
    let mapa = '';
    ORDEM_SEMANA.forEach((dow, linha) => {
      mapa += `<span>${CURTOS[dow]}</span>`;
      for (let s = 0; s < 8; s += 1) {
        const d = somarDias(ini, s * 7 + linha);
        const n = Math.min(3, porDia[d] || 0);
        mapa += d > fim ? '<i class="futuro"></i>' : `<i data-n="${n}" title="${fmtData(d)}: ${porDia[d] || 0} check-in(s)"></i>`;
      }
    });
    const semana = Array.isArray(u.semana) && u.semana.length === 7 ? u.semana : null;
    const semanaHTML = ORDEM_SEMANA.map((i) => `<li><b>${CURTOS[i]}</b>${semana
      ? (semana[i].length ? semana[i].map((t) => `<span class="selo ${(TIPOS[t] || {}).grupo}" title="${(TIPOS[t] || {}).nome}">${(TIPOS[t] || {}).selo}</span>`).join('') : '<small>—</small>')
      : '<small>padrão</small>'}</li>`).join('');
    const itens = [
      ...dados.checkins.filter((c) => c.usuario_id === id).map((c) => ({
        em: new Date(`${String(c.inicio).slice(0, 19)}`).toISOString(), icone: 'cal', alerta: false,
        texto: `Check-in de ${(TIPOS[c.tipo] || {}).nome || c.tipo}${c.retroativo ? ' (retroativo)' : ''}`,
      })),
      ...dados.eventos.filter((e) => e.usuario_id === id && !['tela', 'checkin_criado'].includes(e.tipo) && !ehRuido(e)).map((e) => ({
        em: e.criado_em, icone: ICONE_EVENTO[e.tipo] || 'ponto', alerta: e.tipo === 'erro',
        texto: (NOMES_EVENTO[e.tipo] || (() => e.tipo))(e.dados || {}),
      })),
    ].sort((a, b) => (a.em < b.em ? 1 : -1));
    atividade = { itens, mostrados: POR_VEZ };
    $('det-corpo').innerHTML = `
      <div class="det-topo">
        <span class="avatar" aria-hidden="true">${esc(iniciais(u.nome, u.email))}</span>
        <div><h2 id="det-nome">${esc(u.nome || 'Sem nome')}</h2><p>${esc(u.email)}</p></div>
        <button class="fechar" type="button" data-fechar aria-label="Fechar">${ICON.x}</button>
      </div>
      <p><span class="situacao ${l.sit.chave}">${l.sit.icone}${l.sit.rotulo}</span> <span id="det-online">${seloOnline(id)}</span>
        <span class="nota" style="display:inline">&nbsp;Cadastro em ${u.cadastro ? fmtData(diaDeInstante(u.cadastro), { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} · último uso ${relativo(l.ultimo)} · último treino ${l.ultimoTreino ? fmtData(l.ultimoTreino) : '—'}${typeof u.emails_resumo === 'boolean' ? ` · resumo por e-mail ${u.emails_resumo ? 'ligado' : 'desligado'}` : ''}</span></p>
      <dl class="mini">
        <div><dt>Check-ins no período</dt><dd>${fmtNum(l.checkins)}</dd></div>
        <div><dt>Aderência no período</dt><dd>${pctAder(l.aderencia)}</dd></div>
        <div><dt>Check-ins no total</dt><dd>${fmtNum(l.total)}</dd></div>
        <div><dt>Acessos</dt><dd>${fmtNum(l.acessos)}</dd></div>
      </dl>
      <section class="det-sec" aria-labelledby="det-mapa">
        <h3 id="det-mapa">Check-ins nas últimas 8 semanas</h3>
        <div class="mapa" role="img" aria-label="Mapa de check-ins por dia nas últimas 8 semanas">${mapa}</div>
        <div class="mapa-leg"><span>Nenhum</span><i style="background:var(--int-0)"></i><i style="background:var(--int-2)"></i><i style="background:var(--int-3)"></i><i style="background:var(--int-4)"></i><span>3 ou mais</span></div>
      </section>
      <section class="det-sec" aria-labelledby="det-semana">
        <h3 id="det-semana">Semana montada</h3>
        <ul class="semana">${semanaHTML}</ul>
        ${semana ? '' : '<p class="nota" style="margin-top:6px">Ainda usa a semana padrão do app.</p>'}
      </section>
      <section class="det-sec" aria-labelledby="det-sp">
        <h3 id="det-sp">Exercícios sem peso</h3>
        ${(u.sem_peso || []).length ? `<ul class="chips">${u.sem_peso.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="nota">Nenhum.</p>'}
      </section>
      ${typeof u.liberado === 'boolean' ? `<section class="det-sec" aria-labelledby="det-acesso-t">
        <h3 id="det-acesso-t">Acesso</h3>
        <div class="det-acesso">
          <span class="nota" style="flex:1 1 200px">${u.liberado ? 'Pode usar o app.' : u.acesso_pedido_em ? `Pediu acesso ${relativo(diaDeInstante(u.acesso_pedido_em))}.` : 'Bloqueado: não usa o app até ser liberado.'}</span>
          ${u.id === meuId ? '' : u.liberado
            ? `<button class="btn-peq sec" type="button" data-bloquear="${u.id}">Bloquear acesso</button>`
            : `<button class="btn-peq prim" type="button" data-liberar="${u.id}">Liberar acesso</button>`}
        </div>
        <p class="excluir-erro" id="det-acesso-erro" role="alert" hidden></p>
      </section>` : ''}
      ${typeof u.videos_liberados === 'boolean' ? `<section class="det-sec" aria-labelledby="det-videos-t">
        <h3 id="det-videos-t">Vídeos dos exercícios</h3>
        <div class="det-acesso">
          <span class="nota" style="flex:1 1 200px">${u.videos_liberados ? 'Liberados: vê o vídeo da execução nos exercícios que têm vídeo.' : 'Não liberados: os exercícios aparecem sem vídeo.'}</span>
          ${u.videos_liberados
            ? `<button class="btn-peq sec" type="button" data-videos="${u.id}" data-liberar-videos="nao">Tirar vídeos</button>`
            : `<button class="btn-peq prim" type="button" data-videos="${u.id}" data-liberar-videos="sim">Liberar vídeos</button>`}
        </div>
        <p class="excluir-erro" id="det-videos-erro" role="alert" hidden></p>
      </section>` : ''}
      <section class="det-sec" aria-labelledby="det-tempo">
        <h3 id="det-tempo">Atividade recente</h3>
        <div id="det-atividade"></div>
      </section>
      <!-- Excluir conta fica aqui, no fim da ficha, e não a um toque em cada linha da tabela (Fitts). -->
      <section class="det-sec" aria-labelledby="det-excluir-t">
        <h3 id="det-excluir-t">Excluir conta</h3>
        ${u.id === meuId
          ? '<p class="nota">Esta é a sua conta: para excluí-la, use o app (Você → Excluir conta).</p>'
          : `<div class="det-acesso"><span class="nota" style="flex:1 1 200px">Apaga para sempre os check-ins, pesos, treinos e preferências de ${esc(u.nome || u.email)}.</span>
          <button class="btn-peq perigo" type="button" data-excluir="${u.id}">Excluir conta</button></div>`}
      </section>`;
    renderAtividade();
    const dlg = $('detalhe');
    if (!dlg.open) dlg.showModal();
  }

  // ---------- Eventos de interface ----------
  // Balões de "como funciona" dos números: um aberto por vez; fecha ao tocar fora ou com Esc.
  function fecharInfo() {
    document.querySelectorAll('.info[aria-expanded="true"]').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
      $(b.dataset.info).hidden = true;
    });
  }
  function abrirInfo(botao) {
    const aberto = botao.getAttribute('aria-expanded') === 'true';
    fecharInfo();
    if (aberto) return;
    const balao = $(botao.dataset.info);
    botao.setAttribute('aria-expanded', 'true');
    balao.hidden = false;
    balao.style.left = '8px';
    // Não deixa o balão passar da borda dos cards nem da tela.
    const r = balao.getBoundingClientRect();
    const caixa = botao.closest('.kpis, .cartao, .bloco') || document.body;
    const limite = Math.min(caixa.getBoundingClientRect().right, document.documentElement.clientWidth - 16);
    const sobra = r.right - limite;
    if (sobra > 0) balao.style.left = `${8 - sobra}px`;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const aberto = document.querySelector('.info[aria-expanded="true"]');
    if (aberto) { fecharInfo(); aberto.focus(); }
  });

  document.addEventListener('click', async (e) => {
    const info = e.target.closest('.info');
    if (info) return abrirInfo(info);
    fecharInfo();
    if (e.target.closest('#entrar')) {
      await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
      return;
    }
    if (e.target.closest('#sair')) { desligarOnline(); await sb.auth.signOut(); return iniciar(); }
    if (e.target.closest('#tentar-online')) { desligarOnline(); return ligarOnline(); }
    if (e.target.closest('#ver-erro-online')) { verErroOnline = !verErroOnline; return atualizarOnline(); }
    if (e.target.closest('[data-mais-atividade]')) {
      const primeiroNovo = atividade.mostrados;
      atividade.mostrados += POR_VEZ;
      return renderAtividade(primeiroNovo);
    }
    const tab = e.target.closest('[role="tab"]');
    if (tab) return mostrarAba(tab.dataset.aba);
    const grupoErro = e.target.closest('[data-erro]');
    if (grupoErro) {
      const k = grupoErro.dataset.erro;
      if (errosAbertos.has(k)) errosAbertos.delete(k); else errosAbertos.add(k);
      grupoErro.setAttribute('aria-expanded', String(errosAbertos.has(k)));
      $(grupoErro.getAttribute('aria-controls')).hidden = !errosAbertos.has(k);
      return;
    }
    const edicao = e.target.closest('[data-edicao]');
    if (edicao) { edicaoSel = edicao.dataset.edicao; return renderEmails(janela(periodo)); }
    if (e.target.closest('[data-evoluiu-todos]')) { evoluiuTodos = !evoluiuTodos; return renderListasGeral(janela(periodo)); }
    const abrirU = e.target.closest('[data-abrir-usuario]');
    if (abrirU) return abrirDetalhe(abrirU.dataset.abrirUsuario);
    const abrir = e.target.closest('#on-corpo [data-abrir]');
    if (abrir) return abrirDetalhe(abrir.dataset.abrir);
    if (e.target.closest('#tentar')) return iniciar();
    const p = e.target.closest('[data-periodo]');
    if (p) {
      periodo = p.dataset.periodo;
      document.querySelectorAll('[data-periodo]').forEach((b) => b.setAttribute('aria-pressed', String(b === p)));
      render();
      // Período mais longo do que os eventos já buscados: mostra na hora e busca de novo (o botão Atualizar gira enquanto isso).
      if (!eventosCobrem(periodo)) carregar();
      return;
    }
    const alt = e.target.closest('[data-alternar]');
    if (alt) {
      const id = alt.dataset.alternar;
      const mostrarTabela = $(`${id}-tabela`).hidden;
      $(`${id}-tabela`).hidden = !mostrarTabela;
      $(id).hidden = mostrarTabela;
      alt.textContent = mostrarTabela ? 'Ver gráfico' : 'Ver tabela';
      alt.setAttribute('aria-expanded', String(mostrarTabela));
      if (!mostrarTabela) renderVisivel();
      return;
    }
    const th = e.target.closest('#usuarios th[data-col] button');
    if (th) {
      const col = th.parentElement.dataset.col;
      ordem = { col, dir: ordem.col === col ? -ordem.dir : (col === 'nome' || col === 'situacao' ? 1 : -1) };
      return render();
    }
    const exc = e.target.closest('[data-excluir]');
    if (exc) return abrirExcluir(exc.dataset.excluir);
    if (e.target.closest('.excluir-btn')) return;
    const tr = e.target.closest('#usuarios-corpo tr[data-usuario]');
    if (tr) return abrirDetalhe(tr.dataset.usuario);
    if (e.target.closest('#csv')) return exportarCSV();
    if (e.target.closest('#atualizar')) return carregar();
    if (e.target === $('detalhe') || e.target.closest('[data-fechar]')) $('detalhe').close();
  });

  // ---------- Excluir conta de um usuário (mesma confirmação do app) ----------
  let excluirId = null, toastTimer = null;
  function toast(msg) {
    $('toast').textContent = msg; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
  }
  function abrirExcluir(id) {
    const u = dados && dados.usuarios.find((x) => x.id === id);
    if (!u) return;
    excluirId = id;
    const nome = esc(u.nome || u.email);
    const primeiro = esc((u.nome || '').trim().split(/\s+/)[0] || 'a pessoa');
    const item = (t) => `<li>${ICON.xis}<span>${t}</span></li>`;
    $('excluir-body').innerHTML = `
      <div class="excluir-topo"><h2 id="excluir-title">Excluir a conta de ${nome}?</h2>
        <button class="excluir-fechar" type="button" data-fechar-excluir aria-label="Fechar">${ICON.xis}</button></div>
      <p class="excluir-intro">A exclusão é definitiva: ${nome}${u.email && u.nome ? ` (${esc(u.email)})` : ''} vai perder tudo o que já salvou no app. Vamos apagar para sempre:</p>
      <ul class="excluir-lista">
        ${item('Todos os check-ins e o histórico do calendário')}
        ${item('Os pesos, as cargas e os recordes de cada exercício')}
        ${item('Os treinos montados e a semana')}
        ${item('Foto, nome e preferências')}
        ${item('O resumo semanal por e-mail, que para de chegar')}
      </ul>
      <p class="excluir-alerta"><b>Não dá para desfazer.</b> Se ${primeiro} entrar de novo com o Google depois, a conta começa do zero, sem nada do que foi salvo até hoje.</p>
      <p class="excluir-dica">Se a ideia é só parar os e-mails, a pessoa pode desligar o resumo em Você → Notificações, e tudo continua guardado.</p>
      <label class="excluir-entendi"><input type="checkbox" id="excluir-entendi"><span>Entendi que ${nome} vai perder todas as informações.</span></label>
      <p class="excluir-erro" id="excluir-erro" role="alert" hidden></p>
      <div class="excluir-acoes">
        <button class="btn-excluir" type="button" id="excluir-sim" disabled>Excluir conta</button>
        <button class="btn-sec" type="button" data-fechar-excluir>Cancelar</button>
      </div>`;
    $('excluir-dialog').showModal();
  }
  async function confirmarExcluir() {
    const botao = $('excluir-sim');
    const u = dados.usuarios.find((x) => x.id === excluirId);
    botao.disabled = true; botao.textContent = 'Excluindo…';
    $('excluir-erro').hidden = true;
    // Fotos dos check-ins ficam no Storage, fora da cascata do banco: apaga antes ("<usuário>/<check-in>.jpg").
    // O painel nunca mostra nem baixa as fotos; o acesso de administrador existe só para conseguir apagá-las.
    const caminhos = dados.checkins.filter((c) => c.usuario_id === excluirId && c.id).map((c) => `${excluirId}/${c.id}.jpg`);
    if (caminhos.length && sb.storage) await sb.storage.from('fotos-checkin').remove(caminhos).catch(() => {});
    const { error } = await sb.rpc('admin_excluir_usuario', { alvo: excluirId });
    if (error) {
      $('excluir-erro').textContent = /could not find the function/i.test(error.message || '')
        ? 'A exclusão ainda não está ligada no banco: rode de novo o supabase/schema.sql no Supabase.'
        : `Não foi possível excluir: ${error.message}`;
      $('excluir-erro').hidden = false;
      botao.textContent = 'Excluir conta'; botao.disabled = !$('excluir-entendi').checked;
      return;
    }
    $('excluir-dialog').close();
    if (detalheId === excluirId && $('detalhe').open) $('detalhe').close();
    toast(`A conta de ${u ? u.nome || u.email : 'usuário'} foi excluída.`);
    excluirId = null;
    await carregar();
  }
  $('excluir-dialog').addEventListener('change', (e) => {
    if (e.target.id === 'excluir-entendi') $('excluir-sim').disabled = !e.target.checked;
  });
  $('excluir-dialog').addEventListener('click', (e) => {
    if (e.target.closest('#excluir-sim')) return confirmarExcluir();
    if (e.target === $('excluir-dialog') || e.target.closest('[data-fechar-excluir]')) $('excluir-dialog').close();
  });

  // ---------- Convites ----------
  const linkConvite = (codigo) => `${new URL('./', location.href).href}?convite=${codigo}`;
  function estadoConvite(c) {
    if (c.cancelado_em) return { c: 'cancelado', t: 'Cancelado' };
    if (c.usado_em) return { c: 'usado', t: `Usado por ${c.usado_por_nome || c.usado_por_email || 'conta excluída'} em ${fmtData(diaDeInstante(c.usado_em))}` };
    if (new Date(c.expira_em) < new Date()) return { c: 'expirado', t: 'Expirou' };
    return { c: 'aguardando', t: 'Aguardando' };
  }
  function renderConvites() {
    if (!dados) return;
    const pedidos = dados.usuarios.filter((u) => u.liberado === false && u.acesso_pedido_em)
      .sort((a, b) => (a.acesso_pedido_em < b.acesso_pedido_em ? 1 : -1));
    $('alerta-convites').hidden = !pedidos.length;
    $('alerta-convites').textContent = pedidos.length;
    $('alerta-convites').setAttribute('aria-label', `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'} de acesso`);
    $('pedidos-lista').innerHTML = pedidos.length ? pedidos.map((u) => `
      <div class="conv-item">
        <b>${esc(u.nome || 'Sem nome')}</b>
        <small>${esc(u.email)} · pediu ${relativo(diaDeInstante(u.acesso_pedido_em))}</small>
        <span class="conv-botoes">
          <button class="btn-peq prim" type="button" data-liberar="${u.id}">Liberar</button>
          <button class="btn-peq sec" type="button" data-recusar="${u.id}">Recusar</button>
        </span>
      </div>`).join('') : '<p class="vazio">Nenhum pedido de acesso.</p>';
    if (!dados.convites) {
      $('convites-lista').innerHTML = '<p class="vazio">Os convites ainda não estão ligados no banco: rode de novo o supabase/schema.sql no Supabase.</p>';
      $('utilizados-lista').innerHTML = '';
      return;
    }
    const lixeira = (c) => `<button class="excluir-btn" type="button" data-excluir-convite="${esc(c.codigo)}" aria-label="Excluir o convite ${esc(c.codigo)}" title="Excluir convite">${ICON.lixeira}</button>`;
    const gerados = dados.convites.filter((c) => !c.usado_em);
    $('convites-lista').innerHTML = gerados.length ? gerados.map((c) => {
      const e = estadoConvite(c);
      return `
      <div class="conv-item">
        <b>${esc(c.nome || 'Sem nome')} <span class="conv-codigo">${esc(c.codigo)}</span> <span class="conv-estado ${e.c}">${esc(e.t)}</span></b>
        <small>Criado em ${fmtData(diaDeInstante(c.criado_em))}${e.c === 'aguardando' ? ` · vale até ${fmtData(diaDeInstante(c.expira_em))}` : ''}</small>
        <span class="conv-botoes${e.c === 'aguardando' ? ' varios' : ''}">${e.c === 'aguardando' ? `
          <button class="btn-peq sec" type="button" data-copiar-convite="${esc(c.codigo)}">Copiar link</button>
          <button class="btn-peq sec" type="button" data-cancelar-convite="${esc(c.codigo)}">Cancelar</button>` : ''}
          ${lixeira(c)}</span>
      </div>`;
    }).join('') : '<p class="vazio">Nenhum convite aguardando.</p>';
    // Utilizados: convites usados + quem foi liberado depois de pedir acesso (sem código).
    const pessoa = (id, nome, email) => {
      const u = id && dados.usuarios.find((x) => x.id === id);
      const rotulo = esc(nome || email || 'conta excluída');
      return u ? `<button class="conv-pessoa" type="button" data-abrir-usuario="${u.id}">${rotulo}</button>` : `<span>${rotulo}</span>`;
    };
    const usados = dados.convites.filter((c) => c.usado_em).map((c) => ({ quando: c.usado_em, html: `
      <div class="conv-item">
        <b>${pessoa(c.usado_por, c.usado_por_nome, c.usado_por_email)} <span class="conv-estado usado">Convite <span class="conv-codigo">${esc(c.codigo)}</span></span></b>
        <small>${c.usado_por_nome && c.usado_por_email ? `${esc(c.usado_por_email)} · ` : ''}entrou em ${fmtData(diaDeInstante(c.usado_em))}${c.nome ? ` · convite para ${esc(c.nome)}` : ''}</small>
        <span class="conv-botoes">${lixeira(c)}</span>
      </div>` }));
    const pedidosLiberados = dados.usuarios.filter((u) => u.liberado && u.liberado_como === 'pedido').map((u) => ({ quando: u.liberado_em || '', html: `
      <div class="conv-item">
        <b>${pessoa(u.id, u.nome, u.email)} <span class="conv-estado pedido">Pedido de acesso</span></b>
        <small>${u.nome ? `${esc(u.email)} · ` : ''}${u.liberado_em ? `liberado em ${fmtData(diaDeInstante(u.liberado_em))}` : 'liberado pelo administrador'}</small>
      </div>` }));
    const utilizados = usados.concat(pedidosLiberados).sort((a, b) => (a.quando < b.quando ? 1 : -1));
    $('utilizados-lista').innerHTML = utilizados.length ? utilizados.map((x) => x.html).join('') : '<p class="vazio">Ninguém entrou por convite ainda.</p>';
  }
  // Excluir o registro de um convite (usado ou não). Quem já entrou continua usando o app.
  let convExcluir = null;
  function abrirExcluirConvite(codigo) {
    const c = dados.convites.find((x) => x.codigo === codigo);
    if (!c) return;
    convExcluir = codigo;
    const usado = !!c.usado_em;
    $('conv-excluir-body').innerHTML = `
      <div class="excluir-topo"><h2 id="conv-excluir-title">Excluir o convite <span class="conv-codigo">${esc(codigo)}</span>?</h2>
        <button class="excluir-fechar" type="button" data-fechar-conv aria-label="Fechar">${ICON.xis}</button></div>
      <p class="excluir-intro">${usado
        ? `O registro sai da lista de convites utilizados. ${esc(c.usado_por_nome || c.usado_por_email || 'Quem entrou com ele')} continua usando o app normalmente.`
        : `O registro sai da lista${estadoConvite(c).c === 'aguardando' ? ' e o link para de funcionar' : ''}.`}</p>
      <p class="excluir-erro" id="conv-excluir-erro" role="alert" hidden></p>
      <div class="excluir-acoes">
        <button class="btn-excluir" type="button" id="conv-excluir-sim">Excluir convite</button>
        <button class="btn-sec" type="button" data-fechar-conv>Cancelar</button>
      </div>`;
    $('conv-excluir-dialog').showModal();
  }
  $('conv-excluir-dialog').addEventListener('click', async (e) => {
    if (e.target === $('conv-excluir-dialog') || e.target.closest('[data-fechar-conv]')) return $('conv-excluir-dialog').close();
    if (!e.target.closest('#conv-excluir-sim')) return;
    const botao = $('conv-excluir-sim');
    botao.disabled = true; botao.textContent = 'Excluindo…';
    const { error } = await sb.rpc('admin_excluir_convite', { p_codigo: convExcluir });
    if (error) {
      $('conv-excluir-erro').textContent = /could not find the function/i.test(error.message || '')
        ? 'A exclusão de convites ainda não está ligada no banco: rode de novo o supabase/schema.sql no Supabase.'
        : `Não foi possível excluir: ${error.message}`;
      $('conv-excluir-erro').hidden = false;
      botao.disabled = false; botao.textContent = 'Excluir convite';
      return;
    }
    $('conv-excluir-dialog').close();
    toast('Convite excluído.');
    const cv = await sb.rpc('admin_convites');
    if (!cv.error) { dados.convites = cv.data || []; renderConvites(); }
  });
  function mensagemConvite(nome, link) {
    return `Oi${nome ? `, ${nome}` : ''}! Te convidei para o Gestão de Treinos, o app de treino que eu uso. Entra por este link com a sua conta Google (vale 7 dias): ${link}`;
  }
  async function copiar(texto, botao) {
    try { await navigator.clipboard.writeText(texto); } catch (_) {
      const t = document.createElement('textarea'); t.value = texto; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (__) {} t.remove();
    }
    if (botao) { const antes = botao.textContent; botao.textContent = 'Copiado!'; setTimeout(() => { botao.textContent = antes; }, 1500); }
  }
  $('conv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = $('conv-nome').value.trim();
    $('conv-gerar').disabled = true;
    const { data: codigo, error } = await sb.rpc('admin_criar_convite', { p_nome: nome });
    $('conv-gerar').disabled = false;
    if (error) {
      $('conv-gerado').innerHTML = `<p class="excluir-erro" role="alert" style="margin-top:12px">${/could not find the function/i.test(error.message || '')
        ? 'Os convites ainda não estão ligados no banco: rode de novo o supabase/schema.sql no Supabase.' : `Não foi possível gerar o convite: ${esc(error.message)}`}</p>`;
      return;
    }
    const link = linkConvite(codigo);
    $('conv-gerado').innerHTML = `
      <div class="conv-gerado" role="status">
        <p>Convite${nome ? ` para ${esc(nome)}` : ''} criado: <span class="conv-codigo">${esc(codigo)}</span></p>
        <input class="conv-link" id="conv-link" type="text" readonly value="${esc(link)}" aria-label="Link do convite">
        <div class="conv-acoes">
          <button class="btn" type="button" id="conv-copiar">Copiar link</button>
          <a class="btn-sec" id="conv-whats" href="https://wa.me/?text=${encodeURIComponent(mensagemConvite(nome, link))}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>
        </div>
      </div>`;
    $('conv-nome').value = '';
    const cv = await sb.rpc('admin_convites');
    if (!cv.error) { dados.convites = cv.data || []; renderConvites(); }
  });
  async function acaoAcesso(fn, alvo, msgOk) {
    const { error } = await sb.rpc(fn, { alvo });
    if (error) {
      const el = $('det-acesso-erro');
      if (el && $('detalhe').open) { el.textContent = error.message; el.hidden = false; } else toast(error.message);
      return;
    }
    toast(msgOk);
    await carregar();
    if ($('detalhe').open && detalheId === alvo) abrirDetalhe(alvo);
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-videos], [data-liberar], [data-recusar], [data-bloquear], [data-copiar-convite], [data-cancelar-convite], [data-excluir-convite], [data-abrir-usuario], #conv-copiar');
    if (!b) return;
    if (b.dataset.excluirConvite) return abrirExcluirConvite(b.dataset.excluirConvite);
    if (b.dataset.abrirUsuario) return abrirDetalhe(b.dataset.abrirUsuario);
    const nome = (id) => { const u = dados.usuarios.find((x) => x.id === id); return u ? u.nome || u.email : 'usuário'; };
    if (b.id === 'conv-copiar') return copiar($('conv-link').value, b);
    if (b.dataset.copiarConvite) return copiar(linkConvite(b.dataset.copiarConvite), b);
    if (b.dataset.cancelarConvite) {
      const { error } = await sb.rpc('admin_cancelar_convite', { p_codigo: b.dataset.cancelarConvite });
      if (error) return toast(error.message);
      toast('Convite cancelado.');
      const cv = await sb.rpc('admin_convites');
      if (!cv.error) { dados.convites = cv.data || []; renderConvites(); }
      return;
    }
    if (b.dataset.videos) {
      const alvo = b.dataset.videos, liberar = b.dataset.liberarVideos === 'sim';
      b.disabled = true;
      const { error } = await sb.rpc('admin_liberar_videos', { alvo, liberar });
      if (error) {
        b.disabled = false;
        const el = $('det-videos-erro');
        el.textContent = /admin_liberar_videos|function/.test(error.message) ? 'Para liberar vídeos, rode de novo o supabase/schema.sql no Supabase.' : error.message;
        el.hidden = false;
        return;
      }
      toast(liberar ? `Vídeos liberados para ${nome(alvo)}.` : `${nome(alvo)} não vê mais os vídeos.`);
      await carregar();
      if ($('detalhe').open && detalheId === alvo) abrirDetalhe(alvo);
      return;
    }
    if (b.dataset.liberar) return acaoAcesso('admin_liberar_usuario', b.dataset.liberar, `${nome(b.dataset.liberar)} pode usar o app.`);
    if (b.dataset.recusar) return acaoAcesso('admin_recusar_pedido', b.dataset.recusar, `Pedido de ${nome(b.dataset.recusar)} recusado.`);
    if (b.dataset.bloquear) return acaoAcesso('admin_bloquear_usuario', b.dataset.bloquear, `${nome(b.dataset.bloquear)} foi bloqueado.`);
  });

  $('busca').addEventListener('input', (e) => { busca = e.target.value; if (dados) renderUsuarios(janela(periodo), diasAtivos()); });
  $('so-checkin').checked = soCheckin;
  $('so-checkin').addEventListener('change', (e) => {
    soCheckin = e.target.checked;
    try { localStorage.setItem('bauer-admin-so-checkin', soCheckin ? '1' : ''); } catch (_) {}
    if (dados) renderUsuarios(janela(periodo), diasAtivos());
  });
  $('ordenar-cel').addEventListener('change', (e) => {
    const col = e.target.value;
    ordem = { col, dir: col === 'nome' ? 1 : -1 };
    render();
  });


  // ---------- Exercícios (catálogo do app: tabela exercicios) ----------
  // Lê e grava pelas funções admin_exercicios e admin_salvar_exercicio. Os treinos das contas guardam só o nome:
  // renomear guarda o nome antigo (o app continua achando o exercício) e desativar só tira da lista de escolha.
  const GRUPOS_EX = ['Mobilidade', 'Core', 'Explosivos', 'Pernas', 'Costas', 'Peito', 'Ombros', 'Braços', 'Pescoço', 'Cardio'];
  const rotuloGrupoEx = (g) => ({ Core: 'Core e abdômen' }[g] || g);
  const NIVEIS_EX = [['hipertrofia', 'Hipertrofia'], ['forca', 'Força'], ['explosao', 'Explosão'], ['mobilidade', 'Mobilidade']];
  const ROTULO_NIVEL = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
  const chaveEx = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const exs = { lista: null, erro: '', busca: '', grupo: 'todos', obj: 'todos', sit: 'todos', atual: null, jornadas: [] };
  async function carregarExercicios() {
    // Objetivos (tabela jornadas): para marcar e filtrar os exercícios por objetivo.
    const [r, jr] = await Promise.all([sb.rpc('admin_exercicios'), sb.from('jornadas').select('id, dados, ordem, ativo').then((x) => x, () => ({ error: true }))]);
    exs.jornadas = jr.error ? [] : (jr.data || []).filter((j) => j && j.id && j.dados && j.dados.nome)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0)).map((j) => ({ id: j.id, nome: j.dados.nome }));
    if (r.error) {
      exs.lista = null;
      exs.erro = /admin_exercicios|schema cache|does not exist/.test(r.error.message || '') ? 'sem-sql' : r.error.message;
    } else { exs.lista = r.data || []; exs.erro = ''; }
    renderExercicios();
  }
  // Link do YouTube (watch, youtu.be, shorts, embed) ou só o código de 11 letras. '' = sem vídeo; null = inválido.
  function codigoVideo(t) {
    const v = String(t || '').trim();
    if (!v) return '';
    if (/^[\w-]{11}$/.test(v)) return v;
    const m = v.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})(?![\w-])/);
    return m ? m[1] : null;
  }
  function renderExercicios() {
    const lista = $('ex-lista');
    $('ex-novo').disabled = !exs.lista;
    if (!exs.lista) {
      $('ex-resumo').textContent = '';
      $('ex-grupos').innerHTML = '';
      lista.innerHTML = `<p class="vazio">${exs.erro === 'sem-sql' ? 'Os exercícios ainda não estão no banco: rode de novo o supabase/schema.sql no Supabase. Enquanto isso, o app usa a lista que vem com ele.'
        : exs.erro ? `Não foi possível carregar os exercícios. ${esc(exs.erro)}` : 'Carregando…'}</p>`;
      return;
    }
    const todos = exs.lista;
    const ativos = todos.filter((e) => e.ativo).length;
    const comVideo = todos.filter((e) => e.ativo && e.video_id).length;
    const desativados = todos.length - ativos;
    $('ex-resumo').textContent = `${ativos} ${ativos === 1 ? 'exercício ativo' : 'exercícios ativos'} · ${comVideo} com vídeo${desativados ? ` · ${desativados} ${desativados === 1 ? 'desativado' : 'desativados'}` : ''}`;
    renderFiltros();
    const nomeObj = (id) => (exs.jornadas.find((j) => j.id === id) || { nome: id }).nome;
    const nFiltros = ['grupo', 'obj', 'sit'].filter((k) => exs[k] !== 'todos').length;
    $('ex-filtros-n').hidden = !nFiltros;
    $('ex-filtros-n').textContent = nFiltros;
    $('ex-filtrar').setAttribute('aria-label', nFiltros ? `Filtros (${nFiltros} ${nFiltros === 1 ? 'ativo' : 'ativos'})` : 'Filtros');
    const itens = filtrarExercicios(exs)
      .sort((a, b) => (b.ativo - a.ativo) || GRUPOS_EX.indexOf(a.grupo) - GRUPOS_EX.indexOf(b.grupo) || a.nome.localeCompare(b.nome, 'pt-BR'));
    lista.innerHTML = itens.length ? itens.map((e) => `
      <div class="conv-item ex-item">
        <b>${esc(e.nome)}${e.ativo ? '' : ' <span class="conv-estado desativado">Desativado</span>'}</b>
        <small>${esc(rotuloGrupoEx(e.grupo))} · ${esc(e.dose)} · PSE ${e.pse} · ${e.video_id ? 'com vídeo' : '<span class="ex-sem-video">sem vídeo</span>'} · ${e.usos ? `em ${e.usos} ${e.usos === 1 ? 'conta' : 'contas'}` : 'em nenhum treino'}${(e.nomes_antigos || []).length ? ` · antes: ${esc(e.nomes_antigos.join(', '))}` : ''}</small>
        ${(e.objetivos || []).length ? `<span class="ex-tags">${e.objetivos.map((id) => `<span>${esc(nomeObj(id))}</span>`).join('')}</span>` : ''}
        <span class="conv-botoes"><button class="excluir-btn editar-btn" type="button" data-ex-editar="${esc(e.nome)}" aria-label="Editar ${esc(e.nome)}" title="Editar exercício">${ICON.lapis}</button><button class="excluir-btn" type="button" data-ex-apagar="${esc(e.nome)}" aria-label="Excluir ${esc(e.nome)}" title="Excluir exercício">${ICON.lixeira}</button></span>
      </div>`).join('') : '<p class="vazio">Nenhum exercício com esse nome neste grupo.</p>';
  }
  // Exercícios que passam nos filtros f ({ grupo, obj, sit }) e na busca.
  function filtrarExercicios(f) {
    const busca = chaveEx(exs.busca);
    return (exs.lista || []).filter((e) => (f.grupo === 'todos' || e.grupo === f.grupo) && (f.obj === 'todos' || (e.objetivos || []).includes(f.obj))
      && (f.sit === 'todos' || (f.sit === 'ativos' ? e.ativo : f.sit === 'desativados' ? !e.ativo : !e.video_id))
      && (!busca || [e.nome, ...(e.variacoes || []), ...(e.nomes_antigos || [])].some((n) => chaveEx(n).includes(busca))));
  }
  // Janela de filtros: as escolhas ficam num rascunho e só valem ao tocar em Filtrar (fechar descarta).
  function renderFiltros() {
    if (!exs.lista) return;
    const f = exs.rascunho || exs;
    const todos = exs.lista;
    const conta = (g) => todos.filter((e) => g === 'todos' || e.grupo === g).length;
    $('ex-grupos').innerHTML = ['todos', ...GRUPOS_EX].filter((g) => g === 'todos' || conta(g)).map((g) => `
      <button type="button" data-ex-grupo="${g}" aria-pressed="${f.grupo === g}">${g === 'todos' ? 'Todos' : esc(rotuloGrupoEx(g))} <small>${conta(g)}</small></button>`).join('');
    const nomeObj = (id) => (exs.jornadas.find((j) => j.id === id) || { nome: id }).nome;
    const contaObj = (id) => todos.filter((e) => (e.objetivos || []).includes(id)).length;
    $('ex-objs-filtro').innerHTML = exs.jornadas.length ? ['todos', ...exs.jornadas.map((j) => j.id)].map((id) => `
      <button type="button" data-ex-obj="${esc(id)}" aria-pressed="${f.obj === id}">${id === 'todos' ? 'Todos' : esc(nomeObj(id))} <small>${id === 'todos' ? todos.length : contaObj(id)}</small></button>`).join('') : '';
    $('ex-objs-bloco').hidden = !exs.jornadas.length;
    const ativos = todos.filter((e) => e.ativo).length;
    $('ex-sit-filtro').innerHTML = [['todos', 'Todos', todos.length], ['ativos', 'Ativos', ativos], ['desativados', 'Desativados', todos.length - ativos], ['sem-video', 'Sem vídeo', todos.filter((e) => !e.video_id).length]].map(([k, r, n]) => `
      <button type="button" data-ex-sit="${k}" aria-pressed="${f.sit === k}">${r} <small>${n}</small></button>`).join('');
    const n = filtrarExercicios(f).length;
    $('ex-filtros-ver').textContent = `Filtrar · ${n} ${n === 1 ? 'exercício' : 'exercícios'}`;
  }
  // Séries no padrão do app: "3×10", "2–3×12 / lado", "3×30 s", "3×1 min", "3×12 totais". O que não cabe nisso
  // (ex.: "8×20 s forte / 40 s leve") fica em "Outro formato".
  const RE_DOSE = /^(\d{1,2}(?:–\d{1,2})?)×(\d{1,3}(?:–\d{1,3})?)(?: (s|min))?( \/ lado)?(?: (totais|válidas?))?$/;
  const traco = (t) => String(t || '').trim().replace(/\s*[-–]\s*/g, '–');
  function lerDose(d) {
    const m = RE_DOSE.exec(String(d || '').trim());
    return m ? { series: m[1], valor: m[2], unidade: m[3] || 'rep', lado: !!m[4], conta: (m[5] || '').replace(/^válida$/, 'válidas') } : null;
  }
  function montarDose({ series, valor, unidade, lado, conta }) {
    const n = traco(series), v = traco(valor);
    if (!/^\d{1,2}(–\d{1,2})?$/.test(n) || !/^\d{1,3}(–\d{1,3})?$/.test(v)) return null;
    return `${n}×${v}${unidade === 's' ? ' s' : unidade === 'min' ? ' min' : ''}${lado ? ' / lado' : ''}${conta ? ` ${conta}` : ''}`;
  }
  // Nome no padrão: sem espaços sobrando e com a primeira letra maiúscula (o resto como digitado, por causa das siglas).
  const padronizarNome = (t) => { const n = String(t || '').trim().replace(/\s+/g, ' '); return n ? n[0].toLocaleUpperCase('pt-BR') + n.slice(1) : ''; };
  function doseDoForm() {
    if ($('ex-dose-livre').checked) return $('ex-dose').value.trim().replace(/\s+/g, ' ');
    return montarDose({ series: $('ex-series').value, valor: $('ex-valor').value, unidade: $('ex-unidade').value, lado: $('ex-lado').checked, conta: $('ex-conta').value });
  }
  function mostrarDose() {
    const livre = $('ex-dose-livre').checked;
    $('ex-dose-campos').hidden = livre;
    $('ex-dose-texto').hidden = !livre;
    const d = doseDoForm();
    $('ex-dose-previa').textContent = d ? `No app: ${d}` : 'Preencha as séries e as repetições ou o tempo (ex.: 3 e 10, ou 2–3 e 10–15).';
  }
  function abrirExercicio(nome) {
    const e = nome ? exs.lista.find((x) => x.nome === nome) : null;
    if (nome && !e) return;
    exs.atual = e;
    const v = e || { nome: '', grupo: exs.grupo !== 'todos' ? exs.grupo : '', dose: '3×10', pse: 8, hipertrofia: 'baixa', forca: 'baixa', explosao: 'baixa', mobilidade: 'baixa', explicacao: '', variacoes: [], objetivos: [], ativo: true, video_id: '' };
    const opcoes = (lista, sel) => lista.map(([val, rot]) => `<option value="${esc(val)}"${val === sel ? ' selected' : ''}>${esc(rot)}</option>`).join('');
    const dose = lerDose(v.dose);
    const d = dose || { series: '3', valor: '10', unidade: 'rep', lado: false, conta: '' };
    const pses = [...new Set([4, 5, 6, 7, 8, 9, 10, Number(v.pse) || 8])].sort((a, b) => a - b);
    const nivel = ([k, rot]) => `
          <fieldset class="ex-nivel"><legend>${rot}</legend>
            <div class="ex-seg">${Object.entries(ROTULO_NIVEL).map(([val, r]) => `<label><input type="radio" name="ex-${k}" value="${val}"${v[k] === val ? ' checked' : ''}><span>${r}</span></label>`).join('')}</div>
          </fieldset>`;
    const objs = exs.jornadas || [];
    $('ex-body').innerHTML = `
      <form class="ex-form" id="ex-form" novalidate>
        <div class="ex-topo"><h2 id="ex-title">${e ? 'Editar exercício' : 'Novo exercício'}</h2>
          <button class="excluir-fechar" type="button" data-ex-fechar aria-label="Fechar">${ICON.xis}</button></div>
        <div class="ex-meio">
          <label class="ex-campo">Nome<input id="ex-nome" maxlength="80" autocomplete="off" value="${esc(v.nome)}" required></label>
          ${e && (e.nomes_antigos || []).length ? `<p class="ex-dica">Antes chamado: ${esc(e.nomes_antigos.join(', '))}</p>` : ''}
          <div class="ex-grade2">
            <label class="ex-campo">Grupo<select id="ex-grupo">${v.grupo ? '' : '<option value="">Escolha</option>'}${opcoes(GRUPOS_EX.map((g) => [g, rotuloGrupoEx(g)]), v.grupo)}</select></label>
            <label class="ex-campo">PSE<select id="ex-pse">${opcoes(pses.map((n) => [String(n), String(n)]), String(v.pse))}</select></label>
          </div>
          <fieldset class="ex-bloco"><legend>Séries sugeridas</legend>
            <div class="ex-grade-dose" id="ex-dose-campos">
              <label class="ex-campo">Séries<input id="ex-series" inputmode="numeric" maxlength="5" autocomplete="off" value="${esc(d.series)}" placeholder="3"></label>
              <span class="ex-vezes" aria-hidden="true">×</span>
              <label class="ex-campo">Repetições ou tempo<input id="ex-valor" inputmode="numeric" maxlength="7" autocomplete="off" value="${esc(d.valor)}" placeholder="10"></label>
              <label class="ex-campo">Unidade<select id="ex-unidade">${opcoes([['rep', 'repetições'], ['s', 'segundos'], ['min', 'minutos']], d.unidade)}</select></label>
              <label class="ex-campo">Contagem<select id="ex-conta">${opcoes([['', 'normal'], ['totais', 'totais'], ['válidas', 'válidas']], d.conta)}</select></label>
              <label class="excluir-entendi ex-lado"><input type="checkbox" id="ex-lado"${d.lado ? ' checked' : ''}><span>Por lado</span></label>
            </div>
            <label class="ex-campo" id="ex-dose-texto" hidden>Outro formato<input id="ex-dose" maxlength="30" autocomplete="off" value="${esc(v.dose)}"></label>
            <p class="ex-dica" id="ex-dose-previa" aria-live="polite"></p>
            <label class="excluir-entendi"><input type="checkbox" id="ex-dose-livre"${dose ? '' : ' checked'}><span>Outro formato (texto livre)</span></label>
          </fieldset>
          <fieldset class="ex-bloco"><legend>Níveis</legend>
            <div class="ex-niveis">${NIVEIS_EX.map(nivel).join('')}</div>
          </fieldset>
          <fieldset class="ex-bloco"><legend>Objetivos (opcional)</legend>
            <p class="ex-dica">Marque se o exercício combina com algum objetivo. No app, aparece em "Do meu objetivo" para quem escolheu esse objetivo.</p>
            <div class="ex-objs">${objs.length ? objs.map((j) => `<label><input type="checkbox" name="ex-obj" value="${esc(j.id)}"${(v.objetivos || []).includes(j.id) ? ' checked' : ''}><span>${esc(j.nome)}</span></label>`).join('') : '<span class="ex-dica">Nenhum objetivo no banco.</span>'}</div>
          </fieldset>
          <label class="ex-campo">Explicação<textarea id="ex-why" maxlength="400" rows="3" placeholder="Para que serve e o que trabalha (aparece no app, abaixo dos níveis)">${esc(v.explicacao)}</textarea></label>
          <label class="ex-campo">Outros nomes<input id="ex-var" autocomplete="off" value="${esc((v.variacoes || []).join(', '))}" placeholder="Separe por vírgula (ex.: Agachamento com barra)"></label>
          <p class="ex-dica">A busca do app acha o exercício por eles.</p>
          <label class="ex-campo">Vídeo do YouTube<input id="ex-video" autocomplete="off" inputmode="url" value="${esc(v.video_id || '')}" placeholder="Link ou código do vídeo (opcional)"></label>
          <label class="excluir-entendi"><input type="checkbox" id="ex-ativo"${v.ativo ? ' checked' : ''}><span>Ativo: aparece para escolher nos treinos</span></label>
          <p class="ex-aviso" id="ex-aviso" hidden></p>
          <p class="excluir-erro" id="ex-erro" role="alert" hidden></p>
          ${e ? `<div class="ex-excluir">
            <button class="ex-excluir-btn" type="button" id="ex-excluir">${ICON.lixeira}<span>Excluir exercício</span></button>
            <div class="ex-excluir-caixa" id="ex-excluir-caixa" hidden></div>
          </div>` : ''}
        </div>
        <div class="ex-rodape">
          <button class="btn-sec" type="button" data-ex-fechar>Cancelar</button>
          <button class="btn" type="submit" id="ex-salvar">${e ? 'Salvar' : 'Criar exercício'}</button>
        </div>
      </form>`;
    mostrarDose();
    avisoExercicio();
    $('ex-dialog').showModal();
    if (!e) $('ex-nome').focus();
  }
  // Avisos de renomear e desativar um exercício que está nos treinos de alguém.
  function avisoExercicio() {
    const e = exs.atual;
    const aviso = $('ex-aviso');
    if (!e || !e.usos) { aviso.hidden = true; return; }
    const quem = `${e.usos} ${e.usos === 1 ? 'conta tem' : 'contas têm'} este exercício nos treinos`;
    const nome = padronizarNome($('ex-nome').value);
    const partes = [];
    if (nome && nome !== e.nome) partes.push(`${quem}. O nome novo aparece no treino delas, e as cargas e o histórico continuam ligados.`);
    if (!$('ex-ativo').checked && e.ativo) partes.push(`${partes.length ? 'E desativado, ele' : `${quem}. Desativado, ele`} sai da lista de escolha, mas continua nos treinos de quem já o tem.`);
    aviso.textContent = partes.join(' ');
    aviso.hidden = !partes.length;
  }
  $('ex-dialog').addEventListener('input', (ev) => {
    if (ev.target.id === 'ex-nome' || ev.target.id === 'ex-ativo') avisoExercicio();
    if (/^ex-(series|valor|unidade|conta|lado|dose|dose-livre)$/.test(ev.target.id)) mostrarDose();
  });
  $('ex-dialog').addEventListener('change', (ev) => {
    if (/^ex-(unidade|conta|lado|dose-livre)$/.test(ev.target.id)) mostrarDose();
    if (ev.target.id === 'ex-dose-livre' && ev.target.checked && !$('ex-dose').value.trim()) $('ex-dose').value = doseDoForm() || '';
  });
  // Ao sair do campo, o nome e os outros nomes já aparecem no padrão.
  $('ex-dialog').addEventListener('focusout', (ev) => {
    if (ev.target.id === 'ex-nome') { ev.target.value = padronizarNome(ev.target.value); avisoExercicio(); }
    if (ev.target.id === 'ex-var') ev.target.value = ev.target.value.split(',').map(padronizarNome).filter(Boolean).join(', ');
    if (ev.target.id === 'ex-series' || ev.target.id === 'ex-valor') { ev.target.value = traco(ev.target.value); mostrarDose(); }
  });
  // Excluir: só quando ninguém tem o exercício nos treinos; senão, a sugestão é desativar.
  function mostrarExcluir() {
    const e = exs.atual;
    const caixa = $('ex-excluir-caixa');
    caixa.hidden = false;
    $('ex-excluir').hidden = true;
    caixa.innerHTML = e.usos
      ? `<p>Este exercício está nos treinos de <b>${e.usos} ${e.usos === 1 ? 'conta' : 'contas'}</b>, por isso não pode ser excluído. Desative: ele sai da lista de escolha e continua nos treinos de quem já tem.</p>
         <div class="ex-excluir-acoes"><button class="btn-peq sec" type="button" data-ex-excluir-nao>Voltar</button>${e.ativo ? '<button class="btn-peq prim" type="button" data-ex-desativar>Desativar</button>' : ''}</div>`
      : `<p>Excluir <b>${esc(e.nome)}</b> de vez? Ele sai do catálogo e do app, junto com o vídeo. Não dá para desfazer.</p>
         <div class="ex-excluir-acoes"><button class="btn-peq sec" type="button" data-ex-excluir-nao>Manter</button><button class="btn-peq perigo" type="button" data-ex-excluir-sim>Excluir de vez</button></div>`;
    caixa.scrollIntoView({ block: 'nearest' });
  }
  $('ex-dialog').addEventListener('click', async (ev) => {
    if (ev.target === $('ex-dialog') || ev.target.closest('[data-ex-fechar]')) return $('ex-dialog').close();
    if (ev.target.closest('#ex-excluir')) return mostrarExcluir();
    if (ev.target.closest('[data-ex-excluir-nao]')) { $('ex-excluir-caixa').hidden = true; $('ex-excluir').hidden = false; return; }
    if (ev.target.closest('[data-ex-desativar]')) {
      $('ex-ativo').checked = false; avisoExercicio();
      $('ex-excluir-caixa').hidden = true; $('ex-excluir').hidden = false;
      return $('ex-salvar').focus();
    }
    const sim = ev.target.closest('[data-ex-excluir-sim]');
    if (sim) {
      const e = exs.atual;
      sim.disabled = true; sim.textContent = 'Excluindo…';
      const { error } = await sb.rpc('admin_excluir_exercicio', { p_nome: e.nome });
      if (error) {
        sim.disabled = false; sim.textContent = 'Excluir de vez';
        $('ex-erro').textContent = /admin_excluir_exercicio|schema cache/.test(error.message || '') ? 'Para excluir exercícios, rode de novo o supabase/schema.sql no Supabase.' : error.message;
        $('ex-erro').hidden = false;
        return;
      }
      $('ex-dialog').close();
      toast(`${e.nome} excluído.`);
      await carregarExercicios();
    }
  });
  $('ex-dialog').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const e = exs.atual;
    const erro = (msg) => { $('ex-erro').textContent = msg; $('ex-erro').hidden = !msg; if (msg) $('ex-erro').scrollIntoView({ block: 'nearest' }); };
    const nome = padronizarNome($('ex-nome').value);
    const grupo = $('ex-grupo').value;
    const pse = Number($('ex-pse').value);
    const dose = doseDoForm();
    const video = codigoVideo($('ex-video').value);
    const variacoes = [...new Set($('ex-var').value.split(',').map(padronizarNome).filter(Boolean))];
    const objetivos = [...document.querySelectorAll('input[name="ex-obj"]:checked')].map((x) => x.value);
    if (!nome) return erro('Informe o nome do exercício.');
    const repetido = exs.lista.find((x) => x !== e && chaveEx(x.nome) === chaveEx(nome));
    if (repetido) return erro(`Já existe um exercício com esse nome: ${repetido.nome}.`);
    if (!grupo) return erro('Escolha o grupo do exercício.');
    if (!dose) return erro($('ex-dose-livre').checked ? 'Escreva as séries sugeridas.' : 'Confira as séries: use números, como 3 e 10, ou faixas, como 2–3 e 10–15.');
    if (dose.length > 30) return erro('As séries sugeridas têm até 30 letras.');
    if (video === null) return erro('Não reconheci o vídeo: cole o link do YouTube ou o código de 11 letras.');
    if (variacoes.length > 20 || variacoes.some((x) => x.length > 80)) return erro('Use até 20 outros nomes, cada um com até 80 letras.');
    erro('');
    const p = {
      nome, grupo, dose, pse, explicacao: $('ex-why').value.trim(), variacoes, objetivos, ativo: $('ex-ativo').checked, video_id: video,
      ...Object.fromEntries(NIVEIS_EX.map(([k]) => [k, (document.querySelector(`input[name="ex-${k}"]:checked`) || {}).value || 'baixa'])),
    };
    const botao = $('ex-salvar');
    botao.disabled = true; botao.textContent = 'Salvando…';
    const { error } = await sb.rpc('admin_salvar_exercicio', { p_nome_atual: e ? e.nome : null, p });
    if (error) {
      botao.disabled = false; botao.textContent = e ? 'Salvar' : 'Criar exercício';
      return erro(/admin_salvar_exercicio|schema cache/.test(error.message || '') ? 'Para editar os exercícios, rode de novo o supabase/schema.sql no Supabase.' : error.message);
    }
    $('ex-dialog').close();
    toast(e ? (e.ativo && !p.ativo ? `${nome} desativado.` : `${nome} salvo. Já vale no app.`) : `${nome} criado. Já aparece no app.`);
    await carregarExercicios();
  });
  // Excluir pela lista: confirmação numa janela. Em uso, não exclui: oferece desativar.
  let exApagar = null;
  function abrirApagar(nome) {
    const e = exs.lista.find((x) => x.nome === nome);
    if (!e) return;
    exApagar = e;
    const emUso = e.usos > 0;
    $('ex-apagar-body').innerHTML = `
      <div class="excluir-topo"><h2 id="ex-apagar-title">${emUso ? `Não dá para excluir ${esc(e.nome)}` : `Excluir ${esc(e.nome)}?`}</h2>
        <button class="excluir-fechar" type="button" data-ex-apagar-fechar aria-label="Fechar">${ICON.xis}</button></div>
      <p class="excluir-intro">${emUso
        ? `Ele está nos treinos de <b>${e.usos} ${e.usos === 1 ? 'conta' : 'contas'}</b>. ${e.ativo ? 'Desative: ele sai da lista de escolha e continua nos treinos de quem já tem.' : 'Ele já está desativado: não aparece para escolher e continua nos treinos de quem já tem.'}`
        : 'Ele sai do catálogo e do app, junto com o vídeo. Não dá para desfazer.'}</p>
      <p class="excluir-erro" id="ex-apagar-erro" role="alert" hidden></p>
      <div class="excluir-acoes">
        ${emUso ? (e.ativo ? '<button class="btn" type="button" id="ex-apagar-desativar">Desativar</button>' : '')
          : '<button class="btn-excluir" type="button" id="ex-apagar-sim">Excluir de vez</button>'}
        <button class="btn-sec" type="button" data-ex-apagar-fechar>${emUso ? 'Voltar' : 'Cancelar'}</button>
      </div>`;
    $('ex-apagar-dialog').showModal();
  }
  $('ex-apagar-dialog').addEventListener('click', async (ev) => {
    if (ev.target === $('ex-apagar-dialog') || ev.target.closest('[data-ex-apagar-fechar]')) return $('ex-apagar-dialog').close();
    const e = exApagar;
    const botao = ev.target.closest('#ex-apagar-sim, #ex-apagar-desativar');
    if (!botao || !e) return;
    const desativar = botao.id === 'ex-apagar-desativar';
    const antes = botao.textContent;
    botao.disabled = true; botao.textContent = desativar ? 'Desativando…' : 'Excluindo…';
    const { error } = desativar
      ? await sb.rpc('admin_salvar_exercicio', { p_nome_atual: e.nome, p: {
        nome: e.nome, grupo: e.grupo, dose: e.dose, pse: e.pse, hipertrofia: e.hipertrofia, mobilidade: e.mobilidade, forca: e.forca, explosao: e.explosao,
        explicacao: e.explicacao, variacoes: e.variacoes || [], objetivos: e.objetivos || [], ativo: false } })
      : await sb.rpc('admin_excluir_exercicio', { p_nome: e.nome });
    if (error) {
      botao.disabled = false; botao.textContent = antes;
      $('ex-apagar-erro').textContent = /admin_excluir_exercicio|schema cache/.test(error.message || '') ? 'Para excluir exercícios, rode de novo o supabase/schema.sql no Supabase.' : error.message;
      $('ex-apagar-erro').hidden = false;
      return;
    }
    $('ex-apagar-dialog').close();
    toast(desativar ? `${e.nome} desativado.` : `${e.nome} excluído.`);
    await carregarExercicios();
  });
  $('ex-busca').addEventListener('input', (ev) => { exs.busca = ev.target.value; renderExercicios(); });
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('#ex-filtrar')) {
      exs.rascunho = { grupo: exs.grupo, obj: exs.obj, sit: exs.sit };
      renderFiltros();
      return $('ex-filtros-dialog').showModal();
    }
    if (ev.target.closest('#ex-filtros-ver')) {
      Object.assign(exs, exs.rascunho || {});
      $('ex-filtros-dialog').close();
      return renderExercicios();
    }
    if (ev.target === $('ex-filtros-dialog') || ev.target.closest('[data-ex-filtros-fechar]')) return $('ex-filtros-dialog').close();
    if (!exs.rascunho) return cliqueLista(ev);
    if (ev.target.closest('#ex-limpar')) { Object.assign(exs.rascunho, { grupo: 'todos', obj: 'todos', sit: 'todos' }); return renderFiltros(); }
    const st = ev.target.closest('[data-ex-sit]');
    if (st) { exs.rascunho.sit = st.dataset.exSit; return renderFiltros(); }
    const ob = ev.target.closest('[data-ex-obj]');
    if (ob) { exs.rascunho.obj = ob.dataset.exObj; return renderFiltros(); }
    const g = ev.target.closest('[data-ex-grupo]');
    if (g) { exs.rascunho.grupo = g.dataset.exGrupo; return renderFiltros(); }
    return cliqueLista(ev);
  });
  // Fechar a janela sem Filtrar descarta as escolhas.
  $('ex-filtros-dialog').addEventListener('close', () => { exs.rascunho = null; });
  function cliqueLista(ev) {
    const ap = ev.target.closest('[data-ex-apagar]');
    if (ap) return abrirApagar(ap.dataset.exApagar);
    const ed = ev.target.closest('[data-ex-editar]');
    if (ed) return abrirExercicio(ed.dataset.exEditar);
    if (ev.target.closest('#ex-novo')) return abrirExercicio(null);
  }

  // Os gráficos são desenhados na largura real; redesenha quando a janela muda.
  let timerTamanho = null, larguraAnterior = innerWidth;
  addEventListener('resize', () => {
    if (!dados || innerWidth === larguraAnterior) return;
    larguraAnterior = innerWidth;
    clearTimeout(timerTamanho);
    timerTamanho = setTimeout(renderVisivel, 150);
  });

  if (sb) {
    sb.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') { desligarOnline(); dados = null; }
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') setTimeout(iniciar, 0);
    });
  }
  iniciar();
})();
