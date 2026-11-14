// js/conta.js: excluir conta, privacidade (LGPD) e convites.
// Parte do app (index.html). Os arquivos de js/ dividem o mesmo escopo global e carregam na ordem do index.html;
// o mapa das seções está em docs/MAPA.md.

  // ---------- Excluir conta ----------
  const excluirDialog = $('excluir-dialog');
  const ICON_MENOS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  function abrirExcluirConta() {
    $('excluir-body').innerHTML = `
      <div class="modal-head"><div><h3 id="excluir-title">Excluir sua conta?</h3></div>${BOTAO_FECHAR}</div>
      <p class="resumo-enc">Que pena ver você indo embora! Antes de confirmar, é importante saber que a exclusão é definitiva. Vamos apagar para sempre:</p>
      <ul class="excluir-lista">
        <li>${ICON_MENOS}<span>Todos os seus check-ins e o histórico do calendário</span></li>
        <li>${ICON_MENOS}<span>Os pesos, as cargas e os recordes de cada exercício</span></li>
        <li>${ICON_MENOS}<span>Os treinos que você montou e a sua semana</span></li>
        <li>${ICON_MENOS}<span>Sua foto, seu nome e suas preferências</span></li>
        <li>${ICON_MENOS}<span>O resumo semanal por e-mail, que para de chegar</span></li>
      </ul>
      <p class="excluir-alerta"><b>Não dá para desfazer.</b> Se você entrar de novo com o Google depois, a conta começa do zero, sem nada do que foi salvo até hoje.</p>
      <p class="excluir-dica">Só quer dar um tempo? Você pode sair da conta ou desligar o resumo em Notificações: tudo continua guardado para quando voltar.</p>
      <label class="excluir-entendi"><input type="checkbox" id="excluir-entendi"><span>Entendi que vou perder todas as minhas informações.</span></label>
      <p class="form-erro" id="excluir-erro" role="alert" hidden></p>
      <div class="excluir-acoes">
        <button class="modal-done perigo" type="button" id="excluir-sim" disabled>Excluir minha conta</button>
        <button class="btn-sec" type="button" data-fechar>Quero continuar treinando</button>
      </div>`;
    excluirDialog.showModal();
    registrarEvento('excluir_conta', { etapa: 'abriu' });
  }
  async function confirmarExcluirConta() {
    const botao = $('excluir-sim');
    botao.disabled = true;
    botao.textContent = 'Excluindo…';
    $('excluir-erro').hidden = true;
    salvarSeriesPendentes();
    await fila;
    // As fotos ficam no Storage, fora do banco: apaga antes, porque a exclusão em cascata não chega lá.
    if (fotosLigadas) await apagarFotos(checkins.filter((c) => c.foto).map((c) => c.foto));
    const { error } = await sb.rpc('excluir_conta');
    if (error) {
      const semFuncao = /could not find the function|excluir_conta/i.test(error.message || '');
      $('excluir-erro').textContent = semFuncao
        ? 'A exclusão de conta ainda não foi ligada no servidor. Tente de novo mais tarde.'
        : 'Não foi possível excluir agora. Confira a internet e tente de novo.';
      $('excluir-erro').hidden = false;
      botao.textContent = 'Excluir minha conta';
      botao.disabled = !$('excluir-entendi').checked;
      registrarErro('excluir_conta', error.message);
      return;
    }
    // A conta não existe mais: nada de eventos, presença nem marcas deste usuário no aparelho.
    eventosFila = []; clearTimeout(eventosTimer); eventosTimer = null;
    try {
      [CHAVE_SESSAO, chaveNovidade(), `bauer-migrado-${usuario.id}`].forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
    esquecerCopia();
    desligarPresenca();
    excluirDialog.close();
    await sb.auth.signOut();
    toast('Sua conta foi excluída. Obrigado por ter treinado com a gente!');
  }
  $('excluir-conta').addEventListener('click', abrirExcluirConta);
  excluirDialog.addEventListener('change', (e) => {
    if (e.target.id === 'excluir-entendi') $('excluir-sim').disabled = !e.target.checked;
  });
  excluirDialog.addEventListener('click', (e) => {
    if (e.target.closest('#excluir-sim')) return confirmarExcluirConta();
    if (e.target === excluirDialog || e.target.closest('[data-fechar]')) excluirDialog.close();
  });

  // ---------- Privacidade (LGPD) ----------
  const politicaDialog = $('politica-dialog');
  // Itens do aviso de privacidade: na janela própria (política nova) e no passo "Seus dados" das boas-vindas.
  function itensPolitica(novidadeFoto) {
    return `
      <ul class="novidade-lista">
        <li>${ICON_CHECK}<span>Guardamos seus treinos, check-ins e pesos para o app funcionar, só enquanto sua conta existir.</span></li>
        ${novidadeFoto ? `<li>${ICON_CHECK}<span>Agora dá para anexar uma foto ao check-in, se quiser. Ela fica guardada de forma privada: só você vê; o administrador não.</span></li>` : ''}
        <li>${ICON_CHECK}<span>O administrador vê quem está com o app aberto, em que tela, e o histórico de uso. Não vê pesos, cargas nem observações.</span></li>
        <li>${ICON_CHECK}<span>Observações nos check-ins ficam desligadas até você ligar em Você → Privacidade.</span></li>
        ${AREA_PERSONAL ? `<li>${ICON_CHECK}<span>Se um personal trainer convidar você e você aceitar, ele vê seus treinos, semana, check-ins e pesos (nunca observações e fotos) até você encerrar em Você → Meu personal.</span></li>` : ''}
        <li>${ICON_CHECK}<span>Em Você → Privacidade você baixa seus dados, e em Você dá para excluir a conta.</span></li>
      </ul>`;
  }
  function abrirPolitica() {
    $('politica-body').innerHTML = `
      <div class="modal-head"><div><span class="novidade-selo">Privacidade</span><h3 id="politica-title">${politica.contaNova ? 'Antes de começar' : 'Atualizamos nossa Política de Privacidade'}</h3></div></div>
      <p class="resumo-enc">${politica.contaNova ? 'Veja como cuidamos dos seus dados.' : 'Veja o que mudou.'}</p>
      ${itensPolitica(!politica.contaNova)}
      <div class="novidade-acoes">
        <button class="modal-done" type="button" data-politica-ok>Entendi</button>
        <a class="btn-sec priv-link" href="privacidade.html" target="_blank" rel="noopener">Ler a política completa</a>
      </div>`;
    politicaDialog.showModal();
  }
  function registrarAceitePolitica() {
    if (politica.aceita) return;
    politica.aceita = true;
    salvarPerfil({ politica_versao: POLITICA_VERSAO });
    registrarEvento('politica_aceita', { versao: POLITICA_VERSAO });
  }
  function aceitarPolitica() {
    registrarAceitePolitica();
    politicaDialog.close();
    mostrarNovidadeSeFaltar();
  }
  politicaDialog.addEventListener('click', (e) => { if (e.target.closest('[data-politica-ok]')) aceitarPolitica(); });

  // Links para a política abrem dentro do app (sair para outra aba e voltar recarregava o app).
  const politicaVer = $('politica-ver');
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href="privacidade.html"]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const frame = $('politica-frame');
    if (!frame.getAttribute('src')) frame.src = 'privacidade.html?embed=1';
    else try { frame.contentWindow.scrollTo(0, 0); } catch (_) {}
    politicaVer.showModal();
    if (usuario) registrarEvento('politica_lida');
  });
  politicaVer.addEventListener('click', (e) => { if (e.target === politicaVer || e.target.closest('[data-fechar]')) politicaVer.close(); });
  // Fechar com Esc conta como "Entendi" (o aviso já foi mostrado e a política fica a um toque em Privacidade).
  politicaDialog.addEventListener('cancel', (e) => { e.preventDefault(); aceitarPolitica(); });

  // Consentimento para guardar observações (podem revelar saúde), em Você → Privacidade.
  // Vem desligado. Ligar é consentir; desligar retira o consentimento na hora, sem confirmação,
  // e apaga as observações já registradas (LGPD).
  function renderPrivacidade() {
    $('saude-consent').checked = config.saude === 'sim';
  }
  $('saude-consent').addEventListener('change', (e) => {
    const ligar = e.target.checked;
    config.saude = ligar ? 'sim' : 'nao';
    salvarPerfil({ consentimento_saude: config.saude, consentimento_saude_em: new Date().toISOString() });
    let apagou = false;
    if (!ligar && checkins.some((c) => c.obs)) {
      apagou = true;
      checkins.forEach((c) => { c.obs = ''; });
      apagarObservacoes();
    }
    registrarEvento('consentimento_saude', { resposta: config.saude, origem: 'privacidade', apagou });
    atualizarCheckinUI();
    toast(ligar ? 'Pronto: o campo Observação aparece no check-in.' : apagou ? 'Observações desligadas e apagadas.' : 'Observações desligadas.');
  });

  // Baixar meus dados: arquivo JSON com tudo o que o app guarda sobre a pessoa.
  $('baixar-dados').addEventListener('click', async () => {
    const botao = $('baixar-dados');
    botao.disabled = true;
    salvarSeriesPendentes();
    await fila;
    const extras = await sb.rpc('meus_dados_extras');
    // Fotos dos check-ins: links temporários (24 h) para a própria pessoa baixar os arquivos.
    const comFoto = fotosLigadas ? checkins.filter((c) => c.foto) : [];
    let fotos = [];
    if (comFoto.length) {
      const { data } = await sb.storage.from(BUCKET_FOTOS).createSignedUrls(comFoto.map((c) => c.foto), 86400).catch(() => ({ data: null }));
      fotos = comFoto.map((c, i) => ({ checkin_id: c.id, arquivo: c.foto, link_24h: (data && data[i] && data[i].signedUrl) || null }));
    }
    const p = perfilLinha || {};
    const { foto, ...semFoto } = p;
    const arquivo = {
      gerado_em: new Date().toISOString(),
      app: 'Gestão de Treinos',
      politica_versao: POLITICA_VERSAO,
      perfil: { ...semFoto, nome: perfil.nome, email: perfil.email, tem_foto: !!perfil.foto, tema: config.tema, estilo: config.estilo, semana: config.semana,
        sem_peso: [...config.semPeso], emails_resumo: config.resumoEmail, consentimento_saude: config.saude, treinos: treinosDaConta ? treinosParaSalvar(TREINOS) : 'plano pronto' },
      checkins: checkins.map((c) => ({ ...c })),
      cargas: cargas.map((c) => ({ ...c })),
      ...(fotos.length ? { fotos } : {}),
      ...(extras.error ? { aviso: 'O registro de uso e os e-mails enviados não puderam ser incluídos agora.' } : extras.data || {}),
    };
    const blob = new Blob([JSON.stringify(arquivo, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gestao-de-treinos-meus-dados-${hoje()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    botao.disabled = false;
    $('baixar-status').textContent = extras.error
      ? 'Arquivo baixado. O registro de uso não veio agora; tente de novo mais tarde.'
      : 'Arquivo baixado com seus dados.';
    $('baixar-status').hidden = false;
    registrarEvento('dados_baixados');
  });

  // ---------- Convites ----------
  // O link ?convite=CODIGO é guardado no aparelho para sobreviver à ida e volta do login do Google.
  const CHAVE_CONVITE = 'bauer-convite';
  const conviteGuardado = () => { try { return localStorage.getItem(CHAVE_CONVITE) || ''; } catch (_) { return ''; } };
  const esquecerConvite = () => { try { localStorage.removeItem(CHAVE_CONVITE); } catch (_) {} };
  (() => {
    const busca = new URLSearchParams(location.search);
    const codigo = (busca.get('convite') || '').replace(/\s/g, '').toUpperCase().slice(0, 12);
    if (!codigo) return;
    try { localStorage.setItem(CHAVE_CONVITE, codigo); } catch (_) {}
    busca.delete('convite');
    history.replaceState(null, '', location.pathname + (busca.toString() ? `?${busca}` : '') + location.hash);
  })();
  const MOTIVOS_CONVITE = {
    invalido: 'Não encontramos esse código. Confira as letras e os números e tente de novo.',
    usado: 'Esse convite já foi usado. Peça um novo para quem te convidou.',
    expirado: 'Esse convite expirou (ele vale 7 dias). Peça um novo para quem te convidou.',
    cancelado: 'Esse convite foi cancelado. Peça um novo para quem te convidou.',
  };
  // Libera a entrada no app: conta liberada, administrador ou convite válido. Senão mostra a tela de convidados.
  // Um convite de personal (?personal=CODIGO) vem antes: aceitar também libera a conta.
  async function temAcesso() {
    const codPersonal = AREA_PERSONAL ? codigoPersonalGuardado() : '';
    if (codPersonal) {
      esquecerCodigoPersonal();
      if ((await oferecerPersonal(codPersonal)) === 'ok') {
        acesso.liberado = true;
        await carregarDados();
      }
    }
    if (acompanhamento) buscarMeuPersonal();
    if (acesso.liberado) return true;
    const admin = await sb.rpc('eh_admin');
    if (!admin.error && admin.data) return true;
    const codigo = conviteGuardado();
    if (codigo) {
      esquecerConvite();
      const r = await usarConvite(codigo);
      if (r === 'ok' || r === 'ja_liberado') return true;
      return mostrarConvidados(MOTIVOS_CONVITE[r] || '');
    }
    return mostrarConvidados('');
  }
  async function usarConvite(codigo) {
    const { data, error } = await sb.rpc('usar_convite', { p_codigo: codigo });
    const r = error ? 'erro' : data;
    registrarEvento('convite_usado', { resultado: r });
    if (r === 'ok' || r === 'ja_liberado') {
      acesso.liberado = true;
      toast('Convite aceito! Bem-vindo ao Gestão de Treinos.');
    }
    return r;
  }
  function mostrarConvidados(motivo) {
    mostrarEntrada('convite');
    $('convite-erro').textContent = motivo;
    $('convite-erro').hidden = !motivo;
    if (motivo) $('convite-codigo').setAttribute('aria-invalid', 'true'); else $('convite-codigo').removeAttribute('aria-invalid');
    renderPedido();
    return false;
  }
  function renderPedido() {
    const em = acesso.pedidoEm;
    $('convite-pedir').hidden = !!em;
    $('convite-pedido').hidden = !em;
    if (em) {
      const local = isoLocal(new Date(em));
      $('convite-pedido').textContent = `Pedido de acesso enviado em ${fmtData(local.slice(0, 10), { day: '2-digit', month: '2-digit' })} às ${horaDe(local)}. Quando for aprovado, é só abrir o app de novo.`;
    }
  }
  $('convite-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = $('convite-codigo').value.replace(/\s/g, '').toUpperCase();
    if (!codigo) return mostrarConvidados('Digite o código do convite.');
    $('convite-usar').disabled = true;
    const r = await usarConvite(codigo);
    $('convite-usar').disabled = false;
    if (r === 'ok' || r === 'ja_liberado') return entrarNoApp({ user: usuario });
    mostrarConvidados(r === 'erro' ? 'Não foi possível conferir o convite. Confira a internet e tente de novo.' : MOTIVOS_CONVITE[r]);
    $('convite-codigo').focus();
  });
  $('convite-codigo').addEventListener('input', () => { $('convite-erro').hidden = true; $('convite-codigo').removeAttribute('aria-invalid'); });
  $('convite-pedir').addEventListener('click', async () => {
    $('convite-pedir').disabled = true;
    const { error } = await sb.rpc('pedir_acesso');
    $('convite-pedir').disabled = false;
    if (error) return mostrarConvidados('Não foi possível enviar o pedido. Confira a internet e tente de novo.');
    acesso.pedidoEm = new Date().toISOString();
    registrarEvento('acesso_pedido');
    renderPedido();
  });
  $('convite-sair').addEventListener('click', async () => { await enviarEventos(); await sb.auth.signOut(); });

  // ---------- Meu personal (aluno) ----------
  // O link ?personal=CODIGO (gerado na área do personal) é guardado no aparelho para sobreviver ao login do Google.
  // Ao abrir o app, o aluno vê quem é o personal (nome e CREF), o que ele vai ver e o que nunca vai ver, e aceita ou não.
  const CHAVE_PERSONAL = 'bauer-convite-personal';
  const codigoPersonalGuardado = () => { try { return localStorage.getItem(CHAVE_PERSONAL) || ''; } catch (_) { return ''; } };
  const esquecerCodigoPersonal = () => { try { localStorage.removeItem(CHAVE_PERSONAL); } catch (_) {} };
  (() => {
    const busca = new URLSearchParams(location.search);
    const codigo = (busca.get('personal') || '').replace(/\s/g, '').toUpperCase().slice(0, 12);
    if (!codigo) return;
    // Com a área desligada (produção, por enquanto), o código só sai do endereço.
    if (AREA_PERSONAL) try { localStorage.setItem(CHAVE_PERSONAL, codigo); } catch (_) {}
    busca.delete('personal');
    history.replaceState(null, '', location.pathname + (busca.toString() ? `?${busca}` : '') + location.hash);
  })();
  const personalDialog = $('personal-dialog');
  const MOTIVOS_PERSONAL = {
    invalido: 'Não encontramos esse convite. Confira o link com o seu personal.',
    usado: 'Esse convite já foi usado. Peça um novo ao seu personal.',
    expirado: 'Esse convite expirou (ele vale 7 dias). Peça um novo ao seu personal.',
    cancelado: 'Esse convite foi cancelado. Peça um novo ao seu personal.',
    proprio: 'Esse é um convite seu, para os seus alunos. Mande o link para o aluno abrir no celular dele.',
    lotado: 'O seu personal chegou ao limite de alunos. Avise ele para liberar uma vaga.',
  };
  const itensPersonal = () => `
    <ul class="novidade-lista">
      <li>${ICON_CHECK}<span><b>Vai ver:</b> seus treinos, sua semana, quando você treinou (todas as atividades) e os pesos que você registra.</span></li>
      <li>${ICON_CHECK}<span><b>Vai montar:</b> os seus treinos. Eles chegam aqui sozinhos, e você não precisa montar nada.</span></li>
      <li>${ICON_CHECK}<span><b>Nunca vê:</b> suas observações e as fotos dos check-ins.</span></li>
      <li>${ICON_CHECK}<span>Você encerra quando quiser em Você → Meu personal, e os treinos continuam com você.</span></li>
    </ul>`;
  // Mostra o convite e espera a resposta: 'ok' (aceitou), 'nao' ou o motivo de o convite não valer.
  async function oferecerPersonal(codigo) {
    const { data, error } = await sb.rpc('ver_convite_personal', { p_codigo: codigo });
    const c = !error && data && data[0];
    const situacao = error ? 'erro' : c ? c.situacao : 'invalido';
    registrarEvento('personal_convite', { resultado: situacao === 'ok' ? 'visto' : situacao });
    return new Promise((resolver) => {
      const fim = (r) => { personalDialog.close(); resolver(r); };
      if (situacao !== 'ok') {
        $('personal-body').innerHTML = `
          <div class="modal-head"><div><span class="novidade-selo">Convite do personal</span><h3 id="personal-title">Não deu certo</h3></div></div>
          <p class="resumo-enc">${situacao === 'erro' ? 'Não foi possível conferir o convite. Confira a internet e abra o link de novo.' : MOTIVOS_PERSONAL[situacao] || MOTIVOS_PERSONAL.invalido}</p>
          <div class="novidade-acoes"><button class="modal-done" type="button" data-personal="nao">Entendi</button></div>`;
      } else {
        $('personal-body').innerHTML = `
          <div class="modal-head"><div><span class="novidade-selo">Convite do personal</span><h3 id="personal-title">${esc(c.nome)} quer acompanhar seus treinos</h3></div></div>
          <p class="resumo-enc">Personal trainer · CREF ${esc(c.cref)}/${esc(c.uf)}</p>
          ${itensPersonal()}
          ${c.atual ? `<p class="aviso">Hoje quem acompanha você é ${esc(c.atual)}. Ao aceitar, esse acompanhamento termina.</p>` : ''}
          <p class="aviso personal-erro" id="personal-erro" role="alert" hidden></p>
          <div class="novidade-acoes">
            <button class="modal-done" type="button" data-personal="aceitar">Aceitar acompanhamento</button>
            <button class="btn-sec" type="button" data-personal="nao">Agora não</button>
          </div>`;
      }
      personalDialog.onclick = async (e) => {
        const b = e.target.closest('[data-personal]');
        if (!b) return;
        if (b.dataset.personal === 'nao') { registrarEvento('personal_convite', { resultado: 'recusou' }); return fim('nao'); }
        b.disabled = true;
        const r = await sb.rpc('aceitar_vinculo', { p_codigo: codigo });
        const res = r.error ? 'erro' : r.data;
        registrarEvento('personal_convite', { resultado: res === 'ok' ? 'aceitou' : res });
        if (res !== 'ok') {
          b.disabled = false;
          $('personal-erro').textContent = res === 'erro' ? 'Não foi possível aceitar. Confira a internet e tente de novo.' : MOTIVOS_PERSONAL[res] || MOTIVOS_PERSONAL.invalido;
          $('personal-erro').hidden = false;
          return;
        }
        meuPersonal = { nome: c.nome, cref: c.cref, uf: c.uf, desde: new Date().toISOString() };
        guardarMeuPersonal();
        toast(`Pronto! ${c.nome} agora acompanha seus treinos.`);
        fim('ok');
      };
      personalDialog.oncancel = (e) => { e.preventDefault(); fim('nao'); };
      personalDialog.showModal();
    });
  }
  const chaveMeuPersonal = () => `bauer-meu-personal-${usuario ? usuario.id : ''}`;
  function guardarMeuPersonal() { try { localStorage.setItem(chaveMeuPersonal(), JSON.stringify(meuPersonal)); } catch (_) {} }
  async function buscarMeuPersonal() {
    try { meuPersonal = JSON.parse(localStorage.getItem(chaveMeuPersonal()) || 'null'); } catch (_) {}
    const { data, error } = await sb.rpc('meu_personal');
    if (error) return;
    meuPersonal = (data || [])[0] || null;
    guardarMeuPersonal();
    if (telaAtual() === 'voce') { renderConfig(); if (paginaVoce() === 'personal') renderMeuPersonal(); }
  }
  // Aviso quando o personal mandou treinos novos desde a última vez que este aparelho viu.
  function avisarTreinosDoPersonal() {
    if (!acompanhamento || !treinosDoPersonalEm) return;
    const chave = `bauer-treinos-personal-${usuario.id}`;
    let visto = '';
    try { visto = localStorage.getItem(chave) || ''; } catch (_) {}
    if (visto === treinosDoPersonalEm) return;
    try { localStorage.setItem(chave, treinosDoPersonalEm); } catch (_) {}
    toast(`${meuPersonal && meuPersonal.nome ? meuPersonal.nome : 'Seu personal'} atualizou seus treinos. Eles já estão na tela Treino.`);
  }
  let encerrandoPersonal = false;
  function renderMeuPersonal() {
    const el = $('meu-personal');
    if (!acompanhamento) {
      el.innerHTML = `<p class="nota-campo">Você não tem personal no app. Quando um personal trainer mandar um convite, abra o link no celular para aceitar; ele passa a montar os seus treinos e a acompanhar a sua semana.</p>`;
      return;
    }
    const p = meuPersonal;
    el.innerHTML = `
      <p class="mp-nome"><b>${p ? esc(p.nome) : 'Seu personal'}</b>${p ? `<small>CREF ${esc(p.cref)}/${esc(p.uf)}${p.desde ? ` · acompanha você desde ${fmtData(isoLocal(new Date(p.desde)).slice(0, 10), { day: 'numeric', month: 'short' })}` : ''}</small>` : ''}</p>
      ${itensPersonal()}
      ${encerrandoPersonal ? `<div class="aviso mp-confirmar" role="alert">
          <p>Encerrar o acompanhamento? ${p ? esc(p.nome) : 'O personal'} deixa de ver os seus dados na hora. Os treinos atuais continuam com você, e você volta a poder mudá-los.</p>
          <div class="novidade-acoes"><button class="btn perigo" type="button" id="mp-encerrar-sim">Encerrar acompanhamento</button>
          <button class="btn-sec" type="button" id="mp-encerrar-nao">Continuar com o personal</button></div></div>`
    : '<button class="btn-sec perigo-sec" type="button" id="mp-encerrar">Encerrar acompanhamento</button>'}`;
  }
  $('meu-personal').addEventListener('click', async (e) => {
    if (e.target.closest('#mp-encerrar')) { encerrandoPersonal = true; renderMeuPersonal(); $('mp-encerrar-sim').focus(); return; }
    if (e.target.closest('#mp-encerrar-nao')) { encerrandoPersonal = false; renderMeuPersonal(); return; }
    if (!e.target.closest('#mp-encerrar-sim')) return;
    e.target.closest('#mp-encerrar-sim').disabled = true;
    const { error } = await sb.rpc('encerrar_vinculo');
    if (error) { e.target.closest('#mp-encerrar-sim').disabled = false; return toast('Não foi possível encerrar. Confira a internet e tente de novo.'); }
    registrarEvento('personal_encerrado');
    encerrandoPersonal = false;
    acompanhamento = null;
    meuPersonal = null;
    guardarMeuPersonal();
    if (perfilLinha) perfilLinha.acompanhado_por = null;
    toast('Acompanhamento encerrado. Seus treinos continuam aqui, e agora você pode mudá-los.');
    renderConfig();
    renderMeuPersonal();
  });
