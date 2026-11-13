// js/telas.js: navegação entre telas e eventos da interface (cliques e formulários).
// Parte do app (index.html). Os arquivos de js/ dividem o mesmo escopo global e carregam na ordem do index.html;
// o mapa das seções está em docs/MAPA.md.

  // ---------- Telas ----------
  const TELAS = ['treino', 'dashboard', 'voce'];
  // Você tem uma lista de opções (#voce) e uma tela para cada uma (#voce/semana, #voce/aparencia…).
  const PAGINAS_VOCE = ['dados', 'aparencia', 'treinos', 'semana', 'temporizador', 'notificacoes', 'privacidade'];
  const telaAtual = () => {
    const t = location.hash.slice(1).split('/')[0];
    return TELAS.includes(t) ? t : 'treino';
  };
  const paginaVoce = () => {
    const [t, pag] = location.hash.slice(1).split('/');
    return t === 'voce' && PAGINAS_VOCE.includes(pag) ? pag : null;
  };
  function mostrarTela() {
    const t = telaAtual();
    $('tela-treino').hidden = t !== 'treino';
    $('tela-dashboard').hidden = t !== 'dashboard';
    $('tela-voce').hidden = t !== 'voce';
    document.querySelectorAll('[data-tela]').forEach((b) => {
      if (b.dataset.tela === t) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (t === 'dashboard') renderDashboard();
    // A ficha pode ter sido redesenhada com a tela escondida: refaz a altura dos cartões.
    if (t === 'treino') ajustarTodos();
    const pag = t === 'voce' ? paginaVoce() : null;
    if (t === 'voce') {
      $('voce-menu').hidden = !!pag;
      document.querySelectorAll('.voce-pagina').forEach((el) => { el.hidden = el.dataset.pagina !== pag; });
      renderConfig(); erroFoto('');
    }
    $('fab-checkin').hidden = t === 'voce';
    $('fab-checkin').classList.remove('encolhido');
    renderFabDescanso();
    registrarEvento('tela', pag ? { tela: t, pagina: pag } : { tela: t });
    marcarPresenca();
  }

  function atualizarCheckinUI() {
    renderAtivo();
    renderFichaCheckin();
    renderLista();
    renderSemana();
    if (telaAtual() === 'dashboard') renderDashboard();
  }

  // ---------- Eventos ----------
  function mudarFoco(foco) {
    estado.foco = foco;
    salvar(); renderChips(); renderLista();
  }

  function mostrarTreino(treino) {
    if (estado.treino === treino) return;
    estado.treino = treino;
    salvar(); renderTudo();
  }

  $('treinos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-treino]');
    if (b) mostrarTreino(b.dataset.treino);
  });

  $('sobre').addEventListener('toggle', (e) => {
    if (!e.target.matches('.sobre')) return;
    estado.descAberta = e.target.open;
    salvar();
  }, true);

  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-foco]');
    if (b) mudarFoco(b.dataset.foco);
  });

  // Deslizar o carrossel: atualiza altura, pontinhos e dica no próximo quadro.
  const carrosseisPendentes = new Set();
  $('list').addEventListener('scroll', (e) => {
    if (!e.target.classList || !e.target.classList.contains('ex-slides')) return;
    if (!carrosseisPendentes.size) {
      requestAnimationFrame(() => { carrosseisPendentes.forEach(ajustarCarrossel); carrosseisPendentes.clear(); });
    }
    carrosseisPendentes.add(e.target);
  }, true);
  window.addEventListener('resize', () => {
    document.querySelectorAll('.ex-slides').forEach((sl) => {
      sl.scrollLeft = painelAtivo(sl) * sl.clientWidth;
      ajustarCarrossel(sl);
    });
  });
  if (document.fonts) document.fonts.ready.then(ajustarTodos);

  $('list').addEventListener('click', (e) => {
    const f = e.target.closest('[data-foco]');
    if (f) return mudarFoco(f.dataset.foco);
    const ponto = e.target.closest('[data-ponto]');
    if (ponto) {
      const sl = ponto.closest('.ex').querySelector('.ex-slides');
      const suave = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      sl.scrollTo({ left: Number(ponto.dataset.ponto) * sl.clientWidth, behavior: suave ? 'smooth' : 'auto' });
      return;
    }
    const b = e.target.closest('[data-log]');
    if (b) abrirLog(Number(b.dataset.log));
  });

  // Ações que aparecem em várias telas.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tela]');
    if (t) { location.hash = `#${t.dataset.tela}`; return; }
    if (e.target.closest('[data-encerrar]')) return abrirEncerrar();
  });

  window.addEventListener('hashchange', () => { mostrarTela(); window.scrollTo(0, 0); });

  // Botão fixo de check-in: abre o formulário já com o treino da aba (ou o planejado do dia no Dashboard).
  $('fab-checkin').addEventListener('click', () => {
    if (telaAtual() === 'dashboard') {
      const data = diaSel > hoje() ? hoje() : diaSel;
      return abrirFormCheckin({ tipo: tipoPlanejado(data), data });
    }
    abrirFormCheckin({ tipo: `t${estado.treino}` });
  });
  // Encolhe ao rolar para baixo e volta a mostrar o texto ao rolar para cima. Também fica só com o ícone quando,
  // aberto, cobriria um botão, campo ou dia do calendário (lei de Fitts: a ação embaixo continua alcançável).
  var ultimoScroll = 0, fabDescendo = false, fabLargura = 0, fabPedido = 0;
  function fabCobreAcao(fab) {
    const r = fab.getBoundingClientRect();
    if (!r.width) return false;
    const esquerda = r.right - Math.max(fabLargura, r.width);
    for (const y of [r.top + 10, r.top + r.height / 2, r.bottom - 10]) {
      for (let x = esquerda + 8; x <= r.right - 8; x += 20) {
        const baixo = document.elementsFromPoint(x, y).find((el) => !fab.contains(el) && !el.closest('#fab-descanso, .nav, .ativo, .toast'));
        if (baixo && baixo.closest('button, a[href], input, select, textarea, [role="button"], .cal-dia')) return true;
      }
    }
    return false;
  }
  function ajustarFab() {
    fabPedido = 0;
    const fab = $('fab-checkin');
    if (!fab.getClientRects().length) return; // escondido (position: fixed não tem offsetParent)
    if (!fab.classList.contains('encolhido')) fabLargura = fab.offsetWidth;
    fab.classList.toggle('encolhido', fabDescendo || fabCobreAcao(fab));
  }
  function agendarFab() { if (!fabPedido) fabPedido = requestAnimationFrame(ajustarFab); }
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (Math.abs(y - ultimoScroll) >= 8) {
      fabDescendo = y > ultimoScroll && y > 80;
      ultimoScroll = y;
    }
    agendarFab();
  }, { passive: true });
  window.addEventListener('resize', agendarFab);
  window.addEventListener('hashchange', () => setTimeout(agendarFab, 60));

  logDialog.addEventListener('click', (e) => {
    const passo = e.target.closest('[data-passo]');
    if (passo) {
      const campo = $(passo.dataset.alvo);
      const atual = Number(String(campo.value || campo.placeholder).replace(',', '.'));
      const novo = Math.max(0, (Number.isFinite(atual) ? atual : 0) + Number(passo.dataset.passo));
      campo.value = fmtKg(Math.round(novo * 100) / 100);
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (e.target.closest('[data-concluir]')) return concluirLog();
    const desfazer = e.target.closest('[data-desfazer]');
    if (desfazer) { marcarFeito(desfazer.dataset.desfazer, false); return abrirLog(exAberto); }
    // Clique no fundo escuro (fora do conteúdo) também fecha.
    if (e.target === logDialog || e.target.closest('[data-fechar]')) logDialog.close();
  });

  // Interruptor "Sem peso": fica salvo no exercício e redesenha o painel na hora.
  logDialog.addEventListener('change', (e) => {
    const chave = e.target.closest('[data-sem-peso]');
    if (!chave) return;
    const nome = chave.dataset.semPeso;
    if (chave.checked) config.semPeso.add(nome); else config.semPeso.delete(nome);
    salvarPerfil({ sem_peso: [...config.semPeso] });
    registrarEvento('sem_peso', { exercicio: nome, ativo: chave.checked });
    abrirLog(exAberto);
    logDialog.querySelector('[data-sem-peso]').focus();
  });

  logDialog.addEventListener('input', (e) => {
    const el = e.target.closest('[data-campo]');
    if (el) { salvarInput(el); marcarRecordes(); }
  });

  logDialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('[data-campo]')) return;
    e.preventDefault();
    const campos = camposDoModal();
    const proximo = campos[campos.indexOf(e.target) + 1];
    if (proximo) proximo.focus();
    else concluirLog();
  });

  logDialog.addEventListener('close', () => {
    salvarSeriesPendentes();
    const origem = logCtx && logCtx.origem;
    logCtx = null;
    // Pesos editados pelo Dashboard: redesenha o detalhe e também a ficha (o dia pode ser hoje).
    if (origem === 'dash') { renderLista(); renderDashboard(); }
    else {
      const b = $('list').querySelector(`[data-log="${exAberto}"]`);
      if (b) b.outerHTML = logBtnHTML(exerciciosDoTreino()[exAberto], exAberto);
      const foco = FOCOS.find((f) => f.id === estado.foco);
      const visiveis = estado.foco === 'todos' ? null : exerciciosDoTreino().filter((ex) => ex[estado.foco] === 'alta').length;
      renderProgressoFicha(exerciciosDoTreino(), visiveis == null ? '' : `${visiveis} com alta ${foco.label.toLowerCase()} · `);
    }
    renderFichaCheckin();
  });

  encDialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-confirmar-enc]')) return confirmarEncerrar();
    if (e.target === encDialog || e.target.closest('[data-fechar]')) { depoisEncerrar = null; encDialog.close(); }
  });
  encDialog.addEventListener('cancel', () => { depoisEncerrar = null; });

  formDialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-salvar-form]')) return salvarForm();
    if (e.target === formDialog || e.target.closest('[data-fechar]')) formDialog.close();
  });

  formDialog.addEventListener('change', (e) => {
    if (e.target.name === 'f-tipo') {
      if (!durTocada) $('f-dur').value = duracaoPadrao(e.target.value);
      renderModalidade(e.target.value);
    }
    // Modalidade com km (Bike, Corrida): aparece o campo da distância.
    if (e.target.name === 'f-mod') {
      const m = (TIPOS[formDialog.querySelector('input[name="f-tipo"]:checked').value].modalidades || []).find((x) => x.id === e.target.value);
      $('f-km-campo').hidden = !(m && m.km);
      if (m && m.km) $('f-km').focus();
    }
  });
  formDialog.addEventListener('input', (e) => {
    if (e.target.id === 'f-dur') durTocada = true;
    $('f-erro').hidden = true;
  });

  $('tela-dashboard').addEventListener('click', (e) => {
    const mesBtn = e.target.closest('[data-mes]');
    if (mesBtn) {
      const d = new Date(mesExibido.ano, mesExibido.mes + Number(mesBtn.dataset.mes), 1);
      mesExibido = { ano: d.getFullYear(), mes: d.getMonth() };
      const prefixo = `${mesExibido.ano}-${pad(mesExibido.mes + 1)}`;
      if (!diaSel.startsWith(prefixo)) diaSel = hoje().startsWith(prefixo) ? hoje() : `${prefixo}-01`;
      ckExpandido = null; ckExcluindo = null;
      return renderDashboard();
    }
    const dia = e.target.closest('[data-dia]');
    if (dia) {
      diaSel = dia.dataset.dia;
      ckExpandido = null; ckExcluindo = null;
      renderCalendario(); renderDia();
      return;
    }
    const ck = e.target.closest('[data-ck]');
    if (ck) {
      ckExpandido = ckExpandido === ck.dataset.ck ? null : ck.dataset.ck;
      ckExcluindo = null;
      return renderDia();
    }
    const edEx = e.target.closest('[data-editar-ex]');
    if (edEx) {
      const c = checkins.find((x) => x.id === edEx.dataset.exCk);
      return abrirLog(Number(edEx.dataset.editarEx), { data: dataDe(c), tipo: c.tipo, origem: 'dash', exs: exerciciosDoCheckin(c) });
    }
    const vf = e.target.closest('[data-ver-foto]');
    if (vf) return abrirFotoVer(checkins.find((x) => x.id === vf.dataset.verFoto));
    const ed = e.target.closest('[data-editar]');
    if (ed) return abrirFormCheckin({ editar: checkins.find((x) => x.id === ed.dataset.editar) });
    const exc = e.target.closest('[data-excluir]');
    if (exc) { ckExcluindo = exc.dataset.excluir; return renderDia(); }
    if (e.target.closest('[data-excluir-nao]')) { ckExcluindo = null; return renderDia(); }
    const sim = e.target.closest('[data-excluir-sim]');
    if (sim) {
      const alvo = checkins.find((c) => c.id === sim.dataset.excluirSim);
      checkins = checkins.filter((c) => c !== alvo);
      excluirCheckinRemoto(alvo.id);
      if (alvo.foto) apagarFotos([alvo.foto]);
      ckExpandido = null; ckExcluindo = null;
      toast(`Check-in de ${TIPOS[alvo.tipo].nome} excluído.`);
      registrarEvento('checkin_excluido', { tipo: alvo.tipo });
      atualizarCheckinUI();
      return;
    }
  });

  $('p-foto').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;
    let foto;
    try { foto = await processarFoto(arquivo); } catch (_) {
      return erroFoto('Não foi possível ler essa imagem. Escolha um arquivo JPG ou PNG.');
    }
    const tinhaFoto = !!perfil.foto;
    perfil.foto = foto;
    salvarPerfil({ foto });
    erroFoto('');
    renderFoto();
    toast(tinhaFoto ? 'Foto alterada com sucesso.' : 'Foto salva com sucesso.');
    registrarEvento('foto', { acao: tinhaFoto ? 'trocada' : 'nova' });
  });

  $('remover-foto').addEventListener('click', () => {
    perfil.foto = '';
    salvarPerfil({ foto: '' });
    erroFoto('');
    renderFoto();
    toast('Foto removida.');
    registrarEvento('foto', { acao: 'removida' });
  });

  // Nome salvo sozinho: depois de uma pausa na digitação e ao sair do campo (ou Enter).
  // Sem aviso para o nome: um toast cobriria o botão tocado logo em seguida (ex.: "Sair da conta").
  let timerNome;
  function salvarNome() {
    clearTimeout(timerNome);
    const nome = $('p-nome').value.trim().slice(0, 120);
    // Nome em branco não é salvo: o campo volta ao nome anterior.
    if (!nome) { if (document.activeElement !== $('p-nome')) $('p-nome').value = perfil.nome; return; }
    if (nome === perfil.nome) return;
    perfil.nome = nome;
    salvarPerfil({ nome });
    renderFoto();
  }
  $('p-nome').addEventListener('input', () => {
    clearTimeout(timerNome);
    timerNome = setTimeout(salvarNome, 1000);
  });
  $('p-nome').addEventListener('blur', salvarNome);
  // Sem botão de enviar, o Enter não submete o formulário: ele mesmo encerra a edição do nome.
  $('p-nome').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('p-nome').blur(); } });
  $('form-perfil').addEventListener('submit', (e) => e.preventDefault());
  window.addEventListener('pagehide', () => { if (usuario) salvarNome(); });

  $('tela-voce').addEventListener('change', (e) => {
    if (e.target.name === 'tema') {
      config.tema = e.target.value;
      salvarPerfil({ tema: config.tema });
      registrarEvento('tema', { tema: config.tema });
      guardarTemaLocal();
      aplicarTema();
      renderMenuVoce();
    }
    if (e.target.name === 'estilo' && ESTILOS.includes(e.target.value)) {
      config.estilo = e.target.value;
      if (estiloNaConta) salvarPerfil({ estilo: config.estilo });
      registrarEvento('estilo', { estilo: config.estilo });
      guardarTemaLocal();
      aplicarTema();
      renderMenuVoce();
      $('tema-nota-estilo').hidden = config.estilo === 'padrao';
    }
  });
