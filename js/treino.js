// js/treino.js: tela Treino: abas, cartões dos exercícios e vídeo de execução.
// Parte do app (index.html). Os arquivos de js/ dividem o mesmo escopo global e carregam na ordem do index.html;
// o mapa das seções está em docs/MAPA.md.

  // ---------- Render: tela Treino ----------
  function renderHoje() {
    $('data').textContent = `${dataLonga(hoje())} às ${horaDe(agoraIso())}`;
    $('atividade').textContent = planoDoDia(new Date().getDay()).titulo;
  }

  function renderTreinos() {
    const ids = Object.keys(TREINOS);
    $('treinos').style.setProperty('--n', ids.length);
    $('treinos').classList.toggle('muitos', ids.length > 3);
    $('treinos').innerHTML = ids.map((id) => `
      <button class="treino-btn" role="tab" data-treino="${id}" aria-selected="${id === estado.treino}">
        <b>${TREINOS[id].nome}</b><span>${TREINOS[id].subtitulo || qtdExercicios(TREINOS[id].exercicios.length)}</span>
      </button>`).join('');
  }

  function renderChips() {
    $('chips').innerHTML = FOCOS.map((f) => `
      <button class="chip" data-foco="${f.id}" aria-pressed="${f.id === estado.foco}">${f.label}</button>`).join('');
  }

  function renderSobre() {
    const t = TREINOS[estado.treino];
    // Recado do personal para este treino (quando quem montou foi o personal).
    const recado = t.recado ? `<p class="recado-personal"><b>Recado do seu personal:</b> ${esc(t.recado)}</p>` : '';
    // Treinos montados pela pessoa não têm o texto de objetivo e impacto.
    if (!t.objetivo) { $('sobre').innerHTML = recado; return; }
    $('sobre').innerHTML = `${recado}
      <details class="sobre"${estado.descAberta ? ' open' : ''}>
        <summary>
          <div class="sobre-head">
            <h2>Sobre o ${t.nome}</h2>
            <span class="sobre-dica">Objetivo, o que esperar e impacto</span>
          </div>
          ${CHEVRON}
        </summary>
        <div class="sobre-corpo">
          <div><h3>Objetivo</h3><p>${t.objetivo}</p></div>
          <div><h3>O que esperar</h3><p>${t.esperado}</p></div>
          <div><h3>Impacto</h3>
            <p><b>No Jiu Jitsu:</b> ${t.impacto_jiu}</p>
            <p><b>No físico:</b> ${t.impacto_fisico}</p>
          </div>
        </div>
      </details>`;
  }

  function renderFichaCheckin() {
    const tipo = `t${estado.treino}`;
    const aberto = checkinAberto();
    const sessao = sessaoAtual(estado.treino);
    let html = '';
    if (aberto && aberto.tipo !== tipo && !sessao) {
      html = `<p class="ficha-nota">O ${TIPOS[aberto.tipo].nome} está em andamento. Encerre-o para registrar o ${TIPOS[tipo].nome}.</p>`;
    } else if (sessao && sessao.fim) {
      html = `<span class="status-ok">${ICON_CHECK}Check-in de hoje feito ${horarioTexto(sessao)}</span>`;
    }
    $('ficha-checkin').innerHTML = html;
  }

  function exercicioHTML(ex, i) {
    const id = videoDe(ex.nome);
    const graus = DIMS.map(({ k, label }) => `
      <div>
        <dt>${label}</dt>
        <dd>${ponteiraHTML(ex[k])}${NIVEL[ex[k]]}</dd>
      </div>`).join('');
    const ultima = !config.semPeso.has(ex.nome) && historicoDe(ex.nome, hoje())[0];
    const ultimaKg = ultima ? maxDoDia(ultima.series) : 0;
    const topo = `
        <div class="ex-topo">
          <span class="ex-num">${pad(i + 1)}</span>
          <div>
            <h3>${esc(nomeDe(ex))}</h3>
            <p class="ex-dose"><span>${ex.dose}</span><span class="pse" title="Percepção subjetiva de esforço">PSE ${ex.pse}</span>${ultimaKg ? `<span class="ex-ultima">Última vez ${fmtKg(ultimaKg)} kg</span>` : ''}</p>
          </div>
        </div>`;
    const info = `
        <p class="ex-why">${esc(ex.why)}</p>
        <dl class="graus">${graus}</dl>`;
    // Com vídeo, o cartão vira um carrossel: deslizando para o lado aparece a execução.
    // O nome fica fora do carrossel, sempre visível nos dois painéis.
    const corpo = !id ? topo + info : `${topo}
        <div class="ex-slides" data-ex="${i}" role="group" aria-label="${esc(nomeDe(ex))}: informações e vídeo">
          <div class="ex-slide">${info}</div>
          <div class="ex-slide ex-video" data-video="${id}" data-nome="${esc(nomeDe(ex))}">
            <div class="video-quadro">
              <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="Execução: ${esc(nomeDe(ex))}" loading="lazy">
              <span class="video-play" aria-hidden="true">${ICON_PLAY}</span>
            </div>
            <a class="video-link" href="https://www.youtube.com/shorts/${id}" target="_blank" rel="noopener">${ICON_PLAY} Abrir no YouTube</a>
          </div>
        </div>
        <div class="ex-nav">
          <div class="ex-pontos">
            <button class="ex-ponto" type="button" data-ponto="0" aria-label="Informações" aria-current="true"></button>
            <button class="ex-ponto" type="button" data-ponto="1" aria-label="Vídeo da execução" aria-current="false"></button>
          </div>
          <span class="ex-dica">Deslize para ver a execução</span>
        </div>`;
    return `
      <li class="ex">
        ${corpo}
        <div class="ex-acoes">${logBtnHTML(ex, i)}</div>
      </li>`;
  }

  // ---------- Vídeo de execução no cartão ----------
  const iframeVideo = (id, nome) => `<iframe
    src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&amp;mute=1&amp;loop=1&amp;playlist=${id}&amp;playsinline=1&amp;rel=0"
    title="Execução: ${nome}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen
    referrerpolicy="strict-origin-when-cross-origin"></iframe>`;

  const painelAtivo = (sl) => Math.round(sl.scrollLeft / Math.max(1, sl.clientWidth));

  // O vídeo só carrega com o cartão na tela e no painel do vídeo; sai ao voltar, ao rolar para longe ou ao trocar de
  // tela (para de tocar e de gastar dados).
  const videosVistos = new Set(); // um evento por vídeo e sessão
  function atualizarVideo(sl) {
    const painel = sl.querySelector('.ex-video');
    const quadro = painel.querySelector('.video-quadro');
    const iframe = quadro.querySelector('iframe');
    const mostrar = sl.dataset.visivel === '1' && painelAtivo(sl) === 1;
    if (mostrar && !iframe) {
      quadro.insertAdjacentHTML('beforeend', iframeVideo(painel.dataset.video, painel.dataset.nome));
      if (!videosVistos.has(painel.dataset.nome)) {
        videosVistos.add(painel.dataset.nome);
        registrarEvento('video', { exercicio: painel.dataset.nome });
      }
    }
    if (!mostrar && iframe) iframe.remove();
  }
  const observadorVideo = 'IntersectionObserver' in window
    ? new IntersectionObserver((entradas) => {
      for (const en of entradas) {
        en.target.dataset.visivel = en.isIntersecting ? '1' : '0';
        atualizarVideo(en.target);
      }
    })
    : null;

  function ajustarCarrossel(sl) {
    const idx = Math.min(painelAtivo(sl), sl.children.length - 1);
    // Na primeira vez que chega ao vídeo, a dica "Deslize para ver a execução" deixa de aparecer.
    if (idx === 1 && !document.documentElement.classList.contains('ja-deslizou')) {
      document.documentElement.classList.add('ja-deslizou');
      try { localStorage.setItem('bauer-deslizou', '1'); } catch (_) {}
    }
    atualizarVideo(sl);
    // Com a tela Treino escondida (ex.: salvando treinos em Você) a altura mede 0; mede de novo ao voltar.
    const altura = sl.children[idx].offsetHeight;
    if (altura) sl.style.height = `${altura}px`;
    else sl.style.height = '';
    const card = sl.closest('.ex');
    card.querySelectorAll('.ex-ponto').forEach((p, k) => p.setAttribute('aria-current', String(k === idx)));
    card.querySelector('.ex-dica').textContent = idx ? 'Deslize para voltar' : 'Deslize para ver a execução';
  }
  const ajustarTodos = () => document.querySelectorAll('.ex-slides').forEach(ajustarCarrossel);

  function renderLista() {
    const todos = exerciciosDoTreino();
    const foco = FOCOS.find((f) => f.id === estado.foco);
    const itens = estado.foco === 'todos' ? todos : todos.filter((ex) => ex[estado.foco] === 'alta');

    renderProgressoFicha(todos, estado.foco !== 'todos' ? `${itens.length} com alta ${foco.label.toLowerCase()} · ` : '');

    // Cartões que estavam mostrando o vídeo continuam nele depois de redesenhar a lista.
    const noVideo = treinoRenderizado === estado.treino
      ? new Set([...$('list').querySelectorAll('.ex-slides')].filter((s) => painelAtivo(s) > 0).map((s) => s.dataset.ex))
      : new Set();
    treinoRenderizado = estado.treino;
    if (observadorVideo) observadorVideo.disconnect();

    $('list').innerHTML = itens.length
      ? itens.map((ex) => exercicioHTML(ex, todos.indexOf(ex))).join('')
      : `<li class="vazio">Nenhum exercício do ${TREINOS[estado.treino].nome} tem alta contribuição em ${foco.label.toLowerCase()}.<br>
           <button class="btn-sec" type="button" data-foco="todos">Ver todos os exercícios</button></li>`;

    $('list').querySelectorAll('.ex-slides').forEach((sl) => {
      if (noVideo.has(sl.dataset.ex)) sl.scrollLeft = sl.scrollWidth;
      ajustarCarrossel(sl);
      if (observadorVideo) observadorVideo.observe(sl);
      else sl.dataset.visivel = '1';
    });
    agendarFab();
  }
  let treinoRenderizado = null;

  // Feito hoje: com carga registrada, ou marcado como feito quando é "sem peso".
  function exFeitoHoje(ex) {
    const salvo = pesosDoDia(hoje(), `t${estado.treino}`)[ex.nome] || [];
    return temCarga(salvo) || (config.semPeso.has(ex.nome) && temFeito(salvo));
  }
  // "2 de 6 feitos" e a barra embaixo do título da Ficha (RF-69).
  function renderProgressoFicha(todos = exerciciosDoTreino(), prefixo = '') {
    const n = todos.length;
    const feitos = todos.filter(exFeitoHoje).length;
    $('count').innerHTML = `${esc(prefixo)}Treino de hoje: <b>${feitos} de ${n}</b> ${n === 1 ? 'exercício feito' : 'exercícios feitos'}`;
    const barra = $('ficha-prog');
    barra.hidden = !n;
    barra.style.setProperty('--p', `${n ? Math.round((feitos / n) * 100) : 0}%`);
    barra.setAttribute('aria-valuemax', String(n));
    barra.setAttribute('aria-valuenow', String(feitos));
    barra.setAttribute('aria-valuetext', `${feitos} de ${n} exercícios feitos hoje`);
  }

  function renderSemana() {
    const hojeIdx = new Date().getDay();
    const seg = segundaDe(hoje());
    const porData = agruparPorData();
    const tira = [];
    $('dias').innerHTML = ORDEM_SEMANA.map((i, pos) => {
      const d = planoDoDia(i);
      const doDia = porData[somarDias(seg, pos)] || [];
      // Regra 12: check-in do tipo planejado (ou do mesmo grupo) marca a atividade como feita;
      // os de grupos fora do plano contam como extra.
      const restantes = doDia.filter((c) => c.fim);
      const usar = (t, casa) => {
        const k = restantes.findIndex(casa);
        if (k < 0) return false;
        restantes.splice(k, 1);
        return true;
      };
      const exatos = d.tipos.filter((t) => usar(t, (c) => c.tipo === t));
      const feitos = d.tipos.filter((t) => exatos.includes(t) || usar(t, (c) => TIPOS[c.tipo].grupo === TIPOS[t].grupo));
      let feito = '';
      if (feitos.length && feitos.length === d.tipos.length) feito = `<span class="tag-feito">${ICON_CHECK}Feito</span>`;
      else if (feitos.length) feito = `<span class="tag-feito">${ICON_CHECK}${feitos.map(nomeAtividade).join(', ')}</span>`;
      const extras = doDia.filter((c) => !d.grupos.includes(TIPOS[c.tipo].grupo));
      const tags = [
        i === hojeIdx ? '<span class="tag-hoje">Hoje</span>' : '',
        feito,
        extras.length ? `<span class="tag-extra">+ ${extras.map((c) => TIPOS[c.tipo].nome).join(', ')}</span>` : '',
      ].join('');
      tira.push(`<li class="${[feitos.length && feitos.length === d.tipos.length ? 'feito' : feitos.length ? 'parcial' : '', i === hojeIdx ? 'hoje' : '', d.tipos.length ? '' : 'descanso'].join(' ').trim()}"><i>${feitos.length && feitos.length === d.tipos.length ? '✓' : ''}</i>${d.curto.charAt(0)}</li>`);
      return `
        <li class="dia${i === hojeIdx ? ' hoje' : ''}">
          <span class="dia-curto">${d.curto}</span>
          <div class="dia-info"><b>${d.titulo}</b><span>${d.nota}</span></div>
          <div class="dia-tags">${tags}</div>
        </li>`;
    }).join('');
    $('semana-tira').innerHTML = tira.join('');
    // A nota explica a semana padrão; com a semana mudada ela deixa de valer.
    $('semana-nota').hidden = treinosDaConta || JSON.stringify(config.semana) !== JSON.stringify(SEMANA_PADRAO);
  }

  function renderAtivo() {
    const a = checkinAberto();
    $('ativo').hidden = !a;
    document.body.classList.toggle('com-ativo', !!a);
    if (!a) return;
    const min = minutosEntre(a.inicio, agoraIso());
    $('ativo-titulo').textContent = `${TIPOS[a.tipo].nome} em andamento`;
    $('ativo-tempo').textContent = min >= 180
      ? `Aberto há ${fmtDur(min)}. Encerre o check-in.`
      : `Começou às ${horaDe(a.inicio)}, há ${fmtDur(min)}`;
  }

  function renderTudo() {
    renderTreinos();
    renderChips();
    renderSobre();
    renderFichaCheckin();
    renderLista();
  }
