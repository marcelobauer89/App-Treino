// js/temporizador.js: timer (descanso entre séries ou tempo de um exercício).
// Parte do app (index.html). Os arquivos de js/ dividem o mesmo escopo global e carregam na ordem do index.html;
// o mapa das seções está em docs/MAPA.md.

  // ---------- Temporizador de descanso ----------
  // O tempo vale pela hora de término (não atrasa com o app em segundo plano) e sobrevive a um recarregar (sessionStorage).
  function fmtSegundos(seg) { return seg < 60 ? `${seg} s` : `${Math.floor(seg / 60)} min${seg % 60 ? ` ${seg % 60}` : ''}`; }
  function fmtRelogio(seg) { return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`; }
  function salvarTemporizador() {
    const valor = { ...config.temporizador };
    // Sem a coluna ou sem a permissão (schema.sql antigo), a escolha vale só nesta sessão, sem aviso de erro.
    salvarPerfil({ temporizador: valor }, ['temporizador']);
  }
  function renderTemporizadorConfig() {
    const t = config.temporizador;
    $('temp-ativo').checked = t.ativo;
    $('temp-opcoes').hidden = !t.ativo;
    $('temp-vibrar').checked = t.vibrar;
    $('temp-som').checked = t.som;
    $('temp-tempos').innerHTML = TEMPOS_DESCANSO.map((seg) =>
      `<button class="chip" type="button" data-temp-padrao="${seg}" aria-pressed="${seg === t.segundos}">${fmtSegundos(seg)}</button>`).join('');
  }
  $('temp-ativo').addEventListener('change', (e) => {
    config.temporizador.ativo = e.target.checked;
    if (!config.temporizador.ativo) pararDescanso(false);
    salvarTemporizador();
    registrarEvento('temporizador', { ativo: config.temporizador.ativo });
    renderTemporizadorConfig(); renderMenuVoce(); renderFabDescanso();
    toast(config.temporizador.ativo ? 'Timer ligado: o botão aparece na tela Treino.' : 'Timer desligado.');
  });
  $('temp-vibrar').addEventListener('change', (e) => { config.temporizador.vibrar = e.target.checked; salvarTemporizador(); });
  $('temp-som').addEventListener('change', (e) => {
    config.temporizador.som = e.target.checked;
    salvarTemporizador();
    if (e.target.checked) { liberarSom(); tocarSom(); }
  });

  // Som do fim do timer: três bipes gerados na hora (Web Audio), que tocam por cima da música sem pausá-la.
  // Não usar <audio> nem audioSession 'playback': os dois tomam o áudio do celular e param o Spotify (e outros apps).
  // A troca: no iPhone com a chave de silencioso ligada o bipe não toca (fica o aviso na tela).
  // O navegador só deixa tocar depois de um toque da pessoa: no toque que inicia o timer, o app libera o áudio.
  let audioTimer = null;
  const BIPES = [[0, 0.2, 880], [0.28, 0.2, 880], [0.56, 0.45, 1320]];
  function liberarSom() {
    // iOS 17 ou mais: 'ambient' mistura com o som de outros apps (música, podcast) em vez de interromper.
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (_) {}
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioTimer) audioTimer = new AC();
      if (audioTimer.state !== 'running') audioTimer.resume();
      // Um trecho mudo dentro do toque destrava o áudio nos iPhones mais antigos.
      if (audioTimer.createBuffer) {
        const src = audioTimer.createBufferSource();
        src.buffer = audioTimer.createBuffer(1, 1, 22050);
        src.connect(audioTimer.destination); src.start(0);
      }
    } catch (_) {}
  }
  function tocarSom() {
    if (!audioTimer) liberarSom();
    if (!audioTimer) return;
    try {
      if (audioTimer.state !== 'running') audioTimer.resume();
      const t0 = audioTimer.currentTime + 0.05;
      BIPES.forEach(([d, dur, freq]) => {
        const osc = audioTimer.createOscillator();
        const vol = audioTimer.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        vol.gain.setValueAtTime(0.0001, t0 + d);
        vol.gain.exponentialRampToValueAtTime(0.5, t0 + d + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, t0 + d + dur);
        osc.connect(vol).connect(audioTimer.destination);
        osc.start(t0 + d); osc.stop(t0 + d + dur + 0.05);
      });
    } catch (_) {}
  }
  $('temp-tempos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-temp-padrao]');
    if (!b) return;
    config.temporizador.segundos = Number(b.dataset.tempPadrao);
    salvarTemporizador();
    renderTemporizadorConfig(); renderMenuVoce();
  });

  function renderFabDescanso() {
    const fab = $('fab-descanso');
    fab.hidden = !(usuario && config.temporizador.ativo && telaAtual() === 'treino');
    document.body.classList.toggle('com-descanso', !fab.hidden);
    const rodando = !!desc.fim;
    fab.classList.toggle('rodando', rodando);
    $('fab-descanso-tempo').hidden = !rodando;
    if (rodando) {
      const r = restante();
      $('fab-descanso-tempo').textContent = fmtRelogio(r);
      fab.style.setProperty('--p', String(desc.total ? (desc.total - r) / desc.total : 0));
      fab.setAttribute('aria-label', `Timer: faltam ${fmtRelogio(r)}`);
    } else {
      fab.style.removeProperty('--p');
      fab.setAttribute('aria-label', 'Timer');
    }
  }

  const descansoDialog = $('descanso-dialog');
  function renderDescanso() {
    const escolhido = desc.escolhido || config.temporizador.segundos;
    let corpo;
    if (desc.fim) {
      corpo = `
        <p class="desc-contador" id="desc-contador" role="timer" aria-live="off">${fmtRelogio(restante())}</p>
        <p class="desc-status">Timer de ${fmtSegundos(desc.total)}</p>
        <div class="desc-acoes">
          <button class="btn-sec" type="button" data-desc-ajuste="-15">−15 s</button>
          <button class="btn-sec" type="button" data-desc-ajuste="15">+15 s</button>
          <button class="btn-sec" type="button" data-desc-pular>Pular</button>
        </div>
        <button class="modal-done" type="button" data-fechar>Fechar (continua contando)</button>`;
    } else {
      corpo = `
        ${desc.acabou ? '<p class="desc-contador acabou">0:00</p><p class="desc-status acabou">Tempo esgotado!</p>' : ''}
        <p class="temp-rotulo" id="desc-tempo-rotulo">Tempo</p>
        <div class="chips temp-tempos" role="group" aria-labelledby="desc-tempo-rotulo">
          ${TEMPOS_DESCANSO.map((seg) => `<button class="chip" type="button" data-desc-tempo="${seg}" aria-pressed="${seg === escolhido}">${fmtSegundos(seg)}</button>`).join('')}
        </div>
        <button class="modal-done" type="button" data-desc-iniciar>${desc.acabou ? 'Novo timer' : 'Iniciar timer'}</button>`;
    }
    $('descanso-body').innerHTML = `
      <div class="modal-head"><div><h3 id="descanso-title">Timer</h3></div>${BOTAO_FECHAR}</div>
      ${corpo}
      <p class="sr-only" id="desc-anuncio" aria-live="assertive"></p>`;
  }
  function tickDescanso() {
    if (!desc.fim) return;
    if (restante() <= 0) return terminarDescanso();
    renderFabDescanso();
    const c = $('desc-contador');
    if (c && descansoDialog.open) c.textContent = fmtRelogio(restante());
  }
  function iniciarDescanso(seg) {
    if (config.temporizador.som) liberarSom();
    desc = { fim: Date.now() + seg * 1000, total: seg, acabou: false, escolhido: seg };
    guardarDescanso();
    clearInterval(relogioDescanso);
    relogioDescanso = setInterval(tickDescanso, 250);
    $('fab-descanso').classList.remove('acabou');
    registrarEvento('descanso', { acao: 'iniciado', segundos: seg });
    renderFabDescanso();
    if (descansoDialog.open) renderDescanso();
  }
  function pararDescanso(registrar) {
    if (registrar && desc.fim) registrarEvento('descanso', { acao: 'pulado', segundos: desc.total, faltavam: restante() });
    clearInterval(relogioDescanso); relogioDescanso = null;
    desc = { ...desc, fim: null, acabou: false };
    guardarDescanso();
    renderFabDescanso();
  }
  function terminarDescanso() {
    const total = desc.total;
    clearInterval(relogioDescanso); relogioDescanso = null;
    desc = { ...desc, fim: null, acabou: true };
    guardarDescanso();
    if (config.temporizador.som) tocarSom();
    if (config.temporizador.vibrar && navigator.vibrate) { try { navigator.vibrate([250, 120, 250]); } catch (_) {} }
    registrarEvento('descanso', { acao: 'completo', segundos: total });
    const fab = $('fab-descanso');
    fab.classList.add('acabou');
    clearTimeout(acabouTimer);
    acabouTimer = setTimeout(() => fab.classList.remove('acabou'), 4000);
    renderFabDescanso();
    if (descansoDialog.open) renderDescanso();
    const anuncio = $('desc-anuncio');
    if (anuncio) anuncio.textContent = 'Tempo esgotado!';
    else toast('Tempo esgotado!');
  }
  $('fab-descanso').addEventListener('click', () => {
    if (config.temporizador.som) liberarSom();
    // Parado: começa no padrão; depois de um descanso, "Novo timer" repete o mesmo tempo.
    if (!desc.fim && !desc.acabou) desc.escolhido = null;
    renderDescanso();
    if (!descansoDialog.open) descansoDialog.showModal();
  });
  descansoDialog.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (e.target === descansoDialog || (b && 'fechar' in b.dataset)) {
      if (!desc.fim) desc.acabou = false;
      return descansoDialog.close();
    }
    if (!b) return;
    if (b.dataset.descTempo) { desc.escolhido = Number(b.dataset.descTempo); return renderDescanso(); }
    if ('descIniciar' in b.dataset) return iniciarDescanso(desc.escolhido || config.temporizador.segundos);
    if (b.dataset.descAjuste && desc.fim) {
      desc.fim = Math.max(Date.now() + 1000, desc.fim + Number(b.dataset.descAjuste) * 1000);
      desc.total = Math.max(1, desc.total + Number(b.dataset.descAjuste));
      guardarDescanso(); tickDescanso();
      return renderDescanso();
    }
    if ('descPular' in b.dataset) { pararDescanso(true); return renderDescanso(); }
  });
  // Ao voltar para o app, o contador mostra o tempo certo (ou o fim, se já passou).
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tickDescanso(); });
  if (desc.fim) relogioDescanso = setInterval(tickDescanso, 250);

  $('resumo-email').addEventListener('change', (e) => {
    config.resumoEmail = e.target.checked;
    salvarPerfil({ emails_resumo: config.resumoEmail });
    registrarEvento('resumo_email', { ativo: config.resumoEmail });
    toast(config.resumoEmail ? 'Você vai receber o resumo toda sexta.' : 'Você não vai mais receber o resumo semanal.');
  });

  $('sair').addEventListener('click', async () => {
    salvarNome();
    salvarSeriesPendentes();
    // Mudanças feitas sem internet ainda não enviadas: sair agora as perderia (a cópia do aparelho é apagada ao sair).
    await sincronizar();
    if (pendentes.length) {
      toast('Há alterações feitas sem internet que ainda não foram enviadas. Conecte-se e tente sair de novo.');
      return;
    }
    registrarEvento('saiu');
    try { localStorage.removeItem(CHAVE_SESSAO); } catch (_) {}
    desligarPresenca();
    await Promise.all([fila, enviarEventos()]);
    esquecerCopia();
    await sb.auth.signOut();
  });
