// js/inicio.js: login com Google e abertura do app. Carrega por último: usa o que os outros arquivos definem.
// Parte do app (index.html). Os arquivos de js/ dividem o mesmo escopo global e carregam na ordem do index.html;
// o mapa das seções está em docs/MAPA.md.

  // ---------- Entrada (login com Google) ----------
  const ICONE_GOOGLE = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function mostrarEntrada(modo, msg = '') {
    document.body.classList.add('deslogado');
    esconderCarga();
    $('tela-entrar').hidden = false;
    $('entrar-google').hidden = modo !== 'login';
    $('entrar-tentar').hidden = modo !== 'erro';
    $('entrar-privacidade').hidden = modo !== 'login';
    $('entrar-carga').hidden = modo !== 'carregando';
    $('entrar-erro').textContent = modo === 'login' ? msg : '';
    $('entrar-erro').hidden = !(modo === 'login' && msg);
    $('convite-form').hidden = modo !== 'convite';
    $('entrar-status').textContent = {
      carregando: 'Carregando seus treinos…',
      config: 'O app ainda não está ligado ao Supabase. Preencha o endereço e a chave do projeto no ambiente.js (o passo a passo está no README).',
      login: navigator.onLine === false ? 'Você está sem internet. Conecte-se para entrar com o Google.' : conviteGuardado() ? 'Você foi convidado para o Gestão de Treinos! Entre com o Google para começar.' : 'Seus treinos, suas cargas e seu progresso, sempre com você.',
      convite: 'O Gestão de Treinos é só para convidados. Digite o código do convite que você recebeu ou peça acesso.',
      erro: msg,
    }[modo];
  }

  // Esqueleto da tela Treino enquanto os dados chegam; a etapa aparece em cima e é lida pelo leitor de tela.
  const ESQ_CORES = ['musc', 'jiu', 'bike', 'muay', 'surf'];
  function esqueletoHTML() {
    const b = (cls = '') => `<span class="esq-b ${cls}"></span>`;
    const cor = (n) => `--cor:var(--${ESQ_CORES[n % ESQ_CORES.length]})`;
    const abas = ESQ_CORES.map((_, n) => `<i style="${cor(n)}"></i>`).join('');
    const ex = (n) => `<div class="esq-ex" style="--n:${n};${cor(n)}">${b('n')}${b('s')}${b('x')}</div>`;
    return `<div class="esq" aria-hidden="true">
      <div class="esq-topo">${b('d')}${b('h')}</div>
      <div class="esq-abas">${abas}</div>
      ${b('esq-titulo')}
      ${[0, 1, 2, 3].map(ex).join('')}
      <div class="esq-botao"></div>
    </div>`;
  }
  function mostrarCarga(etapa) {
    const el = $('tela-carga');
    if (el.hidden) {
      el.innerHTML = `<p class="carga-etapa" role="status" id="carga-etapa"></p>${esqueletoHTML()}`;
      el.setAttribute('aria-busy', 'true');
      el.hidden = false;
      $('tela-entrar').hidden = true;
    }
    $('carga-etapa').textContent = etapa;
  }
  function esconderCarga() {
    const el = $('tela-carga');
    el.hidden = true;
    el.removeAttribute('aria-busy');
    el.innerHTML = '';
  }

  // Primeira abertura: os blocos da tela visível entram um depois do outro (sem movimento, se o sistema pedir).
  function entrarEmCascata() {
    const tela = ['tela-treino', 'tela-dashboard', 'tela-voce'].map($).find((t) => !t.hidden);
    if (!tela) return;
    const blocos = [...tela.querySelectorAll(':scope > header, :scope > .controles, :scope > main > *, :scope > :not(header, .controles, main)')]
      .filter((el) => el.offsetParent !== null).slice(0, 10);
    blocos.forEach((el, i) => { el.classList.add('entra-item'); el.style.setProperty('--i', String(i)); });
    document.body.classList.add('entra');
    setTimeout(() => {
      document.body.classList.remove('entra');
      blocos.forEach((el) => { el.classList.remove('entra-item'); el.style.removeProperty('--i'); });
    }, 600 + blocos.length * 55);
  }

  function renderizarApp() {
    renderHoje();
    renderTudo();
    renderFoto();
    preencherPerfil();
    atualizarCheckinUI();
    mostrarTela();
  }

  let relogio = null;
  async function entrarNoApp(sessao) {
    usuario = sessao.user;
    const voltouDoGoogle = /[?&]code=/.test(location.search);
    mostrarCarga('Buscando seus treinos…');
    // Limpa o código de retorno do login do Google da barra de endereço.
    if (/[?&]code=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
    const mesmaConta = () => usuario && usuario.id === sessao.user.id;
    try {
      await carregarDados();
      if (!mesmaConta()) return; // saiu (ou o login caiu) enquanto carregava
      mostrarCarga('Conferindo seu acesso…');
      if (!(await temAcesso())) return;
      // Sem internet (abriu com a cópia do aparelho), a migração fica para a próxima abertura com internet.
      if (!modoOffline) await migrarDadosLocais();
    } catch (_) {
      if (!mesmaConta()) return;
      // Sem internet: aviso amigável, e o app tenta de novo sozinho quando a conexão voltar (ver "online" abaixo).
      mostrarEntrada('erro', navigator.onLine === false
        ? 'Você está sem internet. Seus treinos aparecem aqui assim que a conexão voltar.'
        : 'Não foi possível carregar seus dados. Confira a internet e tente de novo.');
      return;
    }
    if (!mesmaConta()) return;
    // Um quadro com a última etapa antes de montar a tela (antes da presença, que precisa ligar junto com a tela).
    mostrarCarga('Montando sua semana…');
    await new Promise((ok) => requestAnimationFrame(() => ok()));
    // Conta o acesso (último acesso e quantidade, vistos só no Supabase). Sem a função no banco, segue normal.
    sb.rpc('registrar_acesso').then(() => {}, () => {});
    ligarPresenca();
    let anterior = null;
    try { anterior = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); } catch (_) {}
    registrarEvento('sessao', { ...infoAparelho(), login: voltouDoGoogle });
    if (voltouDoGoogle && anterior && anterior.id === usuario.id) {
      registrarEvento('sessao_perdida', { ...infoAparelho(), horas_desde: Math.round((Date.now() - anterior.visto) / 36e5) });
    }
    marcarSessao();
    guardarVersaoCarregada();
    guardarTemaLocal();
    aplicarTema();
    esconderCarga();
    document.body.classList.remove('deslogado');
    $('tela-entrar').hidden = true;
    const esquecido = encerrarEsquecidos();
    abrirTreinoDoDia();
    renderizarApp();
    entrarEmCascata();
    // Conta nova: boas-vindas em passos (o app → seus dados → objetivo); a privacidade vem antes de gravar a escolha.
    if (window.AMBIENTE.dev && new URLSearchParams(location.search).has('boas-vindas')) {
      // Teste no dev: tira o parâmetro do endereço (recarregar não abre de novo) e mostra as 3 etapas.
      history.replaceState(null, '', location.pathname + location.hash);
      bvTeste = true;
      abrirJornadas('boas-vindas');
    } else if (vaiVerBoasVindas()) mostrarNovidadeSeFaltar();
    else if (politica.disponivel && !politica.aceita) abrirPolitica();
    else mostrarNovidadeSeFaltar();
    if (esquecido) {
      toast(`O check-in do ${TIPOS[esquecido.tipo].nome} ficou aberto e foi encerrado às ${horaDe(esquecido.fim)}.`);
    } else avisarTreinosDoPersonal();
    // Mantém o horário do topo e a barra de treino em andamento atualizados.
    if (!relogio) relogio = setInterval(() => { renderHoje(); renderAtivo(); }, 15000);
    // O que foi feito sem internet em outra abertura sai agora (ou quando a conexão voltar).
    if (pendentes.length) sincronizar();
    atualizarPendentesUI();
  }

  $('entrar-google').innerHTML = `${ICONE_GOOGLE}<span>Continuar com o Google</span>`;
  $('entrar-google').addEventListener('click', async () => {
    $('entrar-google').disabled = true;
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname },
    });
    if (error) {
      $('entrar-google').disabled = false;
      mostrarEntrada('erro', 'Não foi possível abrir o login do Google. Tente de novo.');
    }
  });
  $('entrar-tentar').addEventListener('click', () => {
    if (usuario) entrarNoApp({ user: usuario });
  });
  // A internet voltou com a tela de erro aberta: tenta de novo sozinho.
  window.addEventListener('online', () => { if (!$('entrar-tentar').hidden && usuario) entrarNoApp({ user: usuario }); });

  // ---------- Início ----------
  aplicarTema();
  // App instalável: o service worker guarda os arquivos do site para abrir rápido e com internet ruim (sw.js).
  // No computador (localhost) fica desligado, para nunca servir arquivo velho enquanto se mexe no código.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // Volta do link "Não quero mais receber" do resumo semanal (a função já desligou a opção no banco).
  if (new URLSearchParams(location.search).get('resumo') === 'desligado') {
    history.replaceState(null, '', location.pathname + location.hash);
    toast('Pronto: você não vai mais receber o resumo semanal.');
  }
  if (!sb) {
    mostrarEntrada('config');
  } else {
    mostrarEntrada('carregando');
    // Na volta do Google chegam dois eventos com a mesma sessão (INITIAL_SESSION e SIGNED_IN);
    // entrandoId garante que os dados sejam carregados uma vez só.
    let entrandoId = null;
    // Abertura sem internet: com o login vencido, a biblioteca do Supabase passa até 30 s tentando renová-lo antes de
    // responder (e aí responde "sem sessão"). Se a conta deixou a conta e a cópia dos dados neste aparelho (só somem
    // ao sair), o app abre logo com elas: na hora quando o aparelho diz que está sem internet, e depois de 3 s sem
    // resposta do login (Wi-Fi sem internet, sinal fraco). A sessão é renovada quando a internet voltar.
    let entrouComCopia = false;
    const guardado = usuarioGuardado();
    if (guardado && temCopia(guardado.id)) {
      const entrarComCopia = () => {
        if (entrandoId) return;
        entrandoId = guardado.id;
        entrouComCopia = true;
        entrarNoApp({ user: guardado });
      };
      setTimeout(entrarComCopia, navigator.onLine === false ? 0 : 3000);
    }
    sb.auth.onAuthStateChange((evento, sessao) => {
      // Chamadas ao Supabase ficam fora do callback para não travar o cliente de autenticação.
      if (sessao) {
        if (entrandoId !== sessao.user.id) {
          entrandoId = sessao.user.id;
          setTimeout(() => entrarNoApp(sessao), 0);
        } else if (entrouComCopia && usuario && usuario.id === sessao.user.id) {
          // Abriu com a cópia e o login foi renovado: segue com a sessão e envia o que ficou guardado.
          usuario = sessao.user;
          setTimeout(() => voltouAInternet(), 0);
        }
        return;
      }
      // Já aberto com a cópia e ainda sem internet: o "sem sessão" é a renovação que não deu certo, não um logout.
      if (evento === 'INITIAL_SESSION' && entrouComCopia && usuario && (navigator.onLine === false || modoOffline)) return;
      entrandoId = null;
      entrouComCopia = false;
      desligarPresenca();
      usuario = null;
      checkins = [];
      $('entrar-google').disabled = false;
      setTimeout(() => mostrarLoginComMotivo(), 0);
    });
  }

  // Se a volta do Google não criou a sessão, mostra o motivo em vez de só pedir o login de novo.
  async function mostrarLoginComMotivo() {
    let motivo = retornoLogin.erro;
    if (!motivo && retornoLogin.temCodigo) {
      const { error } = await sb.auth.initialize();
      motivo = error
        ? error.message
        : 'O Google aprovou o login, mas a sessão não foi criada neste navegador. Abra o app direto no Chrome ou no Safari (não pelo navegador de outro app) e tente de novo.';
    }
    retornoLogin.erro = '';
    retornoLogin.temCodigo = false;
    if (/[?&](code|error|error_description)=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
    mostrarEntrada('login', motivo ? `Não foi possível concluir o login: ${motivo}` : '');
  }
