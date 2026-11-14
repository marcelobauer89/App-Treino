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
    if (!(P.fichas || []).length) return abrirJanela(`${topoJanela('Aplicar uma ficha')}<p>Você ainda não tem fichas. Monte uma na aba Fichas.</p>
      <div class="excluir-acoes"><button class="btn" type="button" data-ir-fichas>Ir para Fichas</button></div>`);
    if (!lista.length) return abrirJanela(`${topoJanela('Aplicar a alunos')}<p>Você ainda não tem alunos. Convide na aba Convidar; quando o aluno aceitar, ele aparece aqui.</p>
      <div class="excluir-acoes"><button class="btn" type="button" data-ir-convidar>Convidar aluno</button></div>`);
    const fichaSel = fichaId || (P.fichas[0] && P.fichas[0].id);
    abrirJanela(`${topoJanela('Aplicar ficha')}
      <form class="ex-form pf-aplicar" id="pc-aplicar-form" novalidate>
        <label class="ex-campo">Ficha<select id="pc-ficha">${P.fichas.map((f) => `<option value="${f.id}"${f.id === fichaSel ? ' selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></label>
        <fieldset class="ex-bloco"><legend>Alunos</legend>
          <div class="pf-alunos">${lista.map((u) => {
    const atual = u.ficha_id && fichaPorId(u.ficha_id);
    return `<label class="excluir-entendi"><input type="checkbox" name="pc-aluno" value="${u.id}"${u.id === alunoId ? ' checked' : ''}><span>${esc(u.nome)}<small class="pf-sub">${atual ? `Hoje: ${esc(atual.nome)}` : u.treinos ? 'Hoje: treinos próprios' : 'Hoje: plano pronto do app'}</small></span></label>`;
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
    const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
    const vis = ids.slice(0, 4).map((id) => (lista.find((u) => u.id === id) || {}).nome);
    abrirJanela(`<div class="pf-envio" role="status">
        <div class="pf-envio-cena" aria-hidden="true">
          <div class="pf-envio-ficha"><span></span><span></span><span></span></div>
          <div class="pf-envio-alunos">${vis.map((nome, i) => `<span class="pf-envio-av" style="--i:${i}">${esc(iniciais(nome))}</span>`).join('')}${ids.length > 4 ? `<span class="pf-envio-av mais" style="--i:4">+${ids.length - 4}</span>` : ''}</div>
          <svg class="pf-envio-ok" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="m15 27 7.5 7.5L37.5 19"/></svg>
        </div>
        <h2 id="pc-dialog-title">Ficha enviada</h2>
        <p><b>${esc(f.nome)}</b> já está no app de ${n === 1 && vis[0] ? esc(vis[0]) : qtd(n, 'aluno', 'alunos')}. Os treinos de antes ficaram guardados.</p>
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
    painel().toast({ excluirEx: 'Exercício excluído. As fichas e os alunos que já têm ele continuam com ele.', excluir: 'Ficha excluída. Os alunos continuam com os treinos que já receberam.', encerrar: 'Acompanhamento encerrado. O aluno continua com a ficha.', cancelar: 'Convite cancelado: o link parou de funcionar.' }[acao.tipo]);
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
      return confirmar('encerrar', 'Encerrar acompanhamento?', `Você deixa de ver os treinos, a semana, os check-ins e os pesos de <b>${esc(u ? u.nome : 'este aluno')}</b>. Ele continua com a ficha atual e volta a poder mudá-la. Para acompanhar de novo, mande outro convite.`, 'Encerrar acompanhamento', { alunoId: d.pfEncerrar });
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
        <div class="det-acesso"><span class="nota" style="flex:1 1 200px">Aluno desde ${esc(dataCurta(u.vinculado_em))}. Encerrar corta o seu acesso aos dados dele; a ficha continua com ele.</span>
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

  window.PersonalHooks = { semAcesso, carregar, aplicar, render, detalhe };
})();
