// js/personal.js: área do personal (personal.html). O monitoramento dos alunos vem do painel compartilhado (js/admin.js
// no modo personal); aqui ficam o cadastro do profissional, as fichas (montar, aplicar aos alunos e ajustar por aluno),
// os convites e o que entra na ficha de cada aluno (treinos atuais, pesos e encerrar). Seções em docs/MAPA.md.
(() => {
  const P = { cargas: [], fichas: null, convites: null, catalogo: null, meus: null, erroFichas: '' };
  const painel = () => window.Painel;
  const sb = () => window.Painel.sb;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MAX_TREINOS = 6, MAX_EXERCICIOS = 15;
  const DIAS = [[1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado'], [0, 'Domingo']];
  const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  const chave = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace(/\./g, '') : '—');
  const XIS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const SOBE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const GRUPOS = ['Mobilidade', 'Core', 'Explosivos', 'Pernas', 'Costas', 'Peito', 'Ombros', 'Braços', 'Pescoço', 'Cardio'];
  const DESCE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  // ---------- Cadastro do profissional ----------
  // Sem liberação: pede nome, CREF e UF; depois mostra a situação do pedido (aguardando ou bloqueado).
  let semAcessoCtx = null;
  async function semAcesso(session, mostrarEstado) {
    semAcessoCtx = { session, mostrarEstado };
    const r = await sb().rpc('meu_cadastro_profissional');
    if (r.error) {
      return mostrarEstado(/meu_cadastro_profissional|schema cache|does not exist/.test(r.error.message || '')
        ? '<p>A área do personal ainda não está ligada no banco. Peça ao administrador para rodar a migração <code>supabase/migracoes/003-area-do-personal.sql</code>.</p>'
        : `<p>Não foi possível conferir o seu cadastro. ${esc(r.error.message)}</p><button class="btn-sec" type="button" id="tentar">Tentar de novo</button>`);
    }
    const c = (r.data || [])[0];
    if (c && c.bloqueado_em) {
      return mostrarEstado(`<p><b>Área bloqueada.</b> O administrador fechou a área do personal para a conta ${esc(session.user.email)}. Fale com ele para entender o motivo.</p>
        <button class="btn-sec" type="button" id="sair">Entrar com outra conta</button>`);
    }
    if (c && !c.liberado_em) {
      return mostrarEstado(`<div class="pf-cadastro">
        <h2>Pedido enviado</h2>
        <p>Recebemos o seu pedido em ${esc(dataCurta(c.pedido_em))}: <b>${esc(c.nome)}</b>, CREF ${esc(c.cref)}/${esc(c.uf)}.</p>
        <p>O administrador confere o seu registro no conselho e libera a área. Depois disso, é só abrir esta página de novo.</p>
        <div class="pf-acoes"><button class="btn" type="button" id="tentar">Já fui liberado</button>
          <button class="btn-sec" type="button" data-pf-corrigir>Corrigir meus dados</button>
          <button class="btn-sec" type="button" id="sair">Entrar com outra conta</button></div>
      </div>`);
    }
    return formCadastro(c, session);
  }
  function formCadastro(c, session) {
    const nome = c ? c.nome : String((session.user.user_metadata || {}).full_name || '').slice(0, 80);
    semAcessoCtx.mostrarEstado(`<form class="pf-cadastro ex-form" id="pf-form" novalidate>
      <h2>Área do personal</h2>
      <p>Aqui você monta as fichas dos seus alunos, envia para o app de cada um e acompanha quem está treinando. Para liberar a área, precisamos do seu registro profissional.</p>
      <label class="ex-campo">Nome profissional<input id="pf-nome" maxlength="80" autocomplete="name" value="${esc(nome)}" required></label>
      <div class="ex-grade2">
        <label class="ex-campo">CREF<input id="pf-cref" maxlength="20" autocomplete="off" placeholder="000000-G" value="${esc(c ? c.cref : '')}" required></label>
        <label class="ex-campo">UF<select id="pf-uf"><option value="">UF</option>${UFS.map((u) => `<option${c && c.uf === u ? ' selected' : ''}>${u}</option>`).join('')}</select></label>
      </div>
      <p class="nota">Conta: ${esc(session.user.email)}. O administrador confere o CREF antes de liberar. Seus alunos veem o seu nome e o seu CREF quando recebem o convite.</p>
      <p class="excluir-erro" id="pf-erro" role="alert" hidden></p>
      <div class="pf-acoes"><button class="btn" type="submit" id="pf-enviar">${c ? 'Salvar dados' : 'Pedir acesso'}</button>
        <button class="btn-sec" type="button" id="sair">Entrar com outra conta</button></div>
    </form>`);
  }
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'pf-form') return;
    e.preventDefault();
    const nome = $('pf-nome').value.trim(), cref = $('pf-cref').value.trim(), uf = $('pf-uf').value;
    const erro = (m) => { $('pf-erro').textContent = m; $('pf-erro').hidden = false; };
    if (nome.length < 2) return erro('Escreva o seu nome profissional.');
    if (cref.length < 3) return erro('Escreva o número do seu CREF.');
    if (!uf) return erro('Escolha a UF do seu CREF.');
    $('pf-enviar').disabled = true;
    const { error } = await sb().rpc('pedir_acesso_profissional', { p_nome: nome, p_cref: cref, p_uf: uf });
    if (error) { $('pf-enviar').disabled = false; return erro(`Não foi possível enviar. ${error.message}`); }
    semAcesso(semAcessoCtx.session, semAcessoCtx.mostrarEstado);
  });
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-pf-corrigir]')) return;
    const r = await sb().rpc('meu_cadastro_profissional');
    formCadastro((r.data || [])[0], semAcessoCtx.session);
  });

  // ---------- Conta no topo ----------
  // O topo (foto e nome) é desenhado pelo painel (js/admin.js → Conta no topo); aqui vêm o nome profissional e o CREF.
  async function registroDaConta() {
    const r = await sb().rpc('meu_cadastro_profissional').then((x) => x, () => ({ error: true }));
    const c = !r.error && Array.isArray(r.data) ? r.data[0] : null;
    return c ? { nome: c.nome, sub: c.cref ? `CREF ${c.cref}${c.uf ? `/${c.uf}` : ''}` : '' } : null;
  }

  // ---------- Dados da área (carregados junto com o painel) ----------
  async function carregar(todas) {
    const [k, f, c, ex, m] = await Promise.all([
      todas('personal_cargas'), sb().rpc('personal_fichas'), sb().rpc('personal_convites'),
      sb().from('exercicios').select('nome, grupo, dose, pse, ativo').then((r) => r, () => ({ error: true })),
      sb().rpc('personal_exercicios').then((r) => r, () => ({ error: true })),
    ]);
    return { k, f, c, ex, m };
  }
  function aplicar(x) {
    if (!x) return;
    P.cargas = x.k.error ? [] : (x.k.data || []);
    P.fichas = x.f.error ? null : (x.f.data || []);
    P.erroFichas = x.f.error ? x.f.error.message || 'erro' : '';
    P.convites = x.c.error ? null : (x.c.data || []);
    // Biblioteca: a do banco (ativos), ou a cópia que vem no app (js/dados.js) quando o banco não responde.
    const doBanco = !x.ex.error && Array.isArray(x.ex.data) && x.ex.data.length ? x.ex.data.filter((e) => e.ativo !== false) : null;
    P.biblioteca = (doBanco || BIBLIOTECA_APP).map((e) => ({ nome: e.nome, grupo: e.grupo, dose: e.dose, pse: e.pse }));
    // Meus exercícios (só deste personal). Sem a função no banco (migração 006 não rodada), a lista fica vazia.
    P.meus = x.m.error ? (x.m.error === true || /personal_exercicios/.test(x.m.error.message || '') ? [] : null) : (x.m.data || []);
    montarCatalogo();
  }
  // Catálogo do editor: a biblioteca do app mais os exercícios do personal (marcados com meu: true).
  function montarCatalogo() {
    P.catalogo = [...(P.biblioteca || []), ...(P.meus || []).map((e) => ({ ...e, meu: true }))]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  function render() {
    renderFichas();
    renderMeus();
    renderConvites();
  }
  const alunos = () => (painel().dados() || { usuarios: [] }).usuarios;
  const fichaPorId = (id) => (P.fichas || []).find((f) => f.id === id) || null;
  const exDoCatalogo = (nome) => (P.catalogo || []).find((e) => chave(e.nome) === chave(nome)) || null;
  const qtd = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const contarExercicios = (treinos) => Object.values(treinos || {}).reduce((n, t) => n + ((t && t.exercicios) || []).length, 0);
  // Exercício do personal: grupo, níveis, explicação e vídeo vão junto no treino (o app do aluno não tem o cadastro dele).
  const extraDoMeu = (e) => ({ grupo: e.grupo || '', H: e.hipertrofia || 'baixa', F: e.forca || 'baixa', E: e.explosao || 'baixa', M: e.mobilidade || 'baixa',
    ...(e.explicacao ? { why: e.explicacao } : {}), ...(e.video_id ? { video: e.video_id } : {}) });
  const iguais = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

  // ---------- Visão geral do personal ----------
  // Em vez dos números do administrador (uso do app por todos), o que ajuda a gerenciar os alunos: quem precisa de
  // atenção, a semana de cada um (planejado × feito), a aderência, os recordes e as fichas em uso.
  const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
  const CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  function porAluno(j, ativosMap) {
    const C = painel().calc, d = painel().dados(), hoje = painel().hoje();
    return alunos().map((u) => {
      const meus = d.checkins.filter((c) => c.usuario_id === u.id);
      const dias = meus.map(C.diaDeCheckin).sort();
      const ultimoTreino = dias[dias.length - 1] || null;
      const n = meus.filter((c) => C.dentro(C.diaDeCheckin(c), j)).length;
      const plan = C.planejadasNoPeriodo(u, j);
      const desde = u.vinculado_em ? C.diasEntre(painel().diaDeInstante(u.vinculado_em), hoje) : 0;
      const usou = [...(ativosMap.get(u.id) || [])].some((x) => x >= C.somarDias(hoje, -6));
      return { u, n, plan, ader: C.aderenciaDe(n, plan), ultimoTreino, desde, usou,
        semTreinar: ultimoTreino ? C.diasEntre(ultimoTreino, hoje) : null,
        montadoHa: u.treinos_por_mim && u.treinos_em ? C.diasEntre(painel().diaDeInstante(u.treinos_em), hoje) : null,
        parados: pesosDo(u.id).filter((p) => p.parado).length };
    });
  }
  // Motivos de atenção de um aluno, do mais urgente para o menos (peso maior = mais urgente).
  function motivos(a) {
    const m = [];
    if (!a.u.treinos_por_mim) m.push([5, 'Ainda sem treino montado por você']);
    if (a.semTreinar === null ? a.desde >= 7 : a.semTreinar >= 7) m.push([4, a.semTreinar === null ? 'Ainda não fez check-in' : `Sem treinar há ${a.semTreinar} dias`]);
    if (a.ader !== null && a.ader < 0.5 && a.plan >= 1) m.push([3, `Fez ${Math.round(a.ader * 100)}% do planejado no período`]);
    if (a.montadoHa !== null && a.montadoHa >= 42) m.push([2, `Treino montado há ${Math.floor(a.montadoHa / 7)} semanas: hora de renovar?`]);
    if (a.parados) m.push([1, `Carga parada em ${qtd(a.parados, 'exercício', 'exercícios')}`]);
    return m.sort((x, y) => y[0] - x[0]);
  }
  function geral(j, ativosMap) {
    const C = painel().calc, d = painel().dados(), fmt = painel().fmtNum;
    const lista = porAluno(j, ativosMap);
    const ant = j.anterior ? porAluno(j.anterior, ativosMap) : null;
    const total = lista.length;
    const media = (l) => { const v = l.map((a) => a.ader).filter((x) => x !== null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
    const ader = media(lista), aderAnt = ant ? media(ant) : null;
    const cks = lista.reduce((x, a) => x + a.n, 0), cksAnt = ant ? ant.reduce((x, a) => x + a.n, 0) : null;
    const hoje = painel().hoje();
    const hojeN = new Set(d.checkins.filter((c) => C.diaDeCheckin(c) === hoje).map((c) => c.usuario_id)).size;
    const semana = lista.filter((a) => a.ultimoTreino && a.ultimoTreino >= C.somarDias(hoje, -6)).length;
    const atencao = lista.map((a) => ({ a, m: motivos(a) })).filter((x) => x.m.length)
      .sort((x, y) => y.m[0][0] - x.m[0][0] || y.m.length - x.m.length || (x.a.u.nome < y.a.u.nome ? -1 : 1));
    const rec = C.recordesDe(j), recAnt = j.anterior ? C.recordesDe(j.anterior) : null;
    const rotulo = C.rotuloDoPeriodo(), compara = C.comparaDoPeriodo();
    const tile = C.fabricaDeCards('k');
    $('kpis').innerHTML = [
      tile('Alunos ativos', `${semana}<small> de ${total}</small>`, { longo: 'treinaram nos últimos 7 dias', curto: 'treinaram em 7 dias', destaque: true,
        info: 'Quantos dos seus alunos fizeram pelo menos um check-in nos últimos 7 dias. O número menor é o total de alunos que você acompanha. Não muda com o período escolhido.' }),
      tile('Aderência ao plano', ader === null ? '—' : `${fmt(ader * 100)}<small>%</small>`, { longo: 'feito ÷ planejado, média dos alunos', curto: 'do planejado', destaque: true,
        d: ant && ader !== null && aderAnt !== null && C.delta(ader, aderAnt, { pct: true }),
        info: `Quanto do planejado os seus alunos cumpriram ${rotulo}, em média. Para cada aluno: check-ins ÷ treinos planejados na semana dele, com limite de 100%. Quem não tinha nada planejado não entra na média. ${compara}` }),
      tile('Treinaram hoje', `${hojeN}<small> de ${total}</small>`, { longo: 'alunos com check-in hoje', curto: 'com check-in hoje',
        info: 'Quantos alunos já fizeram check-in hoje. Não muda com o período escolhido.' }),
      tile('Precisam de atenção', `${atencao.length}<small> de ${total}</small>`, { longo: atencao.length ? 'a lista está logo abaixo' : 'todo mundo em dia', curto: atencao.length ? 'veja abaixo' : 'em dia',
        info: 'Alunos sem treino montado por você, sem treinar há 7 dias ou mais, abaixo de 50% do planejado, com o treino montado há 6 semanas ou mais ou com a carga parada. A lista "Precisam de atenção" mostra o motivo de cada um.' }),
      tile('Check-ins', fmt(cks), { longo: rotulo, curto: '', d: cksAnt !== null && C.delta(cks, cksAnt),
        info: `Treinos feitos pelos seus alunos ${rotulo}, somando todos os tipos (musculação, lutas, cardio e esportes). ${compara}` }),
      tile('Recordes', fmt(rec.length), { longo: `de ${qtd(new Set(rec.map((e) => e.usuario_id)).size, 'aluno', 'alunos')}`, curto: '', d: recAnt && C.delta(rec.length, recAnt.length),
        info: `Vezes em que um aluno superou o próprio peso máximo num exercício ${rotulo} (o primeiro peso registrado não conta). ${compara}` }),
    ].join('');

    $('atencao-lista').innerHTML = !total ? '<p class="vazio">Você ainda não tem alunos. Convide na aba Convidar.</p>'
      : atencao.length ? atencao.map(({ a, m }) => `<div class="item-lista">
        <button class="item-topo" type="button" data-abrir-usuario="${a.u.id}">
          <span class="item-titulo com-avatar">${painel().avatar(a.u, 'av-p')}${esc(a.u.nome)}</span>
          <span class="pf-motivos">${m.map(([peso, t]) => `<span class="pf-motivo${peso >= 4 ? ' forte' : ''}">${esc(t)}</span>`).join('')}</span>
        </button></div>`).join('')
        : '<p class="vazio">Ninguém precisa de atenção agora: todos têm treino seu, estão treinando e seguindo o plano.</p>';

    renderSemana(lista);

    const usos = (P.fichas || []).filter((f) => f.alunos).sort((x, y) => y.alunos - x.alunos || x.nome.localeCompare(y.nome, 'pt-BR'));
    const semMim = lista.filter((a) => !a.u.treinos_por_mim).length;
    const soDoAluno = lista.filter((a) => a.u.treinos_por_mim && !a.u.ficha_id).length;
    const maior = Math.max(1, ...usos.map((f) => f.alunos), soDoAluno, semMim);
    const linha = (nome, n, sub, cor) => `<li><span class="rt-nome">${esc(nome)}</span>
        <span class="rt-trilho" aria-hidden="true"><span class="rt-barra" style="width:${n / maior * 100}%;background:${cor}"></span></span>
        <span class="rt-num">${fmt(n)}<small>${n === 1 ? 'aluno' : 'alunos'}</small></span>${sub ? `<span class="rt-sub">${sub}</span>` : ''}</li>`;
    $('fichas-uso-lista').innerHTML = !total ? '<p class="vazio">Sem alunos ainda.</p>'
      : `<ol class="ranking-treinos">${usos.map((f) => linha(f.nome, f.alunos, '', 'var(--marca)')).join('')}
        ${soDoAluno ? linha('Treino montado só para o aluno', soDoAluno, '', 'var(--marca)') : ''}
        ${semMim ? linha('Sem treino seu', semMim, 'com o plano pronto do app ou os treinos de antes', 'var(--erro)') : ''}</ol>
        ${!usos.length && !soDoAluno ? '<p class="vazio">Nenhum aluno está com uma ficha sua ainda. Monte na aba Treinos e aplique.</p>' : ''}`;
  }
  // ---------- Semana dos alunos e Gerenciar semana ----------
  // O card mostra a semana (segunda a domingo) de cada aluno: planejado (semana do app) × feito (check-ins). As setas
  // trocam a semana (só para trás) e "Ver detalhes" abre o resumo por aluno. "Gerenciar" abre a mesma semana em tela
  // cheia, com números da turma, busca, filtros (situação e atividade), ordem, a visão das últimas 4 semanas e CSV.
  const SEM = { desloc: 0, detalhes: false, lista: [], linhas: [], gs: { busca: '', sit: 'todos', tipo: '', ordem: 'nome', vista: 'semana' } };
  const DESCANSO = '<span class="pf-marca-dia descanso" title="Descanso"></span>';
  const av = (u, cls) => painel().avatar(u, cls);
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function intervaloDaSemana(seg, fim) {
    const a = painel().deYmd(seg), b = painel().deYmd(fim || painel().calc.somarDias(seg, 6));
    return a.getMonth() === b.getMonth() ? `${a.getDate()} a ${b.getDate()} de ${MESES[b.getMonth()]}` : `${a.getDate()} de ${MESES[a.getMonth()]} a ${b.getDate()} de ${MESES[b.getMonth()]}`;
  }
  function segundaDaSemana(desloc) {
    const C = painel().calc, hoje = painel().hoje();
    return C.somarDias(hoje, -((painel().deYmd(hoje).getDay() + 6) % 7) - 7 * desloc);
  }
  function rotuloDaSemana(desloc) {
    const x = intervaloDaSemana(segundaDaSemana(desloc));
    return desloc === 0 ? `Esta semana · ${x}` : desloc === 1 ? `Semana passada · ${x}` : x;
  }
  // Planejado × feito de um aluno numa semana (tipo, se vier, limita a uma atividade). Cada treino planejado é cumprido
  // pelo mesmo tipo ou, se não, por outro do mesmo grupo (ex.: Treino B no dia do A); o que sobra é treino extra.
  function semanaDoAluno(a, seg, tipo) {
    const C = painel().calc, d = painel().dados(), hoje = painel().hoje(), T = painel().tipos();
    const sem = Array.isArray(a.u.semana) && a.u.semana.length === 7 ? a.u.semana : null;
    const meus = d.checkins.filter((c) => c.usuario_id === a.u.id);
    const r = { a, sem: !!sem, feitos: 0, plan: 0, extras: [], faltas: [], faltasN: 0, treinou: 0, dias: [] };
    for (let i = 0; i < 7; i++) {
      const dia = C.somarDias(seg, i), wd = painel().deYmd(dia).getDay();
      let plan = sem ? (sem[wd] || []).filter((t) => T[t]) : [];
      let fez = meus.filter((c) => C.diaDeCheckin(c) === dia).map((c) => c.tipo);
      if (tipo) { plan = plan.filter((t) => t === tipo); fez = fez.filter((t) => t === tipo); }
      const sobra = fez.slice(), falta = [];
      plan.forEach((t) => {
        let k = sobra.indexOf(t);
        if (k < 0) k = sobra.findIndex((f) => T[f] && T[f].grupo === T[t].grupo);
        if (k >= 0) sobra.splice(k, 1); else falta.push(t);
      });
      const passado = dia < hoje;
      if (dia <= hoje) { r.plan += plan.length; r.feitos += plan.length - falta.length; r.extras.push(...sobra); }
      if (passado && falta.length) { r.faltas.push(CURTO[wd].toLowerCase()); r.faltasN += falta.length; }
      if (fez.length) r.treinou += 1;
      r.dias.push({ dia, wd, plan, fez, falta, passado, ehHoje: dia === hoje });
    }
    r.pct = r.plan ? r.feitos / r.plan : null;
    return r;
  }
  const nomeTipo = (t) => { const T = painel().tipos(); return T[t] ? T[t].nome : t; };
  function marcasDoDia(c, temSemana) {
    const T = painel().tipos();
    const itens = [...c.fez.map((t) => `<span class="pf-marca-dia feito" style="background:var(--${T[t] ? T[t].grupo : 'musc'})" title="${esc(nomeTipo(t))}: feito">${CHECK}</span>`),
      ...c.falta.map((t) => `<span class="pf-marca-dia ${c.passado ? 'faltou' : 'planejado'}" title="${esc(nomeTipo(t))}: ${c.passado ? 'faltou' : 'a fazer'}">${c.passado ? XIS : esc(T[t].selo)}</span>`)];
    return itens.join('') || (temSemana ? DESCANSO : '');
  }
  const descDoDia = (c) => [c.fez.length ? `feito: ${c.fez.map(nomeTipo).join(', ')}` : '', c.falta.length ? `${c.passado ? 'faltou' : 'a fazer'}: ${c.falta.map(nomeTipo).join(', ')}` : ''].filter(Boolean).join('; ') || 'descanso';
  function ultimoTreinoTxt(a) {
    if (!a.ultimoTreino) return 'ainda não fez check-in';
    const n = painel().calc.diasEntre(a.ultimoTreino, painel().hoje());
    return n === 0 ? 'treinou hoje' : n === 1 ? 'treinou ontem' : `último treino há ${n} dias`;
  }
  const cabecalhoDias = (dias) => dias.map((c) => { const x = painel().deYmd(c.dia); return `<th scope="col" class="${c.ehHoje ? 'hoje' : ''}">${CURTO[x.getDay()]}<small>${x.getDate()}</small></th>`; }).join('');
  function celulaAluno(r, sub) {
    return `<div class="pf-aluno-cel">${av(r.a.u, 'av-p')}<div><button class="link-btn pf-sem-grade-nome" type="button" data-abrir-usuario="${r.a.u.id}">${esc(r.a.u.nome)}</button>${sub}</div></div>`;
  }
  function renderSemana(lista) {
    if (lista) SEM.lista = lista;
    lista = SEM.lista;
    const seg = segundaDaSemana(SEM.desloc), atual = SEM.desloc === 0;
    const resumo = lista.slice().sort((a, b) => a.u.nome.localeCompare(b.u.nome, 'pt-BR')).map((a) => semanaDoAluno(a, seg));
    const feitos = resumo.reduce((x, r) => x + r.feitos, 0), plan = resumo.reduce((x, r) => x + r.plan, 0);
    const linhas = resumo.map((r) => {
      const sub = !r.sem ? 'sem semana montada' : r.plan ? `${r.feitos} de ${r.plan} feitos` : 'nada planejado até hoje';
      return `<tr><th scope="row">${celulaAluno(r, `<small class="pf-sub${r.sem && r.plan && r.feitos >= r.plan ? ' ok' : ''}">${sub}</small>`)}</th>${r.dias.map((c) => `<td class="${c.ehHoje ? 'hoje' : ''}"><span class="sr">${esc(descDoDia(c))}</span><span class="pf-dias" aria-hidden="true">${marcasDoDia(c, r.sem)}</span></td>`).join('')}</tr>`;
    });
    const dias = resumo.length ? resumo[0].dias : [];
    $('semana-intervalo').textContent = rotuloDaSemana(SEM.desloc);
    $('sem-prox').disabled = atual;
    $('semana-resumo').textContent = plan ? `${feitos} de ${qtd(plan, 'treino planejado feito', 'treinos planejados feitos')}${atual ? ' até hoje' : ''} (${Math.round(feitos / plan * 100)}%)` : '';
    $('semana-tabela').innerHTML = lista.length ? `<table class="pf-sem-grade">
      <thead><tr><th scope="col">Aluno</th>${cabecalhoDias(dias)}</tr></thead>
      <tbody>${linhas.join('')}</tbody>
      <tfoot><tr><th scope="row">Treinaram</th>${dias.map((c, i) => `<td class="${c.ehHoje ? 'hoje' : ''}">${c.dia > painel().hoje() ? '' : resumo.filter((r) => r.dias[i].fez.length).length}</td>`).join('')}</tr></tfoot></table>` : '<p class="vazio">Sem alunos ainda.</p>';
    $('sem-detalhes').hidden = !lista.length;
    $('sem-gerenciar').hidden = !lista.length;
    $('sem-detalhes').setAttribute('aria-expanded', String(SEM.detalhes));
    $('sem-detalhes').firstChild.textContent = SEM.detalhes ? 'Esconder detalhes ' : 'Ver detalhes ';
    $('semana-detalhes').hidden = !SEM.detalhes || !lista.length;
    if (SEM.detalhes && lista.length) renderDetalhesSemana(resumo, atual);
    if ($('gs-dialog').open) renderGerenciar();
  }
  function renderDetalhesSemana(resumo, atual) {
    const comPlano = resumo.filter((r) => r.plan);
    const tudo = comPlano.filter((r) => r.feitos >= r.plan).length;
    const nada = comPlano.filter((r) => !r.feitos).length;
    const extras = resumo.reduce((x, r) => x + r.extras.length, 0);
    const chip = (n, rot, cls) => `<li class="pf-sem-chip ${cls}"><strong>${n}</strong>${rot}</li>`;
    const ordem = resumo.slice().sort((x, y) => (x.pct ?? 2) - (y.pct ?? 2) || x.a.u.nome.localeCompare(y.a.u.nome, 'pt-BR'));
    $('semana-detalhes').innerHTML = `<ul class="pf-sem-chips">
        ${chip(tudo, comPlano.length === 1 ? ' cumpriu tudo' : ' cumpriram tudo', 'ok')}
        ${chip(comPlano.length - tudo - nada, ' em parte', '')}
        ${chip(nada, ' sem treinar o planejado', nada ? 'alerta' : '')}
        ${chip(extras, extras === 1 ? ' treino extra' : ' treinos extras', '')}
      </ul>
      <p class="nota">Do menor para o maior cumprimento do planejado${atual ? ' até hoje' : ''}.</p>
      <ol class="pf-sem-det">${ordem.map((r) => itemDetalhe(r, atual)).join('')}</ol>`;
  }
  function situacaoTxt(r, atual) {
    const l = [];
    if (!r.sem) l.push('Sem semana montada no app');
    else if (!r.plan) l.push(atual ? 'Nada planejado até hoje' : 'Nada planejado na semana');
    else if (r.faltas.length) l.push(`Faltou ${r.faltas.join(', ')}`);
    else if (r.feitos >= r.plan) l.push(atual ? 'Em dia com o planejado' : 'Fez tudo o que estava planejado');
    if (r.extras.length) l.push(`+${qtd(r.extras.length, 'treino extra', 'treinos extras')} (${[...new Set(r.extras.map(nomeTipo))].join(', ')})`);
    return l;
  }
  const corPct = (p) => (p === null ? 'var(--fio)' : p >= 1 ? 'var(--feito-tinta)' : p >= 0.5 ? 'var(--marca)' : 'var(--erro)');
  function itemDetalhe(r, atual) {
    const p = r.pct, l = situacaoTxt(r, atual);
    return `<li class="pf-sem-det-item">
        ${celulaAluno(r, '')}
        <span class="pf-sem-det-num">${p === null ? '—' : `${r.feitos}/${r.plan}<small>${Math.round(p * 100)}%</small>`}</span>
        <span class="rt-trilho" aria-hidden="true"><span class="rt-barra" style="width:${p === null ? 0 : Math.min(1, p) * 100}%;background:${corPct(p)}"></span></span>
        <span class="pf-sem-det-txt">${l.map(esc).join(' · ')}${l.length ? ' · ' : ''}${esc(ultimoTreinoTxt(r.a))}</span>
      </li>`;
  }

  // Gerenciar semana (tela cheia).
  const SITUACOES = [['todos', 'Todos os alunos'], ['faltou', 'Faltaram algum treino'], ['nada', 'Não treinaram o planejado'], ['parte', 'Cumpriram em parte'],
    ['emdia', 'Cumpriram tudo'], ['extra', 'Fizeram treino extra'], ['semplano', 'Nada planejado'], ['semsemana', 'Sem semana montada']];
  const ORDENS = [['nome', 'Nome (A a Z)'], ['menor', 'Menor cumprimento'], ['maior', 'Maior cumprimento'], ['faltas', 'Mais faltas'], ['parado', 'Mais tempo sem treinar']];
  function passaSituacao(r, sit) {
    return sit === 'todos' || (sit === 'faltou' && r.faltasN > 0) || (sit === 'nada' && r.plan > 0 && !r.feitos)
      || (sit === 'parte' && r.feitos > 0 && r.feitos < r.plan) || (sit === 'emdia' && r.plan > 0 && r.feitos >= r.plan)
      || (sit === 'extra' && r.extras.length > 0) || (sit === 'semplano' && r.sem && !r.plan) || (sit === 'semsemana' && !r.sem);
  }
  // Soma as semanas (visão de 4 semanas) num resumo só, no mesmo formato de semanaDoAluno.
  function somarSemanas(a, semanas) {
    const r = { a, sem: semanas[0].sem, feitos: 0, plan: 0, extras: [], faltas: [], faltasN: 0, treinou: 0, semanas };
    semanas.forEach((s) => { r.feitos += s.feitos; r.plan += s.plan; r.extras.push(...s.extras); r.faltasN += s.faltasN; r.treinou += s.treinou; });
    r.pct = r.plan ? r.feitos / r.plan : null;
    return r;
  }
  function linhasGerenciar() {
    const g = SEM.gs, seg = segundaDaSemana(SEM.desloc), C = painel().calc;
    const segs = g.vista === 'mes' ? [3, 2, 1, 0].map((k) => C.somarDias(seg, -7 * k)) : [seg];
    const busca = chave(g.busca);
    const todos = SEM.lista.map((a) => (g.vista === 'mes' ? somarSemanas(a, segs.map((s) => semanaDoAluno(a, s, g.tipo))) : semanaDoAluno(a, seg, g.tipo)));
    const vis = todos.filter((r) => passaSituacao(r, g.sit) && (!busca || chave(r.a.u.nome).includes(busca)));
    const nome = (x, y) => x.a.u.nome.localeCompare(y.a.u.nome, 'pt-BR');
    const parado = (r) => (r.a.ultimoTreino ? C.diasEntre(r.a.ultimoTreino, painel().hoje()) : 99999);
    const cmp = { nome, menor: (x, y) => (x.pct ?? 2) - (y.pct ?? 2) || nome(x, y), maior: (x, y) => (y.pct ?? -1) - (x.pct ?? -1) || nome(x, y),
      faltas: (x, y) => y.faltasN - x.faltasN || nome(x, y), parado: (x, y) => parado(y) - parado(x) || nome(x, y) }[g.ordem] || nome;
    return { todos, vis: vis.sort(cmp), segs };
  }
  function renderGerenciar() {
    const g = SEM.gs, fmt = painel().fmtNum, atual = SEM.desloc === 0, T = painel().tipos();
    const { todos, vis, segs } = linhasGerenciar();
    SEM.linhas = vis;
    $('gs-intervalo').textContent = g.vista === 'mes' ? `4 semanas · ${intervaloDaSemana(segs[0], painel().calc.somarDias(segs[3], 6))}` : rotuloDaSemana(SEM.desloc);
    $('gs-prox').disabled = atual;
    $('gs-hoje').hidden = atual;
    document.querySelectorAll('[data-gs-vista]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gsVista === g.vista)));
    // Atividades: as que aparecem no planejado ou nos check-ins dos alunos.
    const usados = new Set();
    SEM.lista.forEach((a) => { (Array.isArray(a.u.semana) ? a.u.semana : []).forEach((dia) => (dia || []).forEach((t) => usados.add(t))); });
    painel().dados().checkins.forEach((c) => { if (SEM.lista.some((a) => a.u.id === c.usuario_id)) usados.add(c.tipo); });
    const tipos = [...usados].filter((t) => T[t]).sort((x, y) => nomeTipo(x).localeCompare(nomeTipo(y), 'pt-BR'));
    if (g.tipo && !tipos.includes(g.tipo)) g.tipo = '';
    $('gs-tipo').innerHTML = `<option value="">Todas</option>${tipos.map((t) => `<option value="${esc(t)}"${t === g.tipo ? ' selected' : ''}>${esc(nomeTipo(t))}</option>`).join('')}`;
    $('gs-sit').value = g.sit; $('gs-ordem').value = g.ordem;
    if ($('gs-busca').value !== g.busca) $('gs-busca').value = g.busca;
    // Números dos alunos mostrados (seguem a busca e os filtros).
    const comPlano = vis.filter((r) => r.plan);
    const sf = vis.reduce((x, r) => x + r.feitos, 0), sp = vis.reduce((x, r) => x + r.plan, 0);
    const kpi = (rot, val, sub, cls = '') => `<div class="pf-gs-kpi ${cls}"><dt>${rot}</dt><dd>${val}</dd><small>${sub}</small></div>`;
    $('gs-kpis').innerHTML = [
      kpi(vis.length === todos.length ? 'Cumprimento da turma' : 'Cumprimento (filtrado)', sp ? `${Math.round(sf / sp * 100)}<small>%</small>` : '—', sp ? `${sf} de ${qtd(sp, 'treino planejado', 'treinos planejados')}${atual ? ' até hoje' : ''}` : 'nada planejado', 'destaque'),
      kpi('Cumpriram tudo', `${comPlano.filter((r) => r.feitos >= r.plan).length}<small> de ${comPlano.length}</small>`, 'alunos com treino planejado'),
      kpi('Faltas', fmt(vis.reduce((x, r) => x + r.faltasN, 0)), 'treinos planejados que passaram sem check-in', vis.some((r) => r.faltasN) ? 'alerta' : ''),
      kpi('Treinos extras', fmt(vis.reduce((x, r) => x + r.extras.length, 0)), 'feitos fora do planejado'),
      kpi('Treinaram', `${vis.filter((r) => r.treinou).length}<small> de ${vis.length}</small>`, g.vista === 'mes' ? 'alunos com check-in nas 4 semanas' : 'alunos com check-in na semana'),
    ].join('');
    const filtrando = g.busca || g.sit !== 'todos' || g.tipo;
    $('gs-conta').textContent = `${vis.length === todos.length ? qtd(todos.length, 'aluno', 'alunos') : `${vis.length} de ${qtd(todos.length, 'aluno', 'alunos')}`}${g.tipo ? ` · só ${nomeTipo(g.tipo)}` : ''}`;
    $('gs-limpar').hidden = !filtrando;
    $('gs-csv').disabled = !vis.length;
    $('gs-legenda').hidden = g.vista === 'mes';
    $('gs-info').hidden = true;
    if (!vis.length) { $('gs-tabela').innerHTML = `<p class="vazio">${todos.length ? 'Nenhum aluno com esses filtros.' : 'Sem alunos ainda.'}</p>`; return; }
    const pctCel = (r) => (r.pct === null ? '<span class="pf-gs-pct">—</span>' : `<span class="pf-gs-pct" style="--cor:${corPct(r.pct)}"><b>${r.feitos}/${r.plan}</b><small>${Math.round(r.pct * 100)}%</small></span>`);
    const sub = (r) => `<small class="pf-sub">${esc(!r.sem ? 'sem semana montada' : ultimoTreinoTxt(r.a))}</small>`;
    const resto = (r) => `<td>${pctCel(r)}</td><td class="num${r.faltasN ? ' ruim' : ''}">${r.faltasN || '—'}</td><td class="num">${r.extras.length || '—'}</td>`;
    if (g.vista === 'mes') {
      $('gs-tabela').innerHTML = `<table class="pf-sem-grade pf-gs-grade mes">
        <thead><tr><th scope="col">Aluno</th>${segs.map((s, i) => `<th scope="col" class="${i === 3 && atual ? 'hoje' : ''}">${painel().deYmd(s).getDate()} ${MESES[painel().deYmd(s).getMonth()]}<small>${i === 3 && atual ? 'esta semana' : 'semana'}</small></th>`).join('')}<th scope="col">Total</th><th scope="col">Faltas</th><th scope="col">Extras</th></tr></thead>
        <tbody>${vis.map((r) => `<tr><th scope="row">${celulaAluno(r, sub(r))}</th>${r.semanas.map((s, i) => `<td class="${i === 3 && atual ? 'hoje' : ''}">${s.plan ? `<span class="pf-gs-sem${s.feitos >= s.plan ? ' cheia' : ''}" style="--p:${Math.min(1, s.feitos / s.plan)}" title="${s.feitos} de ${s.plan} feitos">${s.feitos >= s.plan ? CHECK : ''}${s.feitos}/${s.plan}</span>` : `<span class="pf-gs-sem vazia" title="nada planejado">${s.extras.length ? `+${s.extras.length}` : '—'}</span>`}</td>`).join('')}${resto(r)}</tr>`).join('')}</tbody></table>`;
      return;
    }
    const dias = vis[0].dias;
    $('gs-tabela').innerHTML = `<table class="pf-sem-grade pf-gs-grade">
      <thead><tr><th scope="col">Aluno</th>${cabecalhoDias(dias)}<th scope="col">Feito</th><th scope="col">Faltas</th><th scope="col">Extras</th></tr></thead>
      <tbody>${vis.map((r, k) => `<tr><th scope="row">${celulaAluno(r, sub(r))}</th>${r.dias.map((c, i) => `<td class="${c.ehHoje ? 'hoje' : ''}"><button class="pf-gs-cel" type="button" data-gs-cel="${k}-${i}" aria-label="${esc(`${r.a.u.nome}, ${CURTO[c.wd]} ${painel().deYmd(c.dia).getDate()}: ${descDoDia(c)}`)}"><span class="pf-dias" aria-hidden="true">${marcasDoDia(c, r.sem)}</span></button></td>`).join('')}${resto(r)}</tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row">Treinaram</th>${dias.map((c, i) => `<td class="${c.ehHoje ? 'hoje' : ''}">${c.dia > painel().hoje() ? '' : vis.filter((r) => r.dias[i].fez.length).length}</td>`).join('')}<td></td><td></td><td></td></tr></tfoot></table>`;
  }
  function abrirGerenciar() {
    renderGerenciar();
    const dlg = $('gs-dialog');
    if (!dlg.open) dlg.showModal();
  }
  function baixarCsvSemana() {
    const g = SEM.gs, campo = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`, C = painel().calc;
    const { vis, segs } = linhasGerenciar();
    const cab = ['aluno', ...(g.vista === 'mes' ? segs.map((s) => `semana_${s}`) : segs.length ? [0, 1, 2, 3, 4, 5, 6].map((i) => C.somarDias(segs[0], i)) : []), 'feitos', 'planejados', 'cumprimento_pct', 'faltas', 'extras', 'ultimo_treino'];
    const linhas = vis.map((r) => [r.a.u.nome, ...(g.vista === 'mes' ? r.semanas.map((s) => `${s.feitos}/${s.plan}`) : r.dias.map(descDoDia)),
      r.feitos, r.plan, r.pct === null ? '' : Math.round(r.pct * 100), r.faltasN, r.extras.length, r.a.ultimoTreino || ''].map(campo).join(';'));
    const blob = new Blob([`﻿${cab.join(';')}\n${linhas.join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `semana-dos-alunos-${segs[0]}${g.vista === 'mes' ? '-4-semanas' : ''}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('#sem-ant, #sem-prox, #sem-detalhes, #sem-gerenciar, #gs-ant, #gs-prox, #gs-hoje, [data-gs-vista], #gs-limpar, #gs-csv, [data-gs-fechar], [data-gs-cel], #gs-info-fechar');
    if (!b || !window.Painel || !painel().dados()) return;
    if (b.id === 'sem-ant' || b.id === 'gs-ant') SEM.desloc += 1;
    else if (b.id === 'sem-prox' || b.id === 'gs-prox') SEM.desloc = Math.max(0, SEM.desloc - 1);
    else if (b.id === 'gs-hoje') SEM.desloc = 0;
    else if (b.id === 'sem-detalhes') SEM.detalhes = !SEM.detalhes;
    else if (b.id === 'sem-gerenciar') return abrirGerenciar();
    else if (b.dataset.gsVista) SEM.gs.vista = b.dataset.gsVista;
    else if (b.id === 'gs-limpar') Object.assign(SEM.gs, { busca: '', sit: 'todos', tipo: '' });
    else if (b.id === 'gs-csv') return baixarCsvSemana();
    else if (b.hasAttribute('data-gs-fechar')) return $('gs-dialog').close();
    else if (b.id === 'gs-info-fechar') { $('gs-info').hidden = true; return; }
    else if (b.dataset.gsCel) {
      const [k, i] = b.dataset.gsCel.split('-').map(Number), r = SEM.linhas[k], c = r && r.dias[i];
      if (!c) return;
      const x = painel().deYmd(c.dia);
      $('gs-info-txt').innerHTML = `<b>${esc(r.a.u.nome)}</b> · ${CURTO[c.wd]}, ${x.getDate()} de ${MESES[x.getMonth()]}: ${esc(descDoDia(c))}`;
      $('gs-info').hidden = false;
      return;
    }
    renderSemana();
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'gs-busca') { SEM.gs.busca = e.target.value; renderGerenciar(); }
  });
  document.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'gs-sit') SEM.gs.sit = e.target.value;
    else if (id === 'gs-tipo') SEM.gs.tipo = e.target.value;
    else if (id === 'gs-ordem') SEM.gs.ordem = e.target.value;
    else return;
    renderGerenciar();
  });
  if ($('gs-sit')) {
    $('gs-sit').innerHTML = SITUACOES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    $('gs-ordem').innerHTML = ORDENS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  }

  // ---------- Fichas ----------
  function renderFichas() {
    const el = $('fichas-lista');
    if (!P.fichas) {
      el.innerHTML = `<p class="vazio">Não foi possível carregar as fichas. ${esc(P.erroFichas)}</p>`;
      return;
    }
    if (!P.fichas.length) {
      el.innerHTML = '<p class="vazio">Você ainda não tem fichas. Toque em <b>Nova ficha</b> para montar a primeira; dá para começar de um treino pronto do app.</p>';
      return;
    }
    el.innerHTML = P.fichas.map((f) => {
      const nT = Object.keys(f.treinos || {}).length;
      return `<div class="conv-item ficha-item">
        <b>${esc(f.nome)}</b>
        <small>${qtd(nT, 'treino', 'treinos')} · ${qtd(contarExercicios(f.treinos), 'exercício', 'exercícios')} · ${qtd(f.alunos || 0, 'aluno', 'alunos')} com esta ficha · atualizada em ${esc(dataCurta(f.atualizado_em))}${f.descricao ? `<br>${esc(f.descricao)}` : ''}</small>
        <div class="conv-botoes varios">
          <button class="btn-peq prim" type="button" data-ficha-aplicar="${f.id}">Aplicar a alunos</button>
          <button class="btn-peq sec" type="button" data-ficha-editar="${f.id}">Editar</button>
          <button class="btn-peq sec" type="button" data-ficha-duplicar="${f.id}">Duplicar</button>
          <button class="btn-peq sec" type="button" data-ficha-excluir="${f.id}">Excluir</button>
        </div>
      </div>`;
    }).join('');
  }

  // Editor: o mesmo para uma ficha (modo 'ficha') e para os treinos de um aluno (modo 'aluno').
  // ed = { modo, id, alunoId, nome, descricao, treinos: [{ nome, subtitulo, recado, exercicios: [{nome,dose,pse}] }], semana: [[...]x7], trocarSemana, erro }
  let ed = null;
  const paraLista = (treinos) => Object.keys(treinos || {}).sort((a, b) => a - b).map((k) => {
    const t = treinos[k] || {};
    return { nome: t.nome || `Treino ${k}`, subtitulo: t.subtitulo || '', recado: t.recado || '', exercicios: (t.exercicios || []).map((x) => ({ nome: x.nome, dose: x.dose || '', pse: Number(x.pse) || 8, ...(x.extra ? { extra: x.extra } : {}) })) };
  });
  const semanaVazia = () => [[], [], [], [], [], [], []];
  const semanaDeJornada = (s) => { const v = semanaVazia(); Object.entries(s || {}).forEach(([d, l]) => { v[Number(d)] = [...l]; }); return v; };
  const MODELOS = () => [['', 'Em branco'], ['plano', 'Plano pronto do app (Treinos 1, 2 e 3)'], ...JORNADAS_APP.map((j) => [`j:${j.id}`, `Objetivo pronto: ${j.nome}`])];
  function abrirEditor(cfg) {
    const f = cfg.fichaId ? fichaPorId(cfg.fichaId) : null;
    const u = cfg.alunoId ? alunos().find((x) => x.id === cfg.alunoId) : null;
    ed = {
      modo: cfg.alunoId ? 'aluno' : 'ficha', id: f && !cfg.duplicar ? f.id : null, alunoId: cfg.alunoId || null,
      nome: f ? (cfg.duplicar ? `${f.nome} (cópia)` : f.nome).slice(0, 60) : '', descricao: f ? f.descricao || '' : '',
      treinos: u ? paraLista(u.treinos || (u.treinos === null ? PLANO_PADRAO : {})) : f ? paraLista(f.treinos) : [{ nome: 'Treino 1', subtitulo: '', recado: '', exercicios: [] }],
      semana: u ? (Array.isArray(u.semana) && u.semana.length === 7 ? u.semana.map((d) => [...d]) : semanaVazia()) : f && Array.isArray(f.semana) ? f.semana.map((d) => [...d]) : semanaVazia(),
      trocarSemana: false, novo: !f && !u, erro: '', alunoNome: u ? u.nome : '', passo: 0, modelo: '',
    };
    renderEditor();
    if (!$('ficha-dialog').open) $('ficha-dialog').showModal();
  }
  function opcoesAtividades(valor, idx) {
    const tipos = painel().tipos();
    const treinos = ed.treinos.map((t, i) => [`t${i + 1}`, `${t.nome || `Treino ${i + 1}`}`]);
    const outros = Object.entries(tipos).filter(([k]) => !/^t\d$/.test(k)).map(([k, t]) => [k, t.nome]);
    return `<option value="">${idx === 0 ? 'Descanso' : '—'}</option>${[...treinos, ...outros].map(([k, n]) => `<option value="${esc(k)}"${k === valor ? ' selected' : ''}>${esc(n)}</option>`).join('')}`;
  }
  // Ficha nova ou editada: passo a passo (Início → Treinos → Semana → Revisão). Os treinos de um aluno: página única.
  const PASSOS = ['Início', 'Treinos', 'Semana', 'Revisão'];
  function renderEditor() {
    const titulo = ed.modo === 'aluno' ? `Treinos de ${ed.alunoNome || 'aluno'}` : ed.id ? 'Editar ficha' : 'Nova ficha';
    const passo = ed.modo === 'ficha' ? ed.passo : null;
    const mostra = (n) => (passo === null || passo === n ? '' : ' hidden');
    const pses = Array.from({ length: 10 }, (_, i) => i + 1);
    const treinoHTML = (t, i) => `<fieldset class="ex-bloco pf-treino" data-t="${i}">
      <legend>Treino ${i + 1}</legend>
      <div class="ex-grade2">
        <label class="ex-campo">Nome<input data-campo="nome" maxlength="40" value="${esc(t.nome)}" placeholder="Treino ${i + 1}"></label>
        <label class="ex-campo">Foco<input data-campo="subtitulo" maxlength="60" value="${esc(t.subtitulo)}" placeholder="Ex.: Peito + tríceps"></label>
      </div>
      <label class="ex-campo">Recado para o aluno (opcional)<input data-campo="recado" maxlength="200" value="${esc(t.recado)}" placeholder="Ex.: Suba a carga do supino quando fizer as 10 repetições"></label>
      <ol class="pf-exs">${t.exercicios.map((x, j) => `<li data-x="${j}">
        <label class="ex-campo pf-ex-nome"><span>Exercício${exDoCatalogo(x.nome) && exDoCatalogo(x.nome).meu ? ' <span class="pf-meu">seu</span>' : ''}</span><input data-campo="ex-nome" list="pf-biblioteca" maxlength="80" autocomplete="off" value="${esc(x.nome)}" placeholder="Busque na biblioteca"></label>
        <label class="ex-campo pf-ex-dose">Séries<input data-campo="ex-dose" maxlength="30" autocomplete="off" value="${esc(x.dose)}" placeholder="3×10"></label>
        <label class="ex-campo pf-ex-pse">PSE<select data-campo="ex-pse">${pses.map((n) => `<option${n === x.pse ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <span class="pf-ex-botoes">
          <button class="pf-icone" type="button" data-pf-mover="-1" aria-label="Subir ${esc(x.nome || 'exercício')}"${j === 0 ? ' disabled' : ''}>${SOBE}</button>
          <button class="pf-icone" type="button" data-pf-mover="1" aria-label="Descer ${esc(x.nome || 'exercício')}"${j === t.exercicios.length - 1 ? ' disabled' : ''}>${DESCE}</button>
          <button class="pf-icone" type="button" data-pf-tirar aria-label="Tirar ${esc(x.nome || 'exercício')}">${XIS}</button>
        </span>
      </li>`).join('')}</ol>
      ${t.exercicios.length ? '' : '<p class="ex-dica">Nenhum exercício ainda.</p>'}
      <div class="pf-acoes">
        <button class="btn-sec" type="button" data-pf-ex-mais${t.exercicios.length >= MAX_EXERCICIOS ? ' disabled' : ''}>+ Exercício</button>
        <button class="btn-sec" type="button" data-pf-ex-criar${t.exercicios.length >= MAX_EXERCICIOS ? ' disabled' : ''}>Criar exercício</button>
        ${ed.treinos.length > 1 ? `<button class="btn-sec pf-perigo" type="button" data-pf-treino-tirar>Tirar este treino</button>` : ''}
      </div>
    </fieldset>`;
    const semanaHTML = DIAS.map(([d, nome]) => `<div class="pf-dia"><b>${nome}</b>
      <select data-dia="${d}" data-pos="0" aria-label="${nome}: 1ª atividade">${opcoesAtividades((ed.semana[d] || [])[0] || '', 0)}</select>
      <select data-dia="${d}" data-pos="1" aria-label="${nome}: 2ª atividade">${opcoesAtividades((ed.semana[d] || [])[1] || '', 1)}</select></div>`).join('');
    const passosHTML = passo === null ? '' : `<ol class="pf-passos" aria-label="Passos da ficha">${PASSOS.map((nome, n) => `<li>
        <button type="button" data-pf-passo="${n}" class="${n === passo ? 'atual' : n < passo ? 'feito' : ''}"${n === passo ? ' aria-current="step"' : ''}>
          <span class="pf-passo-num" aria-hidden="true">${n < passo ? CHECK : n + 1}</span><span class="pf-passo-nome">${nome}</span></button></li>`).join('')}</ol>`;
    const rodape = passo === null
      ? `<button class="btn-sec" type="button" data-ficha-fechar>Cancelar</button>
        <button class="btn" type="submit" id="ficha-salvar">Salvar e enviar ao aluno</button>`
      : `${passo === 0 ? '<button class="btn-sec" type="button" data-ficha-fechar>Cancelar</button>' : '<button class="btn-sec" type="button" data-pf-voltar>Voltar</button>'}
        ${passo < PASSOS.length - 1 ? `<button class="btn" type="button" id="ficha-proximo" data-pf-proximo>Próximo: ${PASSOS[passo + 1]}</button>` : '<button class="btn" type="submit" id="ficha-salvar">Salvar ficha</button>'}`;
    $('ficha-body').innerHTML = `<form class="ex-form" id="ficha-form" novalidate>
      <div class="ex-topo"><h2 id="ficha-title">${esc(titulo)}</h2>
        <button class="excluir-fechar" type="button" data-ficha-fechar aria-label="Fechar">${XIS}</button></div>
      <div class="ex-meio">
        ${passosHTML}
        ${ed.modo === 'ficha' ? `<div class="pf-passo" data-passo="0"${mostra(0)}>
          <p class="ex-dica">Comece de um modelo ou em branco, e dê um nome que ajude a achar a ficha depois.</p>
          ${ed.novo ? `<label class="ex-campo">Começar de<select id="pf-modelo">${MODELOS().map(([v, n]) => `<option value="${v}"${v === (ed.modelo || '') ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''}
          <label class="ex-campo">Nome da ficha<input id="pf-ficha-nome" maxlength="60" value="${esc(ed.nome)}" placeholder="Ex.: Hipertrofia iniciante" required></label>
          <label class="ex-campo">Descrição (opcional)<input id="pf-ficha-desc" maxlength="300" value="${esc(ed.descricao)}" placeholder="Para quem é e por quanto tempo"></label>
        </div>`
    : '<p class="ex-dica">O que você salvar aqui chega na hora ao app do aluno. A versão de antes fica guardada.</p>'}
        <div class="pf-passo" data-passo="1"${mostra(1)}>
          ${passo === 1 ? `<p class="ex-dica">Até ${MAX_TREINOS} treinos de até ${MAX_EXERCICIOS} exercícios. Não achou um exercício na lista? Toque em <b>Criar exercício</b>: ele fica só para você.</p>` : ''}
          ${ed.treinos.map(treinoHTML).join('')}
          <button class="btn-sec" type="button" data-pf-treino-mais${ed.treinos.length >= MAX_TREINOS ? ' disabled' : ''}>+ Treino (${ed.treinos.length} de ${MAX_TREINOS})</button>
        </div>
        <fieldset class="ex-bloco pf-passo" data-passo="2"${mostra(2)}><legend>${ed.modo === 'aluno' ? 'Semana do aluno' : 'Semana sugerida'}</legend>
          ${ed.modo === 'aluno'
    ? `<label class="excluir-entendi"><input type="checkbox" id="pf-trocar-semana"${ed.trocarSemana ? ' checked' : ''}><span>Trocar também a semana do aluno por esta</span></label>`
    : '<p class="ex-dica">Opcional. Até 2 atividades por dia. Ao aplicar a ficha, você escolhe se troca também a semana do aluno.</p>'}
          <div class="pf-semana"${ed.modo === 'aluno' && !ed.trocarSemana ? ' hidden' : ''}>${semanaHTML}</div>
        </fieldset>
        ${passo === 3 ? `<div class="pf-passo" data-passo="3">${revisaoHTML()}</div>` : ''}
        <p class="excluir-erro" id="ficha-erro" role="alert"${ed.erro ? '' : ' hidden'}>${esc(ed.erro)}</p>
      </div>
      <div class="ex-rodape">${rodape}</div>
      <datalist id="pf-biblioteca">${(P.catalogo || []).map((x) => `<option value="${esc(x.nome)}">${x.meu ? `Seu exercício${(x.variacoes || []).length ? ` · também: ${esc(x.variacoes.join(', '))}` : ''}` : ''}</option>`).join('')}</datalist>
    </form>`;
  }
  // Revisão (último passo): o que vai ser salvo, com atalho para voltar a cada parte.
  function revisaoHTML() {
    const tipos = painel().tipos();
    const nomeAtiv = (a) => { const m = /^t(\d)$/.exec(a); return m ? (ed.treinos[Number(m[1]) - 1] || {}).nome || `Treino ${m[1]}` : (tipos[a] || {}).nome || a; };
    const dias = DIAS.filter(([d]) => (ed.semana[d] || []).length);
    return `<div class="pf-revisao">
      <section><div class="pf-rev-topo"><h3>${esc(ed.nome.trim() || 'Sem nome')}</h3><button class="pf-link" type="button" data-pf-passo="0">Mudar</button></div>
        ${ed.descricao.trim() ? `<p>${esc(ed.descricao.trim())}</p>` : ''}</section>
      <section><div class="pf-rev-topo"><h3>${qtd(ed.treinos.length, 'treino', 'treinos')} · ${qtd(ed.treinos.reduce((n, t) => n + t.exercicios.filter((x) => x.nome).length, 0), 'exercício', 'exercícios')}</h3><button class="pf-link" type="button" data-pf-passo="1">Mudar</button></div>
        <ul>${ed.treinos.map((t, i) => `<li><b>${esc(t.nome.trim() || `Treino ${i + 1}`)}</b>${t.subtitulo.trim() ? ` · ${esc(t.subtitulo.trim())}` : ''}<small class="pf-sub">${t.exercicios.filter((x) => x.nome).map((x) => esc(x.nome)).join(', ')}</small></li>`).join('')}</ul></section>
      <section><div class="pf-rev-topo"><h3>Semana sugerida</h3><button class="pf-link" type="button" data-pf-passo="2">Mudar</button></div>
        ${dias.length ? `<ul>${dias.map(([d, nome]) => `<li><b>${nome}</b> · ${ed.semana[d].map((a) => esc(nomeAtiv(a))).join(' + ')}</li>`).join('')}</ul>` : '<p>Sem semana sugerida: ao aplicar, o aluno mantém a semana dele.</p>'}</section>
    </div>`;
  }
  // Lê os campos para o estado antes de redesenhar (os campos não guardam nada sozinhos).
  function lerEditor() {
    if (!ed || !$('ficha-form')) return;
    if ($('pf-ficha-nome')) ed.nome = $('pf-ficha-nome').value;
    if ($('pf-ficha-desc')) ed.descricao = $('pf-ficha-desc').value;
    document.querySelectorAll('.pf-treino').forEach((fs) => {
      const t = ed.treinos[Number(fs.dataset.t)];
      ['nome', 'subtitulo', 'recado'].forEach((c) => { t[c] = fs.querySelector(`[data-campo="${c}"]`).value; });
      fs.querySelectorAll('li[data-x]').forEach((li) => {
        const x = t.exercicios[Number(li.dataset.x)];
        const nomeNovo = li.querySelector('[data-campo="ex-nome"]').value.trim();
        if (nomeNovo !== x.nome) delete x.extra; // trocou o exercício: o cadastro do anterior não vale mais
        x.nome = nomeNovo;
        x.dose = li.querySelector('[data-campo="ex-dose"]').value.trim();
        x.pse = Number(li.querySelector('[data-campo="ex-pse"]').value) || 8;
      });
    });
    document.querySelectorAll('.pf-semana select').forEach((s) => {
      const d = Number(s.dataset.dia), pos = Number(s.dataset.pos);
      ed.semana[d] = ed.semana[d] || [];
      ed.semana[d][pos] = s.value;
    });
    ed.semana = ed.semana.map((d) => (d || []).filter(Boolean).slice(0, 2));
    if ($('pf-trocar-semana')) ed.trocarSemana = $('pf-trocar-semana').checked;
  }
  // Redesenha a partir do estado (quem chama já leu os campos com lerEditor antes de mudar o estado).
  const redesenhar = (foco, doTopo) => {
    const rolagem = document.querySelector('#ficha-form .ex-meio');
    const topo = rolagem && !doTopo ? rolagem.scrollTop : 0;
    renderEditor();
    const r = document.querySelector('#ficha-form .ex-meio');
    if (r) r.scrollTop = topo;
    if (foco) { const el = document.querySelector(foco); if (el) el.focus(); }
  };
  $('ficha-dialog').addEventListener('click', (e) => {
    if (e.target === $('ficha-dialog') || e.target.closest('[data-ficha-fechar]')) return $('ficha-dialog').close();
    const fs = e.target.closest('.pf-treino');
    const ti = fs ? Number(fs.dataset.t) : -1;
    const passoBtn = e.target.closest('[data-pf-passo]');
    if (passoBtn) return irPara(Number(passoBtn.dataset.pfPasso));
    if (e.target.closest('[data-pf-proximo]')) return irPara(ed.passo + 1);
    if (e.target.closest('[data-pf-voltar]')) return irPara(ed.passo - 1);
    if (e.target.closest('[data-pf-ex-criar]')) { lerEditor(); return abrirExercicio({ ti }); }
    if (e.target.closest('[data-pf-treino-mais]')) {
      lerEditor();
      ed.treinos.push({ nome: `Treino ${ed.treinos.length + 1}`, subtitulo: '', recado: '', exercicios: [] });
      return redesenhar(`.pf-treino[data-t="${ed.treinos.length - 1}"] [data-campo="nome"]`);
    }
    if (e.target.closest('[data-pf-treino-tirar]')) {
      lerEditor();
      ed.treinos.splice(ti, 1);
      // A semana aponta para os treinos pela posição (t1, t2...): o que vinha depois do tirado sobe uma posição.
      ed.semana = ed.semana.map((d) => d.flatMap((a) => {
        const m = /^t(\d)$/.exec(a); if (!m) return [a];
        const n = Number(m[1]) - 1;
        return n === ti ? [] : [n > ti ? `t${n}` : a];
      }));
      return redesenhar();
    }
    if (e.target.closest('[data-pf-ex-mais]')) {
      lerEditor();
      ed.treinos[ti].exercicios.push({ nome: '', dose: '', pse: 8 });
      return redesenhar(`.pf-treino[data-t="${ti}"] li[data-x="${ed.treinos[ti].exercicios.length - 1}"] [data-campo="ex-nome"]`);
    }
    const li = e.target.closest('li[data-x]');
    if (!li) return;
    const xi = Number(li.dataset.x);
    const mover = e.target.closest('[data-pf-mover]');
    if (mover) {
      lerEditor();
      const exs = ed.treinos[ti].exercicios, para = xi + Number(mover.dataset.pfMover);
      [exs[xi], exs[para]] = [exs[para], exs[xi]];
      return redesenhar(`.pf-treino[data-t="${ti}"] li[data-x="${para}"] [data-pf-mover="${mover.dataset.pfMover}"]`);
    }
    if (e.target.closest('[data-pf-tirar]')) {
      lerEditor();
      ed.treinos[ti].exercicios.splice(xi, 1);
      return redesenhar();
    }
  });
  $('ficha-dialog').addEventListener('change', (e) => {
    if (e.target.id === 'pf-trocar-semana') { lerEditor(); return redesenhar(); }
    if (e.target.id === 'pf-modelo') {
      const v = e.target.value;
      lerEditor();
      ed.modelo = v;
      if (!v) { ed.treinos = [{ nome: 'Treino 1', subtitulo: '', recado: '', exercicios: [] }]; ed.semana = semanaVazia(); }
      else if (v === 'plano') { ed.treinos = paraLista(PLANO_PADRAO); ed.semana = [[], ['t2'], [], ['t1'], [], ['t3'], ['bike']]; }
      else {
        const j = JORNADAS_APP.find((x) => `j:${x.id}` === v);
        if (j) { ed.treinos = paraLista(j.treinos); ed.semana = semanaDeJornada(j.semana); if (!ed.nome.trim()) ed.nome = j.nome; }
      }
      return redesenhar();
    }
    // Ao escolher um exercício da biblioteca, séries e PSE vêm da biblioteca (se ainda estiverem vazias).
    if (e.target.dataset.campo === 'ex-nome') {
      const ex = exDoCatalogo(e.target.value);
      const li = e.target.closest('li');
      if (ex && li) {
        e.target.value = ex.nome;
        const dose = li.querySelector('[data-campo="ex-dose"]');
        if (!dose.value.trim()) { dose.value = ex.dose || '3×10'; li.querySelector('[data-campo="ex-pse"]').value = String(ex.pse || 8); }
      }
    }
  });
  // Cada passo confere a sua parte: Início (nome) e Treinos (exercícios). A semana é opcional.
  const validarPasso = (n) => (n === 0 ? validarInicio() : n === 1 ? validarTreinos() : '');
  const validarInicio = () => (ed.modo === 'ficha' && !ed.nome.trim() ? 'Dê um nome à ficha.' : '');
  function validarEditor() { return validarInicio() || validarTreinos(); }
  // Vai para o passo n: para a frente, só passando pelos passos que estão completos (para no primeiro com problema).
  function irPara(n) {
    lerEditor();
    const alvo = Math.max(0, Math.min(PASSOS.length - 1, n));
    for (let k = ed.passo; k < alvo; k++) {
      const erro = validarPasso(k);
      if (erro) { ed.passo = k; ed.erro = erro; return redesenhar('#ficha-erro', true); }
    }
    ed.passo = alvo; ed.erro = '';
    redesenhar(alvo === 0 ? '#pf-ficha-nome' : '#ficha-title', true);
  }
  function validarTreinos() {
    for (const [i, t] of ed.treinos.entries()) {
      const nomeT = t.nome.trim() || `Treino ${i + 1}`;
      const exs = t.exercicios.filter((x) => x.nome);
      if (!exs.length) return `${nomeT}: coloque pelo menos um exercício.`;
      if (exs.length > MAX_EXERCICIOS) return `${nomeT}: no máximo ${MAX_EXERCICIOS} exercícios.`;
      const fora = exs.find((x) => !exDoCatalogo(x.nome) && !x.extra); // x.extra: exercício de personal que já estava no treino
      if (fora) return `${nomeT}: "${fora.nome}" não está na biblioteca. Escolha um exercício da lista ou toque em Criar exercício.`;
      const vistos = new Set();
      const repetido = exs.find((x) => { const k = chave(x.nome); if (vistos.has(k)) return true; vistos.add(k); return false; });
      if (repetido) return `${nomeT}: "${repetido.nome}" aparece duas vezes.`;
    }
    return '';
  }
  const paraBanco = () => Object.fromEntries(ed.treinos.map((t, i) => [String(i + 1), {
    nome: t.nome.trim() || `Treino ${i + 1}`, subtitulo: t.subtitulo.trim(), ...(t.recado.trim() ? { recado: t.recado.trim() } : {}),
    exercicios: t.exercicios.filter((x) => x.nome).map((x) => {
      const c = exDoCatalogo(x.nome) || { nome: x.nome, dose: x.dose };
      const extra = c.meu ? extraDoMeu(c) : x.extra;
      return { nome: c.nome, dose: x.dose || c.dose || '3×10', pse: x.pse, ...(extra ? { extra } : {}) };
    }),
  }]));
  $('ficha-dialog').addEventListener('submit', async (e) => {
    e.preventDefault();
    lerEditor();
    if (ed.modo === 'ficha' && ed.passo < PASSOS.length - 1) return irPara(ed.passo + 1); // Enter num campo: próximo passo
    ed.erro = validarEditor();
    if (ed.erro) {
      if (ed.modo === 'ficha') ed.passo = validarInicio() ? 0 : 1;
      return redesenhar('#ficha-erro', true);
    }
    $('ficha-salvar').disabled = true;
    const treinos = paraBanco();
    const semana = ed.semana.some((d) => d.length) ? ed.semana : null;
    const r = ed.modo === 'aluno'
      ? await sb().rpc('personal_salvar_treinos', { p_aluno: ed.alunoId, p_treinos: treinos, p_semana: ed.trocarSemana ? (semana || semanaVazia()) : null })
      : await sb().rpc('personal_salvar_ficha', { p: { id: ed.id || '', nome: ed.nome.trim(), descricao: ed.descricao.trim(), treinos, semana } });
    if (r.error) {
      ed.erro = `Não foi possível salvar. ${r.error.message}`;
      return redesenhar('#ficha-erro');
    }
    const aluno = ed.modo === 'aluno' ? ed.alunoId : null;
    $('ficha-dialog').close();
    painel().toast(aluno ? 'Treinos enviados: o aluno já vê a ficha nova no app.' : 'Ficha salva.');
    await recarregarMantendo(aluno);
  });
  // Recarrega o painel e, se a ficha de um aluno estava aberta, abre de novo.
  async function recarregarMantendo(alunoId) {
    const aberto = alunoId || painel().detalheAberto();
    await painel().recarregar();
    if (aberto && alunos().some((u) => u.id === aberto)) painel().abrirDetalhe(aberto);
  }

  // ---------- Meus exercícios ----------
  // Exercícios criados pelo personal (tabela exercicios_personal): só ele vê, e entram nas fichas como os da biblioteca.
  function renderMeus() {
    const el = $('meus-ex-lista');
    if (!el) return;
    if (!P.meus) { el.innerHTML = '<p class="vazio">Não foi possível carregar os seus exercícios.</p>'; return; }
    if (!P.meus.length) {
      el.innerHTML = '<p class="vazio">Nenhum exercício seu ainda. Crie aqui ou direto na ficha, em <b>Criar exercício</b>.</p>';
      return;
    }
    el.innerHTML = P.meus.map((x) => `<div class="conv-item ficha-item">
        <b>${esc(x.nome)}</b>
        <small>${x.grupo ? `${esc(x.grupo)} · ` : ''}${esc(x.dose)} · PSE ${esc(x.pse)}${x.video_id ? ' · com vídeo' : ''}${(x.variacoes || []).length ? ` · também: ${esc(x.variacoes.join(', '))}` : ''}</small>
        <div class="conv-botoes varios">
          <button class="btn-peq sec" type="button" data-meu-ex-editar="${esc(x.id)}">Editar</button>
          <button class="btn-peq sec" type="button" data-meu-ex-excluir="${esc(x.id)}">Excluir</button>
        </div>
      </div>`).join('');
  }
  // Criar ou editar um exercício: a mesma tela do catálogo do administrador (nome, grupo, PSE, séries sugeridas, níveis,
  // explicação, outros nomes e vídeo), sem objetivos nem "ativo", que só valem para a biblioteca do app.
  // Aberto da ficha (ti = índice do treino), o exercício criado já entra naquele treino.
  let mx = null;
  const EX = () => painel().exercicio;
  function abrirExercicio({ id = null, ti = -1, nome = '' } = {}) {
    const F = EX();
    const x = id ? (P.meus || []).find((e) => e.id === id) : null;
    mx = { id, ti, x };
    const v = x || { nome, grupo: '', dose: '3×10', pse: 8, hipertrofia: 'baixa', forca: 'baixa', explosao: 'baixa', mobilidade: 'baixa', explicacao: '', variacoes: [], video_id: '' };
    const opcoes = (lista, sel) => lista.map(([val, rot]) => `<option value="${esc(val)}"${val === sel ? ' selected' : ''}>${esc(rot)}</option>`).join('');
    const dose = F.lerDose(v.dose);
    const d = dose || { series: '3', valor: '10', unidade: 'rep', lado: false, conta: '' };
    const pses = [...new Set([4, 5, 6, 7, 8, 9, 10, Number(v.pse) || 8])].sort((a, b) => a - b);
    const nivel = ([k, rot]) => `
          <fieldset class="ex-nivel"><legend>${rot}</legend>
            <div class="ex-seg">${Object.entries(F.ROTULO_NIVEL).map(([val, r]) => `<label><input type="radio" name="mx-${k}" value="${val}"${(v[k] || 'baixa') === val ? ' checked' : ''}><span>${r}</span></label>`).join('')}</div>
          </fieldset>`;
    $('mx-body').innerHTML = `
      <form class="ex-form" id="mx-form" novalidate>
        <div class="ex-topo"><h2 id="mx-title">${x ? 'Editar exercício' : 'Novo exercício'}</h2>
          <button class="excluir-fechar" type="button" data-mx-fechar aria-label="Fechar">${XIS}</button></div>
        <div class="ex-meio">
          <p class="ex-dica pf-mx-aviso">Só você vê este exercício e pode usá-lo nas suas fichas. Outros personais não têm acesso.</p>
          <label class="ex-campo">Nome<input id="mx-nome" maxlength="80" autocomplete="off" value="${esc(v.nome)}" required></label>
          <div class="ex-grade2">
            <label class="ex-campo">Grupo<select id="mx-grupo">${v.grupo ? '' : '<option value="">Escolha</option>'}${opcoes(F.GRUPOS_EX.map((g) => [g, F.rotuloGrupoEx(g)]), v.grupo)}</select></label>
            <label class="ex-campo">PSE<select id="mx-pse">${opcoes(pses.map((n) => [String(n), String(n)]), String(v.pse))}</select></label>
          </div>
          <fieldset class="ex-bloco"><legend>Séries sugeridas</legend>
            <div class="ex-grade-dose" id="mx-dose-campos">
              <label class="ex-campo">Séries<input id="mx-series" inputmode="numeric" maxlength="5" autocomplete="off" value="${esc(d.series)}" placeholder="3"></label>
              <span class="ex-vezes" aria-hidden="true">×</span>
              <label class="ex-campo">Repetições ou tempo<input id="mx-valor" inputmode="numeric" maxlength="7" autocomplete="off" value="${esc(d.valor)}" placeholder="10"></label>
              <label class="ex-campo">Unidade<select id="mx-unidade">${opcoes([['rep', 'repetições'], ['s', 'segundos'], ['min', 'minutos']], d.unidade)}</select></label>
              <label class="ex-campo">Contagem<select id="mx-conta">${opcoes([['', 'normal'], ['totais', 'totais'], ['válidas', 'válidas']], d.conta)}</select></label>
              <label class="excluir-entendi ex-lado"><input type="checkbox" id="mx-lado"${d.lado ? ' checked' : ''}><span>Por lado</span></label>
            </div>
            <label class="ex-campo" id="mx-dose-texto" hidden>Outro formato<input id="mx-dose" maxlength="30" autocomplete="off" value="${esc(v.dose)}"></label>
            <p class="ex-dica" id="mx-dose-previa" aria-live="polite"></p>
            <label class="excluir-entendi"><input type="checkbox" id="mx-dose-livre"${dose ? '' : ' checked'}><span>Outro formato (texto livre)</span></label>
          </fieldset>
          <fieldset class="ex-bloco"><legend>Níveis</legend>
            <div class="ex-niveis">${F.NIVEIS_EX.map(nivel).join('')}</div>
          </fieldset>
          <label class="ex-campo">Explicação<textarea id="mx-why" maxlength="400" rows="3" placeholder="Para que serve e o que trabalha (aparece no app do aluno, abaixo dos níveis)">${esc(v.explicacao)}</textarea></label>
          <label class="ex-campo">Outros nomes<input id="mx-var" autocomplete="off" value="${esc((v.variacoes || []).join(', '))}" placeholder="Separe por vírgula (ex.: Remada suspensa)"></label>
          <p class="ex-dica">A busca do editor de fichas acha o exercício por eles.</p>
          <label class="ex-campo">Vídeo do YouTube<input id="mx-video" autocomplete="off" inputmode="url" value="${esc(v.video_id || '')}" placeholder="Link ou código do vídeo (opcional)"></label>
          <p class="excluir-erro" id="mx-erro" role="alert" hidden></p>
          ${x ? `<div class="ex-excluir"><button class="ex-excluir-btn" type="button" data-meu-ex-excluir="${esc(x.id)}">${F.ICON.lixeira}<span>Excluir exercício</span></button></div>` : ''}
        </div>
        <div class="ex-rodape">
          <button class="btn-sec" type="button" data-mx-fechar>Cancelar</button>
          <button class="btn" type="submit" id="mx-salvar">${x ? 'Salvar' : ti >= 0 ? 'Criar e pôr no treino' : 'Criar exercício'}</button>
        </div>
      </form>`;
    mostrarDoseMx();
    if (!$('mx-dialog').open) $('mx-dialog').showModal();
    if (!x) $('mx-nome').focus();
  }
  function doseMx() {
    if ($('mx-dose-livre').checked) return $('mx-dose').value.trim().replace(/\s+/g, ' ');
    return EX().montarDose({ series: $('mx-series').value, valor: $('mx-valor').value, unidade: $('mx-unidade').value, lado: $('mx-lado').checked, conta: $('mx-conta').value });
  }
  function mostrarDoseMx() {
    const livre = $('mx-dose-livre').checked;
    $('mx-dose-campos').hidden = livre;
    $('mx-dose-texto').hidden = !livre;
    const d = doseMx();
    $('mx-dose-previa').textContent = d ? `No app: ${d}` : 'Preencha as séries e as repetições ou o tempo (ex.: 3 e 10, ou 2–3 e 10–15).';
  }
  $('mx-dialog').addEventListener('input', (ev) => { if (/^mx-(series|valor|unidade|conta|lado|dose|dose-livre)$/.test(ev.target.id)) mostrarDoseMx(); });
  $('mx-dialog').addEventListener('change', (ev) => {
    if (/^mx-(unidade|conta|lado|dose-livre)$/.test(ev.target.id)) mostrarDoseMx();
    if (ev.target.id === 'mx-dose-livre' && ev.target.checked && !$('mx-dose').value.trim()) $('mx-dose').value = doseMx() || '';
  });
  $('mx-dialog').addEventListener('focusout', (ev) => {
    const F = EX();
    if (ev.target.id === 'mx-nome') ev.target.value = F.padronizarNome(ev.target.value);
    if (ev.target.id === 'mx-var') ev.target.value = ev.target.value.split(',').map(F.padronizarNome).filter(Boolean).join(', ');
    if (ev.target.id === 'mx-series' || ev.target.id === 'mx-valor') { ev.target.value = F.traco(ev.target.value); mostrarDoseMx(); }
  });
  $('mx-dialog').addEventListener('click', (ev) => {
    if (ev.target === $('mx-dialog') || ev.target.closest('[data-mx-fechar]')) $('mx-dialog').close();
  });
  $('mx-dialog').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const F = EX();
    const erro = (msg) => { $('mx-erro').textContent = msg; $('mx-erro').hidden = !msg; if (msg) $('mx-erro').scrollIntoView({ block: 'nearest' }); };
    const nome = F.padronizarNome($('mx-nome').value);
    const grupo = $('mx-grupo').value;
    const dose = doseMx();
    const video = F.codigoVideo($('mx-video').value);
    const variacoes = [...new Set($('mx-var').value.split(',').map(F.padronizarNome).filter(Boolean))];
    if (nome.length < 2) return erro('Informe o nome do exercício.');
    if ((P.biblioteca || []).some((e) => chave(e.nome) === chave(nome))) return erro('Esse exercício já está na biblioteca do app: escolha ele na lista da ficha.');
    const repetido = (P.meus || []).find((e) => chave(e.nome) === chave(nome) && e.id !== mx.id);
    if (repetido) return erro(`Você já tem um exercício com esse nome: ${repetido.nome}.`);
    if (!grupo) return erro('Escolha o grupo do exercício.');
    if (!dose) return erro($('mx-dose-livre').checked ? 'Escreva as séries sugeridas.' : 'Confira as séries: use números, como 3 e 10, ou faixas, como 2–3 e 10–15.');
    if (dose.length > 30) return erro('As séries sugeridas têm até 30 letras.');
    if (video === null) return erro('Não reconheci o vídeo: cole o link do YouTube ou o código de 11 letras.');
    if (variacoes.length > 20 || variacoes.some((x) => x.length > 80)) return erro('Use até 20 outros nomes, cada um com até 80 letras.');
    erro('');
    const dados = {
      id: mx.id || '', nome, grupo, dose, pse: Number($('mx-pse').value) || 8, explicacao: $('mx-why').value.trim(), variacoes, video_id: video,
      ...Object.fromEntries(F.NIVEIS_EX.map(([k]) => [k, (document.querySelector(`input[name="mx-${k}"]:checked`) || {}).value || 'baixa'])),
    };
    const botao = $('mx-salvar');
    const rotulo = botao.textContent;
    botao.disabled = true; botao.textContent = 'Salvando…';
    const r = await sb().rpc('personal_salvar_exercicio', { p: dados });
    if (r.error) { botao.disabled = false; botao.textContent = rotulo; return erro(`Não foi possível salvar. ${r.error.message}`); }
    const l = await sb().rpc('personal_exercicios');
    if (!l.error) P.meus = l.data || [];
    montarCatalogo();
    renderMeus();
    const { ti } = mx;
    $('mx-dialog').close();
    if (ti >= 0 && ed && $('ficha-dialog').open && ed.treinos[ti]) {
      ed.treinos[ti].exercicios.push({ nome, dose, pse: dados.pse });
      redesenhar(`.pf-treino[data-t="${ti}"] li[data-x="${ed.treinos[ti].exercicios.length - 1}"] [data-campo="ex-dose"]`);
      painel().toast(`"${nome}" criado e colocado no treino.`);
    } else {
      if (ed && $('ficha-dialog').open) redesenhar();
      painel().toast(mx.id ? `${nome} salvo. As fichas novas já usam a versão nova.` : `${nome} criado: já aparece na lista do editor de fichas.`);
    }
  });

  // ---------- Aplicar ficha e confirmações ----------
  // Janela única (pc-dialog) para: aplicar uma ficha a alunos, excluir ficha, encerrar acompanhamento e cancelar convite.
  let acao = null;
  function abrirJanela(html) {
    $('pc-dialog-body').innerHTML = html;
    if (!$('pc-dialog').open) $('pc-dialog').showModal();
  }
  const topoJanela = (titulo) => `<div class="excluir-topo"><h2 id="pc-dialog-title">${esc(titulo)}</h2>
    <button class="excluir-fechar" type="button" data-janela-fechar aria-label="Fechar">${XIS}</button></div>`;
  function abrirAplicar({ fichaId = null, alunoId = null }) {
    acao = { tipo: 'aplicar', fichaId, alunoId };
    const lista = alunos();
    if (!(P.fichas || []).length) return abrirJanela(`${topoJanela('Aplicar uma ficha')}<p>Você ainda não tem fichas. Monte uma na aba Treinos.</p>
      <div class="excluir-acoes"><button class="btn" type="button" data-ir-fichas>Ir para Treinos</button></div>`);
    if (!lista.length) return abrirJanela(`${topoJanela('Aplicar a alunos')}<p>Você ainda não tem alunos. Convide na aba Convidar; quando o aluno aceitar, ele aparece aqui.</p>
      <div class="excluir-acoes"><button class="btn" type="button" data-ir-convidar>Convidar aluno</button></div>`);
    const fichaSel = fichaId || (P.fichas[0] && P.fichas[0].id);
    abrirJanela(`${topoJanela('Aplicar ficha')}
      <form class="ex-form pf-aplicar" id="pc-aplicar-form" novalidate>
        <label class="ex-campo">Ficha<select id="pc-ficha">${P.fichas.map((f) => `<option value="${f.id}"${f.id === fichaSel ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
        <fieldset class="ex-bloco"><legend>Alunos</legend>
          <div class="pf-alunos">${lista.map((u) => {
    const atual = u.ficha_id && fichaPorId(u.ficha_id);
    return `<label class="excluir-entendi"><input type="checkbox" name="pc-aluno" value="${u.id}"${u.id === alunoId ? ' checked' : ''}>${painel().avatar(u, 'av-p')}<span>${esc(u.nome)}<small class="pf-sub">${atual ? `Hoje: ${esc(atual.nome)}` : u.treinos ? 'Hoje: treinos próprios' : 'Hoje: plano pronto do app'}</small></span></label>`;
  }).join('')}</div>
        </fieldset>
        <label class="excluir-entendi" id="pc-semana-linha"><input type="checkbox" id="pc-semana"><span>Trocar também a semana dos alunos pela semana sugerida da ficha</span></label>
        <p class="nota">Os treinos de antes de cada aluno ficam guardados. O aluno vê a ficha nova assim que abrir o app.</p>
        <p class="excluir-erro" id="pc-erro" role="alert" hidden></p>
        <div class="excluir-acoes"><button class="btn" type="submit" id="pc-aplicar">Aplicar</button>
          <button class="btn-sec" type="button" data-janela-fechar>Cancelar</button></div>
      </form>`);
    atualizarAplicar();
  }
  function atualizarAplicar() {
    const f = fichaPorId($('pc-ficha').value);
    $('pc-semana-linha').hidden = !(f && Array.isArray(f.semana) && f.semana.some((d) => d.length));
    const n = document.querySelectorAll('[name="pc-aluno"]:checked').length;
    $('pc-aplicar').textContent = n ? `Aplicar a ${qtd(n, 'aluno', 'alunos')}` : 'Aplicar';
    $('pc-aplicar').disabled = !n;
  }
  $('pc-dialog').addEventListener('change', (e) => { if (acao && acao.tipo === 'aplicar') atualizarAplicar(); });
  $('pc-dialog').addEventListener('submit', async (e) => {
    if (e.target.id !== 'pc-aplicar-form') return;
    e.preventDefault();
    const ids = [...document.querySelectorAll('[name="pc-aluno"]:checked')].map((x) => x.value);
    const f = fichaPorId($('pc-ficha').value);
    $('pc-aplicar').disabled = true;
    const { data, error } = await sb().rpc('personal_aplicar_ficha', { p_ficha: f.id, p_alunos: ids, p_semana: !$('pc-semana-linha').hidden && $('pc-semana').checked });
    if (error) { $('pc-erro').textContent = `Não foi possível aplicar. ${error.message}`; $('pc-erro').hidden = false; $('pc-aplicar').disabled = false; return; }
    mostrarEnvio(f, ids, data || ids.length);
    recarregarMantendo(acao.alunoId);
  });
  // Animação de "ficha enviada": a ficha voa até os alunos e aparece o visto. Sem animação para quem pediu menos movimento.
  function mostrarEnvio(f, ids, n) {
    acao = { tipo: 'enviado' };
    const lista = alunos();
    const vis = ids.slice(0, 4).map((id) => lista.find((u) => u.id === id) || {});
    abrirJanela(`<div class="pf-envio" role="status">
        <div class="pf-envio-cena" aria-hidden="true">
          <div class="pf-envio-ficha"><span></span><span></span><span></span></div>
          <div class="pf-envio-alunos">${vis.map((u, i) => `<span class="pf-envio-av" style="--i:${i}">${painel().avatar(u, 'cheio')}</span>`).join('')}${ids.length > 4 ? `<span class="pf-envio-av mais" style="--i:4">+${ids.length - 4}</span>` : ''}</div>
          <svg class="pf-envio-ok" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="m15 27 7.5 7.5L37.5 19"/></svg>
        </div>
        <h2 id="pc-dialog-title">Ficha enviada</h2>
        <p><b>${esc(f.nome)}</b> já está no app de ${n === 1 && vis[0] && vis[0].nome ? esc(vis[0].nome) : qtd(n, 'aluno', 'alunos')}. Os treinos de antes ficaram guardados.</p>
        <div class="excluir-acoes"><button class="btn" type="button" data-janela-fechar id="pc-pronto">Pronto</button></div>
      </div>`);
    setTimeout(() => $('pc-pronto') && $('pc-pronto').focus(), 50);
  }
  function confirmar(tipo, titulo, texto, botao, dados) {
    acao = { tipo, ...dados };
    abrirJanela(`${topoJanela(titulo)}<p>${texto}</p><p class="excluir-erro" id="pc-erro" role="alert" hidden></p>
      <div class="excluir-acoes"><button class="btn-peq perigo pf-confirmar" type="button" data-confirmar>${esc(botao)}</button>
        <button class="btn-sec" type="button" data-janela-fechar>Cancelar</button></div>`);
  }
  $('pc-dialog').addEventListener('click', async (e) => {
    if (e.target === $('pc-dialog') || e.target.closest('[data-janela-fechar]')) return $('pc-dialog').close();
    if (e.target.closest('[data-ir-fichas]')) { $('pc-dialog').close(); painel().fecharDetalhe(); return painel().mostrarAba('fichas'); }
    if (e.target.closest('[data-ir-convidar]')) { $('pc-dialog').close(); return painel().mostrarAba('convidar'); }
    if (!e.target.closest('[data-confirmar]') || !acao) return;
    e.target.closest('[data-confirmar]').disabled = true;
    const chamadas = {
      excluir: () => sb().rpc('personal_excluir_ficha', { p_id: acao.fichaId }),
      encerrar: () => sb().rpc('personal_encerrar_vinculo', { p_aluno: acao.alunoId }),
      cancelar: () => sb().rpc('personal_cancelar_convite', { p_codigo: acao.codigo }),
      excluirEx: () => sb().rpc('personal_excluir_exercicio', { p_id: acao.exId }),
    };
    const { error } = await chamadas[acao.tipo]();
    if (error) { $('pc-erro').textContent = error.message; $('pc-erro').hidden = false; e.target.closest('[data-confirmar]').disabled = false; return; }
    $('pc-dialog').close();
    if (acao.tipo === 'encerrar') painel().fecharDetalhe();
    if (acao.tipo === 'excluirEx' && $('mx-dialog').open) $('mx-dialog').close();
    painel().toast({ excluirEx: 'Exercício excluído. As fichas e os alunos que já têm ele continuam com ele.', excluir: 'Ficha excluída. Os alunos continuam com os treinos que já receberam.', encerrar: 'Acompanhamento encerrado. Os treinos que você montou saíram do app do aluno.', cancelar: 'Convite cancelado: o link parou de funcionar.' }[acao.tipo]);
    await painel().recarregar();
  });

  // Botões das listas e da ficha do aluno.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ficha-aplicar], [data-ficha-editar], [data-ficha-duplicar], [data-ficha-excluir], [data-pf-editar-aluno], [data-pf-aplicar-aluno], [data-pf-encerrar], [data-pc-copiar], [data-pc-cancelar], #ficha-nova, [data-pf-pesos-todos], #meu-ex-novo, [data-meu-ex-editar], [data-meu-ex-excluir]');
    if (!b) return;
    if (b.id === 'ficha-nova') return abrirEditor({});
    if (b.id === 'meu-ex-novo') return abrirExercicio({});
    const d = b.dataset;
    if (d.meuExEditar) return abrirExercicio({ id: d.meuExEditar });
    if (d.meuExExcluir) {
      const x = (P.meus || []).find((m) => m.id === d.meuExExcluir);
      return confirmar('excluirEx', 'Excluir exercício?', `<b>${esc(x ? x.nome : 'Este exercício')}</b> sai da sua lista e do editor de fichas. As fichas e os alunos que já têm ele continuam com ele.`, 'Excluir exercício', { exId: d.meuExExcluir });
    }
    if (d.fichaAplicar) return abrirAplicar({ fichaId: d.fichaAplicar });
    if (d.fichaEditar) return abrirEditor({ fichaId: d.fichaEditar });
    if (d.fichaDuplicar) return abrirEditor({ fichaId: d.fichaDuplicar, duplicar: true });
    if (d.fichaExcluir) {
      const f = fichaPorId(d.fichaExcluir);
      return confirmar('excluir', 'Excluir ficha?', `A ficha <b>${esc(f.nome)}</b> sai da sua lista. ${f.alunos ? `Os ${qtd(f.alunos, 'aluno', 'alunos')} que estão com ela continuam com os treinos que já receberam.` : ''}`, 'Excluir ficha', { fichaId: f.id });
    }
    if (d.pfEditarAluno) return abrirEditor({ alunoId: d.pfEditarAluno });
    if (d.pfAplicarAluno) return abrirAplicar({ alunoId: d.pfAplicarAluno });
    if (d.pfEncerrar) {
      const u = alunos().find((x) => x.id === d.pfEncerrar);
      return confirmar('encerrar', 'Encerrar acompanhamento?', `Você deixa de ver os treinos, a semana, os check-ins e os pesos de <b>${esc(u ? u.nome : 'este aluno')}</b>. Os treinos que você montou saem do app dele, que volta aos treinos de antes (ou ao plano pronto do app). Para acompanhar de novo, mande outro convite.`, 'Encerrar acompanhamento', { alunoId: d.pfEncerrar });
    }
    if (d.pfPesosTodos) { pesosTodos = !pesosTodos; return painel().abrirDetalhe(d.pfPesosTodos); }
    if (d.pcCopiar) return copiar(linkDe(d.pcCopiar));
    if (d.pcCancelar) return confirmar('cancelar', 'Cancelar convite?', `O link com o código <b>${esc(d.pcCancelar)}</b> para de funcionar.`, 'Cancelar convite', { codigo: d.pcCancelar });
  });

  // ---------- Ficha do aluno (dentro do detalhe do painel) ----------
  let pesosTodos = false;
  // Pesos de um aluno: por exercício, o recorde (maior carga de uma série), o último treino e se está parado.
  function pesosDo(id) {
    const porEx = new Map();
    P.cargas.filter((k) => k.usuario_id === id).forEach((k) => {
      Object.entries(k.series || {}).forEach(([ex, series]) => {
        const cargas = (Array.isArray(series) ? series : []).map((s) => Number(String(s && s.carga != null ? s.carga : '').replace(',', '.'))).filter((n) => n > 0);
        if (!cargas.length) return;
        if (!porEx.has(ex)) porEx.set(ex, []);
        porEx.get(ex).push({ data: String(k.data).slice(0, 10), max: Math.max(...cargas) });
      });
    });
    const hoje = painel().hoje();
    return [...porEx.entries()].map(([ex, dias]) => {
      dias.sort((a, b) => (a.data < b.data ? -1 : 1));
      let rec = dias[0];
      dias.forEach((d) => { if (d.max > rec.max) rec = d; });
      const ultimo = dias[dias.length - 1];
      const depois = dias.filter((d) => d.data > rec.data).length;
      const diasDesde = Math.round((painel().deYmd(hoje) - painel().deYmd(rec.data)) / 864e5);
      return { ex, rec, ultimo, primeiro: dias[0], parado: diasDesde >= 28 && depois >= 2 };
    }).sort((a, b) => (a.ultimo.data < b.ultimo.data ? 1 : -1));
  }
  const kg = (n) => `${String(Math.round(n * 10) / 10).replace('.', ',')} kg`;
  function detalhe(u) {
    const f = u.ficha_id ? fichaPorId(u.ficha_id) : null;
    const ajustada = f && !iguais(f.treinos, u.treinos);
    const origem = !u.treinos ? 'Plano pronto do app (o aluno ainda não recebeu uma ficha sua).'
      : f ? `Ficha <b>${esc(f.nome)}</b>${ajustada ? ', ajustada para este aluno' : ''}${u.treinos_em ? `, enviada em ${esc(dataCurta(u.treinos_em))}` : ''}.`
        : u.treinos_por_mim ? `Montada por você${u.treinos_em ? ` em ${esc(dataCurta(u.treinos_em))}` : ''}.` : 'Treinos que o aluno já tinha antes do acompanhamento.';
    const treinos = paraLista(u.treinos || PLANO_PADRAO);
    const treinosHTML = treinos.map((t, i) => `<li><b>${esc(t.nome)}</b>${t.subtitulo ? ` · ${esc(t.subtitulo)}` : ''}
      <small class="pf-sub">${t.exercicios.map((x) => `${esc(x.nome)} ${esc(x.dose)}`).join(' · ')}</small>${t.recado ? `<small class="pf-sub">Recado: ${esc(t.recado)}</small>` : ''}</li>`).join('');
    const pesos = pesosDo(u.id);
    const mostrar = pesosTodos ? pesos : pesos.slice(0, 6);
    const parados = pesos.filter((p) => p.parado);
    const pesosHTML = pesos.length ? `<ul class="pf-pesos">${mostrar.map((p) => `<li>
        <b>${esc(p.ex)}</b><span class="pf-rec">${p.rec.max === p.ultimo.max && p.rec.data === p.ultimo.data ? '🏆 ' : ''}Recorde ${kg(p.rec.max)} <small>em ${esc(dataCurta(`${p.rec.data}T12:00`))}</small></span>
        <small class="pf-sub">Último treino: ${kg(p.ultimo.max)} em ${esc(dataCurta(`${p.ultimo.data}T12:00`))}${p.primeiro.max < p.rec.max ? ` · subiu ${kg(p.rec.max - p.primeiro.max)} desde o primeiro registro` : ''}${p.parado ? ' · <b>parado há 4 semanas ou mais</b>' : ''}</small></li>`).join('')}</ul>
      ${pesos.length > 6 ? `<button class="link-btn" type="button" data-pf-pesos-todos="${u.id}">${pesosTodos ? 'Mostrar menos' : `Ver todos (${pesos.length})`}</button>` : ''}`
      : '<p class="nota">Nenhum peso registrado ainda.</p>';
    return `
      <section class="det-sec" aria-labelledby="pf-det-treinos">
        <h3 id="pf-det-treinos">Treinos atuais</h3>
        <p class="nota" style="margin-bottom:8px">${origem}</p>
        <ul class="pf-treinos-lista">${treinosHTML}</ul>
        <div class="pf-acoes" style="margin-top:10px">
          <button class="btn-peq prim" type="button" data-pf-editar-aluno="${u.id}">Editar os treinos deste aluno</button>
          <button class="btn-peq sec" type="button" data-pf-aplicar-aluno="${u.id}">Aplicar uma ficha</button>
        </div>
      </section>
      <section class="det-sec" aria-labelledby="pf-det-pesos">
        <h3 id="pf-det-pesos">Pesos${parados.length ? ` <span class="pf-alerta">${qtd(parados.length, 'parado', 'parados')}</span>` : ''}</h3>
        ${pesosHTML}
      </section>
      <section class="det-sec" aria-labelledby="pf-det-acomp">
        <h3 id="pf-det-acomp">Acompanhamento</h3>
        <div class="det-acesso"><span class="nota" style="flex:1 1 200px">Aluno desde ${esc(dataCurta(u.vinculado_em))}. Encerrar corta o seu acesso aos dados dele e tira do app dele os treinos que você montou.</span>
          <button class="btn-peq perigo" type="button" data-pf-encerrar="${u.id}">Encerrar acompanhamento</button></div>
      </section>`;
  }

  // ---------- Convites do personal ----------
  // Link do app (index.html) com ?personal=CODIGO, no mesmo endereço desta página.
  const linkDe = (codigo) => `${location.origin}${location.pathname.replace(/personal\.html$/, '')}?personal=${codigo}`;
  const mensagem = (nome, link) => `${nome ? `Oi, ${nome}! ` : 'Oi! '}Vou acompanhar seus treinos pelo Gestão de Treinos. Entre com o Google por este link e aceite o convite: ${link}`;
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); painel().toast('Link copiado.'); } catch (_) { painel().toast(texto); }
  }
  function renderConvites() {
    if (!P.convites) {
      $('pc-aguardando').innerHTML = '<p class="vazio">Não foi possível carregar os convites.</p>';
      $('pc-historico').innerHTML = '';
      return;
    }
    const agora = new Date().toISOString();
    const aguardando = P.convites.filter((c) => !c.aceito_em && !c.cancelado_em && c.expira_em > agora);
    const outros = P.convites.filter((c) => !aguardando.includes(c));
    $('pc-aguardando').innerHTML = aguardando.length ? aguardando.map((c) => `<div class="conv-item">
        <b>${c.nome ? esc(c.nome) : 'Sem nome'} <span class="conv-codigo">${esc(c.codigo)}</span><span class="conv-estado aguardando">Aguardando</span></b>
        <small>Vale até ${esc(dataCurta(c.expira_em))}</small>
        <div class="conv-botoes"><button class="btn-peq sec" type="button" data-pc-copiar="${esc(c.codigo)}">Copiar link</button>
          <button class="btn-peq sec" type="button" data-pc-cancelar="${esc(c.codigo)}">Cancelar</button></div>
      </div>`).join('') : '<p class="vazio">Nenhum convite aguardando.</p>';
    const estado = (c) => (c.aceito_em ? (c.encerrado_em ? ['', `Encerrado ${c.encerrado_por === 'personal' ? 'por você' : c.encerrado_por === 'troca' ? '(trocou de personal)' : 'pelo aluno'}`] : ['usado', 'Aluno'])
      : c.cancelado_em ? ['', 'Cancelado'] : ['', 'Expirou']);
    $('pc-historico').innerHTML = outros.length ? outros.map((c) => {
      const [cls, rot] = estado(c);
      const ativo = c.aceito_em && !c.encerrado_em;
      return `<div class="conv-item"><b>${ativo ? `<button class="conv-pessoa" type="button" data-abrir-usuario="${c.aluno_id}">${esc(c.aluno_nome || c.nome || 'Aluno')}</button>` : esc(c.aluno_nome || c.nome || 'Sem nome')}<span class="conv-estado ${cls}">${rot}</span></b>
        <small>${c.aceito_em ? `Aceito em ${esc(dataCurta(c.aceito_em))}${c.encerrado_em ? ` · encerrado em ${esc(dataCurta(c.encerrado_em))}` : ''}` : `Código ${esc(c.codigo)} · criado em ${esc(dataCurta(c.criado_em))}`}</small></div>`;
    }).join('') : '<p class="vazio">Nenhum convite aceito ainda.</p>';
  }
  $('pc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = $('pc-nome').value.trim();
    $('pc-gerar').disabled = true;
    const { data: codigo, error } = await sb().rpc('personal_criar_convite', { p_nome: nome });
    $('pc-gerar').disabled = false;
    if (error) { $('pc-gerado').innerHTML = `<p class="excluir-erro" role="alert" style="margin-top:12px">Não foi possível gerar o convite. ${esc(error.message)}</p>`; return; }
    const link = linkDe(codigo);
    $('pc-gerado').innerHTML = `<div class="conv-gerado" role="status">
        <p>Convite${nome ? ` para ${esc(nome)}` : ''} criado: <span class="conv-codigo">${esc(codigo)}</span></p>
        <input class="conv-link" id="pc-link" type="text" readonly value="${esc(link)}" aria-label="Link do convite">
        <div class="conv-acoes">
          <button class="btn" type="button" data-pc-copiar="${esc(codigo)}">Copiar link</button>
          <a class="btn-sec" href="https://wa.me/?text=${encodeURIComponent(mensagem(nome, link))}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>
        </div></div>`;
    $('pc-nome').value = '';
    const r = await sb().rpc('personal_convites');
    if (!r.error) { P.convites = r.data || []; renderConvites(); }
  });

  window.PersonalHooks = { semAcesso, registroDaConta, carregar, aplicar, render, detalhe, geral };
})();
