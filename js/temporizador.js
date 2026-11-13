// js/temporizador.js: temporizador de descanso entre séries.
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
    toast(config.temporizador.ativo ? 'Temporizador ligado: o botão aparece na tela Treino.' : 'Temporizador desligado.');
  });
  $('temp-vibrar').addEventListener('change', (e) => { config.temporizador.vibrar = e.target.checked; salvarTemporizador(); });
  $('temp-som').addEventListener('change', (e) => {
    config.temporizador.som = e.target.checked;
    salvarTemporizador();
    if (e.target.checked) { liberarSom(); tocarSom(); }
  });

  // Som do fim do descanso: três bipes num áudio WAV gerado pelo app (sem arquivo no site).
  // Tocado como mídia (<audio>), ele toca mesmo com o iPhone no silencioso, o que o som gerado na hora (Web Audio) não faz.
  // O navegador só deixa tocar depois de um toque da pessoa: no toque que inicia o descanso, o mesmo elemento toca um
  // trecho mudo, e assim fica liberado para tocar os bipes sozinho no fim. Web Audio fica de reserva.
  let audioDescanso = null; // Web Audio (reserva)
  let audioEl = null;
  let somBipe = null;
  let somMudo = null;
  function wav(duracao, amostra) {
    const taxa = 8000; const n = Math.round(taxa * duracao);
    const buf = new ArrayBuffer(44 + n * 2); const v = new DataView(buf);
    const txt = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    txt(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, taxa, true); v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    txt(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, amostra(i / taxa))) * 32767, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }
  const BIPES = [[0, 0.2, 880], [0.28, 0.2, 880], [0.56, 0.45, 1320]];
  function amostraBipe(t) {
    for (const [ini, dur, freq] of BIPES) {
      if (t >= ini && t < ini + dur) {
        const x = t - ini;
        const env = Math.min(1, x / 0.01) * Math.min(1, (dur - x) / 0.05);
        return 0.6 * env * Math.sin(2 * Math.PI * freq * x);
      }
    }
    return 0;
  }
  function liberarSom() {
    // iOS 17 ou mais: o som do app é "reprodução" (não respeita a chave de silencioso nem é cortado pela música).
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
    try {
      if (!audioEl) {
        audioEl = new Audio(); audioEl.preload = 'auto';
        somBipe = wav(1.05, amostraBipe); somMudo = wav(0.1, () => 0);
      }
      audioEl.dataset.som = 'mudo'; audioEl.src = somMudo;
      const r = audioEl.play(); if (r && r.catch) r.catch(() => {});
    } catch (_) {}
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioDescanso) audioDescanso = new AC();
      if (audioDescanso.state !== 'running') audioDescanso.resume();
    } catch (_) {}
  }
  function tocarBipesWebAudio() {
    if (!audioDescanso) return;
    try {
      if (audioDescanso.state !== 'running') audioDescanso.resume();
      const t0 = audioDescanso.currentTime + 0.05;
      BIPES.forEach(([d, dur, freq]) => {
        const osc = audioDescanso.createOscillator();
        const vol = audioDescanso.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        vol.gain.setValueAtTime(0.0001, t0 + d);
        vol.gain.exponentialRampToValueAtTime(0.5, t0 + d + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, t0 + d + dur);
        osc.connect(vol).connect(audioDescanso.destination);
        osc.start(t0 + d); osc.stop(t0 + d + dur + 0.05);
      });
    } catch (_) {}
  }
  function tocarSom() {
    if (!audioEl) return tocarBipesWebAudio();
    try {
      audioEl.dataset.som = 'bipe'; audioEl.src = somBipe; audioEl.currentTime = 0;
      const r = audioEl.play();
      if (r && r.catch) r.catch(() => tocarBipesWebAudio());
    } catch (_) { tocarBipesWebAudio(); }
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
      fab.setAttribute('aria-label', `Temporizador de descanso: faltam ${fmtRelogio(r)}`);
    } else {
      fab.style.removeProperty('--p');
      fab.setAttribute('aria-label', 'Temporizador de descanso');
    }
  }

  const descansoDialog = $('descanso-dialog');
  function renderDescanso() {
    const escolhido = desc.escolhido || config.temporizador.segundos;
    let corpo;
    if (desc.fim) {
      corpo = `
        <p class="desc-contador" id="desc-contador" role="timer" aria-live="off">${fmtRelogio(restante())}</p>
        <p class="desc-status">Descansando: ${fmtSegundos(desc.total)}</p>
        <div class="desc-acoes">
          <button class="btn-sec" type="button" data-desc-ajuste="-15">−15 s</button>
          <button class="btn-sec" type="button" data-desc-ajuste="15">+15 s</button>
          <button class="btn-sec" type="button" data-desc-pular>Pular</button>
        </div>
        <button class="modal-done" type="button" data-fechar>Fechar (continua contando)</button>`;
    } else {
      corpo = `
        ${desc.acabou ? '<p class="desc-contador acabou">0:00</p><p class="desc-status acabou">Bora para a próxima série!</p>' : ''}
        <p class="temp-rotulo" id="desc-tempo-rotulo">Tempo de descanso</p>
        <div class="chips temp-tempos" role="group" aria-labelledby="desc-tempo-rotulo">
          ${TEMPOS_DESCANSO.map((seg) => `<button class="chip" type="button" data-desc-tempo="${seg}" aria-pressed="${seg === escolhido}">${fmtSegundos(seg)}</button>`).join('')}
        </div>
        <button class="modal-done" type="button" data-desc-iniciar>${desc.acabou ? 'Novo descanso' : 'Iniciar descanso'}</button>`;
    }
    $('descanso-body').innerHTML = `
      <div class="modal-head"><div><h3 id="descanso-title">Descanso</h3></div>${BOTAO_FECHAR}</div>
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
    if (anuncio) anuncio.textContent = 'Descanso terminado. Bora para a próxima série!';
    else toast('Descanso terminado. Bora para a próxima série!');
  }
  $('fab-descanso').addEventListener('click', () => {
    if (config.temporizador.som) liberarSom();
    // Parado: começa no padrão; depois de um descanso, "Novo descanso" repete o mesmo tempo.
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
