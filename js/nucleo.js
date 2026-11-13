// js/nucleo.js: conexão com o Supabase, catálogo, perfil, datas, estado, gravação, eventos de uso,
// atualização automática, carga dos dados da conta e helpers de interface.
// Parte do app (index.html). Os arquivos de js/ dividem o mesmo escopo global e carregam na ordem do index.html;
// o mapa das seções está em docs/MAPA.md.

  // ---------- Conexão com o Supabase ----------
  // Endereço e chave publicável do projeto ficam no ambiente.js (produção ou desenvolvimento).
  const SUPABASE_URL = window.AMBIENTE.url;
  const SUPABASE_KEY = window.AMBIENTE.chave;
  const configurado = /^https:\/\//.test(SUPABASE_URL) && !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_KEY.startsWith('SUA-');

  // Atividades além da musculação, na ordem em que aparecem (check-in, semana, Dashboard). Vêm do banco
  // (tabela tipos_checkin, cadastrada no painel → Tipos de check-in); esta lista é a reserva sem o banco.
  const ATIVIDADES = ['jiu', 'muay', 'surf', 'futebol', 'futvolei', 'bike'];
  const ATIVIDADES_APP = [...ATIVIDADES];

  // ---------- Catálogo (exercícios e objetivos) ----------
  // Vem do banco (tabelas exercicios e jornadas, editadas no painel → Exercícios) e fica guardado no aparelho,
  // para abrir rápido e sem internet. A cópia acima (BIBLIOTECA_APP e JORNADAS_APP) é a reserva enquanto o banco
  // não tem o catálogo (supabase/schema.sql ainda não rodado) e gera a carga inicial (supabase/gerar-catalogo.cjs).
  // Os treinos das contas guardam só nome, dose e PSE: um exercício renomeado continua sendo achado pelo nome antigo
  // (nomes_antigos) e um desativado sai da lista de escolha, mas segue completo nos treinos de quem já o tem.
  const CHAVE_CATALOGO = 'bauer-catalogo';
  const NIVEIS = ['alta', 'media', 'baixa'];
  let BIBLIOTECA = BIBLIOTECA_APP; // para escolher: só os ativos
  let JORNADAS = JORNADAS_APP; // para escolher: só os ativos
  let catalogo = null; // { porNome, antigos, jornadas } quando veio do banco (ou da cópia guardada dele)
  let catalogoDoBanco = false;
  function exDaBiblioteca(nome) {
    if (catalogo) { const ex = catalogo.porNome.get(nome) || catalogo.antigos.get(nome); if (ex) return ex; }
    return BIBLIOTECA_APP.find((ex) => ex.nome === nome) || null;
  }
  // Objetivo da conta para o filtro "Do meu objetivo" do editor: só quando há exercícios marcados para ele no catálogo.
  function objetivoDoEditor() {
    const j = jornada && jornadaPorId(jornada);
    return j && BIBLIOTECA.some((ex) => (ex.objetivos || []).includes(j.id)) ? j : null;
  }
  // Nome de hoje no catálogo (para um exercício salvo com um nome antigo).
  const nomeAtual = (nome) => (exDaBiblioteca(nome) || { nome }).nome;
  // Nome para mostrar: o de hoje no catálogo.
  const nomeDe = (ex) => ex.rotulo || nomeAtual(ex.nome);
  const jornadaPorId = (id) => (catalogo && catalogo.jornadas.find((j) => j.id === id)) || jornadaPorIdApp(id);
  const listaTextos = (v, max) => (Array.isArray(v) ? v.map((x) => limpar(x, 80)).filter(Boolean).slice(0, max) : []);
  function exercicioDoBanco(r) {
    const nome = r && limpar(r.nome, 80);
    if (!nome) return null;
    const nivel = (v) => (NIVEIS.includes(v) ? v : 'baixa');
    const pse = Number(r.pse);
    return {
      nome, grupo: GRUPOS_EX.includes(r.grupo) ? r.grupo : '', dose: limpar(r.dose, 30) || '3×10', pse: pse >= 1 && pse <= 10 ? Math.round(pse) : 8,
      H: nivel(r.hipertrofia), M: nivel(r.mobilidade), F: nivel(r.forca), E: nivel(r.explosao), why: String(r.explicacao ?? '').trim().slice(0, 400),
      variacoes: listaTextos(r.variacoes, 20), nomesAntigos: listaTextos(r.nomes_antigos, 20), objetivos: listaTextos(r.objetivos, 20), ativo: r.ativo !== false,
    };
  }
  function jornadaDoBanco(r) {
    const d = r && r.dados;
    const id = r && limpar(r.id, 30);
    if (!id || !d || typeof d !== 'object' || !limpar(d.nome, 40)) return null;
    const texto = (v, max) => String(v ?? '').trim().slice(0, max);
    const treinos = {};
    for (let n = 1; n <= MAX_TREINOS; n++) {
      const t = d.treinos && d.treinos[n];
      const exercicios = t && Array.isArray(t.exercicios) ? t.exercicios.filter((e) => e && e.nome).slice(0, MAX_EXERCICIOS)
        .map((e) => ({ nome: limpar(e.nome, 80), dose: limpar(e.dose, 30), pse: Number(e.pse) || 8 })) : [];
      if (!exercicios.length) continue;
      treinos[n] = {
        nome: limpar(t.nome, 40) || `Treino ${n}`, subtitulo: limpar(t.subtitulo, 60), objetivo: texto(t.objetivo, 400), esperado: texto(t.esperado, 600),
        impacto_jiu: texto(t.impacto_jiu, 400), impacto_fisico: texto(t.impacto_fisico, 400), exercicios,
      };
    }
    if (!Object.keys(treinos).length) return null;
    const semana = {};
    for (const [dia, tipos] of Object.entries(d.semana && typeof d.semana === 'object' ? d.semana : {})) {
      if (/^[0-6]$/.test(dia) && Array.isArray(tipos)) semana[dia] = tipos.filter((x) => /^t[1-6]$/.test(x) && treinos[x.slice(1)]);
    }
    return {
      id, nome: limpar(d.nome, 40), resumo: texto(d.resumo, 120), nivel: texto(d.nivel, 40), dias: Number(d.dias) || Object.keys(semana).length,
      tempo: texto(d.tempo, 30), equipamento: texto(d.equipamento, 120), semana, treinos, ativo: r.ativo !== false, ordem: Number(r.ordem) || 0,
    };
  }
  // Usa o catálogo que veio do banco. Sem nenhum exercício ativo (tabela vazia ou com problema), fica a cópia do app.
  function aplicarCatalogo(dados) {
    const exs = (dados && Array.isArray(dados.exercicios) ? dados.exercicios : []).map(exercicioDoBanco).filter(Boolean)
      .sort((a, b) => GRUPOS_EX.indexOf(a.grupo) - GRUPOS_EX.indexOf(b.grupo) || a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!exs.some((e) => e.ativo)) return false;
    const porNome = new Map(exs.map((e) => [e.nome, e]));
    const antigos = new Map();
    exs.forEach((e) => e.nomesAntigos.forEach((n) => { if (!porNome.has(n) && !antigos.has(n)) antigos.set(n, e); }));
    const jornadas = (Array.isArray(dados.jornadas) ? dados.jornadas : []).map(jornadaDoBanco).filter(Boolean).sort((a, b) => a.ordem - b.ordem);
    catalogo = { porNome, antigos, jornadas };
    BIBLIOTECA = exs.filter((e) => e.ativo);
    const ativas = jornadas.filter((j) => j.ativo);
    JORNADAS = ativas.length ? ativas : JORNADAS_APP;
    catalogoDoBanco = true;
    return true;
  }
  // Busca o catálogo no banco. Sem as tabelas (SQL ainda não rodado) ou sem internet, segue com o que já tem.
  // Devolve true quando o catálogo mudou desde a última vez.
  let catalogoEm = 0, catalogoJson = '';
  async function carregarCatalogo() {
    try {
      catalogoEm = Date.now();
      const [e, j, t] = await Promise.all([sb.from('exercicios').select('*'), sb.from('jornadas').select('*'),
        sb.from('tipos_checkin').select('*').then((r) => r, () => ({ error: true }))]);
      // Tipos de check-in: valem mesmo sem o catálogo de exercícios no banco.
      if (!t.error && Array.isArray(t.data) && aplicarTiposCheckin(t.data)) {
        try { localStorage.setItem(CHAVE_TIPOS, JSON.stringify(t.data)); } catch (_) {}
      }
      if (e.error || !Array.isArray(e.data) || !e.data.length) return false;
      const dados = { exercicios: e.data, jornadas: j.error ? [] : j.data || [] };
      const json = JSON.stringify(dados);
      if (json === catalogoJson) return false;
      if (!aplicarCatalogo(dados)) return false;
      catalogoJson = json;
      try { localStorage.setItem(CHAVE_CATALOGO, json); } catch (_) {}
      return true;
    } catch (_) { return false; }
  }
  // Ao voltar para o app (ou abrir o editor), busca o catálogo de novo, no máximo a cada 2 min: o que o administrador
  // mudou no painel (nome, explicação, níveis, vídeo) aparece nos cartões sem fechar o app. Séries e PSE são da pessoa.
  async function atualizarCatalogo({ forcar = false } = {}) {
    if (!usuario || !sb || (!forcar && Date.now() - catalogoEm < 120000)) return;
    if (!(await carregarCatalogo())) return;
    TREINOS = treinosDaConta ? montarTreinos(treinosParaSalvar(TREINOS)) || TREINOS : planoPronto();
    // Com uma janela aberta (pesos, editor, check-in), redesenha depois, para não mexer no que a pessoa está fazendo.
    if (document.querySelector('dialog[open]')) { catalogoPendente = true; return; }
    redesenharCatalogo();
  }
  let catalogoPendente = false;
  // Redesenho adiado: quando a última janela aberta fecha.
  document.addEventListener('close', () => { if (catalogoPendente && !document.querySelector('dialog[open]')) redesenharCatalogo(); }, true);
  function redesenharCatalogo() {
    catalogoPendente = false;
    renderTudo();
    if (telaAtual() === 'dashboard') renderDashboard();
    if (telaAtual() === 'voce') renderConfig();
  }
  // Vídeo da execução: pelo nome salvo no treino, pelo nome de hoje no catálogo ou por um nome antigo dele.
  function videoDe(nome) {
    if (VIDEOS[nome]) return VIDEOS[nome];
    const ex = exDaBiblioteca(nome);
    return (ex && [ex.nome, ...(ex.nomesAntigos || [])].map((n) => VIDEOS[n]).find(Boolean)) || '';
  }

  // Treinos da conta: os montados em "Meus treinos" (perfis.treinos) ou, sem eles, o plano pronto.
  // No banco vão só nome, dose e PSE de cada exercício; níveis, grupo e explicação vêm da biblioteca.
  const MAX_TREINOS = 6, MAX_EXERCICIOS = 15;
  let TREINOS = PLANO_PADRAO;
  let treinosDaConta = false;
  // { liberado, pedidoEm }: contas novas só usam o app depois de um convite ou de um administrador liberar.
  let acesso = { liberado: true, pedidoEm: null };
  // Política de Privacidade: versão atual (mude junto com privacidade.html) e se a pessoa já viu esta versão.
  const POLITICA_VERSAO = '2026-10-27';
  let politica = { disponivel: false, aceita: true, contaNova: false };
  let perfilLinha = null;
  // Versão anterior dos treinos (perfis.treinos_anterior): { treinos, semana, em, jornada }. Serve para Desfazer e recuperar.
  let treinosAnterior = null;
  // Jornada escolhida (perfis.jornada): mostra "Jornada X" em Meus treinos e se ela foi personalizada.
  let jornada = null;
  const limpar = (t, max) => String(t ?? '').replace(/[<>"&]/g, '').trim().slice(0, max);
  function exercicioCompleto(e) {
    const base = exDaBiblioteca(e.nome) || { nome: limpar(e.nome, 80), grupo: '', H: 'baixa', M: 'baixa', F: 'baixa', E: 'baixa', why: '' };
    const pse = Number(e.pse);
    // O nome fica o salvo no treino (as cargas e o histórico usam ele, como chave); na tela aparece o rotulo,
    // o nome de hoje no catálogo (um exercício renomeado no painel aparece com o nome novo).
    return { ...base, nome: base.nome === e.nome ? base.nome : limpar(e.nome, 80), rotulo: base.nome || limpar(e.nome, 80), dose: limpar(e.dose, 30) || base.dose || '3×10', pse: pse >= 1 && pse <= 10 ? Math.round(pse) : base.pse || 8 };
  }
  const qtdExercicios = (n) => `${n} ${n === 1 ? 'exercício' : 'exercícios'}`;
  const nomesDos = (exs) => exs.map((e) => e.nome).join('|');
  function montarTreinos(salvos) {
    if (!salvos || typeof salvos !== 'object' || Array.isArray(salvos)) return null;
    const treinos = {};
    for (let n = 1; n <= MAX_TREINOS; n++) {
      const t = salvos[n];
      const exercicios = t && Array.isArray(t.exercicios)
        ? t.exercicios.filter((e) => e && e.nome).slice(0, MAX_EXERCICIOS).map(exercicioCompleto) : [];
      if (!exercicios.length) continue;
      treinos[n] = { nome: limpar(t.nome, 40) || `Treino ${n}`, subtitulo: limpar(t.subtitulo, 60), exercicios };
      // O texto "Sobre o treino" do plano pronto (ou de uma jornada) só vale enquanto os exercícios forem os mesmos.
      const p = [...(catalogo ? catalogo.jornadas : []), ...JORNADAS_APP].map((j) => j.treinos[n]).find((x) => x && nomesDos(x.exercicios) === nomesDos(exercicios));
      if (p) {
        const { objetivo, esperado, impacto_jiu, impacto_fisico } = p;
        Object.assign(treinos[n], { objetivo, esperado, impacto_jiu, impacto_fisico });
      }
    }
    return Object.keys(treinos).length ? treinos : null;
  }
  // Formato gravado em perfis.treinos.
  const treinosParaSalvar = (treinos) => Object.fromEntries(Object.entries(treinos).map(([id, t]) => [id, {
    nome: t.nome, subtitulo: t.subtitulo, exercicios: t.exercicios.map(({ nome, dose, pse }) => ({ nome, dose, pse })),
  }]));
  // Plano pronto (contas sem treinos próprios): a lista de exercícios é sempre a do app, e não muda quando o objetivo
  // Jiu Jitsu é editado no banco; os detalhes de cada exercício vêm do catálogo.
  const planoPronto = () => (catalogoDoBanco && montarTreinos(treinosParaSalvar(PLANO_PADRAO))) || PLANO_PADRAO;
  const mesmoQuePadrao = (treinos) => JSON.stringify(treinosParaSalvar(treinos)) === JSON.stringify(treinosParaSalvar(PLANO_PADRAO));
  // Cópia guardada no aparelho: o app já abre com ela, antes de o banco responder.
  try { const g = JSON.parse(localStorage.getItem(CHAVE_CATALOGO) || 'null'); if (g) aplicarCatalogo(g); } catch (_) {}

  // ---------- Perfil e configurações (vêm do Supabase depois do login) ----------
  // Temporizador de descanso (perfis.temporizador): ligado por padrão; a pessoa pode desligar em Você → Temporizador.
  const TEMPOS_DESCANSO = [30, 45, 60, 90, 120, 180];
  const TEMP_PADRAO = { ativo: true, segundos: 90, vibrar: true, som: true };
  function lerTemporizador(v) {
    if (!v || typeof v !== 'object') return { ...TEMP_PADRAO };
    const seg = Number(v.segundos);
    return { ativo: v.ativo !== false, segundos: TEMPOS_DESCANSO.includes(seg) ? seg : TEMP_PADRAO.segundos, vibrar: v.vibrar !== false, som: v.som !== false };
  }
  const CHAVE_DESCANSO = 'bauer-descanso';
  // desc: { fim (ms) e total (s) enquanto roda; acabou quando terminou; escolhido = tempo marcado na janela }
  let desc = { fim: null, total: 0, acabou: false, escolhido: null };
  let relogioDescanso = null;
  let acabouTimer = null;
  try {
    const salvo = JSON.parse(sessionStorage.getItem(CHAVE_DESCANSO) || 'null');
    if (salvo && salvo.fim > Date.now() && salvo.total > 0) desc = { ...desc, fim: salvo.fim, total: salvo.total };
  } catch (_) {}
  const restante = () => (desc.fim ? Math.max(0, Math.ceil((desc.fim - Date.now()) / 1000)) : 0);
  const guardarDescanso = () => {
    try { if (desc.fim) sessionStorage.setItem(CHAVE_DESCANSO, JSON.stringify({ fim: desc.fim, total: desc.total })); else sessionStorage.removeItem(CHAVE_DESCANSO); } catch (_) {}
  };

  const lerJSON = (k) => {
    try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; }
  };
  // semPeso: exercícios que o usuário faz só com o corpo (o painel não pede carga).
  let config = { tema: 'auto', estilo: 'padrao', semana: [[], ['t2'], ['jiu'], ['t1'], ['jiu'], ['t3'], ['bike']], semPeso: new Set(), resumoEmail: true, temporizador: { ...TEMP_PADRAO } };
  // A conta já tem a semana salva (coluna perfis.semana)? Senão, ela vem dos antigos dias de jiu.
  let semanaDaConta = false;
  // Aviso "Baita atualização" dos treinos personalizados: aparece a cada abertura do app até a pessoa marcar
  // "Não mostrar esta mensagem de novo" (perfis.novidade_oculta, com cópia no navegador para quando a coluna
  // ainda não existe no banco). perfis.novidade_treinos guarda a última resposta.
  let novidade = { disponivel: false, vista: true, contaNova: false };
  // Avisos de novidade ocultos ("Não mostrar esta novidade de novo"): perfis.novidades_ocultas, com cópia no navegador
  // para quando a coluna ainda não existe no banco.
  let novidadesOcultas = new Set(['evolucao']);
  const chaveNovidades = () => `bauer-novidades-ocultas-${usuario.id}`;
  const chaveNovidade = () => `bauer-novidade-oculta-${usuario.id}`;
  // Voltar ao app depois de 30 min em segundo plano conta como abrir de novo (no celular a página não recarrega).
  const NOVA_ABERTURA_MS = 30 * 60000;
  let escondidoEm = null;
  let perfil = { nome: '', email: '', foto: '' };
  // Só uma cópia do tema fica no navegador, para aplicá-lo antes da primeira pintura.
  const ESTILOS = ['padrao', 'neon', 'brasa', 'cyber', 'ultra', 'gelo', 'violeta', 'miami', 'lua_de_sangue'];
  const guardarTemaLocal = () => {
    try { localStorage.setItem('bauer-tema', config.tema); localStorage.setItem('bauer-estilo', config.estilo); } catch (_) {}
  };
  try {
    const t = localStorage.getItem('bauer-tema');
    if (['auto', 'claro', 'escuro'].includes(t)) config.tema = t;
    const e = localStorage.getItem('bauer-estilo');
    if (ESTILOS.includes(e)) config.estilo = e;
  } catch (_) {}
  // Sem a coluna perfis.estilo (schema.sql antigo), o estilo fica só neste aparelho.
  let estiloNaConta = false;

  // Semana do usuário: para cada dia (índice de Date.getDay(), 0 = domingo), até 2 atividades
  // entre os treinos ('t1' a 't6'), 'jiu', 'muay', 'surf', 'futebol', 'futvolei' e 'bike'. Dia vazio é descanso.
  const CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0];
  const naDia = (i) => `${i === 0 || i === 6 ? 'No' : 'Na'} ${NOMES_DIA[i]}`;
  const daDia = (i) => `${i === 0 || i === 6 ? 'do' : 'da'} ${NOMES_DIA[i]}`;
  const copiaSemana = (s) => s.map((d) => [...d]);
  // Treino de musculação que existe hoje na conta (t1 a t6; um treino excluído deixa de valer na semana).
  const ehTreino = (t) => /^t[1-6]$/.test(t) && !!TREINOS[t.slice(1)];
  const nomeAtividade = (t) => (TIPOS[t] ? TIPOS[t].nome : t);
  // Contas antigas só tinham os dias de jiu: a semana é montada com eles sobre o plano original.
  function semanaDeDiasJiu(dias) {
    const s = [[], ['t2'], [], ['t1'], [], ['t3'], []];
    dias.forEach((i) => { if (i >= 1 && i <= 6) s[i].push('jiu'); });
    if (!dias.includes(6)) s[6].push('bike');
    return s;
  }
  // Padrão sem lutas: jiu e os outros esportes entram quando a pessoa os coloca na semana.
  const SEMANA_PADRAO = semanaDeDiasJiu([]);
  // Com treinos montados pela pessoa, a semana padrão fica só com os que existem.
  const semanaPadrao = () => validarSemana(SEMANA_PADRAO);
  function validarSemana(s) {
    if (!Array.isArray(s) || s.length !== 7) return null;
    return s.map((d) => (Array.isArray(d)
      ? [...new Set(d.filter((t) => ehTreino(t) || ATIVIDADES.includes(t)))].slice(0, 2)
      : []));
  }
  function planoDoDia(i) {
    const tipos = config.semana[i] || [];
    const tipoTreino = tipos.find(ehTreino);
    const treino = tipoTreino ? tipoTreino.slice(1) : undefined;
    const grupos = [...new Set(tipos.map((t) => (ehTreino(t) ? 'musc' : t)))];
    const notaDe = (t) => (ehTreino(t) ? TREINOS[t.slice(1)].subtitulo || 'musculação' : t === 'jiu' ? 'aula de jiu' : t === 'muay' ? 'aula de muay thai' : t === 'surf' ? 'sessão de surf' : t === 'futebol' ? 'jogo de futebol' : t === 'futvolei' ? 'jogo de futvôlei' : 'cardio leve');
    let titulo = 'Descanso', nota = 'Recuperação';
    if (tipos.length === 1) {
      titulo = nomeAtividade(tipos[0]);
      nota = tipos[0] === 'jiu' ? 'Prioridade técnica' : tipos[0] === 'muay' ? 'Aula de muay thai' : tipos[0] === 'surf' ? 'Sessão de surf' : tipos[0] === 'futebol' ? 'Jogo de futebol' : tipos[0] === 'futvolei' ? 'Jogo de futvôlei' : tipos[0] === 'bike' ? '20–40 min, intensidade leve' : notaDe(tipos[0]);
    } else if (tipos.length) {
      titulo = tipos.map(nomeAtividade).join(' + ');
      nota = tipos.map(notaDe).join(', ');
    }
    return { curto: CURTOS[i], tipos, treino, jiu: tipos.includes('jiu'), bike: tipos.includes('bike'), grupos, titulo, nota };
  }

  // Tipos de check-in. Musculação usa uma cor só; o número no selo diz qual treino foi.
  // t1 a t6 existem sempre, para os check-ins de um treino que foi excluído continuarem com nome.
  // As outras atividades vêm do banco (tipos_checkin); cada uma é o próprio grupo (cor e meta na semana).
  // modalidades: [{ id, nome, km }] (ex.: Cardio → Bike e Corrida, com os km percorridos).
  const TIPOS_BASE = {
    jiu: { nome: 'Jiu Jitsu', selo: 'J', grupo: 'jiu', modalidades: [] },
    muay: { nome: 'Muay Thai', selo: 'M', grupo: 'muay', modalidades: [] },
    surf: { nome: 'Surf', selo: 'S', grupo: 'surf', modalidades: [] },
    futebol: { nome: 'Futebol', selo: 'F', grupo: 'futebol', modalidades: [] },
    futvolei: { nome: 'Futvôlei', selo: 'V', grupo: 'futvolei', modalidades: [] },
    // A chave 'bike' fica no banco (check-ins e semana já salvos); na tela o tipo se chama Cardio.
    bike: { nome: 'Cardio', selo: 'C', grupo: 'bike', modalidades: [{ id: 'bike', nome: 'Bike', km: true }, { id: 'corrida', nome: 'Corrida', km: true }] },
  };
  // Um check-in de um tipo que não está cadastrado (ex.: Calistenia, retirada) fica de fora ao carregar.
  const TIPOS = JSON.parse(JSON.stringify(TIPOS_BASE));
  let ORDEM_TIPOS = [];
  function atualizarTipos() {
    for (let n = 1; n <= MAX_TREINOS; n++) {
      TIPOS[`t${n}`] = { nome: TREINOS[n] ? TREINOS[n].nome : `Treino ${n}`, selo: String(n), grupo: 'musc', treino: String(n) };
    }
    ORDEM_TIPOS = [...Object.keys(TREINOS).map((n) => `t${n}`), ...ATIVIDADES];
  }
  atualizarTipos();
  const DURACAO_PADRAO = { musc: 60, jiu: 60, muay: 60, surf: 90, futebol: 90, futvolei: 90, bike: 30 };
  const duracaoPadrao = (tipo) => DURACAO_PADRAO[TIPOS[tipo].grupo] || 60;

  // Tipos cadastrados no banco: nome, selo, cor, duração, ordem, ativo e modalidades. Os desativados saem do check-in
  // e da semana, mas continuam com nome nos check-ins antigos. Sem nenhuma linha, ficam os tipos do app.
  const CHAVE_TIPOS = 'bauer-tipos-checkin';
  const COR = /^#[0-9a-fA-F]{6}$/;
  function aplicarTiposCheckin(linhas) {
    const lista = (Array.isArray(linhas) ? linhas : []).filter((r) => r && /^[a-z][a-z0-9_]{1,19}$/.test(r.id) && r.id !== 'musc' && !/^t\d+$/.test(r.id))
      .map((r) => ({
        id: r.id, nome: limpar(r.nome, 40) || r.id, selo: limpar(r.selo, 2) || r.id.charAt(0).toUpperCase(),
        cor: COR.test(r.cor || '') ? r.cor : '', corEscura: COR.test(r.cor_escura || '') ? r.cor_escura : '',
        duracao: Number(r.duracao) >= 5 && Number(r.duracao) <= 600 ? Math.round(Number(r.duracao)) : 60,
        ordem: Number(r.ordem) || 0, ativo: r.ativo !== false,
        modalidades: (Array.isArray(r.modalidades) ? r.modalidades : []).filter((m) => m && /^[a-z][a-z0-9_]{0,19}$/.test(m.id))
          .map((m) => ({ id: m.id, nome: limpar(m.nome, 30) || m.id, km: !!m.km })),
      }))
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!lista.length) return false;
    lista.forEach((t) => {
      TIPOS[t.id] = { nome: t.nome, selo: t.selo, grupo: t.id, modalidades: t.modalidades, ativo: t.ativo };
      DURACAO_PADRAO[t.id] = t.duracao;
    });
    ATIVIDADES.splice(0, ATIVIDADES.length, ...lista.filter((t) => t.ativo).map((t) => t.id));
    aplicarCoresTipos(lista);
    atualizarTipos();
    return true;
  }
  // Cores: os tipos do app já têm as suas no CSS (validadas no claro, no escuro e em cada estilo); um tipo novo, ou um
  // dos do app com cor escolhida no painel, ganha as mesmas regras aqui, com a cor do tema claro e a do escuro.
  function aplicarCoresTipos(lista) {
    const css = lista.filter((t) => t.cor || !ATIVIDADES_APP.includes(t.id)).map((t) => {
      const c = t.cor || '#6b7280', e = t.corEscura || c, id = t.id;
      return `:root{--${id}:${c}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--${id}:${e}}}:root[data-theme="dark"]{--${id}:${e}}`
        + `.selo.${id}{background:var(--${id})}.evo-${id}{fill:var(--${id})}.seg i.on.${id},.barra-trilho i.${id}{background:var(--${id})}`
        + `html[data-estilo] :is(.seg i.on.${id},.barra-trilho i.${id}){color:var(--${id})}html[data-estilo] .selo.${id}{box-shadow:0 0 8px var(--${id})}`;
    }).join('\n');
    let el = document.getElementById('cores-tipos');
    if (!el) { el = document.createElement('style'); el.id = 'cores-tipos'; document.head.appendChild(el); }
    el.textContent = css;
  }
  try { const g = JSON.parse(localStorage.getItem(CHAVE_TIPOS) || 'null'); if (g) aplicarTiposCheckin(g); } catch (_) {}
  // Modalidade do check-in (ex.: Bike) e o texto curto para as listas: "Bike · 12,5 km".
  const modalidadeDe = (c) => (TIPOS[c.tipo].modalidades || []).find((m) => m.id === c.modalidade) || null;
  function detalheCardio(c) {
    const m = modalidadeDe(c);
    const partes = [m ? m.nome : '', c.km ? `${String(c.km).replace('.', ',')} km` : ''].filter(Boolean);
    return partes.join(' · ');
  }

  const FOCOS = [
    { id: 'todos', label: 'Todos' },
    { id: 'H', label: 'Hipertrofia' },
    { id: 'F', label: 'Força' },
    { id: 'E', label: 'Explosão' },
    { id: 'M', label: 'Mobilidade' },
  ];
  const DIMS = [
    { k: 'H', label: 'Hipertrofia' },
    { k: 'F', label: 'Força' },
    { k: 'E', label: 'Explosão' },
    { k: 'M', label: 'Mobilidade' },
  ];
  const NIVEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  const GRAUS = { alta: 3, media: 2, baixa: 1 };

  // Vídeos de execução (YouTube): nome do exercício → id do vídeo. Exercícios sem entrada aqui não mostram vídeo.
  // A lista fica no banco (videos_exercicios) e chega pelo meus_videos() só para quem o administrador liberou.
  const VIDEOS = {};

  // ---------- Datas ----------
  // Horários são guardados como texto local "AAAA-MM-DDTHH:MM" (comparáveis como texto).
  const pad = (n) => String(n).padStart(2, '0');
  const isoLocal = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const agoraIso = () => isoLocal(new Date());
  const hoje = () => agoraIso().slice(0, 10);
  const deData = (s) => new Date(`${s}T00:00`);
  const somarDias = (s, n) => { const d = deData(s); d.setDate(d.getDate() + n); return isoLocal(d).slice(0, 10); };
  const segundaDe = (s) => somarDias(s, -((deData(s).getDay() + 6) % 7));
  const horaDe = (s) => s.slice(11, 16);
  const minutosEntre = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
  const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtData = (s, opts) => new Intl.DateTimeFormat('pt-BR', opts).format(deData(s));
  const dataLonga = (s) => capitalizar(fmtData(s, { weekday: 'long', day: 'numeric', month: 'long' }));
  const nomeMes = (ano, mes) => new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(ano, mes, 1));
  const fmtNum = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  function fmtDur(min) {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Estado da tela ----------
  const KEY = 'bauer-treino-estado';
  let estado = { treino: '1', foco: 'todos', descAberta: false, dia: null };
  try {
    const salvo = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (salvo) estado = { ...estado, ...salvo };
  } catch (_) {}
  if (!TREINOS[estado.treino]) estado.treino = '1';
  const salvar = () => {
    try {
      const { treino, foco, descAberta, dia } = estado;
      localStorage.setItem(KEY, JSON.stringify({ treino, foco, descAberta, dia }));
    } catch (_) {}
  };
  // Na primeira abertura do dia, a ficha já abre no treino de hoje (chamado depois de carregar a semana da conta).
  function abrirTreinoDoDia() {
    if (estado.dia === hoje()) return;
    const treinoDeHoje = planoDoDia(new Date().getDay()).treino;
    if (treinoDeHoje) estado.treino = treinoDeHoje;
    estado.dia = hoje();
    salvar();
  }

  // ---------- Check-ins ----------
  // checkin = { id, tipo, inicio, fim (null = aberto), semHorario, obs, retroativo,
  //             series (pesos de versões anteriores, hoje ficam em "cargas"), ultimaSerie }
  let checkins = [];
  // Pesos registrados na ficha, independentes do check-in: { data, treino: 't1'|'t2'|'t3', series: { [exercício]: [{ carga }] } }
  let cargas = [];
  const novoId = () => (crypto.randomUUID
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  // ---------- Supabase ----------
  // Lido antes de criar o cliente, que limpa a URL: resultado da volta do login do Google.
  const retornoLogin = (() => {
    const busca = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.slice(1));
    const erro = busca.get('error_description') || hash.get('error_description') || busca.get('error') || hash.get('error') || '';
    return { erro, temCodigo: busca.has('code') };
  })();
  const sb = configurado && window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'pkce' } })
    : null;
  let usuario = null;

  // Foto do check-in (opcional): fica no Supabase Storage, no bucket privado "fotos-checkin",
  // em "<usuário>/<check-in>.jpg"; o check-in guarda só o caminho. Sem a coluna (schema antigo), some.
  const BUCKET_FOTOS = 'fotos-checkin';
  let fotosLigadas = false;
  // Modalidade e km do check-in (Cardio): só com as colunas checkins.modalidade e checkins.km (migração 002).
  let kmLigado = false;
  const paraLinha = (c) => ({
    id: c.id, usuario_id: usuario.id, tipo: c.tipo, inicio: c.inicio, fim: c.fim,
    sem_horario: !!c.semHorario, obs: c.obs || '',
    retroativo: !!c.retroativo, ultima_serie: c.ultimaSerie || null, series: c.series || {},
    ...(fotosLigadas ? { foto: c.foto || '' } : {}),
    ...(kmLigado ? { modalidade: c.modalidade || null, km: c.km || null } : {}),
  });
  // O banco devolve "AAAA-MM-DDTHH:MM:SS"; o app trabalha com "AAAA-MM-DDTHH:MM".
  const minuto = (s) => (s ? s.slice(0, 16) : null);
  const deLinha = (r) => ({
    id: r.id, tipo: r.tipo, inicio: minuto(r.inicio), fim: minuto(r.fim), semHorario: r.sem_horario,
    obs: r.obs || '', retroativo: r.retroativo,
    ultimaSerie: minuto(r.ultima_serie), series: r.series || {}, foto: r.foto || '',
    modalidade: r.modalidade || '', km: r.km != null && Number(r.km) > 0 ? Number(r.km) : null,
  });

  // ---------- Fila de envio e cópia dos dados no aparelho (uso sem internet) ----------
  // Cada gravação vira um pedido guardado no aparelho e enviado na ordem em que aconteceu (ex.: encerrar um check-in
  // antes de abrir outro). Sem internet, os pedidos ficam guardados, mesmo se o app for fechado, e saem sozinhos
  // quando a conexão volta. Cada pedido também entra na cópia dos dados do aparelho, com a qual o app abre sem internet.
  // Pedidos: { t: 'checkin', linha } · { t: 'apagarCheckin', id } · { t: 'carga', linha } · { t: 'apagarObs' }
  //          { t: 'perfil', campos, tolerar }: colunas de "tolerar" que o banco ainda não tem (schema.sql antigo) ficam de fora.
  const ERRO_REDE = /failed to fetch|load failed|networkerror|network ?request failed|fetch failed|network connection was lost|timed? ?out|timeout|aborterror|err_internet_disconnected|sem internet/i;
  const ERRO_SESSAO = /jwt expired|invalid jwt|jwt.*expir|PGRST301/i;
  const textoErro = (e) => String((e && e.message) || e || '');
  const semRede = (e) => navigator.onLine === false || ERRO_REDE.test(textoErro(e));
  const CHAVE_COPIA_USUARIO = 'bauer-copia-usuario';
  const chavePendentes = () => `bauer-pendentes-${usuario.id}`;
  const chaveCopia = () => `bauer-copia-${usuario.id}`;
  let pendentes = [];
  let copiaDados = null; // { p: perfil, c: check-ins, k: cargas (null = sem a tabela), v: vídeos, fotos, em }
  let modoOffline = false; // a tela está com a cópia do aparelho (abriu sem internet)
  let semConexao = false; // a última tentativa de envio parou por falta de internet
  let enviando = false;
  let fila = Promise.resolve(); // a tentativa de envio em andamento (Sair e Excluir conta esperam por ela)

  function lerPendentes() {
    try { const v = JSON.parse(localStorage.getItem(chavePendentes()) || '[]'); pendentes = Array.isArray(v) ? v : []; } catch (_) { pendentes = []; }
  }
  function guardarPendentes() {
    try {
      if (pendentes.length) localStorage.setItem(chavePendentes(), JSON.stringify(pendentes));
      else localStorage.removeItem(chavePendentes());
    } catch (_) {}
  }
  function lerCopia() {
    try {
      const d = JSON.parse(localStorage.getItem(chaveCopia()) || 'null');
      return d && d.p && Array.isArray(d.c) ? d : null;
    } catch (_) { return null; }
  }
  function guardarCopia() {
    if (!copiaDados || !usuario) return;
    try {
      localStorage.setItem(chaveCopia(), JSON.stringify(copiaDados));
      localStorage.setItem(CHAVE_COPIA_USUARIO, JSON.stringify({ id: usuario.id, email: usuario.email || '', user_metadata: usuario.user_metadata || {} }));
    } catch (_) {} // aparelho sem espaço: o app segue, só não abre sem internet com a última mudança
  }
  // Conta guardada para abrir sem internet quando a sessão venceu e não dá para renová-la agora.
  const temCopia = (id) => { try { return !!localStorage.getItem(`bauer-copia-${id}`); } catch (_) { return false; } };
  function usuarioGuardado() {
    try { const u = JSON.parse(localStorage.getItem(CHAVE_COPIA_USUARIO) || 'null'); return u && u.id ? u : null; } catch (_) { return null; }
  }
  // Ao sair ou excluir a conta: nada dos dados da pessoa fica no aparelho.
  function esquecerCopia() {
    try { [chaveCopia(), chavePendentes(), CHAVE_COPIA_USUARIO].forEach((k) => localStorage.removeItem(k)); } catch (_) {}
    pendentes = []; copiaDados = null; modoOffline = false; semConexao = false;
  }
  const mesmaCarga = (a, b) => String(a.data).slice(0, 10) === String(b.data).slice(0, 10) && a.treino === b.treino;
  function aplicarNaCopia(d, op) {
    if (!d) return;
    if (op.t === 'checkin') d.c = d.c.filter((r) => r.id !== op.linha.id).concat(op.linha);
    else if (op.t === 'apagarCheckin') d.c = d.c.filter((r) => r.id !== op.id);
    else if (op.t === 'carga') d.k = (d.k || []).filter((r) => !mesmaCarga(r, op.linha)).concat(op.linha);
    else if (op.t === 'apagarObs') d.c.forEach((r) => { r.obs = ''; });
    else if (op.t === 'perfil') d.p = { ...d.p, ...op.campos };
  }
  async function executarPedido(op) {
    if (op.t === 'checkin') return sb.from('checkins').upsert(op.linha);
    if (op.t === 'apagarCheckin') return sb.from('checkins').delete().eq('id', op.id);
    if (op.t === 'carga') return sb.from('cargas').upsert(op.linha, { onConflict: 'usuario_id,data,treino' });
    if (op.t === 'apagarObs') return sb.from('checkins').update({ obs: '' }).eq('usuario_id', usuario.id);
    // Perfil: coluna tolerada que o banco não tem (citada no erro) ou sem permissão (42501, grant antigo) fica de fora.
    const tolerar = op.tolerar || [];
    let resto = op.campos;
    for (;;) {
      const r = await sb.from('perfis').update(resto).eq('id', usuario.id);
      if (!r.error) return r;
      const presentes = tolerar.filter((c) => c in resto);
      const falta = presentes.find((c) => new RegExp(`\\b${c}\\b`).test(r.error.message || ''))
        || (r.error.code === '42501' ? presentes[presentes.length - 1] : null);
      if (!falta) return r;
      const { [falta]: _, ...sem } = resto;
      if (!Object.keys(sem).length) return { error: null };
      resto = sem;
    }
  }
  // O que a pessoa mudou em cada pedido, para a faixa contar alterações e não pedidos: os pesos de um treino num dia
  // vão num pedido só, mas cada exercício com peso mudado conta; várias edições do mesmo check-in contam uma vez.
  function itensDoPedido(op, anterior) {
    if (op.t === 'checkin') return [`checkin:${op.linha.id}`];
    if (op.t === 'apagarCheckin') return [`checkin:${op.id}`];
    if (op.t !== 'carga') return null;
    const antes = ((copiaDados && copiaDados.k) || []).find((r) => mesmaCarga(r, op.linha));
    const series = (antes && antes.series) || {};
    const mudou = Object.keys(op.linha.series || {})
      .filter((ex) => JSON.stringify(op.linha.series[ex]) !== JSON.stringify(series[ex]))
      .map((ex) => `carga:${op.linha.data}:${op.linha.treino}:${ex}`);
    const itens = [...new Set([...((anterior && anterior.itens) || []), ...mudou])];
    return itens.length ? itens : [`carga:${op.linha.data}:${op.linha.treino}`];
  }
  // Quantas alterações estão guardadas só no aparelho (pedido sem itens, como perfil e semana, conta 1).
  function contarAlteracoes() {
    const itens = new Set();
    let soltos = 0;
    pendentes.forEach((x) => { if (Array.isArray(x.itens) && x.itens.length) x.itens.forEach((i) => itens.add(i)); else soltos++; });
    return itens.size + soltos;
  }
  function enfileirar(pedido) {
    // Cópia própria: a tela continua mexendo nos mesmos objetos (ex.: as séries) depois de pedir o envio.
    const op = JSON.parse(JSON.stringify(pedido));
    // Um check-in ou um registro de pesos com envio ainda pendente: só a versão mais nova vai.
    let anterior = null;
    if (op.t === 'checkin' || op.t === 'apagarCheckin') {
      const id = op.t === 'checkin' ? op.linha.id : op.id;
      pendentes = pendentes.filter((x) => !(x.t === 'checkin' && x.linha.id === id));
    }
    if (op.t === 'carga') {
      anterior = pendentes.find((x) => x.t === 'carga' && mesmaCarga(x.linha, op.linha));
      pendentes = pendentes.filter((x) => x !== anterior);
    }
    const itens = itensDoPedido(op, anterior);
    if (itens) op.itens = itens;
    pendentes.push(op);
    guardarPendentes();
    aplicarNaCopia(copiaDados, op);
    guardarCopia();
    return sincronizar();
  }
  // Envia os pedidos guardados, um por vez. Sem internet (ou com a sessão vencida e sem como renovar), para e tenta de
  // novo quando a conexão volta; o pedido continua guardado. Recusado pelo banco por outro motivo: sai da fila e avisa.
  function sincronizar() {
    if (enviando || !usuario || !sb) return fila;
    enviando = true;
    fila = (async () => {
      const estavaSemConexao = semConexao;
      let renovou = false;
      while (pendentes.length && usuario) {
        const op = pendentes[0];
        let r;
        try { r = await executarPedido(op); } catch (e) { r = { error: e }; }
        const erro = r && r.error;
        if (erro && ERRO_SESSAO.test(textoErro(erro)) && !renovou && !semRede(erro)) {
          renovou = true;
          try { await sb.auth.refreshSession(); } catch (_) {}
          continue;
        }
        if (erro && (semRede(erro) || ERRO_SESSAO.test(textoErro(erro)))) {
          if (!semConexao && !estavaSemConexao) toast('Sem internet: ficou guardado no aparelho e será salvo na sua conta assim que a internet voltar.');
          semConexao = true;
          break;
        }
        pendentes = pendentes.filter((x) => x !== op);
        guardarPendentes();
        semConexao = false;
        if (erro) await falhaAoSalvar(erro);
      }
      enviando = false;
      if (estavaSemConexao && !semConexao && !pendentes.length && usuario) toast('Conexão de volta: suas alterações foram enviadas.');
      atualizarPendentesUI();
    })();
    atualizarPendentesUI();
    return fila;
  }
  const ICONE_SEM_WIFI = '<svg class="pendentes-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 5.17-2.69M19 12.86a10 10 0 0 0-2.01-1.52M2 8.82a15 15 0 0 1 4.18-2.65M22 8.82a15 15 0 0 0-11.29-3.76M2 2l20 20"/></svg>';
  // Faixa no topo enquanto há mudanças guardadas só no aparelho ou a tela está com a cópia (sem internet).
  function atualizarPendentesUI() {
    const el = document.getElementById('pendentes');
    if (!el) return;
    const n = contarAlteracoes();
    const mostrar = !!usuario && !document.body.classList.contains('deslogado')
      && (modoOffline || (n > 0 && (semConexao || navigator.onLine === false)));
    el.hidden = !mostrar;
    document.body.classList.toggle('com-pendentes', mostrar);
    if (!mostrar) return;
    const texto = n
      ? `<b>Sem internet.</b> ${n === 1 ? '1 alteração guardada' : `${n} alterações guardadas`} no aparelho; ${n === 1 ? 'será salva' : 'serão salvas'} na sua conta assim que a internet voltar.`
      : '<b>Sem internet.</b> Mostrando os dados guardados no aparelho; tudo volta a ser salvo na sua conta quando a internet voltar.';
    el.innerHTML = `${ICONE_SEM_WIFI}<span>${texto}</span>`;
    // A faixa pode ocupar duas linhas: a tela desce o quanto ela mede.
    document.body.style.setProperty('--pendentes-h', `${el.offsetHeight}px`);
  }
  // A internet voltou (ou o app voltou para a frente): envia o que ficou guardado e, se a tela estava com a cópia,
  // busca os dados do servidor de novo.
  let voltando = false;
  async function voltouAInternet() {
    if (!usuario || voltando || navigator.onLine === false) return;
    voltando = true;
    try {
      await sincronizar();
      if (modoOffline && !semConexao) {
        await carregarDados();
        if (!modoOffline) renderizarApp();
      }
    } catch (_) {} finally { voltando = false; atualizarPendentesUI(); }
  }
  window.addEventListener('online', voltouAInternet);
  window.addEventListener('offline', atualizarPendentesUI);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (pendentes.length || modoOffline)) voltouAInternet();
  });
  setInterval(() => { if (usuario && (semConexao || modoOffline)) voltouAInternet(); }, 30000);

  async function falhaAoSalvar(erro) {
    // Banco com o schema.sql antigo: sem a coluna perfis.semana ou sem a tabela cargas.
    const msg = (erro && erro.message) || '';
    registrarErro('salvar', msg);
    if (/semana/.test(msg)) toast('Para salvar a semana, rode de novo o supabase/schema.sql no Supabase (veja o README).');
    else if (/estilo/.test(msg)) toast('Para salvar o estilo na conta, rode de novo o supabase/schema.sql no Supabase (veja o README).');
    else if (/emails_resumo/.test(msg)) toast('Para salvar essa opção, rode de novo o supabase/schema.sql no Supabase (veja o README).');
    else if (/sem_peso/.test(msg)) toast('Para salvar essa opção, rode de novo o supabase/schema.sql no Supabase (veja o README).');
    else if (/treinos/.test(msg)) toast('Para salvar seus treinos, rode de novo o supabase/schema.sql no Supabase (veja o README).');
    else if (/cargas/.test(msg)) toast('Para salvar os pesos, rode de novo o supabase/schema.sql no Supabase (veja o README).');
    else toast('Não foi possível salvar. Confira a internet; os dados foram recarregados do servidor.');
    try { await carregarDados(); renderizarApp(); } catch (_) {}
  }
  const salvarCheckin = (c) => enfileirar({ t: 'checkin', linha: paraLinha(c) });
  const excluirCheckinRemoto = (id) => enfileirar({ t: 'apagarCheckin', id });
  const salvarPerfil = (campos, tolerar) => enfileirar({ t: 'perfil', campos, ...(tolerar ? { tolerar } : {}) });
  const salvarCarga = (r) => enfileirar({ t: 'carga', linha: { usuario_id: usuario.id, data: r.data, treino: r.treino, series: r.series } });
  const apagarObservacoes = () => enfileirar({ t: 'apagarObs' });

  // ---------- Eventos de uso (para o dashboard /admin) ----------
  // Vão numa fila e são enviados em lote: a cada 10 s, com 20 eventos ou quando a página some.
  // Silenciosos: sem aviso. Se a internet cair ou a sessão vencer, o lote volta para a fila e sai depois;
  // um evento recusado pelo banco não derruba os outros; só a falta da tabela desliga o envio nesta sessão.
  // Não levam pesos corporais, cargas nem observações.
  let eventosFila = [], eventosTimer = null, eventosLigados = true;
  function registrarEvento(tipo, dados = {}) {
    if (!usuario) return;
    if (!eventosLigados) return;
    eventosFila.push({ usuario_id: usuario.id, tipo, dados: caberNoBanco(dados) });
    if (eventosFila.length >= 20) enviarEventos();
    else if (!eventosTimer) eventosTimer = setTimeout(enviarEventos, 10000);
  }
  // O banco aceita até 2.000 bytes em "dados": textos longos são encurtados antes de entrar na fila.
  const tamanho = (d) => new TextEncoder().encode(JSON.stringify(d)).length;
  function caberNoBanco(dados) {
    let d = dados && typeof dados === 'object' ? dados : {};
    for (const max of [200, 60]) {
      if (tamanho(d) <= 1500) return d;
      d = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, max) : v]));
    }
    if (tamanho(d) <= 1500) return d;
    d = Object.fromEntries(Object.entries(d).filter(([, v]) => v === null || typeof v !== 'object'));
    return tamanho(d) <= 1500 ? d : {};
  }
  const MAX_FILA_EVENTOS = 200;
  const semTabelaEventos = (e) => e.code === '42P01' || e.code === 'PGRST205' || /could not find the table/i.test(e.message || '');
  const eventoRecusado = (e) => ['23514', '23502', '22P02', '22023'].includes(e.code);
  let enviandoEventos = null;
  function voltarParaFila(lote) {
    eventosFila = [...lote, ...eventosFila].slice(-MAX_FILA_EVENTOS);
    if (!eventosTimer) eventosTimer = setTimeout(enviarEventos, 30000);
  }
  function enviarEventos() {
    clearTimeout(eventosTimer);
    eventosTimer = null;
    // Um envio já em andamento: o que entrou na fila depois sai logo em seguida (não espera o próximo ciclo de 10 s).
    if (enviandoEventos) return enviandoEventos.then(() => (eventosFila.length ? enviarEventos() : undefined));
    if (!eventosFila.length || !sb || !eventosLigados) return Promise.resolve();
    const lote = eventosFila;
    eventosFila = [];
    enviandoEventos = sb.from('eventos').insert(lote).then(async ({ error }) => {
      if (!error) return;
      if (semTabelaEventos(error)) { eventosLigados = false; return; }
      // Um evento recusado derruba o lote inteiro: manda um por um e descarta só o que o banco recusar.
      if (eventoRecusado(error)) {
        const falharam = [];
        for (const ev of lote) {
          const r = await sb.from('eventos').insert(ev).then((x) => x.error, () => ({}));
          if (r && !eventoRecusado(r)) falharam.push(ev);
        }
        if (falharam.length) voltarParaFila(falharam);
        return;
      }
      voltarParaFila(lote); // internet caiu ou sessão vencida
    }, () => voltarParaFila(lote)).finally(() => { enviandoEventos = null; });
    return enviandoEventos;
  }
  window.addEventListener('online', () => { if (usuario) enviarEventos(); });
  // Navegador e sistema, para cruzar erros e sessões perdidas com o aparelho.
  function infoAparelho() {
    const ua = navigator.userAgent;
    const navegador = /Instagram/.test(ua) ? 'Instagram' : /FBAN|FBAV/.test(ua) ? 'Facebook'
      : /WhatsApp/.test(ua) ? 'WhatsApp' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
        : /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox'
          : /Safari\//.test(ua) ? 'Safari' : 'Outro';
    const sistema = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android'
      : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Outro';
    const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    return { navegador, sistema, instalado, largura: innerWidth };
  }
  // Erros comuns no dia a dia (internet caindo, conexão ao vivo reconectando, ruído do navegador) não são
  // falhas do app: a pessoa já vê o aviso na hora e o app se recupera sozinho. Só os críticos são registrados.
  const ERRO_COMUM = /failed to fetch|load failed|networkerror|network ?request failed|fetch failed|network connection was lost|timed? ?out|timeout|aborterror|aborted|offline|connection (closed|reset|refused)|jwt expired|refresh token|^script error\.?$|resizeobserver loop/i;
  const ehErroComum = (origem, mensagem) => origem === 'presenca' || ERRO_COMUM.test(String(mensagem || '').trim());
  let errosNaSessao = 0;
  function registrarErro(origem, mensagem) {
    if (errosNaSessao >= 5 || ehErroComum(origem, mensagem)) return;
    errosNaSessao += 1;
    registrarEvento('erro', { origem, mensagem: String(mensagem || '').slice(0, 200), ...infoAparelho() });
  }
  window.addEventListener('error', (e) => registrarErro('js', e.message));
  window.addEventListener('unhandledrejection', (e) => registrarErro('promessa', e.reason && (e.reason.message || e.reason)));
  // Sessão perdida: a pessoa precisou entrar de novo pelo Google sem ter tocado em "Sair da conta".
  const CHAVE_SESSAO = 'bauer-sessao';
  function marcarSessao() {
    try { localStorage.setItem(CHAVE_SESSAO, JSON.stringify({ id: usuario.id, visto: Date.now() })); } catch (_) {}
  }
  // ---------- Atualização automática ----------
  // O site publica versao.json com o commit de cada ambiente (.github/workflows/publicar.yml). Ao voltar para o app
  // (no máximo a cada 2 min), se a versão mudou, o app recarrega sozinho quando for seguro: sem janela aberta, sem
  // campo em edição e sem séries esperando gravar. Senão, tenta de novo ao fechar a janela ou na próxima volta.
  // O check-in em andamento fica no banco e volta depois de recarregar. Sem o arquivo (local, testes), fica desligado.
  let versaoCarregada = null, versaoNova = null, versaoEm = 0, atualizandoApp = false;
  const lerVersao = () => fetch(`versao.json?t=${Date.now()}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && typeof j.versao === 'string' && j.versao ? j.versao : null))
    .catch(() => null);
  function guardarVersaoCarregada() { lerVersao().then((v) => { versaoCarregada = v; versaoEm = Date.now(); }); }
  async function conferirVersao() {
    if (!versaoCarregada || versaoNova || Date.now() - versaoEm < 120000) return atualizarApp();
    versaoEm = Date.now();
    const v = await lerVersao();
    if (v && v !== versaoCarregada) versaoNova = v;
    atualizarApp();
  }
  const podeAtualizar = () => !document.querySelector('dialog[open]') && !timersSeries.size
    && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
  async function atualizarApp() {
    if (!versaoNova || atualizandoApp || !podeAtualizar()) return;
    atualizandoApp = true;
    try { await fila; } catch (_) {}
    registrarEvento('app_atualizado', { de: versaoCarregada.slice(0, 7), para: versaoNova.slice(0, 7) });
    try { await enviarEventos(); } catch (_) {}
    location.reload();
  }
  // Ao fechar qualquer janela (o evento "close" não sobe; pega na captura).
  document.addEventListener('close', () => setTimeout(atualizarApp, 0), true);
  document.addEventListener('visibilitychange', () => {
    if (!usuario) return;
    if (document.visibilityState !== 'hidden') {
      presencaDesde = new Date().toISOString();
      if (escondidoEm && Date.now() - escondidoEm >= NOVA_ABERTURA_MS) mostrarNovidadeSeFaltar();
      escondidoEm = null;
      atualizarCatalogo();
      conferirVersao();
      return marcarPresenca();
    }
    escondidoEm = Date.now();
    marcarSessao();
    enviarEventos();
    clearTimeout(timerPresenca); timerPresenca = null;
    if (canalOnline) canalOnline.untrack().catch(() => {});
  });

  // Presença ao vivo (Supabase Realtime): cada pessoa publica só no próprio canal privado "online:<id>",
  // que só ela e os administradores conseguem ler. Mostra no monitoramento quem está com o app aberto e em que tela.
  let canalOnline = null, presencaDesde = null;
  let erroPresencaAvisado = false, statusPresenca = '', timerPresenca = null;
  // Quedas da conexão ao vivo são comuns (troca de rede, iPhone suspendendo o app) e a biblioteca
  // reconecta sozinha. Só vira erro se, 30 s depois, com a página visível, ainda não reconectou.
  function verificarPresencaDepois(canal, msg) {
    // "transport failure" é a rede do aparelho oscilando; a biblioteca reconecta sozinha. Não registra.
    if (/transport failure/i.test(msg) || document.visibilityState === 'hidden' || timerPresenca) return;
    timerPresenca = setTimeout(() => {
      timerPresenca = null;
      if (canalOnline === canal && document.visibilityState !== 'hidden' && statusPresenca !== 'SUBSCRIBED') {
        avisarErroPresenca(`${msg} (não reconectou em 30 s)`);
      }
    }, 30000);
  }
  function avisarErroPresenca(msg) {
    if (erroPresencaAvisado) return;
    erroPresencaAvisado = true;
    registrarErro('presenca', msg);
  }
  async function ligarPresenca() {
    if (!sb.channel || (canalOnline && canalOnline.topic === `realtime:online:${usuario.id}`)) return;
    desligarPresenca();
    presencaDesde = new Date().toISOString();
    try {
      if (sb.realtime && sb.realtime.setAuth) await sb.realtime.setAuth();
      // O ouvinte e "enabled" ligam a presença no servidor para este canal.
      const canal = sb.channel(`online:${usuario.id}`, { config: { private: true, presence: { key: usuario.id, enabled: true } } });
      canal.on('presence', { event: 'sync' }, () => {});
      canalOnline = canal;
      canal.subscribe((status, err) => {
        statusPresenca = status;
        if (status === 'SUBSCRIBED') { clearTimeout(timerPresenca); timerPresenca = null; return marcarPresenca(); }
        // CLOSED depois de sair da conta é esperado; com o canal ainda em uso, é falha (talvez passageira).
        if (canalOnline === canal) verificarPresencaDepois(canal, `${status}${err ? `: ${err.message || err}` : ''}`);
      });
    } catch (e) { canalOnline = null; avisarErroPresenca(e && e.message); }
  }
  function marcarPresenca() {
    if (!canalOnline || !usuario || document.visibilityState === 'hidden') return;
    canalOnline.track({ tela: telaAtual(), desde: presencaDesde, sistema: infoAparelho().sistema })
      .then((r) => {
        // "error" com o canal conectado é falha real (ex.: permissão); "timed out" costuma ser a rede.
        if (r === 'error' && statusPresenca === 'SUBSCRIBED') avisarErroPresenca(`track: ${r}`);
        else if (r !== 'ok') verificarPresencaDepois(canalOnline, `track: ${r}`);
      }, (e) => verificarPresencaDepois(canalOnline, `track: ${e && e.message}`));
  }
  function desligarPresenca() {
    clearTimeout(timerPresenca); timerPresenca = null;
    if (!canalOnline) return;
    const canal = canalOnline;
    canalOnline = null;
    canal.untrack().catch(() => {}).finally(() => sb.removeChannel(canal));
  }

  // Pesos digitados são enviados depois de uma pausa, para não gravar a cada tecla.
  const timersSeries = new Map();
  function salvarCargaDepois(r) {
    const chave = `${r.data}|${r.treino}`;
    if (timersSeries.has(chave)) clearTimeout(timersSeries.get(chave).timer);
    timersSeries.set(chave, { r, timer: setTimeout(() => { timersSeries.delete(chave); salvarCarga(r); }, 800) });
  }
  function salvarSeriesPendentes() {
    for (const { r, timer } of timersSeries.values()) {
      clearTimeout(timer);
      salvarCarga(r);
    }
    timersSeries.clear();
  }

  // O Supabase devolve no máximo 1.000 linhas por chamada: busca em páginas até a lista acabar,
  // senão quem passa de 1.000 check-ins (ou registros de peso) deixa de ver os mais novos.
  // A ordem precisa ser única (o id ou a chave desempata) para as páginas não repetirem nem pularem linhas.
  const POR_PAGINA = 1000;
  async function todasLinhas(consulta) {
    const linhas = [];
    for (let de = 0; ; de += POR_PAGINA) {
      const r = await consulta().range(de, de + POR_PAGINA - 1);
      if (r.error) return r;
      const pagina = r.data || [];
      linhas.push(...pagina);
      if (pagina.length < POR_PAGINA) return { data: linhas, error: null };
    }
  }

  // Busca os dados da conta no servidor (perfil, check-ins, pesos, vídeos e catálogo). Sem internet, dá erro.
  async function buscarDoServidor() {
    const [p, c, k, v] = await Promise.all([
      sb.from('perfis').select('*').eq('id', usuario.id).maybeSingle(),
      todasLinhas(() => sb.from('checkins').select('*').order('inicio').order('id')),
      todasLinhas(() => sb.from('cargas').select('*').order('data').order('treino')),
      // Vídeos dos exercícios: só vêm para quem o administrador liberou. Sem a função (schema antigo), sem vídeos.
      sb.rpc('meus_videos').then((r) => r, () => ({ error: true })),
      // Catálogo de exercícios e objetivos (antes de montar os treinos da conta).
      carregarCatalogo(),
    ]);
    if (p.error || c.error) throw p.error || c.error;
    // Fotos nos check-ins: liga quando a coluna checkins.foto existe (o schema.sql cria junto o bucket).
    const fotos = (c.data || []).length ? 'foto' in c.data[0] : !(await sb.from('checkins').select('foto').limit(1)).error;
    const km = (c.data || []).length ? 'km' in c.data[0] : !(await sb.from('checkins').select('km').limit(1)).error;
    let linha = p.data;
    if (!linha) {
      // Conta criada antes do schema: cria o perfil com os dados do Google.
      const meta = usuario.user_metadata || {};
      linha = {
        id: usuario.id, nome: meta.full_name || meta.name || '', email: usuario.email || '',
        foto: meta.avatar_url || meta.picture || '', tema: 'auto', dias_jiu: [],
      };
      const { error } = await sb.from('perfis').upsert(linha);
      if (error) throw error;
    }
    // Sem a tabela cargas (schema.sql antigo), k = null: o app abre do mesmo jeito; o aviso aparece ao salvar um peso.
    return { p: linha, c: c.data || [], k: k.error ? null : (k.data || []), v: v.error ? null : (v.data || []), fotos, km, em: new Date().toISOString() };
  }

  // Carrega os dados da conta. Sem internet, abre com a cópia guardada no aparelho (com o que ainda não foi enviado).
  // Com internet, o que ainda está na fila de envio entra por cima do que veio do servidor.
  async function carregarDados() {
    lerPendentes();
    const copia = lerCopia();
    let d;
    try {
      // O aparelho diz que está sem internet: nem tenta (abre na hora com a cópia).
      if (copia && navigator.onLine === false) throw new Error('sem internet');
      // Internet muito ruim, com a cópia no aparelho: depois de 8 s, abre com a cópia em vez de esperar mais.
      d = await (copia
        ? Promise.race([buscarDoServidor(), new Promise((_, nao) => setTimeout(() => nao(new Error('timeout')), 8000))])
        : buscarDoServidor());
      pendentes.forEach((op) => aplicarNaCopia(d, op));
      modoOffline = false;
    } catch (erro) {
      if (!copia || !semRede(erro)) throw erro;
      await carregarCatalogo();
      d = copia;
      modoOffline = true;
    }
    copiaDados = d;
    if (!modoOffline) guardarCopia();
    aplicarDados(d);
    atualizarPendentesUI();
  }

  function aplicarDados(d) {
    const linha = d.p;
    fotosLigadas = !!d.fotos;
    kmLigado = !!d.km;
    const ordemCarga = (a, b) => (String(a.data) + a.treino < String(b.data) + b.treino ? -1 : 1);
    cargas = (d.k || []).map((r) => ({ data: String(r.data).slice(0, 10), treino: r.treino, series: r.series || {} })).sort(ordemCarga);
    for (const nome of Object.keys(VIDEOS)) delete VIDEOS[nome];
    (d.v || []).forEach((r) => { if (r && r.exercicio && /^[\w-]{11}$/.test(r.video_id || '')) VIDEOS[r.exercicio] = r.video_id; });
    perfil = { nome: linha.nome || '', email: usuario.email || linha.email || '', foto: linha.foto || '' };
    // Perfil sem nome (o Google não mandou ao criar a conta, ou o nome foi apagado): usa o nome do Google.
    const nomeGoogle = String((usuario.user_metadata || {}).full_name || (usuario.user_metadata || {}).name || '').trim().slice(0, 120);
    if (!perfil.nome.trim() && nomeGoogle) { perfil.nome = nomeGoogle; salvarPerfil({ nome: nomeGoogle }); }
    const proprios = montarTreinos(linha.treinos);
    treinosDaConta = !!proprios;
    TREINOS = proprios || planoPronto();
    atualizarTipos();
    if (!TREINOS[estado.treino]) estado.treino = Object.keys(TREINOS)[0];
    let ocultaNoAparelho = false;
    try { ocultaNoAparelho = !!localStorage.getItem(chaveNovidade()); } catch (_) {}
    // Acesso por convite: sem a coluna (schema.sql antigo), todo mundo entra como antes.
    acesso = { liberado: linha.liberado !== false, pedidoEm: linha.acesso_pedido_em || null };
    politica = { disponivel: 'politica_versao' in linha, aceita: linha.politica_versao === POLITICA_VERSAO, contaNova: !d.c.length && !cargas.length };
    perfilLinha = linha;
    treinosAnterior = linha.treinos_anterior && linha.treinos_anterior.treinos ? linha.treinos_anterior : null;
    jornada = jornadaPorId(linha.jornada) ? linha.jornada : null;
    novidade = { disponivel: true, vista: !!linha.novidade_oculta || ocultaNoAparelho, contaNova: !d.c.length && !cargas.length };
    let ocultasNoAparelho = [];
    try { ocultasNoAparelho = JSON.parse(localStorage.getItem(chaveNovidades()) || '[]'); } catch (_) {}
    novidadesOcultas = new Set([...(Array.isArray(linha.novidades_ocultas) ? linha.novidades_ocultas : []), ...(Array.isArray(ocultasNoAparelho) ? ocultasNoAparelho : [])]);
    estiloNaConta = 'estilo' in linha;
    const semana = validarSemana(linha.semana);
    semanaDaConta = !!semana;
    config = {
      tema: linha.tema || 'auto',
      estilo: 'estilo' in linha ? (ESTILOS.includes(linha.estilo) ? linha.estilo : 'padrao') : config.estilo,
      semana: semana || validarSemana(semanaDeDiasJiu((linha.dias_jiu || [2, 4]).map(Number))),
      semPeso: new Set(Array.isArray(linha.sem_peso) ? linha.sem_peso : []),
      resumoEmail: linha.emails_resumo !== false,
      temporizador: lerTemporizador(linha.temporizador),
      // Sem a coluna (schema.sql antigo), os campos aparecem como antes.
      saude: 'consentimento_saude' in linha ? linha.consentimento_saude || null : 'sim',
    };
    // Tipos que não existem mais no app (ex.: a Calistenia retirada) ficam de fora, para nada quebrar.
    const ordemCheckin = (a, b) => (a.inicio + a.id < b.inicio + b.id ? -1 : 1);
    checkins = d.c.map(deLinha).filter((x) => TIPOS[x.tipo]).sort(ordemCheckin);
  }

  // No primeiro login neste aparelho, envia para a conta o que já estava salvo só no navegador.
  async function migrarDadosLocais() {
    const marca = `bauer-migrado-${usuario.id}`;
    try { if (localStorage.getItem(marca)) return; } catch (_) { return; }
    let locais = [];
    try { const v = JSON.parse(localStorage.getItem('bauer-checkins-v1') || 'null'); if (Array.isArray(v)) locais = v; } catch (_) {}
    if (!locais.length) locais = migrarLogsAntigos();
    // Só migra para contas ainda vazias, para não sobrescrever o que já veio de outro aparelho.
    if (checkins.length) { try { localStorage.setItem(marca, '1'); } catch (_) {} return; }
    if (locais.length) {
      const novos = locais.map((c) => ({ ...c, id: novoId() }));
      const { error } = await sb.from('checkins').insert(novos.map(paraLinha));
      if (error) throw error;
      checkins = novos;
    }
    const cfg = lerJSON('bauer-config-v1');
    const pf = lerJSON('bauer-perfil-v1');
    const mudancas = {};
    if (['auto', 'claro', 'escuro'].includes(cfg.tema)) mudancas.tema = cfg.tema;
    if (Array.isArray(cfg.diasJiu)) mudancas.dias_jiu = cfg.diasJiu.filter((i) => Number.isInteger(i) && i >= 1 && i <= 6);
    if (pf.nome) mudancas.nome = String(pf.nome).slice(0, 120);
    if (pf.foto) mudancas.foto = pf.foto;
    if (Object.keys(mudancas).length) {
      const { error } = await sb.from('perfis').update(mudancas).eq('id', usuario.id);
      if (error) throw error;
      if (mudancas.tema) config.tema = mudancas.tema;
      if (mudancas.dias_jiu && !semanaDaConta) config.semana = semanaDeDiasJiu(mudancas.dias_jiu);
      if (mudancas.nome) perfil.nome = mudancas.nome;
      if (mudancas.foto) perfil.foto = mudancas.foto;
    }
    try { localStorage.setItem(marca, '1'); } catch (_) {}
  }

  // Converte as cargas salvas antes dos check-ins (por dia e exercício) em check-ins sem horário.
  function migrarLogsAntigos() {
    let antigos = {};
    try { antigos = JSON.parse(localStorage.getItem('bauer-logs-v1') || '{}') || {}; } catch (_) {}
    const porDia = {};
    for (const [chave, datas] of Object.entries(antigos)) {
      const [treino, ...resto] = chave.split(':');
      const nome = resto.join(':');
      if (!TREINOS[treino]) continue;
      for (const [data, series] of Object.entries(datas || {})) {
        const validas = (series || []).map((s) => (s && s.carga != null ? { carga: s.carga } : null));
        if (!validas.some(Boolean)) continue;
        const k = `${data}|${treino}`;
        porDia[k] = porDia[k] || {
          id: novoId(), tipo: `t${treino}`, inicio: `${data}T12:00`, fim: `${data}T13:00`,
          semHorario: true, obs: '', retroativo: true, series: {},
        };
        porDia[k].series[nome] = validas;
      }
    }
    return Object.values(porDia);
  }

  const dataDe = (c) => c.inicio.slice(0, 10);
  const checkinAberto = () => checkins.find((c) => !c.fim) || null;
  const duracaoMin = (c) => (c.semHorario || !c.fim ? null : minutosEntre(c.inicio, c.fim));
  const temCarga = (series) => (series || []).some((s) => s && s.carga != null);
  // Exercício sem peso concluído no dia: guardado nas cargas do dia como [{ feito: true }].
  const temFeito = (series) => (series || []).some((s) => s && s.feito);
  const exercicioFeito = (ex, pesos) => temCarga(pesos[ex.nome]) || (config.semPeso.has(ex.nome) && temFeito(pesos[ex.nome]));
  const porInicio = (a, b) => a.inicio.localeCompare(b.inicio);
  function horarioTexto(c) {
    if (c.semHorario) return 'sem horário registrado';
    if (!c.fim) return `em andamento desde ${horaDe(c.inicio)}`;
    return `das ${horaDe(c.inicio)} às ${horaDe(c.fim)}`;
  }
  function agruparPorData() {
    const m = {};
    for (const c of checkins) (m[dataDe(c)] = m[dataDe(c)] || []).push(c);
    for (const k in m) m[k].sort(porInicio);
    return m;
  }
  const tipoPlanejado = (data) => {
    const d = planoDoDia(deData(data).getDay());
    return d.tipos.find(ehTreino) || d.tipos[0] || 'jiu';
  };

  // Sessão em que as cargas do treino vão: o check-in aberto desse treino ou o último de hoje.
  function sessaoAtual(treino) {
    const tipo = `t${treino}`;
    const a = checkinAberto();
    if (a && a.tipo === tipo) return a;
    return checkins.filter((c) => c.tipo === tipo && c.fim && dataDe(c) === hoje()).sort(porInicio).pop() || null;
  }

  const cargaDoDia = (data, tipo) => cargas.find((r) => r.data === data && r.treino === tipo);
  // Pesos de um treino num dia: os da tabela cargas e, de versões anteriores, os guardados nos check-ins.
  function pesosDoDia(data, tipo) {
    const antigos = Object.assign({}, ...checkins
      .filter((c) => c.tipo === tipo && dataDe(c) === data).sort(porInicio).map((c) => c.series || {}));
    const r = cargaDoDia(data, tipo);
    return r ? { ...antigos, ...r.series } : antigos;
  }
  // Dias com pesos de um treino (tabela cargas e check-ins antigos).
  const datasDoTreino = (tipo) => [...new Set([
    ...cargas.filter((r) => r.treino === tipo).map((r) => r.data),
    ...checkins.filter((c) => c.tipo === tipo).map(dataDe),
  ])];
  // Cargas de um exercício em dias anteriores a `antesDe`, em qualquer treino: em "Meus treinos" o
  // exercício pode mudar de treino e o histórico vai junto. [{ data, series }], do mais recente ao mais antigo.
  const TIPOS_MUSC = ['t1', 't2', 't3', 't4', 't5', 't6'];
  // Pesos de um exercício no dia: pelo nome salvo ou por outro nome do mesmo exercício no catálogo (renomeado).
  function seriesDe(pesos, nome) {
    if (temCarga(pesos[nome])) return pesos[nome];
    const atual = nomeAtual(nome);
    const k = Object.keys(pesos).find((x) => x !== nome && temCarga(pesos[x]) && nomeAtual(x) === atual);
    return k ? pesos[k] : pesos[nome];
  }
  const historicoDe = (nome, antesDe) => TIPOS_MUSC
    .flatMap((t) => datasDoTreino(t).filter((d) => d < antesDe).map((d) => ({ data: d, series: seriesDe(pesosDoDia(d, t), nome) })))
    .filter((r) => temCarga(r.series))
    .sort((a, b) => b.data.localeCompare(a.data));
  // Pesos do dia anterior mais recente com carga no exercício (pré-preenchimento, RF-14).
  function ultimasCargas(nome, antesDe = hoje()) {
    const r = historicoDe(nome, antesDe)[0];
    return r ? r.series : null;
  }

  // Recorde: maior carga de uma série no exercício, só em dias anteriores a `antesDe`.
  const maxDoDia = (series) => Math.max(0, ...(series || []).filter((x) => x && x.carga != null).map((x) => Number(x.carga) || 0));
  function recordeAntes(nome, antesDe) {
    let rec = null;
    for (const { data: d, series } of historicoDe(nome, antesDe)) {
      const kg = maxDoDia(series);
      if (kg > 0 && (!rec || kg > rec.kg || (kg === rec.kg && d < rec.data))) rec = { kg, data: d };
    }
    return rec;
  }
  // Novo recorde no dia: a maior carga do dia supera o recorde anterior (o primeiro registro não conta).
  function recordeNoDia(tipo, nome, data) {
    if (config.semPeso.has(nome)) return null;
    const antes = recordeAntes(nome, data);
    const kg = maxDoDia(pesosDoDia(data, tipo)[nome]);
    return antes && kg > antes.kg ? { kg, antes: antes.kg } : null;
  }

  // Regra 14: check-in esquecido aberto por mais de 3 h é encerrado na hora da última série.
  function encerrarEsquecidos() {
    const a = checkinAberto();
    if (!a || minutosEntre(a.inicio, agoraIso()) < 180) return null;
    const umaHora = isoLocal(new Date(new Date(a.inicio).getTime() + 60 * 60000));
    a.fim = a.ultimaSerie && a.ultimaSerie > a.inicio ? a.ultimaSerie : umaHora;
    salvarCheckin(a);
    return a;
  }

  // ---------- Helpers de interface ----------
  const $ = (id) => document.getElementById(id);
  const exerciciosDoTreino = () => TREINOS[estado.treino].exercicios;

  const CHEVRON = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const ICON_PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const ICON_TROFEU = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>';
  const ICON_CAMERA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  const ICON_LAPIS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  const ICON_CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const ICON_X = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const BOTAO_FECHAR = `<button class="modal-close" type="button" data-fechar aria-label="Fechar">${ICON_X}</button>`;
  const ponteiraHTML = (nivel) =>
    `<span class="ponteira" data-nivel="${GRAUS[nivel]}" aria-hidden="true"><i></i><i></i><i></i></span>`;
  const seloHTML = (tipo, extra = '') =>
    `<span class="selo ${TIPOS[tipo].grupo} ${extra}" aria-hidden="true">${TIPOS[tipo].selo}</span>`;

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('com-acao');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
  }
  // Aviso com um botão (ex.: "Desfazer"), que fica um pouco mais na tela.
  function toastAcao(msg, rotulo, acao, ms = 8000) {
    const t = $('toast');
    t.innerHTML = `<span>${esc(msg)}</span><button class="toast-acao" type="button">${esc(rotulo)}</button>`;
    t.classList.add('com-acao');
    t.querySelector('.toast-acao').addEventListener('click', () => { clearTimeout(toastTimer); t.hidden = true; acao(); }, { once: true });
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // A observação pode revelar dados de saúde (ex.: dor ou lesão): só aparece para quem ligou
  // "Registrar observações" em Você → Privacidade, que vem desligado (consentimento, LGPD).
  function camposSaudeHTML(prefixo, obs, exemplo) {
    if (config.saude !== 'sim') return '';
    return `
      <div class="campo">
        <label for="${prefixo}-obs">Observação <span class="opcional">(opcional)</span></label>
        <textarea id="${prefixo}-obs" placeholder="${exemplo}">${esc(obs)}</textarea>
      </div>`;
  }
