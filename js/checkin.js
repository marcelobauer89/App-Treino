// js/checkin.js: pesos das séries, check-in (rápido, extra, retroativo, encerrar), celebração e foto.
// Parte do app (index.html). Os arquivos de js/ dividem o mesmo escopo global e carregam na ordem do index.html;
// o mapa das seções está em docs/MAPA.md.

  // ---------- Registro de pesos ----------
  const numSeries = (ex) => { const m = /^(\d+)\s*×/.exec(ex.dose); return m ? parseInt(m[1], 10) : 3; };

  // Aceita vírgula ou ponto ("22,5" ou "22.5"); undefined = valor inválido.
  function lerKg(texto) {
    const t = texto.trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  const fmtKg = (n) => String(n).replace('.', ',');
  const listaKg = (series) => series.map((s) => (s && s.carga != null ? fmtKg(s.carga) : '–')).join(' / ');

  const logDialog = $('log-dialog');
  let exAberto = null;
  // Painel do exercício: na tela Treino vale para hoje e o treino da aba; pelo Dashboard, para o
  // dia e o treino do check-in. { data, tipo, origem: 'treino' | 'dash' }
  let logCtx = null;
  // O detalhe de um check-in antigo pode ter exercícios que saíram do treino (logCtx.exs).
  const exsDoCtx = () => logCtx.exs || TREINOS[logCtx.tipo.slice(1)].exercicios;
  const camposDoModal = () => [...logDialog.querySelectorAll('[data-campo]')];

  // Salvar um peso só grava o peso do dia: não abre check-in nem temporizador.
  function definirSerie(nome, n, valor) {
    const { data, tipo } = logCtx;
    let r = cargaDoDia(data, tipo);
    if (!r) {
      if (valor == null) return;
      r = { data, treino: tipo, series: {} };
      cargas.push(r);
    }
    // Começa das séries que já existiam no dia (inclusive as guardadas num check-in antigo).
    r.series[nome] = r.series[nome] || (pesosDoDia(data, tipo)[nome] || []).map((x) => (x && x.feito ? null : x));
    r.series[nome][n] = valor == null ? null : { carga: valor };
    salvarCargaDepois(r);
  }

  // "Terminei o exercício" num exercício sem peso: marca (ou desmarca) como feito hoje.
  function marcarFeito(nome, feito) {
    const { data, tipo } = logCtx;
    let r = cargaDoDia(data, tipo);
    if (!r) {
      if (!feito) return;
      r = { data, treino: tipo, series: {} };
      cargas.push(r);
    }
    if (feito) {
      if (temCarga(pesosDoDia(data, tipo)[nome]) || temFeito(r.series[nome])) return;
      r.series[nome] = [{ feito: true }];
    } else {
      delete r.series[nome];
    }
    salvarCargaDepois(r);
  }

  // Mostra "Novo recorde" no campo cuja carga passa do recorde anterior ao dia.
  function marcarRecordes() {
    const log = logDialog.querySelector('.log[data-recorde]');
    if (!log || !log.dataset.recorde) return;
    const rec = Number(log.dataset.recorde);
    camposDoModal().forEach((el) => {
      const v = lerKg(el.value);
      el.parentElement.querySelector('.selo-recorde').hidden = !(typeof v === 'number' && v > rec);
    });
  }

  function salvarInput(el) {
    const v = lerKg(el.value);
    el.setAttribute('aria-invalid', String(v === undefined));
    if (v !== undefined) definirSerie(el.dataset.ex, Number(el.dataset.serie), v);
    const erro = $('log-erro');
    if (erro) erro.hidden = !camposDoModal().some((c) => c.getAttribute('aria-invalid') === 'true');
  }

  function logHTML(ex) {
    const { data, tipo } = logCtx;
    const atual = pesosDoDia(data, tipo)[ex.nome] || [];
    const ultimo = ultimasCargas(ex.nome, data);
    const quando = data === hoje() ? 'hoje' : `em ${fmtData(data, { day: 'numeric', month: 'long' })}`;
    const total = numSeries(ex);
    const linhas = Array.from({ length: total }, (_, n) => {
      // RF-14: a carga já vem preenchida com a da última sessão.
      const carga = (atual[n] && atual[n].carga) ?? (ultimo && ultimo[n] && ultimo[n].carga);
      return `
        <div class="serie-row">
          <label for="kg-${n}">Série ${n + 1}</label>
          <button class="kg-passo" type="button" data-passo="-0.5" data-alvo="kg-${n}" aria-label="Série ${n + 1}: menos 0,5 kg">−</button>
          <input id="kg-${n}" type="text" inputmode="decimal" autocomplete="off" placeholder="kg"
            enterkeyhint="${n < total - 1 ? 'next' : 'done'}"
            data-ex="${esc(ex.nome)}" data-serie="${n}" data-campo="carga" value="${carga != null ? fmtKg(carga) : ''}"
            aria-label="${esc(nomeDe(ex))}: carga da série ${n + 1} (kg)" aria-describedby="log-erro">
          <button class="kg-passo" type="button" data-passo="0.5" data-alvo="kg-${n}" aria-label="Série ${n + 1}: mais 0,5 kg">+</button>
          <span class="selo-recorde" hidden>${ICON_TROFEU}Novo recorde</span>
        </div>`;
    }).join('');
    const hint = ultimo ? `<span class="log-hint">Última vez: ${listaKg(ultimo)} kg</span>` : '';
    const rec = recordeAntes(ex.nome, data);
    const linhaRec = rec
      ? `<p class="log-recorde">${ICON_TROFEU}Recorde: <b>${fmtKg(rec.kg)} kg</b> em ${fmtData(rec.data, { day: '2-digit', month: '2-digit' })}</p>`
      : '';
    const semPeso = config.semPeso.has(ex.nome);
    const chave = `
      <label class="sem-peso-linha">
        <span><b>Sem peso</b><small>Exercício feito só com o corpo</small></span>
        <input type="checkbox" role="switch" data-sem-peso="${esc(ex.nome)}"${semPeso ? ' checked' : ''}>
      </label>`;
    if (semPeso) {
      return temFeito(atual) || temCarga(atual)
        ? `${chave}
      <p class="aviso feito-aviso">${ICON_CHECK}Feito ${quando}. <button class="link-btn" type="button" data-desfazer="${esc(ex.nome)}">Desfazer</button></p>`
        : `${chave}
      <p class="aviso">Exercício sem peso: toque em Concluir para marcar como feito ${quando}.</p>`;
    }
    return `${chave}
      <div class="log" data-recorde="${rec ? rec.kg : ''}">
        <div class="log-head"><h4>Carga por série (kg)</h4>${hint}</div>
        ${linhaRec}
        ${linhas}
        <p class="log-erro" id="log-erro" hidden>Use só números, como 22,5.</p>
      </div>`;
  }

  function logBtnHTML(ex, i) {
    const salvo = pesosDoDia(hoje(), `t${estado.treino}`)[ex.nome] || [];
    if (config.semPeso.has(ex.nome) && (temFeito(salvo) || temCarga(salvo))) {
      return `<button class="log-btn feito" type="button" data-log="${i}" title="Exercício sem peso feito hoje">
      ${ICON_CHECK}<span>Feito hoje</span></button>`;
    }
    if (!temCarga(salvo)) {
      return `<button class="log-btn" type="button" data-log="${i}">Terminei o exercício</button>`;
    }
    const series = Array.from({ length: numSeries(ex) }, (_, n) => salvo[n]);
    const rec = recordeNoDia(`t${estado.treino}`, ex.nome, hoje());
    return `<button class="log-btn feito" type="button" data-log="${i}" title="Editar pesos de hoje">
      ${ICON_CHECK}<span>Hoje: ${listaKg(series)} kg${rec ? '<span class="sr-only">, novo recorde</span>' : ''}</span>${rec ? `<span class="trofeu" title="Novo recorde">${ICON_TROFEU}</span>` : ''}</button>`;
  }

  function abrirLog(i, ctx = null) {
    exAberto = i;
    if (ctx) logCtx = ctx;
    else if (!logDialog.open || !logCtx) logCtx = { data: hoje(), tipo: `t${estado.treino}`, origem: 'treino' };
    const ex = exsDoCtx()[i];
    const deOutroDia = logCtx.origem === 'dash'
      ? `<p class="log-quando">${TIPOS[logCtx.tipo].nome}, ${fmtData(logCtx.data, { day: 'numeric', month: 'long' })}</p>` : '';
    $('log-body').innerHTML = `
      <div class="modal-head">
        <div>
          <h3 id="log-title">${esc(nomeDe(ex))}</h3>
          ${deOutroDia}
          <p class="ex-dose"><span>${ex.dose}</span><span class="pse">PSE ${ex.pse}</span></p>
        </div>
        ${BOTAO_FECHAR}
      </div>
      ${logHTML(ex)}
      <button class="modal-done" type="button" data-concluir>Concluir</button>`;
    // Carga máxima do dia ao abrir: o aviso de recorde só aparece se ela subir neste painel.
    logCtx.maxAoAbrir = maxDoDia(pesosDoDia(logCtx.data, logCtx.tipo)[ex.nome]);
    marcarRecordes();
    if (!logDialog.open) logDialog.showModal();
  }

  // "Concluir" grava tudo o que está na tela, inclusive a carga pré-preenchida.
  function concluirLog() {
    const ex = exsDoCtx()[exAberto];
    const evento = { treino: logCtx.tipo, exercicio: ex.nome, origem: logCtx.origem, outro_dia: logCtx.data !== hoje() };
    if (config.semPeso.has(ex.nome)) {
      marcarFeito(ex.nome, true);
      registrarEvento('exercicio_concluido', { ...evento, sem_peso: true });
      return logDialog.close();
    }
    const campos = camposDoModal();
    campos.forEach(salvarInput);
    const invalido = campos.find((el) => el.getAttribute('aria-invalid') === 'true');
    if (invalido) return invalido.focus();
    registrarEvento('exercicio_concluido', { ...evento, sem_peso: false, com_carga: temCarga(pesosDoDia(logCtx.data, logCtx.tipo)[ex.nome]) });
    const rec = recordeNoDia(logCtx.tipo, ex.nome, logCtx.data);
    if (rec && rec.kg > logCtx.maxAoAbrir) {
      toast(`Novo recorde em ${nomeDe(ex)}: ${fmtKg(rec.kg)} kg (antes ${fmtKg(rec.antes)} kg).`);
      registrarEvento('recorde', { treino: logCtx.tipo, exercicio: ex.nome });
    }
    logDialog.close();
  }

  // ---------- Encerrar check-in ----------
  const encDialog = $('enc-dialog');
  let depoisEncerrar = null;

  function abrirEncerrar({ motivo = '', depois = null } = {}) {
    const a = checkinAberto();
    if (!a) return;
    depoisEncerrar = depois;
    const min = minutosEntre(a.inicio, agoraIso());
    let resumo = '';
    if (TREINOS[TIPOS[a.tipo].treino]) {
      const exs = TREINOS[TIPOS[a.tipo].treino].exercicios;
      const pesos = pesosDoDia(dataDe(a), a.tipo);
      const feitos = exs.filter((ex) => exercicioFeito(ex, pesos)).length;
      resumo = `${feitos} de ${exs.length} exercícios feitos.`;
    }
    $('enc-body').innerHTML = `
      <div class="modal-head">
        <div>
          <h3 id="enc-title">Encerrar ${TIPOS[a.tipo].nome}</h3>
          <p class="resumo-enc">Começou às ${horaDe(a.inicio)}, há ${fmtDur(min)}.</p>
        </div>
        ${BOTAO_FECHAR}
      </div>
      ${motivo ? `<p class="aviso">${motivo}</p>` : ''}
      ${resumo ? `<p class="resumo-enc">${resumo}</p>` : ''}
      ${camposSaudeHTML('enc', a.obs, 'Ex.: ombro incomodou no supino')}
      <button class="modal-done" type="button" data-confirmar-enc>Encerrar check-in</button>`;
    encDialog.showModal();
  }

  function confirmarEncerrar() {
    const a = checkinAberto();
    if (!a) return encDialog.close();
    a.fim = agoraIso() > a.inicio ? agoraIso() : a.inicio;
    if ($('enc-obs')) a.obs = $('enc-obs').value.trim();
    salvarSeriesPendentes();
    salvarCheckin(a);
    const depois = depoisEncerrar;
    depoisEncerrar = null;
    encDialog.close();
    registrarEvento('checkin_encerrado', { tipo: a.tipo });
    atualizarCheckinUI();
    celebrarCheckin(a, { encerrado: true, aoFechar: () => {
      toast(`${TIPOS[a.tipo].nome} encerrado: ${fmtDur(duracaoMin(a))} de treino.`);
      if (depois) depois();
    } });
  }

  // ---------- Celebração do check-in (tela cheia) ----------
  // Ao salvar um check-in novo e ao encerrar um treino em andamento: um ✓ grande na cor da atividade, o resumo e
  // quantos treinos a pessoa já fez na semana. Fecha sozinha em poucos segundos ou no Continuar.
  const celebraDialog = $('celebra-dialog');
  let celebra = null;
  function treinosDaSemana(data) {
    const d = deData(data);
    const seg = new Date(d); seg.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
    const ini = isoLocal(seg).slice(0, 10), fim = isoLocal(dom).slice(0, 10);
    return checkins.filter((c) => dataDe(c) >= ini && dataDe(c) <= fim).length;
  }
  function celebrarCheckin(c, { encerrado = false, aoFechar } = {}) {
    // Os testes antigos desligam a celebração (window.__semCelebracao) para seguir direto.
    if (window.__semCelebracao) { if (aoFechar) aoFechar(); return; }
    const g = TIPOS[c.tipo].grupo;
    const data = dataDe(c);
    const quando = data === hoje() ? 'Hoje' : fmtData(data, { weekday: 'short', day: '2-digit', month: '2-digit' });
    const dur = duracaoMin(c);
    const n = treinosDaSemana(data);
    const faiscas = Array.from({ length: 16 }, (_, k) => `<i style="--a:${k * 22.5}deg;--c:var(${['--cor', '--tatame', '--checkin', '--feito-tinta'][k % 4]})"></i>`).join('');
    $('celebra-body').innerHTML = `
      <div class="cel" data-grupo="${g}" style="--cor:var(--${g})">
        <div class="cel-palco">
          <span class="cel-onda" aria-hidden="true"></span><span class="cel-onda cel-onda2" aria-hidden="true"></span>
          <span class="cel-icone" aria-hidden="true">${ICON_CHECK}</span>
          <span class="cel-faiscas" aria-hidden="true">${faiscas}</span>
        </div>
        <h3 id="cel-title" tabindex="-1">${encerrado ? 'Treino concluído!' : 'Check-in feito!'}</h3>
        <p class="cel-tipo">${TIPOS[c.tipo].nome}</p>
        <p class="cel-info">${quando} · ${horaDe(c.inicio)} às ${horaDe(c.fim)}${dur ? ` · ${fmtDur(dur)}` : ''}</p>
        <p class="cel-semana"><b>${n}º</b> treino da semana</p>
        <button class="modal-done cel-ok-btn" type="button" data-cel-fechar>Continuar</button>
      </div>`;
    document.body.classList.add('bv-ativa');
    celebraDialog.showModal();
    $('cel-title').focus();
    const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(celebra && celebra.timer);
    celebra = { aoFechar, timer: setTimeout(fecharCelebracao, reduzido ? 2200 : 4200) };
  }
  function fecharCelebracao() {
    if (!celebra) return;
    const { aoFechar, timer } = celebra;
    celebra = null;
    clearTimeout(timer);
    celebraDialog.close();
    document.body.classList.remove('bv-ativa');
    if (aoFechar) aoFechar();
  }
  celebraDialog.addEventListener('click', (e) => { if (e.target.closest('[data-cel-fechar]')) fecharCelebracao(); });
  celebraDialog.addEventListener('cancel', (e) => { e.preventDefault(); fecharCelebracao(); });

  // ---------- Check-in rápido, extra ou retroativo ----------
  const formDialog = $('form-dialog');
  let durTocada = false;

  // Tipos do check-in: primeiro os da semana montada e os feitos nos últimos 60 dias; o resto fica em
  // "Outras atividades" (lei de Hick: menos opções na frente).
  function opcoesTipoHTML(tipo) {
    const todos = ORDEM_TIPOS.includes(tipo) ? ORDEM_TIPOS : [tipo, ...ORDEM_TIPOS];
    const limite = isoLocal(new Date(Date.now() - 60 * 86400000)).slice(0, 10);
    const usados = new Set([tipo, ...config.semana.flat(), ...checkins.filter((c) => dataDe(c) >= limite).map((c) => c.tipo)]);
    const opcao = (t) => `
            <label class="opcao"><input type="radio" name="f-tipo" value="${t}"${t === tipo ? ' checked' : ''}><span>${seloHTML(t)}${TIPOS[t].nome}</span></label>`;
    const principais = todos.filter((t) => usados.has(t));
    const outras = todos.filter((t) => !usados.has(t));
    if (!outras.length || principais.length < 2) return `<div class="opcoes">${todos.map(opcao).join('')}</div>`;
    return `<div class="opcoes">${principais.map(opcao).join('')}</div>
        <details class="mais-tipos">
          <summary>Outras atividades <span>(${outras.length})</span></summary>
          <div class="opcoes">${outras.map(opcao).join('')}</div>
        </details>`;
  }

  function abrirFormCheckin({ tipo = 'jiu', data = hoje(), editar = null } = {}) {
    let dur, inicio, obs = '';
    if (editar) {
      // Edição: o formulário abre com os dados do check-in (o "sem horário" ganha horário ao salvar).
      ({ tipo } = editar);
      data = dataDe(editar);
      inicio = horaDe(editar.inicio);
      dur = duracaoMin(editar) ?? DURACAO_PADRAO[TIPOS[tipo].grupo];
      obs = editar.obs || '';
      formDialog.dataset.editar = editar.id;
    } else {
      if (data > hoje()) data = hoje();
      dur = DURACAO_PADRAO[TIPOS[tipo].grupo];
      inicio = '19:00';
      if (data === hoje()) {
        const ini = new Date(Date.now() - dur * 60000);
        inicio = isoLocal(ini).slice(0, 10) === data ? `${pad(ini.getHours())}:${pad(Math.floor(ini.getMinutes() / 5) * 5)}` : '00:00';
      }
      delete formDialog.dataset.editar;
    }
    durTocada = !!editar;
    $('form-body').innerHTML = `
      <div class="modal-head">
        <div><h3 id="form-title">${editar ? 'Editar check-in' : 'Novo check-in'}</h3></div>
        ${BOTAO_FECHAR}
      </div>
      <fieldset class="campo">
        <legend>Treino</legend>
        ${opcoesTipoHTML(tipo)}
      </fieldset>
      <div class="campo">
        <label for="f-data">Data</label>
        <input type="date" id="f-data" value="${data}" max="${hoje()}">
      </div>
      <div class="linha2">
        <div class="campo"><label for="f-inicio">Início</label><input type="time" id="f-inicio" value="${inicio}"></div>
        <div class="campo"><label for="f-dur">Duração (min)</label><input type="text" inputmode="numeric" id="f-dur" value="${dur}"></div>
      </div>
      ${fotosLigadas ? '<div class="campo foto-campo" id="f-foto-bloco"></div>' : ''}
      ${camposSaudeHTML('f', obs, 'Ex.: aula de raspagens, muitos rolas')}
      ${editar && TIPOS[tipo].grupo === 'musc' ? '<p class="nota-campo">Os pesos ficam guardados no dia e no treino; para corrigi-los, toque no exercício no detalhe do check-in.</p>' : ''}
      <p class="form-erro" id="f-erro" role="alert" hidden></p>
      <button class="modal-done" type="button" data-salvar-form>${editar ? 'Salvar alterações' : 'Salvar check-in'}</button>`;
    fotoForm = { atual: editar ? editar.foto || '' : '', nova: null, remover: false };
    if (fotosLigadas) renderFotoForm();
    formDialog.showModal();
  }

  // ---------- Foto do check-in ----------
  // Estado da foto no formulário aberto: a atual (caminho no bucket), a nova (ainda não enviada) e se é para remover.
  let fotoForm = null;
  // A foto aparece só para quem a postou (link assinado de 1 h); o painel do administrador nunca a mostra.
  const urlsFoto = new Map(); // caminho → { url, ate }
  async function urlFoto(caminho) {
    const c = urlsFoto.get(caminho);
    if (c && c.ate > Date.now()) return c.url;
    const { data, error } = await sb.storage.from(BUCKET_FOTOS).createSignedUrl(caminho, 3600);
    if (error || !data) return '';
    urlsFoto.set(caminho, { url: data.signedUrl, ate: Date.now() + 50 * 60000 });
    return data.signedUrl;
  }
  // Preenche as <img data-foto> de um trecho da tela com os links assinados.
  function carregarFotos(raiz) {
    raiz.querySelectorAll('img[data-foto]:not([src])').forEach(async (img) => {
      const url = await urlFoto(img.dataset.foto);
      if (url) img.src = url; else img.closest('.foto-moldura')?.classList.add('foto-falhou');
    });
  }
  function renderFotoForm() {
    const f = fotoForm;
    const temFoto = f.nova || (f.atual && !f.remover);
    if (f.previa && !f.nova) { URL.revokeObjectURL(f.previa); f.previa = ''; }
    if (f.nova && !f.previa) f.previa = URL.createObjectURL(f.nova);
    $('f-foto-bloco').innerHTML = `
      <span class="foto-rotulo">Foto <span class="opcional">(opcional)</span></span>
      <input type="file" id="f-foto-input" accept="image/*" hidden>
      ${temFoto ? `
        <div class="foto-moldura"><img ${f.nova ? `src="${f.previa}"` : `data-foto="${esc(f.atual)}"`} alt="Foto do check-in"></div>
        <div class="foto-acoes">
          <button class="btn-sec" type="button" data-foto-escolher>Trocar</button>
          <button class="btn-sec" type="button" data-foto-remover>Remover</button>
        </div>`
      : `<button class="foto-add" type="button" data-foto-escolher>
          ${ICON_CAMERA}<span><b>Adicionar foto</b><small>Tire agora ou escolha da galeria</small></span>
        </button>`}
      ${temFoto ? '<p class="nota-campo">Só você vê esta foto.</p>' : ''}
      <p class="form-erro" id="f-foto-erro" role="alert" hidden></p>`;
    carregarFotos($('f-foto-bloco'));
  }
  // Reduz a foto no aparelho (lado maior até 1280 px, JPEG) já na orientação certa.
  async function reduzirFoto(arquivo) {
    if (!arquivo || !arquivo.type.startsWith('image/')) throw new Error('tipo');
    let fonte;
    try { fonte = await createImageBitmap(arquivo, { imageOrientation: 'from-image' }); } catch (_) {
      fonte = await new Promise((ok, falha) => {
        const url = URL.createObjectURL(arquivo);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); ok(img); };
        img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('imagem')); };
        img.src = url;
      });
    }
    const w = fonte.width || fonte.naturalWidth, h = fonte.height || fonte.naturalHeight;
    const k = Math.min(1, 1280 / Math.max(w, h));
    const tela = document.createElement('canvas');
    tela.width = Math.round(w * k); tela.height = Math.round(h * k);
    tela.getContext('2d').drawImage(fonte, 0, 0, tela.width, tela.height);
    return new Promise((ok, falha) => tela.toBlob((b) => (b ? ok(b) : falha(new Error('jpeg'))), 'image/jpeg', 0.8));
  }
  formDialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-foto-escolher]')) return $('f-foto-input').click();
    if (e.target.closest('[data-foto-remover]')) {
      fotoForm = { ...fotoForm, nova: null, remover: true };
      return renderFotoForm();
    }
  });
  formDialog.addEventListener('change', async (e) => {
    if (e.target.id !== 'f-foto-input') return;
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    try {
      const blob = await reduzirFoto(arquivo);
      fotoForm = { ...fotoForm, nova: blob, remover: false };
      renderFotoForm();
    } catch (_) {
      $('f-foto-erro').textContent = 'Não foi possível abrir essa imagem. Tente outra foto.';
      $('f-foto-erro').hidden = false;
    }
  });
  // Depois de salvar o check-in: envia a foto nova ou apaga a removida. Se o envio falhar, o check-in fica salvo.
  async function aplicarFotoForm(c) {
    const f = fotoForm;
    fotoForm = null;
    if (f && f.previa) URL.revokeObjectURL(f.previa);
    if (!f || !fotosLigadas) return;
    if (f.nova) {
      const caminho = `${usuario.id}/${c.id}.jpg`;
      const { error } = await sb.storage.from(BUCKET_FOTOS).upload(caminho, f.nova, { upsert: true, contentType: 'image/jpeg' });
      if (error) {
        toast('Check-in salvo, mas a foto não foi enviada. Tente de novo em Editar check-in.', 6000);
        registrarErro('foto', error.message);
        return;
      }
      const acao = c.foto ? 'trocou' : 'adicionou';
      c.foto = caminho;
      urlsFoto.delete(caminho);
      salvarCheckin(c);
      registrarEvento('checkin_foto', { acao });
      atualizarCheckinUI();
    } else if (f.remover && c.foto) {
      apagarFotos([c.foto]);
      c.foto = '';
      salvarCheckin(c);
      registrarEvento('checkin_foto', { acao: 'removeu' });
      atualizarCheckinUI();
    }
  }
  function apagarFotos(caminhos) {
    caminhos.forEach((k) => urlsFoto.delete(k));
    return caminhos.length ? sb.storage.from(BUCKET_FOTOS).remove(caminhos).catch(() => {}) : Promise.resolve();
  }
  // Foto em tela cheia (só a própria pessoa).
  const fotoVer = $('foto-ver');
  async function abrirFotoVer(c) {
    $('foto-ver-img').removeAttribute('src');
    $('foto-ver-legenda').textContent = `${TIPOS[c.tipo].nome} · ${dataLonga(dataDe(c))}`;
    fotoVer.showModal();
    const url = await urlFoto(c.foto);
    if (url) $('foto-ver-img').src = url;
  }
  fotoVer.addEventListener('click', (e) => { if (e.target === fotoVer || e.target.closest('[data-fechar]')) fotoVer.close(); });

  function salvarForm() {
    const erro = (msg) => { $('f-erro').textContent = msg; $('f-erro').hidden = false; };
    const tipo = formDialog.querySelector('input[name="f-tipo"]:checked').value;
    const data = $('f-data').value;
    const ini = $('f-inicio').value;
    const dur = Number($('f-dur').value.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return erro('Escolha a data do treino.');
    if (data > hoje()) return erro('A data não pode ser no futuro.');
    if (!/^\d{2}:\d{2}$/.test(ini)) return erro('Informe o horário de início.');
    if (!Number.isInteger(dur) || dur < 1 || dur > 600) return erro('Informe a duração em minutos, entre 1 e 600.');
    const inicio = `${data}T${ini}`;
    const fim = isoLocal(new Date(new Date(inicio).getTime() + dur * 60000));
    // Regra 13: check-ins do mesmo dia não podem se sobrepor.
    const editado = checkins.find((c) => c.id === formDialog.dataset.editar);
    const choque = checkins.find((c) => c !== editado && !c.semHorario && dataDe(c) === data && inicio < (c.fim || agoraIso()) && c.inicio < fim);
    if (choque) return erro(`Esse horário se sobrepõe ao ${TIPOS[choque.tipo].nome} ${horarioTexto(choque)}. Ajuste o início ou a duração.`);
    if (editado) {
      Object.assign(editado, {
        tipo, inicio, fim, semHorario: false,
        ...($('f-obs') ? { obs: $('f-obs').value.trim() } : {}), retroativo: data < hoje(),
      });
      salvarCheckin(editado);
      aplicarFotoForm(editado);
      formDialog.close();
      toast(`Check-in de ${TIPOS[tipo].nome} atualizado.`);
      registrarEvento('checkin_editado', { tipo });
      diaSel = data;
      mesExibido = { ano: deData(data).getFullYear(), mes: deData(data).getMonth() };
      ckExpandido = editado.id;
      atualizarCheckinUI();
      return;
    }
    const novo = {
      id: novoId(), tipo, inicio, fim, semHorario: false,
      obs: $('f-obs') ? $('f-obs').value.trim() : '',
      retroativo: data < hoje(), series: {},
    };
    checkins.push(novo);
    salvarCheckin(novo);
    aplicarFotoForm(novo);
    formDialog.close();
    registrarEvento('checkin_criado', { tipo, retroativo: novo.retroativo, origem: telaAtual() });
    diaSel = data;
    mesExibido = { ano: deData(data).getFullYear(), mes: deData(data).getMonth() };
    atualizarCheckinUI();
    celebrarCheckin(novo, { aoFechar: () => toast(`Check-in de ${TIPOS[tipo].nome} salvo.`) });
  }
