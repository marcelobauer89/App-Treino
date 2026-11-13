// js/voce.js: tela Você: lista de opções, Minha semana, Meus treinos (editor), jornadas prontas e avisos de novidade.
// Parte do app (index.html). Os arquivos de js/ dividem o mesmo escopo global e carregam na ordem do index.html;
// o mapa das seções está em docs/MAPA.md.

  // ---------- Render: Você ----------
  const ICON_PESSOA = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  const CORES_TEMA = { claro: '#f3f4f6', escuro: '#0f1115' };
  const CORES_ESTILO = { neon: '#06080f', brasa: '#0b0706', cyber: '#04090b', ultra: '#0a0512', gelo: '#08111c', violeta: '#4c1d95', miami: '#140a24', lua_de_sangue: '#070a10' };

  function aplicarTema() {
    const raiz = document.documentElement;
    if (config.tema === 'claro') raiz.dataset.theme = 'light';
    else if (config.tema === 'escuro') raiz.dataset.theme = 'dark';
    else delete raiz.dataset.theme;
    const [metaClaro, metaEscuro] = document.querySelectorAll('meta[name="theme-color"]');
    const fixa = CORES_TEMA[config.tema];
    metaClaro.content = fixa || CORES_TEMA.claro;
    metaEscuro.content = fixa || CORES_TEMA.escuro;
    // Estilos neon: sempre escuros, por cima do tema (o Padrão não marca nada e segue o tema).
    if (CORES_ESTILO[config.estilo]) {
      raiz.dataset.estilo = config.estilo;
      metaClaro.content = metaEscuro.content = CORES_ESTILO[config.estilo];
    } else delete raiz.dataset.estilo;
  }

  function iniciais(nome) {
    const p = nome.trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '';
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }

  function renderFoto() {
    const ini = iniciais(perfil.nome);
    const foto = esc(perfil.foto);
    $('voce-avatar').innerHTML = foto ? `<img src="${foto}" alt="" referrerpolicy="no-referrer">` : (ini ? esc(ini) : ICON_PESSOA);
    $('foto-label-texto').textContent = perfil.foto ? 'Trocar foto' : 'Escolher foto';
    $('remover-foto').hidden = !perfil.foto;
    $('nav-voce-icone').innerHTML = foto ? `<img class="nav-foto" src="${foto}" alt="" referrerpolicy="no-referrer">` : ICON_PESSOA;
    $('voce-menu-avatar').innerHTML = $('voce-avatar').innerHTML;
    $('voce-menu-nome').textContent = perfil.nome || 'Seu nome';
    $('voce-menu-email').textContent = perfil.email || '';
  }

  // ---------- Minha semana ----------
  const lista = (nomes) => (nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0]);
  function avisosSemana() {
    const s = config.semana;
    const av = [];
    const todas = s.flat();
    const treinos = Object.keys(TREINOS).map((n) => `t${n}`);
    const faltam = treinos.filter((t) => !todas.includes(t)).map(nomeAtividade);
    if (faltam.length) {
      av.push(`${lista(faltam)} ${faltam.length > 1 ? 'ficaram' : 'ficou'} fora da semana. ${treinosDaConta ? 'Coloque em algum dia para não deixar de fazer.' : 'O plano usa os três treinos.'}`);
    }
    treinos.forEach((t) => {
      const n = todas.filter((x) => x === t).length;
      if (n > 1) av.push(`O ${nomeAtividade(t)} aparece ${n} vezes na semana.`);
    });
    ORDEM_SEMANA.forEach((i) => {
      if (s[i].length === 2) av.push(`${naDia(i)} você terá ${lista(s[i].map(nomeAtividade))}; faça um check-in para cada.`);
    });
    // Regra 5: pernas pesadas na véspera (ou no mesmo dia) do tatame (só com o Treino 3 do plano pronto).
    ORDEM_SEMANA.forEach((i) => {
      if (!s[i].includes('jiu') || !(TREINOS['3'] && TREINOS['3'].objetivo)) return;
      const vespera = (i + 6) % 7;
      if (s[vespera].includes('t3')) av.push(`${naDia(i)} o jiu vem logo depois do Treino 3 (pernas). Se as pernas estiverem pesadas, vá mais leve no rola.`);
      else if (s[i].includes('t3')) av.push(`${naDia(i)} o Treino 3 (pernas) e o jiu caem juntos. Se der, faça o jiu antes.`);
    });
    if (s.every((d) => d.length)) av.push('A semana não tem dia de descanso. Deixe pelo menos um dia vazio para recuperar.');
    return av;
  }

  const ativHTML = (t, dia) => (dia === undefined
    ? `<button class="ativ" type="button" data-arrastar="${t}">${seloHTML(t)}${nomeAtividade(t)}</button>`
    : `<span class="ativ no-dia" data-arrastar="${t}" data-de="${dia}">${seloHTML(t)}${nomeAtividade(t)}<button class="chip-x" type="button" data-remover="${dia}:${t}" aria-label="Tirar ${nomeAtividade(t)} de ${NOMES_DIA[dia]}">${ICON_X}</button></span>`);

  function renderSemanaConfig() {
    const hojeIdx = new Date().getDay();
    $('paleta').innerHTML = ORDEM_TIPOS.map((t) => ativHTML(t)).join('');
    $('dias-cfg').innerHTML = ORDEM_SEMANA.map((i) => `
      <li class="dia-cfg${i === hojeIdx ? ' hoje' : ''}" data-dia="${i}">
        <span class="dia-curto">${CURTOS[i]}</span>
        <div class="dia-slots">${config.semana[i].length ? config.semana[i].map((t) => ativHTML(t, i)).join('') : '<span class="dia-vazio">Descanso</span>'}</div>
        <button class="dia-add" type="button" data-adicionar="${i}" aria-label="Escolher atividades de ${NOMES_DIA[i]}">+</button>
      </li>`).join('');
    $('avisos-semana').innerHTML = avisosSemana().map((a) => `<li class="aviso">${a}</li>`).join('');
    $('semana-padrao').disabled = JSON.stringify(config.semana) === JSON.stringify(semanaPadrao());
  }

  let timerEventoSemana;
  function mudarSemana(fn) {
    const s = copiaSemana(config.semana);
    fn(s);
    config.semana = s;
    semanaDaConta = true;
    salvarPerfil({ semana: s });
    // Um evento por rodada de edição (arrastar várias vezes seguidas conta uma vez).
    clearTimeout(timerEventoSemana);
    timerEventoSemana = setTimeout(() => registrarEvento('semana_alterada'), 3000);
    renderSemanaConfig();
    renderHoje();
    atualizarCheckinUI();
  }
  // Põe a atividade no dia; com o dia cheio, sai a mais antiga. Devolve a que saiu.
  function colocarNoDia(s, dia, t) {
    if (s[dia].includes(t)) return null;
    const saiu = s[dia].length >= 2 ? s[dia].shift() : null;
    s[dia].push(t);
    return saiu;
  }
  function soltarNoDia(t, dia, de) {
    if (de === dia) return;
    if (config.semana[dia].includes(t)) {
      if (de !== undefined) mudarSemana((s) => { s[de] = s[de].filter((x) => x !== t); });
      toast(`${nomeAtividade(t)} já está ${naDia(dia).toLowerCase()}.`);
      return;
    }
    let saiu = null;
    mudarSemana((s) => {
      if (de !== undefined) s[de] = s[de].filter((x) => x !== t);
      saiu = colocarNoDia(s, dia, t);
    });
    if (saiu) toast(`${nomeAtividade(saiu)} saiu ${daDia(dia)}: até 2 atividades por dia.`);
  }

  // Seletor do botão + (também é o caminho sem arrastar, para teclado e leitor de tela).
  const ativDialog = $('ativ-dialog');
  function renderSeletor(dia) {
    const doDia = config.semana[dia];
    $('ativ-body').dataset.dia = dia;
    $('ativ-body').innerHTML = `
      <div class="modal-head"><h3 id="ativ-title">${NOMES_DIA[dia][0].toUpperCase() + NOMES_DIA[dia].slice(1)}</h3>${BOTAO_FECHAR}</div>
      <p class="nota-campo">Escolha até 2 atividades. Com 2 marcadas, a próxima toma o lugar da mais antiga. Nenhuma marcada é descanso.</p>
      <div class="ativ-opcoes">${ORDEM_TIPOS.map((t) => `
        <button class="ativ-opcao" type="button" data-escolher="${t}" aria-pressed="${doDia.includes(t)}">
          ${seloHTML(t, 'grande')}${nomeAtividade(t)}<small>${doDia.includes(t) ? 'No dia' : ''}</small>
        </button>`).join('')}</div>
      <button class="modal-done" type="button" data-fechar>Pronto</button>`;
  }
  ativDialog.addEventListener('click', (e) => {
    if (e.target === ativDialog || e.target.closest('[data-fechar]')) return ativDialog.close();
    const b = e.target.closest('[data-escolher]');
    if (!b) return;
    const dia = Number($('ativ-body').dataset.dia), t = b.dataset.escolher;
    mudarSemana((s) => {
      if (s[dia].includes(t)) s[dia] = s[dia].filter((x) => x !== t);
      else colocarNoDia(s, dia, t);
    });
    renderSeletor(dia);
    $('ativ-body').querySelector(`[data-escolher="${t}"]`).focus();
  });

  $('dias-cfg').addEventListener('click', (e) => {
    const rem = e.target.closest('[data-remover]');
    if (rem) {
      const [dia, t] = rem.dataset.remover.split(':');
      mudarSemana((s) => { s[dia] = s[dia].filter((x) => x !== t); });
      return;
    }
    const add = e.target.closest('[data-adicionar]');
    if (add) { renderSeletor(Number(add.dataset.adicionar)); ativDialog.showModal(); }
  });
  let ignorarClique = false;
  $('paleta').addEventListener('click', (e) => {
    if (!e.target.closest('[data-arrastar]')) return;
    if (ignorarClique) { ignorarClique = false; return; }
    toast('Arraste a atividade até um dia, ou toque em + no dia.');
  });
  $('semana-padrao').addEventListener('click', () => {
    mudarSemana((s) => { s.splice(0, 7, ...semanaPadrao()); });
    toast('A semana voltou ao padrão.');
  });

  // Arrastar com o dedo ou o mouse (pointer events; o HTML5 drag and drop não funciona no toque).
  let arrasto = null;
  const diaSob = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el && el.closest('#dias-cfg .dia-cfg');
  };
  function moverArrasto(x, y) {
    const a = arrasto;
    a.x = x; a.y = y;
    a.fantasma.style.transform = `translate(${x - a.dx}px, ${y - a.dy}px)`;
    const alvo = diaSob(x, y);
    if (alvo !== a.alvo) {
      if (a.alvo) a.alvo.classList.remove('alvo');
      if (alvo) alvo.classList.add('alvo');
      a.alvo = alvo;
    }
    // Rola a tela quando o dedo chega perto do topo ou da navegação inferior.
    const fundo = innerHeight - document.querySelector('.nav').offsetHeight;
    a.vel = y < 70 ? -Math.ceil((70 - y) / 5) : y > fundo - 50 ? Math.ceil((y - fundo + 50) / 5) : 0;
  }
  function rolarArrasto() {
    if (!arrasto || !arrasto.fantasma) return;
    if (arrasto.vel) { scrollBy(0, arrasto.vel); moverArrasto(arrasto.x, arrasto.y); }
    arrasto.raf = requestAnimationFrame(rolarArrasto);
  }
  function iniciarArrasto() {
    const a = arrasto;
    const r = a.el.getBoundingClientRect();
    a.dx = a.x0 - r.left; a.dy = a.y0 - r.top;
    a.fantasma = a.el.cloneNode(true);
    a.fantasma.classList.add('fantasma');
    a.fantasma.removeAttribute('data-arrastar');
    a.fantasma.style.width = `${r.width}px`;
    document.body.appendChild(a.fantasma);
    a.el.classList.add('arrastando');
    document.body.style.cursor = 'grabbing';
    a.raf = requestAnimationFrame(rolarArrasto);
  }
  function terminarArrasto(soltar) {
    const a = arrasto;
    arrasto = null;
    if (!a || !a.fantasma) return;
    cancelAnimationFrame(a.raf);
    a.fantasma.remove();
    a.el.classList.remove('arrastando');
    if (a.alvo) a.alvo.classList.remove('alvo');
    document.body.style.cursor = '';
    ignorarClique = true;
    setTimeout(() => { ignorarClique = false; }, 0);
    if (!soltar) return;
    if (a.alvo) soltarNoDia(a.tipo, Number(a.alvo.dataset.dia), a.de);
    else if (a.de !== undefined) {
      mudarSemana((s) => { s[a.de] = s[a.de].filter((x) => x !== a.tipo); });
      toast(`${nomeAtividade(a.tipo)} saiu ${daDia(a.de)}.`);
    }
  }
  $('tela-voce').addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-arrastar]');
    if (!el || e.target.closest('[data-remover]') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    arrasto = { el, id: e.pointerId, tipo: el.dataset.arrastar, de: el.dataset.de === undefined ? undefined : Number(el.dataset.de), x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, vel: 0 };
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });
  document.addEventListener('pointermove', (e) => {
    if (!arrasto || e.pointerId !== arrasto.id) return;
    if (!arrasto.fantasma) {
      if (Math.hypot(e.clientX - arrasto.x0, e.clientY - arrasto.y0) < 6) return;
      iniciarArrasto();
    }
    e.preventDefault();
    moverArrasto(e.clientX, e.clientY);
  });
  document.addEventListener('pointerup', (e) => { if (arrasto && e.pointerId === arrasto.id) terminarArrasto(true); });
  document.addEventListener('pointercancel', (e) => { if (arrasto && e.pointerId === arrasto.id) terminarArrasto(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && arrasto) terminarArrasto(false); });

  // ---------- Meus treinos (editor) ----------
  const ICON_MAIS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const ICON_VOLTAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  const editorDialog = $('editor-dialog');
  // Rascunho: cópia dos treinos editada até tocar em Salvar. vista: 'treino' | 'escolher'.
  // confirmar: null | 'excluir' | 'plano' | 'sair'.
  let ed = null;
  const ICON_ALCA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
  const ICON_ALCA_TEXTO = ICON_ALCA.replace('<svg ', '<svg width="14" height="14" style="vertical-align:-2px" ');
  // Botão flutuante "Adicionar exercício": encolhe ao rolar a lista para baixo e volta ao subir (como o do check-in).
  let edFabEncolhido = false, edUltimoScroll = 0;
  const copiaTreinos = (t) => Object.fromEntries(Object.entries(t).map(([id, x]) => [id, {
    nome: x.nome, subtitulo: x.subtitulo || '', exercicios: x.exercicios.map((ex) => ({ ...ex })),
  }]));
  const edTreino = () => ed.treinos[ed.sel];
  const edMudou = () => JSON.stringify(treinosParaSalvar(ed.treinos)) !== JSON.stringify(treinosParaSalvar(TREINOS));
  const altas = (ex) => DIMS.filter(({ k }) => ex[k] === 'alta').map(({ label }) => label.toLowerCase());

  function abrirEditor({ doZero = false, daBoasVindas = false } = {}) {
    const treinos = doZero ? { 1: { nome: 'Treino 1', subtitulo: '', exercicios: [] } } : copiaTreinos(TREINOS);
    const sel = doZero ? '1' : (treinos[estado.treino] ? estado.treino : Object.keys(treinos)[0]);
    ed = { treinos, sel, vista: doZero ? 'escolher' : 'treino', busca: '', grupo: 'todos', confirmar: null, erro: '', doZero, daBoasVindas };
    // Vindo das boas-vindas, o app continua escondido até a primeira escolha.
    if (daBoasVindas) document.body.classList.add('bv-ativa');
    edFabEncolhido = false;
    renderEditor();
    if (!editorDialog.open) editorDialog.showModal();
    registrarEvento('editor_treinos', { origem: doZero ? 'do_zero' : telaAtual() });
  }

  function renderEditor() {
    const t = edTreino();
    const ids = Object.keys(ed.treinos);
    if (ed.vista === 'escolher') {
      $('editor-body').innerHTML = `
        <div class="modal-head">
          <div>
            <button class="ed-voltar" type="button" data-ed-vista="treino">${ICON_VOLTAR}${esc(t.nome)}</button>
            <h3 id="editor-title">Adicionar exercícios</h3>
          </div>
          ${BOTAO_FECHAR}
        </div>
        <input class="ed-busca" id="ed-busca" type="search" placeholder="Buscar exercício" autocomplete="off" value="${esc(ed.busca)}" aria-label="Buscar exercício">
        <div class="chips ed-grupos" role="group" aria-label="Filtrar por grupo">
          ${(objetivoDoEditor() ? ['todos', 'objetivo', ...GRUPOS_EX] : ['todos', ...GRUPOS_EX]).map((g) => `<button class="chip${g === 'objetivo' ? ' chip-objetivo' : ''}" type="button" data-ed-grupo="${g}" aria-pressed="${ed.grupo === g}">${g === 'todos' ? 'Todos' : g === 'objetivo' ? `Do meu objetivo (${esc(objetivoDoEditor().nome)})` : rotuloGrupo(g)}</button>`).join('')}
        </div>
        <p class="nota-campo" id="ed-contagem" aria-live="polite"></p>
        <ul class="ed-bib" id="ed-bib"></ul>
        <div class="ed-fixo"><button class="modal-done" type="button" data-ed-vista="treino">Pronto</button></div>`;
      renderBiblioteca();
      return;
    }
    const exs = t.exercicios;
    const confirma = {
      excluir: `<div class="ed-confirma" role="alert"><p>Excluir o ${esc(t.nome)}? Os check-ins e pesos já registrados continuam salvos.</p>
        <div><button class="btn-perigo cheio" type="button" data-ed-excluir-sim>Excluir treino</button><button class="btn-sec" type="button" data-ed-cancelar>Cancelar</button></div></div>`,
      plano: `<div class="ed-confirma" role="alert"><p>Voltar ao plano pronto? Os treinos daqui serão trocados pelos 3 treinos do plano (Costas e bíceps, Peito, tríceps e ombro, e Pernas). Nada muda até você salvar.</p>
        <div><button class="btn" type="button" data-ed-plano-sim>Usar o plano pronto</button><button class="btn-sec" type="button" data-ed-cancelar>Cancelar</button></div></div>`,
      sair: `<div class="ed-confirma" role="alert"><p>Sair sem salvar? As mudanças nos treinos serão perdidas.</p>
        <div><button class="btn-perigo cheio" type="button" data-ed-sair-sim>Sair sem salvar</button><button class="btn-sec" type="button" data-ed-cancelar>Continuar editando</button></div></div>`,
    }[ed.confirmar] || '';
    $('editor-body').innerHTML = `
      <div class="modal-head">
        <div><h3 id="editor-title">Meus treinos</h3><p class="resumo-enc">Até ${MAX_TREINOS} treinos, com até ${MAX_EXERCICIOS} exercícios cada.</p></div>
        ${BOTAO_FECHAR}
      </div>
      <div class="ed-abas" role="group" aria-label="Treinos">
        ${ids.map((id) => `<button class="ed-aba" type="button" data-ed-treino="${id}" aria-pressed="${id === ed.sel}">${seloHTML(`t${id}`)}${esc(ed.treinos[id].nome || `Treino ${id}`)}</button>`).join('')}
        <button class="ed-aba novo" type="button" data-ed-novo${ids.length >= MAX_TREINOS ? ' disabled' : ''}>+ Novo treino</button>
      </div>
      <div class="linha2">
        <div class="campo"><label for="ed-nome">Nome</label><input id="ed-nome" maxlength="40" value="${esc(t.nome)}" placeholder="Treino ${ed.sel}" autocomplete="off"></div>
        <div class="campo"><label for="ed-sub">Foco <span class="opcional">(opcional)</span></label><input id="ed-sub" maxlength="60" value="${esc(t.subtitulo)}" placeholder="Ex.: Peito e tríceps" autocomplete="off"></div>
      </div>
      <div class="log-head"><h4>Exercícios (${exs.length})</h4>${exs.length > 1 ? `<span class="log-hint" id="ed-dica-ordem">Segure ${ICON_ALCA_TEXTO} e arraste para mudar a ordem</span>` : ''}</div>
      <p class="sr-only" id="ed-anuncio" aria-live="polite"></p>
      ${exs.length ? `<ol class="ed-exs">${exs.map((ex, i) => `
        <li class="ed-ex" data-ed-pos="${i}">
          <button class="ed-alca" type="button" data-ed-alca="${i}" aria-label="Mover ${esc(nomeDe(ex))}, posição ${i + 1} de ${exs.length}. Arraste, ou use as setas do teclado." aria-describedby="ed-dica-ordem">${ICON_ALCA}</button>
          <span class="ed-ex-nome"><b><span class="ed-num">${pad(i + 1)}</span>${esc(nomeDe(ex))}</b><small>${esc(ex.grupo ? rotuloGrupo(ex.grupo) : 'Exercício')}${videoDe(ex.nome) ? ' · com vídeo' : ''}</small></span>
          <button class="ed-icone" type="button" data-ed-remover="${i}" aria-label="Tirar ${esc(nomeDe(ex))} do treino">${ICON_X}</button>
          <div class="ed-ex-campos">
            <label>Séries<input type="text" value="${esc(ex.dose)}" maxlength="30" data-ed-dose="${i}" aria-label="${esc(nomeDe(ex))}: séries e repetições"></label>
            <label>PSE<select data-ed-pse="${i}" aria-label="${esc(nomeDe(ex))}: PSE">${[4, 5, 6, 7, 8, 9, 10].map((n) => `<option${n === ex.pse ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
          </div>
        </li>`).join('')}</ol>`
        : '<p class="ed-vazio">Nenhum exercício ainda. Toque em Adicionar exercício para escolher na biblioteca.</p>'}
      ${confirma}
      <div class="ed-rodape">
        ${ids.length > 1 ? '<button class="btn-perigo" type="button" data-ed-excluir>Excluir este treino</button>' : ''}
        ${mesmoQuePadrao(ed.treinos) ? '' : '<button class="btn-sec" type="button" data-ed-plano>Voltar ao plano pronto</button>'}
      </div>
      <div class="ed-fixo">
        <button class="fab ed-fab${edFabEncolhido ? ' encolhido' : ''}" type="button" data-ed-vista="escolher"
          ${exs.length >= MAX_EXERCICIOS ? `disabled aria-label="Adicionar exercício: o treino já tem ${MAX_EXERCICIOS}, o máximo"` : 'aria-label="Adicionar exercício"'}>
          ${ICON_MAIS}<span class="fab-txt">Adicionar exercício</span>
        </button>
        <p class="form-erro" id="ed-erro" role="alert"${ed.erro ? '' : ' hidden'}>${esc(ed.erro)}</p>
        <button class="modal-done" type="button" data-ed-salvar>Salvar treinos</button>
      </div>`;
  }

  const semAcento = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function renderBiblioteca() {
    const t = edTreino();
    const busca = semAcento(ed.busca.trim());
    // A busca vale também para os outros nomes do exercício (ex.: "cadeira" acha a Elevação pélvica unilateral).
    // E palavras do grupo: "abdominal", "abdômen" ou "barriga" mostram todo o Core e abdômen (a partir de 3 letras).
    const doGrupo = (ex) => busca.length >= 3 && (BUSCA_GRUPO[ex.grupo] || []).some((p) => p.startsWith(busca));
    const achou = (ex) => !busca || doGrupo(ex) || [ex.nome, ...ex.variacoes].some((n) => semAcento(n).includes(busca));
    const obj = objetivoDoEditor();
    const doFiltro = (ex) => ed.grupo === 'todos' || (ed.grupo === 'objetivo' ? !!obj && (ex.objetivos || []).includes(obj.id) : ex.grupo === ed.grupo);
    const itens = BIBLIOTECA.filter((ex) => doFiltro(ex) && achou(ex));
    const noTreino = new Set(t.exercicios.map((ex) => nomeAtual(ex.nome)));
    $('ed-contagem').textContent = `${t.exercicios.length} de ${MAX_EXERCICIOS} no ${t.nome || `Treino ${ed.sel}`} · ${itens.length} ${itens.length === 1 ? 'exercício' : 'exercícios'} na lista`;
    $('ed-bib').innerHTML = itens.length ? itens.map((ex) => {
      const dentro = noTreino.has(ex.nome);
      const destaque = altas(ex);
      return `
      <li><button class="ed-bib-item" type="button" data-ed-add="${esc(ex.nome)}" aria-pressed="${dentro}">
        <b>${esc(ex.nome)}</b>
        <small>${esc(rotuloGrupo(ex.grupo))} · ${esc(ex.dose)} · PSE ${ex.pse}${destaque.length ? ` · alta ${lista(destaque)}` : ''}${videoDe(ex.nome) ? ' · vídeo' : ''}</small>
        ${ex.variacoes.length ? `<small class="ed-tambem">Também: ${esc(ex.variacoes.join(', '))}</small>` : ''}
        <span class="ed-marca" aria-hidden="true">${dentro ? ICON_CHECK : ICON_MAIS}</span>
      </button></li>`;
    }).join('') : '<li class="ed-vazio">Nenhum exercício com esse nome. Tente outra palavra ou outro grupo.</li>';
  }

  function salvarEditor() {
    const vazio = Object.entries(ed.treinos).find(([, t]) => !t.exercicios.length);
    if (vazio) {
      ed.sel = vazio[0];
      ed.erro = `O ${vazio[1].nome || `Treino ${vazio[0]}`} está sem exercícios. Adicione pelo menos um ou exclua o treino.`;
      return renderEditor();
    }
    Object.entries(ed.treinos).forEach(([id, t]) => { t.nome = limpar(t.nome, 40) || `Treino ${id}`; t.subtitulo = limpar(t.subtitulo, 60); });
    // Mudou algo de verdade (e não veio das boas-vindas)? Então os treinos se "remontam" na animação antes do aviso.
    const animar = !ed.daBoasVindas && edMudou();
    const valor = mesmoQuePadrao(ed.treinos) ? null : treinosParaSalvar(ed.treinos);
    const antes = Object.keys(TREINOS);
    // Cópia do que existia antes de salvar, para Desfazer agora ou restaurar depois.
    treinosAnterior = fotoDosTreinos();
    TREINOS = montarTreinos(valor) || planoPronto();
    treinosDaConta = !!valor;
    atualizarTipos();
    // Treinos iguais aos de uma jornada voltam a ser ela; senão a jornada continua, agora personalizada.
    const igual = JORNADAS.find(ehDaJornada);
    if (igual) jornada = igual.id;
    const campos = { treinos: valor, treinos_anterior: treinosAnterior, jornada };
    // Treino excluído sai da semana; treino novo entra pelo Minha semana.
    const semana = validarSemana(config.semana);
    const saiuDaSemana = JSON.stringify(semana) !== JSON.stringify(config.semana);
    if (saiuDaSemana) { config.semana = semana; campos.semana = semana; semanaDaConta = true; }
    salvarTreinosNoBanco(campos);
    const novos = Object.keys(TREINOS).filter((id) => !antes.includes(id));
    if (!TREINOS[estado.treino]) estado.treino = Object.keys(TREINOS)[0];
    salvar();
    registrarEvento('treinos_salvos', {
      treinos: Object.keys(TREINOS).length, exercicios: Object.values(TREINOS).reduce((n, t) => n + t.exercicios.length, 0), plano_pronto: !valor,
    });
    if (ed.daBoasVindas) { gravarNovidade('montar', true); document.body.classList.remove('bv-ativa'); }
    ed = null;
    editorDialog.close();
    renderHoje();
    renderTudo();
    atualizarCheckinUI();
    if (telaAtual() === 'voce') renderConfig();
    const fora = Object.keys(TREINOS).filter((id) => !config.semana.flat().includes(`t${id}`));
    const avisar = () => toastAcao(saiuDaSemana ? 'Treinos salvos. O treino excluído saiu da sua semana.'
      : novos.length || fora.length ? 'Treinos salvos. Coloque os treinos na semana em Você → Minha semana.'
        : 'Treinos salvos.', 'Desfazer', () => restaurarAnterior('desfazer'));
    if (!animar) return avisar();
    animarMontagem({ titulo: 'Atualizando seus treinos', inicio: 'Salvando suas mudanças…', fimTitulo: 'Treinos atualizados!',
      aoTerminar: () => { fecharJornadas('editor'); avisar(); } });
  }

  const fotoDosTreinos = () => ({ treinos: treinosParaSalvar(TREINOS), semana: copiaSemana(config.semana), em: new Date().toISOString(), jornada });
  // Num banco sem as colunas treinos_anterior ou jornada (schema.sql antigo), grava sem elas: salvar nunca trava por causa delas.
  function salvarTreinosNoBanco(campos) {
    // Coluna que ainda não existe (citada no erro) ou sem permissão para gravá-la (42501, grant antigo): grava o resto.
    salvarPerfil(campos, ['treinos_anterior', 'jornada']);
  }
  // Volta para a versão anterior (treinos e semana). A versão de agora vira a anterior, então dá para desfazer de novo.
  function restaurarAnterior(origem) {
    const foto = treinosAnterior;
    if (!foto) return;
    treinosAnterior = fotoDosTreinos();
    const valor = mesmoQuePadrao(foto.treinos) ? null : montarTreinos(foto.treinos) && foto.treinos;
    TREINOS = montarTreinos(valor) || planoPronto();
    treinosDaConta = !!valor;
    jornada = jornadaPorId(foto.jornada) ? foto.jornada : null;
    atualizarTipos();
    config.semana = validarSemana(foto.semana) || validarSemana(config.semana);
    semanaDaConta = true;
    if (!TREINOS[estado.treino]) estado.treino = Object.keys(TREINOS)[0];
    salvar();
    salvarTreinosNoBanco({ treinos: valor, semana: config.semana, treinos_anterior: treinosAnterior, jornada });
    registrarEvento('treinos_desfeitos', { origem });
    restaurarConfirmando = false;
    renderHoje();
    renderTudo();
    atualizarCheckinUI();
    if (telaAtual() === 'voce') renderConfig();
    toast('Treinos restaurados.');
  }

  function fecharEditor() {
    if (ed && ed.confirmar !== 'sair' && edMudou()) { ed.confirmar = 'sair'; ed.vista = 'treino'; renderEditor(); editorDialog.querySelector('[data-ed-sair-sim]').focus(); return; }
    // Veio de "Montar do zero" nas boas-vindas e saiu sem salvar: volta para a escolha do objetivo.
    const voltarBV = ed && ed.daBoasVindas;
    ed = null;
    editorDialog.close();
    document.body.classList.remove('bv-ativa');
    if (voltarBV) abrirJornadas('boas-vindas', 'objetivo');
  }

  editorDialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    // Esc durante o arrasto só cancela o arrasto.
    if (arrastoEx) return terminarArrastoEx(false);
    fecharEditor();
  });
  // ---------- Mudar a ordem dos exercícios arrastando a alça ----------
  function moverExercicio(de, para) {
    const exs = edTreino().exercicios;
    if (de === para || para < 0 || para >= exs.length) return false;
    const [ex] = exs.splice(de, 1);
    exs.splice(para, 0, ex);
    renderEditor();
    const alca = $('editor-body').querySelector(`[data-ed-alca="${para}"]`);
    if (alca) alca.focus({ preventScroll: true });
    $('ed-anuncio').textContent = `${nomeDe(ex)} na posição ${para + 1} de ${exs.length}.`;
    return true;
  }
  let arrastoEx = null;
  function posicaoAlvo(a) {
    // Centro do cartão arrastado comparado ao meio dos outros cartões (posições guardadas no começo).
    const centro = a.topos[a.de] + a.dy + a.alturas[a.de] / 2;
    let alvo = 0;
    a.topos.forEach((t, j) => { if (j !== a.de && t + a.alturas[j] / 2 < centro) alvo += 1; });
    return alvo;
  }
  function moverArrastoEx() {
    const a = arrastoEx;
    a.dy = a.y - a.y0 + (editorDialog.scrollTop - a.scroll0);
    a.alvo = posicaoAlvo(a);
    const passo = a.alturas[a.de] + a.vao;
    a.itens.forEach((li, j) => {
      if (j === a.de) li.style.transform = `translateY(${a.dy}px)`;
      else if (j > a.de && j <= a.alvo) li.style.transform = `translateY(${-passo}px)`;
      else if (j < a.de && j >= a.alvo) li.style.transform = `translateY(${passo}px)`;
      else li.style.transform = '';
    });
  }
  function rolarArrastoEx() {
    if (!arrastoEx || !arrastoEx.ativo) return;
    const r = editorDialog.getBoundingClientRect();
    const fundo = r.bottom - ($('editor-body').querySelector('.ed-fixo') || { offsetHeight: 0 }).offsetHeight;
    const y = arrastoEx.y;
    const vel = y < r.top + 60 ? -Math.ceil((r.top + 60 - y) / 4) : y > fundo - 60 ? Math.ceil((y - fundo + 60) / 4) : 0;
    if (vel) { editorDialog.scrollTop += vel; moverArrastoEx(); }
    arrastoEx.raf = requestAnimationFrame(rolarArrastoEx);
  }
  function terminarArrastoEx(soltar) {
    const a = arrastoEx;
    arrastoEx = null;
    if (!a || !a.ativo) return;
    cancelAnimationFrame(a.raf);
    document.body.classList.remove('arrastando-ex');
    if (soltar && a.alvo !== a.de) return moverExercicio(a.de, a.alvo);
    renderEditor();
  }
  editorDialog.addEventListener('pointerdown', (e) => {
    const alca = e.target.closest('[data-ed-alca]');
    if (!alca || !ed || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    arrastoEx = { de: Number(alca.dataset.edAlca), id: e.pointerId, y0: e.clientY, y: e.clientY, ativo: false };
    try { alca.setPointerCapture(e.pointerId); } catch (_) {}
  });
  editorDialog.addEventListener('pointermove', (e) => {
    const a = arrastoEx;
    if (!a || e.pointerId !== a.id) return;
    a.y = e.clientY;
    if (!a.ativo) {
      if (Math.abs(a.y - a.y0) < 4) return;
      const lista = $('editor-body').querySelector('.ed-exs');
      a.itens = [...lista.querySelectorAll('.ed-ex')];
      a.topos = a.itens.map((li) => li.getBoundingClientRect().top + editorDialog.scrollTop);
      a.alturas = a.itens.map((li) => li.offsetHeight);
      a.vao = a.itens.length > 1 ? Math.abs(a.topos[1] - a.topos[0]) - a.alturas[0] : 8;
      a.scroll0 = editorDialog.scrollTop;
      a.ativo = true;
      lista.classList.add('arrastando');
      a.itens[a.de].classList.add('ed-arrastando');
      document.body.classList.add('arrastando-ex');
      a.raf = requestAnimationFrame(rolarArrastoEx);
    }
    e.preventDefault();
    moverArrastoEx();
  });
  editorDialog.addEventListener('pointerup', (e) => { if (arrastoEx && e.pointerId === arrastoEx.id) terminarArrastoEx(true); });
  editorDialog.addEventListener('pointercancel', (e) => { if (arrastoEx && e.pointerId === arrastoEx.id) terminarArrastoEx(false); });
  editorDialog.addEventListener('keydown', (e) => {
    const alca = e.target.closest && e.target.closest('[data-ed-alca]');
    if (!alca || !ed || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const de = Number(alca.dataset.edAlca);
    moverExercicio(de, de + (e.key === 'ArrowUp' ? -1 : 1));
  });

  editorDialog.addEventListener('scroll', () => {
    const y = editorDialog.scrollTop;
    if (Math.abs(y - edUltimoScroll) < 8) return;
    edFabEncolhido = y > edUltimoScroll && y > 80;
    const fab = editorDialog.querySelector('.ed-fab');
    if (fab) fab.classList.toggle('encolhido', edFabEncolhido);
    edUltimoScroll = y;
  }, { passive: true });
  editorDialog.addEventListener('click', (e) => {
    if (!ed) return;
    if (e.target === editorDialog || e.target.closest('[data-fechar]')) return fecharEditor();
    const alvo = (sel) => e.target.closest(sel);
    const t = edTreino();
    let b;
    if ((b = alvo('[data-ed-treino]'))) { ed.sel = b.dataset.edTreino; ed.confirmar = null; ed.erro = ''; edFabEncolhido = false; return renderEditor(); }
    if (alvo('[data-ed-novo]')) {
      const id = Array.from({ length: MAX_TREINOS }, (_, i) => String(i + 1)).find((n) => !ed.treinos[n]);
      if (!id) return;
      ed.treinos[id] = { nome: `Treino ${id}`, subtitulo: '', exercicios: [] };
      // Mantém a ordem numérica das abas.
      ed.treinos = Object.fromEntries(Object.entries(ed.treinos).sort(([a], [b2]) => a - b2));
      Object.assign(ed, { sel: id, vista: 'escolher', busca: '', grupo: 'todos', confirmar: null, erro: '' });
      return renderEditor();
    }
    if ((b = alvo('[data-ed-vista]'))) {
      ed.vista = b.dataset.edVista; ed.confirmar = null; ed.erro = '';
      renderEditor();
      if (ed.vista === 'escolher') $('editor-body').scrollTop = 0;
      return;
    }
    if ((b = alvo('[data-ed-grupo]'))) { ed.grupo = b.dataset.edGrupo; return renderEditor(); }
    if ((b = alvo('[data-ed-add]'))) {
      const nome = b.dataset.edAdd;
      const k = t.exercicios.findIndex((ex) => nomeAtual(ex.nome) === nome);
      if (k >= 0) t.exercicios.splice(k, 1);
      else if (t.exercicios.length >= MAX_EXERCICIOS) return toast(`Cada treino tem até ${MAX_EXERCICIOS} exercícios.`);
      else t.exercicios.push({ ...exDaBiblioteca(nome) });
      ed.erro = '';
      renderBiblioteca();
      return;
    }
    if ((b = alvo('[data-ed-remover]'))) { t.exercicios.splice(Number(b.dataset.edRemover), 1); return renderEditor(); }
    if (alvo('[data-ed-excluir]')) { ed.confirmar = 'excluir'; return renderEditor(); }
    if (alvo('[data-ed-excluir-sim]')) {
      delete ed.treinos[ed.sel];
      Object.assign(ed, { sel: Object.keys(ed.treinos)[0], confirmar: null, erro: '' });
      return renderEditor();
    }
    if (alvo('[data-ed-plano]')) { ed.confirmar = 'plano'; return renderEditor(); }
    if (alvo('[data-ed-plano-sim]')) {
      Object.assign(ed, { treinos: copiaTreinos(PLANO_PADRAO), sel: '1', confirmar: null, erro: '' });
      return renderEditor();
    }
    if (alvo('[data-ed-sair-sim]')) { ed.confirmar = 'sair'; return fecharEditor(); }
    if (alvo('[data-ed-cancelar]')) { ed.confirmar = null; return renderEditor(); }
    if (alvo('[data-ed-salvar]')) return salvarEditor();
  });
  editorDialog.addEventListener('input', (e) => {
    if (!ed) return;
    const t = edTreino();
    if (e.target.id === 'ed-busca') { ed.busca = e.target.value; return renderBiblioteca(); }
    if (e.target.id === 'ed-nome') {
      t.nome = e.target.value;
      const aba = $('editor-body').querySelector(`[data-ed-treino="${ed.sel}"]`);
      if (aba) aba.lastChild.textContent = t.nome || `Treino ${ed.sel}`;
      return;
    }
    if (e.target.id === 'ed-sub') { t.subtitulo = e.target.value; return; }
    if (e.target.dataset.edDose) t.exercicios[Number(e.target.dataset.edDose)].dose = e.target.value;
  });
  editorDialog.addEventListener('change', (e) => {
    if (!ed || !e.target.dataset.edPse) return;
    edTreino().exercicios[Number(e.target.dataset.edPse)].pse = Number(e.target.value);
  });

  // Resumo dos treinos em Você.
  function renderMeusTreinos() {
    const j = jornadaAtual();
    $('meus-treinos-nota').textContent = j
      ? (ehDaJornada(j) ? `Seu objetivo é ${j.nome}. Mude exercícios, séries, PSE e a ordem quando quiser.`
        : `Seu objetivo é ${j.nome}, com os treinos personalizados por você. Mude o que quiser ou mude o objetivo.`)
      : treinosDaConta
        ? 'Você está usando os treinos que montou. Mude exercícios, séries, PSE e a ordem quando quiser.'
        : 'Você está usando o plano pronto. Monte os seus treinos com os exercícios da biblioteca.';
    $('meus-treinos').innerHTML = Object.entries(TREINOS).map(([id, t]) => `
      <li>${seloHTML(`t${id}`)}<span><b>${t.nome}</b> <small>${t.subtitulo ? `${t.subtitulo} · ` : ''}${qtdExercicios(t.exercicios.length)}</small></span></li>`).join('');
    renderTreinosAnterior();
  }
  $('editar-treinos').addEventListener('click', () => abrirEditor());
  $('trocar-jornada').addEventListener('click', () => abrirJornadas('trocar'));
  let restaurarConfirmando = false;
  function renderTreinosAnterior() {
    const el = $('treinos-anterior');
    if (!treinosAnterior) { el.innerHTML = ''; return; }
    const local = treinosAnterior.em ? isoLocal(new Date(treinosAnterior.em)) : '';
    const quando = local ? ` (salva em ${fmtData(local.slice(0, 10), { day: '2-digit', month: '2-digit' })} às ${horaDe(local)})` : '';
    const nomes = Object.values(treinosAnterior.treinos).map((t) => t.nome);
    el.innerHTML = restaurarConfirmando ? `
      <div class="ed-confirma anterior-confirma" role="alert">
        <p>Voltar para a versão anterior${quando}? Ela tem ${lista(nomes)}. Os treinos de agora ficam guardados como versão anterior.</p>
        <div><button class="btn" type="button" data-anterior-sim>Restaurar</button><button class="btn-sec" type="button" data-anterior-nao>Cancelar</button></div>
      </div>` : `<button class="btn-sec" type="button" data-anterior>Restaurar versão anterior${quando}</button>`;
  }
  $('treinos-anterior').addEventListener('click', (e) => {
    if (e.target.closest('[data-anterior]')) { restaurarConfirmando = true; renderTreinosAnterior(); return; }
    if (e.target.closest('[data-anterior-nao]')) { restaurarConfirmando = false; renderTreinosAnterior(); return; }
    if (e.target.closest('[data-anterior-sim]')) restaurarAnterior('versao_anterior');
  });

  // ---------- Jornadas prontas ----------
  // Boas-vindas (conta nova com o plano pronto) e "Mudar meu objetivo" em Meus treinos. Escolher grava os treinos
  // e a semana sugerida; a versão de antes fica em treinos_anterior (Desfazer). Treinos de quem já usa só mudam assim.
  const jornadaDialog = $('jornada-dialog');
  const jornadaAtual = () => jornadaPorId(jornada);
  const ehDaJornada = (j) => JSON.stringify(treinosParaSalvar(TREINOS)) === JSON.stringify(treinosParaSalvar(j.treinos));
  // jd: { modo: 'boas-vindas' | 'trocar', aberta: id da jornada com os treinos à mostra, confirmar: id,
  //       passo e comDados (só nas boas-vindas) }.
  // Boas-vindas da conta nova, sem fechar: 'bemvindo' (o que o app faz; não grava nada) → 'dados' (privacidade, só se
  // a política ainda não foi aceita) → 'objetivo'. A privacidade vem antes de qualquer escolha ser gravada (LGPD).
  let jd = null;
  // Só no ambiente de desenvolvimento: /dev/?boas-vindas abre as boas-vindas completas em qualquer conta, para testar.
  let bvTeste = false;
  const passosBV = () => ['bemvindo', ...(jd.comDados ? ['dados'] : []), 'objetivo'];
  function abrirJornadas(modo, passo) {
    const boasVindas = modo === 'boas-vindas';
    jd = { modo, aberta: null, confirmar: null, passo: boasVindas ? passo || 'bemvindo' : null, comDados: boasVindas && (bvTeste || (politica.disponivel && !politica.aceita)) };
    // Boas-vindas em tela cheia, com fundo sólido: quem chega pela primeira vez não vê treinos que ainda não escolheu.
    jornadaDialog.classList.toggle('bv-tela', boasVindas);
    document.body.classList.toggle('bv-ativa', boasVindas);
    renderJornadas();
    if (!jornadaDialog.open) jornadaDialog.showModal();
    if (!boasVindas || jd.passo === 'objetivo') registrarEvento('jornadas_abertas', { origem: modo });
    if (boasVindas) { const t = $('jornada-title'); if (t) t.focus(); }
  }
  function irParaPasso(passo) {
    jd.passo = passo;
    jd.aberta = null;
    renderJornadas();
    if (passo === 'objetivo') registrarEvento('jornadas_abertas', { origem: jd.modo });
    $('jornada-title').focus();
  }
  // "Etapa X de N" no topo, ao lado da etiqueta (só ali, para não repetir a etapa em dois lugares).
  function etapaBV() {
    const passos = passosBV();
    return `<span class="bv-etapa">Etapa ${passos.indexOf(jd.passo) + 1} de ${passos.length}</span>`;
  }
  // Cabeçalho das boas-vindas, fixo ao rolar: a etiqueta e, abaixo, o título com "Etapa X de N" à direita.
  function cabecaBV(selo, titulo) {
    return `
      <div class="bv-cabeca">
        <span class="novidade-selo">${selo}</span>
        <div class="bv-titulo"><h3 id="jornada-title" tabindex="-1">${titulo}</h3>${etapaBV()}</div>
      </div>`;
  }
  // Rodapé fixo ao rolar: Voltar à esquerda e o botão principal à direita (na etapa do objetivo, só o Voltar).
  function rodapeBV(botao = '') {
    const passos = passosBV();
    const anterior = passos[passos.indexOf(jd.passo) - 1];
    const voltar = anterior ? `<button class="bv-voltar" type="button" data-jd-voltar="${anterior}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Voltar</button>` : '';
    return `<div class="bv-rodape">${voltar}${botao}</div>`;
  }
  function renderPassoBV() {
    const item = (txt) => `<li>${ICON_CHECK}<span>${txt}</span></li>`;
    if (jd.passo === 'bemvindo') {
      return `
      ${cabecaBV('Boas-vindas', 'Bem-vindo ao Gestão de Treinos')}
      <p class="resumo-enc">Seu treino de Jiu Jitsu e academia num lugar só.</p>
      <ul class="novidade-lista">
        ${item('<b>Treino do dia</b>: a ficha de hoje, com as cargas de cada série')}
        ${item('<b>Check-in</b> de cada treino: musculação, Jiu Jitsu, muay thai, surf, futebol, futvôlei e cardio')}
        ${item('<b>Dashboard</b> com o calendário e o histórico dos seus treinos')}
        ${item('<b>Temporizador de descanso</b> entre as séries')}
        ${item('<b>Você</b>: treinos, semana, aparência e privacidade do seu jeito')}
      </ul>
      ${rodapeBV('<button class="modal-done" type="button" data-jd-comecar>Começar</button>')}`;
    }
    if (jd.passo === 'dados') {
      return `
      ${cabecaBV('Privacidade', 'Seus dados')}
      <p class="resumo-enc">Antes de escolher seus treinos, veja como cuidamos dos seus dados.</p>
      ${itensPolitica(false)}
      <a class="btn-sec priv-link" href="privacidade.html" target="_blank" rel="noopener">Ler a política completa</a>
      ${rodapeBV(`<button class="modal-done" type="button" data-jd-entendi>${politica.aceita ? 'Continuar' : 'Entendi'}</button>`)}`;
    }
    return null;
  }
  // "Escolher" só marca o cartão; o Confirmar do rodapé aplica a escolha (nas boas-vindas e em Mudar meu objetivo).
  function botaoEscolherBV(id, rotulo = 'Escolher') {
    const marcado = jd.selecionado === id;
    return `<button class="${marcado ? 'btn escolhido' : 'btn'}" type="button" data-jd-marcar="${id}" aria-pressed="${marcado}">${marcado ? `${ICON_CHECK}Escolhido` : rotulo}</button>`;
  }
  function renderJornadas(foco) {
    const boasVindas = jd.modo === 'boas-vindas';
    if (jd.passo === 'montando') return;
    if (boasVindas && jd.passo !== 'objetivo') {
      $('jornada-body').innerHTML = renderPassoBV();
      return;
    }
    const atual = boasVindas ? null : jornadaAtual();
    const cartao = (j) => {
      const ids = Object.keys(j.treinos);
      const aberta = jd.aberta === j.id;
      return `
      <li class="jornada${atual === j ? ' atual' : ''}${jd.selecionado === j.id ? ' selecionada' : ''}">
        <div class="jornada-topo"><b>${esc(j.nome)}</b>${atual === j ? `<span class="jornada-tag">${ehDaJornada(j) ? 'Atual' : 'Atual, personalizada'}</span>` : ''}</div>
        <p>${esc(j.resumo)}</p>
        <p class="jornada-meta">${esc(j.nivel)} · ${ids.length} treinos · ${j.dias} dias por semana · ${esc(j.tempo)} · ${esc(j.equipamento)}</p>
        ${aberta ? `<div class="jornada-treinos" id="jornada-treinos-${j.id}">${ids.map((n) => `
          <div><h4>${seloHTML(`t${n}`)}${esc(j.treinos[n].nome)}${j.treinos[n].subtitulo ? ` <small>${esc(j.treinos[n].subtitulo)}</small>` : ''}</h4>
          <ol>${j.treinos[n].exercicios.map((e) => `<li>${esc(e.nome)} <small>${esc(e.dose)}</small></li>`).join('')}</ol></div>`).join('')}
        </div>` : ''}
        <div class="jornada-acoes">
          <button class="btn-sec" type="button" data-jd-ver="${j.id}" aria-expanded="${aberta}"${aberta ? ` aria-controls="jornada-treinos-${j.id}"` : ''}>${aberta ? 'Esconder treinos' : 'Ver treinos'}</button>
          ${atual === j && ehDaJornada(j) ? '' : botaoEscolherBV(j.id, atual === j ? 'Voltar ao original' : 'Escolher')}
        </div>
      </li>`;
    };
    $('jornada-body').innerHTML = `
      ${boasVindas ? cabecaBV('Boas-vindas', 'Qual é o seu objetivo?')
    : `<div class="modal-head"><div><h3 id="jornada-title" tabindex="-1">Mudar meu objetivo</h3></div>${BOTAO_FECHAR}</div>`}
      <p class="resumo-enc">Escolha um objetivo e receba os treinos prontos${boasVindas ? ', ou monte os seus do zero' : ''}. Depois dá para mudar exercícios, séries e dias em Você → Meus treinos.</p>
      <ul class="jornadas">
        ${JORNADAS.map(cartao).join('')}
        <li class="jornada${jd.selecionado === 'zero' ? ' selecionada' : ''}">
          <div class="jornada-topo"><b>Montar do zero</b></div>
          <p>Escolha entre ${BIBLIOTECA.length} exercícios e monte até ${MAX_TREINOS} treinos do seu jeito.</p>
          <div class="jornada-acoes">${boasVindas ? botaoEscolherBV('zero') : '<button class="btn-sec" type="button" data-jd-zero>Montar meus treinos</button>'}</div>
        </li>
      </ul>
      ${boasVindas ? rodapeBV(jd.selecionado ? `<button class="modal-done" type="button" data-jd-confirmar>${jd.selecionado === 'zero' ? 'Montar meus treinos' : 'Confirmar'}</button>` : '')
    : jd.selecionado ? '<div class="bv-rodape"><button class="modal-done" type="button" data-jd-confirmar>Confirmar</button></div>' : ''}`;
    if (foco) { const el = $('jornada-body').querySelector(foco); if (el) el.focus(); }
  }
  function fecharJornadas(escolha) {
    if (!jd) return;
    // Nas boas-vindas, escolher um objetivo encerra a apresentação (montar do zero só encerra ao salvar os treinos).
    if (jd.modo === 'boas-vindas' && escolha === 'jornada') gravarNovidade('jornada', true);
    jd = null;
    jornadaDialog.close();
    jornadaDialog.classList.remove('bv-tela');
    document.body.classList.remove('bv-ativa');
  }
  jornadaDialog.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && 'jdComecar' in b.dataset) return irParaPasso(passosBV()[1]);
    if (b && 'jdEntendi' in b.dataset) { registrarAceitePolitica(); return irParaPasso('objetivo'); }
    if (b && b.dataset.jdVoltar) return irParaPasso(b.dataset.jdVoltar);
    if (b && b.dataset.jdVer) {
      jd.aberta = jd.aberta === b.dataset.jdVer ? null : b.dataset.jdVer;
      jd.confirmar = null;
      return renderJornadas(`[data-jd-ver="${b.dataset.jdVer}"]`);
    }
    if (b && b.dataset.jdMarcar) {
      jd.selecionado = jd.selecionado === b.dataset.jdMarcar ? null : b.dataset.jdMarcar;
      return renderJornadas(`[data-jd-marcar="${b.dataset.jdMarcar}"]`);
    }
    if (b && 'jdConfirmar' in b.dataset && jd.selecionado) {
      if (jd.selecionado === 'zero') { fecharJornadas('montar'); return abrirEditor({ doZero: true, daBoasVindas: true }); }
      return montarTreinosBV(jd.selecionado);
    }
    if (b && 'jdZero' in b.dataset) {
      const daBoasVindas = jd.modo === 'boas-vindas';
      fecharJornadas('montar');
      return abrirEditor({ doZero: true, daBoasVindas });
    }
    // As boas-vindas não fecham sem uma escolha, e a animação não fecha no meio (sem X, sem Esc e sem tocar fora).
    if (jd && (jd.modo === 'boas-vindas' || jd.passo === 'montando')) return;
    if (e.target === jornadaDialog || e.target.closest('[data-fechar]')) fecharJornadas('fechou');
  });
  jornadaDialog.addEventListener('cancel', (e) => { e.preventDefault(); if (jd && jd.modo !== 'boas-vindas' && jd.passo !== 'montando') fecharJornadas('fechou'); });

  // Semana sugerida: tira os treinos da semana de agora e põe os da jornada, sem mexer nas outras atividades (jiu, muay, surf, futebol, futvôlei e cardio).
  function semanaDaJornada(j) {
    const s = config.semana.map((d) => d.filter((t) => !ehTreino(t)));
    for (const [dia, tipos] of Object.entries(j.semana)) {
      for (const t of tipos) if (s[dia].length < 2) s[dia].push(t);
    }
    return validarSemana(s);
  }
  function aplicarJornada(id, origem, { semAviso = false } = {}) {
    const j = jornadaPorId(id);
    if (!j) return;
    treinosAnterior = fotoDosTreinos();
    const valor = mesmoQuePadrao(j.treinos) ? null : treinosParaSalvar(j.treinos);
    TREINOS = montarTreinos(valor) || planoPronto();
    treinosDaConta = !!valor;
    jornada = j.id;
    atualizarTipos();
    config.semana = semanaDaJornada(j);
    semanaDaConta = true;
    const deHoje = planoDoDia(new Date().getDay()).treino;
    estado.treino = deHoje && TREINOS[deHoje] ? deHoje : Object.keys(TREINOS)[0];
    salvar();
    salvarTreinosNoBanco({ treinos: valor, semana: config.semana, treinos_anterior: treinosAnterior, jornada });
    registrarEvento('jornada_escolhida', { jornada: j.id, origem, conta_nova: novidade.contaNova });
    restaurarConfirmando = false;
    renderHoje();
    renderTudo();
    atualizarCheckinUI();
    if (telaAtual() === 'voce') renderConfig();
    if (!semAviso) avisarJornada(j);
  }
  const avisarJornada = (j) => toastAcao(`Objetivo ${j.nome} escolhido. Os treinos já estão na sua semana.`, 'Desfazer', () => restaurarAnterior('desfazer'));

  // ---------- Animação "Montando seus treinos" ----------
  // Ao confirmar um objetivo (boas-vindas ou Mudar meu objetivo) e ao salvar treinos alterados no editor.
  // A gravação é feita antes; a animação mostra os treinos e a semana se formando, em tela cheia, e só então mostra o app.
  const ICON_HALTER = '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>';
  const DIAS_LETRA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let montagemTimers = [];
  function montarTreinosBV(id) {
    const j = jornadaPorId(id);
    if (!j) return;
    aplicarJornada(id, jd.modo, { semAviso: true });
    animarMontagem({ rotulo: `Treinos de ${j.nome}`, aoTerminar: () => { fecharJornadas('jornada'); avisarJornada(j); } });
  }
  function animarMontagem({ titulo = 'Montando seus treinos', inicio = 'Analisando seu objetivo…', fimTitulo = 'Treinos prontos!', rotulo = 'Seus treinos', aoTerminar }) {
    if (!jd) jd = { modo: 'editor' };
    jd.passo = 'montando';
    jornadaDialog.classList.add('bv-tela');
    document.body.classList.add('bv-ativa');
    if (!jornadaDialog.open) jornadaDialog.showModal();
    const ids = Object.keys(TREINOS);
    const treinos = ids.map((n, i) => {
      const t = TREINOS[n];
      const mostra = t.exercicios.slice(0, 4);
      const resto = t.exercicios.length - mostra.length;
      return `
        <li class="mt-treino" data-mt-treino="${i}">
          <div class="mt-treino-topo">${seloHTML(`t${n}`)}<b>${esc(t.nome)}</b><span class="mt-estado" aria-hidden="true"><i class="mt-gira"></i>${ICON_CHECK}</span></div>
          <ul>${mostra.map((e, k) => `<li style="--k:${k}">${esc(nomeDe(e))}</li>`).join('')}${resto > 0 ? `<li class="mt-mais" style="--k:${mostra.length}">+${resto} exercício${resto > 1 ? 's' : ''}</li>` : ''}</ul>
        </li>`;
    }).join('');
    // Semana começando na segunda, como no Dashboard.
    const ordem = [1, 2, 3, 4, 5, 6, 0];
    const semana = ordem.map((d, k) => `
        <li class="mt-dia" style="--k:${k}"><small>${DIAS_LETRA[d]}</small><span>${config.semana[d].map((t) => (TIPOS[t] ? seloHTML(t) : '')).join('') || '<i class="mt-folga"></i>'}</span></li>`).join('');
    const faiscas = Array.from({ length: 14 }, (_, k) => `<i style="--a:${k * (360 / 14)}deg;--c:var(${['--tatame', '--checkin', '--jiu', '--musc', '--bike', '--muay', '--surf', '--futebol', '--futvolei'][k % 9]})"></i>`).join('');
    $('jornada-body').innerHTML = `
      <div class="bv-montando" style="--prog:0">
        <div class="mt-anel">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="mt-fundo" cx="60" cy="60" r="54"/><circle class="mt-barra" cx="60" cy="60" r="54"/></svg>
          <span class="mt-icone mt-halter">${ICON_HALTER}</span>
          <span class="mt-icone mt-pronto">${ICON_CHECK}</span>
          <span class="mt-faiscas" aria-hidden="true">${faiscas}</span>
        </div>
        <div class="mt-textos">
          <h3 id="jornada-title" tabindex="-1">${titulo}</h3>
          <p class="mt-etapa" id="mt-etapa" role="status" aria-live="polite">${inicio}</p>
        </div>
        <ol class="mt-treinos" aria-label="${esc(rotulo)}">${treinos}</ol>
        <div class="mt-semana-box"><p class="mt-rotulo">Sua semana</p><ol class="mt-semana">${semana}</ol></div>
      </div>`;
    $('jornada-title').focus();
    const raiz = $('jornada-body').querySelector('.bv-montando');
    const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Com movimento: cerca de 7,5 a 8 s no total (+1 s nos treinos, +0,5 s na semana e +0,5 s no "pronto").
    const passo = reduzido ? 180 : 650 + Math.round(1000 / ids.length);
    const etapa = (txt) => { $('mt-etapa').textContent = txt; };
    const linha = [];
    let t = reduzido ? 150 : 700;
    linha.push([0, () => { raiz.style.setProperty('--prog', '0.08'); }]);
    ids.forEach((n, i) => {
      linha.push([t, () => {
        etapa(`Montando ${TREINOS[n].nome}…`);
        if (i > 0) raiz.querySelector(`[data-mt-treino="${i - 1}"]`).classList.add('feito');
        raiz.querySelector(`[data-mt-treino="${i}"]`).classList.add('on');
        raiz.style.setProperty('--prog', String(0.1 + 0.65 * (i + 1) / ids.length));
      }]);
      t += passo;
    });
    linha.push([t, () => {
      etapa('Organizando sua semana…');
      raiz.querySelector(`[data-mt-treino="${ids.length - 1}"]`).classList.add('feito');
      raiz.classList.add('semana-on');
      raiz.style.setProperty('--prog', '0.92');
    }]);
    t += reduzido ? 250 : 1500;
    linha.push([t, () => {
      etapa('Tudo pronto! Bons treinos.');
      $('jornada-title').textContent = fimTitulo;
      raiz.classList.add('pronto');
      raiz.style.setProperty('--prog', '1');
    }]);
    t += reduzido ? 600 : 2000;
    linha.push([t, aoTerminar]);
    montagemTimers.forEach(clearTimeout);
    montagemTimers = linha.map(([ms, fn]) => setTimeout(fn, ms));
  }

  // ---------- Aviso da novidade (até marcar "não mostrar mais") ----------
  const novidadeDialog = $('novidade-dialog');
  const OCULTAR_NOVIDADE = `
      <label class="novidade-ocultar">
        <input type="checkbox" id="novidade-ocultar">
        <span>Não mostrar esta mensagem de novo</span>
      </label>`;
  function abrirNovidade() {
    const comVideo = BIBLIOTECA.filter((ex) => videoDe(ex.nome)).length;
    const item = (txt) => `<li>${ICON_CHECK}<span>${txt}</span></li>`;
    // Conta nova com o plano pronto escolhe uma jornada; quem já montou os treinos vê a versão "Baita atualização!".
    if (novidade.contaNova && !treinosDaConta) return abrirJornadas('boas-vindas');
    $('novidade-body').innerHTML = (`
      <div class="modal-head"><div><span class="novidade-selo">Novidade</span><h3 id="novidade-title">Baita atualização!</h3></div>${BOTAO_FECHAR}</div>
      <p class="resumo-enc">Agora você pode montar os seus próprios treinos.</p>
      <ul class="novidade-lista">
        ${item(`Biblioteca com ${BIBLIOTECA.length} exercícios${comVideo ? `, ${comVideo} com vídeo da execução` : ''}`)}
        ${item(`Até ${MAX_TREINOS} treinos, com o nome e a ordem que você quiser`)}
        ${item('Séries, repetições e PSE ajustáveis em cada exercício')}
      </ul>
      <p class="aviso">Seus check-ins, pesos e recordes continuam salvos. Se preferir, mantenha o treino de hoje e personalize depois em Você → Meus treinos.</p>
      <div class="novidade-acoes">
        <button class="modal-done" type="button" data-novidade="personalizar">Personalizar meus treinos</button>
        <button class="btn-sec" type="button" data-novidade="manter">Manter meu treino atual</button>
      </div>`) + OCULTAR_NOVIDADE;
    novidadeDialog.showModal();
    registrarEvento('novidade_treinos', { escolha: 'viu', conta_nova: novidade.contaNova });
  }
  // Aparece a cada abertura do app enquanto a pessoa não marcar "Não mostrar esta mensagem de novo"
  // (sem outra janela aberta por cima).
  const vaiVerBoasVindas = () => novidade.disponivel && !novidade.vista && novidade.contaNova && !treinosDaConta;
  // A novidade mais recente (Evolução) vem antes do aviso antigo dos treinos; uma por abertura.
  function mostrarNovidadeSeFaltar() {
    if (document.querySelector('dialog[open]')) return;
    if (pedeNovidadeEvo()) abrirNovidadeEvo();
    else if (novidade.disponivel && !novidade.vista) abrirNovidade();
  }
  // Sem a caixa marcada, o aviso volta na próxima vez que o app abrir.
  // Gravação silenciosa: num banco sem as colunas novas, o aviso continua funcionando pelo navegador.
  function responderNovidade(escolha) {
    gravarNovidade(escolha, $('novidade-ocultar').checked);
    novidadeDialog.close();
    if (escolha === 'personalizar') abrirEditor();
    else if (escolha === 'montar') abrirEditor({ doZero: true });
  }
  function gravarNovidade(escolha, ocultou) {
    const agora = new Date().toISOString();
    if (ocultou) {
      novidade.vista = true;
      try { localStorage.setItem(chaveNovidade(), agora); } catch (_) {}
    }
    sb.from('perfis').update(ocultou ? { novidade_treinos: agora, novidade_oculta: agora } : { novidade_treinos: agora })
      .eq('id', usuario.id).then(() => {}, () => {});
    registrarEvento('novidade_treinos', { escolha, ocultou, conta_nova: novidade.contaNova });
  }
  novidadeDialog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-novidade]');
    if (b) return responderNovidade(b.dataset.novidade);
    if (e.target === novidadeDialog || e.target.closest('[data-fechar]')) responderNovidade('fechou');
  });
  novidadeDialog.addEventListener('cancel', (e) => { e.preventDefault(); responderNovidade('fechou'); });

  // ---------- Novidade: Evolução no Dashboard (até marcar "não mostrar mais") ----------
  // Para quem já usa o app (conta nova vê as boas-vindas); volta a cada abertura até marcar a caixa.
  const novidadeEvoDialog = $('novidade-evo-dialog');
  const pedeNovidadeEvo = () => EVOLUCAO_LIGADA && novidade.disponivel && !novidade.contaNova && !novidadesOcultas.has('evolucao');
  function ilustraNovidadeEvo() {
    // Colunas de exemplo subindo mês a mês (musculação, jiu e cardio), com o último mês em destaque.
    const meses = [['jul', 2, 1, 0], ['ago', 3, 1, 1], ['set', 3, 2, 0], ['out', 4, 2, 1], ['nov', 5, 2, 2]];
    const W = 260, H = 132, base = 112, alto = 10, banda = W / meses.length, larg = 26;
    const cols = meses.map(([m, mu, ji, bi], i) => {
      const x = banda * i + (banda - larg) / 2;
      let topo = base;
      const partes = [['musc', mu], ['jiu', ji], ['bike', bi]].filter(([, n]) => n);
      const segs = partes.map(([g, n], k) => {
        const h = n * alto, y = topo - h;
        topo = y;
        const gap = k < partes.length - 1 ? 2 : 0;
        return k === partes.length - 1
          ? `<path class="evo-${g}" d="M${x},${y + h}V${y + 4}Q${x},${y} ${x + 4},${y}H${x + larg - 4}Q${x + larg},${y} ${x + larg},${y + 4}V${y + h}Z"/>`
          : `<rect class="evo-${g}" x="${x}" y="${y + gap}" width="${larg}" height="${h - gap}"/>`;
      }).join('');
      const ult = i === meses.length - 1;
      return `${ult ? `<rect class="nev-sel" x="${banda * i + 4}" y="0" width="${banda - 8}" height="${H}" rx="10"/>` : ''}
        <g class="evo-barra" style="--i:${i}">${segs}</g>
        <text class="nev-tot" x="${x + larg / 2}" y="${topo - 6}" text-anchor="middle">${mu + ji + bi}</text>
        <text class="nev-mes" x="${x + larg / 2}" y="${H - 4}" text-anchor="middle"${ult ? ' style="font-weight:800"' : ''}>${m}</text>`;
    }).join('');
    return `<div class="nov-evo-ilustra" aria-hidden="true">
        <p class="nov-evo-onde">No Dashboard, toque em Evolução</p>
        <div class="nov-evo-abas"><span>Resumo</span><span class="on">Evolução</span></div>
        <svg viewBox="0 -18 ${W} ${H + 18}" width="${W}" height="${H + 18}">
          <line class="nev-grade" x1="0" x2="${W}" y1="${base}" y2="${base}"/>${cols}
          <rect class="nev-sobe" x="${W - 54}" y="-18" width="50" height="18" rx="9"/><text class="nev-sobe-t" x="${W - 29}" y="-5" text-anchor="middle">▲ 2</text>
        </svg>
      </div>`;
  }
  function abrirNovidadeEvo() {
    const item = (ic, titulo, txt) => `<li><span class="nov-evo-ic" aria-hidden="true">${ic}</span><span><b>${titulo}</b><small>${txt}</small></span></li>`;
    $('novidade-evo-body').innerHTML = `
      <div class="modal-head"><div><span class="novidade-selo">Novidade</span><h3 id="novidade-evo-title">Sua evolução, mês a mês</h3></div>${BOTAO_FECHAR}</div>
      <p class="resumo-enc">Agora o Dashboard tem a aba Evolução: veja como você está indo e o que fazer para melhorar.</p>
      ${ilustraNovidadeEvo()}
      <ul class="nov-evo-lista">
        ${item('📊', 'Seus treinos mês a mês', 'Quantos treinos, dias e horas, comparados ao mês anterior.')}
        ${item('🎯', 'Quanto falta para o plano', 'O que a sua semana pedia, o que você já fez e o dia que mais falha.')}
        ${item('🏋️', 'Seus pesos e a hora de subir a carga', 'Recordes de cada exercício e os que estão parados há meses.')}
      </ul>
      <p class="aviso">Já vem com todo o seu histórico: check-ins e pesos desde o começo.</p>
      <div class="novidade-acoes">
        <button class="modal-done" type="button" data-novidade-evo="ver">Ver minha evolução</button>
        <button class="btn-sec" type="button" data-novidade-evo="depois">Agora não</button>
      </div>
      <label class="novidade-ocultar">
        <input type="checkbox" id="novidade-evo-ocultar">
        <span>Não mostrar esta novidade de novo</span>
      </label>`;
    novidadeEvoDialog.showModal();
    registrarEvento('novidade_evolucao', { escolha: 'viu' });
  }
  function responderNovidadeEvo(escolha) {
    const ocultou = $('novidade-evo-ocultar').checked;
    if (ocultou) {
      novidadesOcultas.add('evolucao');
      try { localStorage.setItem(chaveNovidades(), JSON.stringify([...novidadesOcultas])); } catch (_) {}
      // Gravação silenciosa: sem a coluna no banco, fica valendo a cópia do navegador.
      sb.from('perfis').update({ novidades_ocultas: [...novidadesOcultas] }).eq('id', usuario.id).then(() => {}, () => {});
    }
    registrarEvento('novidade_evolucao', { escolha, ocultou });
    novidadeEvoDialog.close();
    if (escolha === 'ver') location.hash = '#dashboard/evolucao';
  }
  novidadeEvoDialog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-novidade-evo]');
    if (b) return responderNovidadeEvo(b.dataset.novidadeEvo);
    if (e.target === novidadeEvoDialog || e.target.closest('[data-fechar]')) responderNovidadeEvo('fechou');
  });
  novidadeEvoDialog.addEventListener('cancel', (e) => { e.preventDefault(); responderNovidadeEvo('fechou'); });

  const NOMES_TEMA = { auto: 'Automático', claro: 'Claro', escuro: 'Escuro' };
  const NOMES_ESTILO = { padrao: 'Padrão', neon: 'Neon Tatame', brasa: 'Brasa', cyber: 'Cyber', ultra: 'Ultravioleta', gelo: 'Gelo', violeta: 'Violeta', miami: 'Miami', lua_de_sangue: 'Lua de Sangue' };
  // Valores mostrados à direita de cada linha da lista de Você.
  function renderMenuVoce() {
    const n = Object.keys(TREINOS).length;
    const j = jornadaAtual();
    $('valor-treinos').textContent = j ? (ehDaJornada(j) ? j.nome : `${j.nome} (personalizada)`)
      : treinosDaConta ? `${n} ${n === 1 ? 'treino' : 'treinos'}` : 'Plano pronto';
    const ativ = config.semana.flat().length;
    const descanso = config.semana.filter((d) => !d.length).length;
    $('valor-semana').textContent = `${ativ} ${ativ === 1 ? 'atividade' : 'atividades'}${descanso ? '' : ', sem descanso'}`;
    $('valor-aparencia').textContent = config.estilo !== 'padrao' ? NOMES_ESTILO[config.estilo] : NOMES_TEMA[config.tema] || 'Automático';
    $('valor-notificacoes').textContent = config.resumoEmail ? 'Resumo ligado' : 'Desligadas';
    $('valor-temporizador').textContent = config.temporizador.ativo ? fmtSegundos(config.temporizador.segundos) : 'Desligado';
  }
  // Abrir uma opção pela lista: "‹ Você" volta pelo histórico (o botão voltar do celular também funciona).
  let abriuPelaLista = false;
  $('tela-voce').addEventListener('click', (e) => {
    const linha = e.target.closest('[data-voce]');
    if (linha) { abriuPelaLista = true; location.hash = `#voce/${linha.dataset.voce}`; return; }
    if (e.target.closest('[data-voltar]')) {
      if (abriuPelaLista) { abriuPelaLista = false; history.back(); } else location.hash = '#voce';
    }
  });

  function renderConfig() {
    renderMenuVoce();
    renderPrivacidade();
    document.querySelectorAll('input[name="tema"]').forEach((r) => { r.checked = r.value === config.tema; });
    document.querySelectorAll('input[name="estilo"]').forEach((r) => { r.checked = r.value === config.estilo; });
    $('tema-nota-estilo').hidden = config.estilo === 'padrao';
    $('resumo-email').checked = config.resumoEmail;
    renderTemporizadorConfig();
    renderMeusTreinos();
    renderSemanaConfig();
  }

  function preencherPerfil() {
    $('p-nome').value = perfil.nome;
    $('p-email').value = perfil.email;
    $('conta-email').textContent = perfil.email || 'sua conta Google';
  }

  // Recorta a imagem no centro e reduz para 320×320, para caber no armazenamento do navegador.
  function processarFoto(arquivo) {
    return new Promise((resolve, reject) => {
      if (!arquivo || !arquivo.type.startsWith('image/')) return reject();
      const url = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = () => {
        const lado = Math.min(img.naturalWidth, img.naturalHeight);
        const tela = document.createElement('canvas');
        tela.width = tela.height = 320;
        const ctx = tela.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 320, 320);
        ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 320, 320);
        URL.revokeObjectURL(url);
        resolve(tela.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }

  function erroFoto(msg) {
    $('foto-erro').textContent = msg;
    $('foto-erro').hidden = !msg;
  }

  // ---------- Instalar o app ----------
  // Linha "Instalar o app" em Você: no Android (Chrome), abre o pedido de instalação do navegador com um toque;
  // no iPhone, que não tem esse pedido, mostra o passo a passo do Safari. Some quando o app já está instalado
  // (aberto da tela inicial) e nos navegadores que não instalam apps.
  let pedidoInstalar = null;
  const appInstalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ehIPhone = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function atualizarInstalar() {
    $('grupo-instalar').hidden = appInstalado() || !(pedidoInstalar || ehIPhone());
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalar = e; atualizarInstalar(); });
  window.addEventListener('appinstalled', () => { pedidoInstalar = null; atualizarInstalar(); });
  const instalarDialog = $('instalar-dialog');
  function abrirPassosIPhone() {
    const passo = (n, txt) => `<li><b class="instalar-n">${n}</b><span>${txt}</span></li>`;
    $('instalar-body').innerHTML = `
      <div class="modal-head"><h3 id="instalar-title">Instalar no iPhone</h3>${BOTAO_FECHAR}</div>
      <ol class="instalar-passos">
        ${passo(1, 'No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta para cima).')}
        ${passo(2, 'Role a lista e toque em <b>Adicionar à Tela de Início</b>.')}
        ${passo(3, 'Toque em <b>Adicionar</b>. O app aparece na tela inicial, com o ícone GT.')}
      </ol>
      <p class="aviso">Só funciona pelo Safari. No primeiro uso, o app instalado pede para entrar com o Google de novo.</p>
      <button class="modal-done" type="button" data-fechar>Entendi</button>`;
    instalarDialog.showModal();
  }
  instalarDialog.addEventListener('click', (e) => {
    if (e.target === instalarDialog || e.target.closest('[data-fechar]')) instalarDialog.close();
  });
  $('instalar-app').addEventListener('click', () => {
    if (pedidoInstalar) {
      const pedido = pedidoInstalar;
      pedido.prompt();
      pedido.userChoice.then((r) => {
        registrarEvento('app_instalar', { resultado: r && r.outcome === 'accepted' ? 'instalou' : 'desistiu' });
        if (r && r.outcome === 'accepted') pedidoInstalar = null;
        atualizarInstalar();
      }).catch(() => {});
      return;
    }
    registrarEvento('app_instalar', { resultado: 'passos_iphone' });
    abrirPassosIPhone();
  });
  atualizarInstalar();
