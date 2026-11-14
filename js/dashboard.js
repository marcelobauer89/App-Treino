// js/dashboard.js: Dashboard: resumo, calendário, check-ins do dia e Evolução mês a mês.
// Parte do app (index.html). Os arquivos de js/ dividem o mesmo escopo global e carregam na ordem do index.html;
// o mapa das seções está em docs/MAPA.md.

  // ---------- Render: Dashboard ----------
  let mesExibido = { ano: new Date().getFullYear(), mes: new Date().getMonth() };
  let diaSel = hoje();
  let ckExpandido = null;
  let ckExcluindo = null;

  // Semanas seguidas em que a pessoa fez pelo menos o que a semana montada pede. A semana atual entra quando já
  // bateu o plano; senão a conta começa na anterior (a semana em andamento não quebra a sequência).
  function semanasNoPlano() {
    const plano = config.semana.flat().length;
    if (!plano || !checkins.length) return 0;
    const porSemana = new Map();
    checkins.forEach((c) => { const s = segundaDe(dataDe(c)); porSemana.set(s, (porSemana.get(s) || 0) + 1); });
    const primeira = segundaDe(checkins.map(dataDe).sort()[0]);
    let seg = segundaDe(hoje());
    if ((porSemana.get(seg) || 0) < plano) seg = somarDias(seg, -7);
    let n = 0;
    while (seg >= primeira && (porSemana.get(seg) || 0) >= plano && n < 520) { n += 1; seg = somarDias(seg, -7); }
    return n;
  }

  function renderNumeros() {
    const mesAtual = hoje().slice(0, 7);
    const noMes = checkins.filter((c) => dataDe(c).startsWith(mesAtual));
    const minutos = noMes.reduce((s, c) => s + (duracaoMin(c) || 0), 0);
    const dias = new Set(noMes.map(dataDe)).size;
    const agora = new Date();
    const mes = nomeMes(agora.getFullYear(), agora.getMonth());
    $('numeros').innerHTML = `
      <div class="num-destaque"><dt>Semanas seguidas no plano</dt><dd>${semanasNoPlano()}<small>${semanasNoPlano() === 1 ? ' semana' : ' semanas'}</small></dd></div>
      <div><dt>Check-ins em ${mes}</dt><dd>${noMes.length}</dd></div>
      <div><dt>Horas treinadas em ${mes}</dt><dd>${fmtNum(minutos / 60)}<small> h</small></dd></div>
      <div><dt>Dias com treino em ${mes}</dt><dd>${dias}<small>${dias === 1 ? ' dia' : ' dias'}</small></dd></div>`;
  }

  function renderMetas() {
    const seg = segundaDe(hoje());
    const dom = somarDias(seg, 6);
    const daSemana = checkins.filter((c) => dataDe(c) >= seg && dataDe(c) <= dom);
    const conta = (g) => daSemana.filter((c) => TIPOS[c.tipo].grupo === g).length;
    const linha = (rotulo, tipoSelo, grupo, feitos, plano) => {
      if (!plano && !feitos) return '';
      return `
      <li class="meta">
        <span class="meta-nome">${seloHTML(tipoSelo)}${rotulo}</span>
        <span class="seg" aria-hidden="true">${Array.from({ length: plano }, (_, k) => `<i class="${k < feitos ? `on ${grupo}` : ''}"></i>`).join('')}</span>
        <span class="meta-valor">${plano ? `${feitos} de ${plano}` : `${feitos} extra`}</span>
      </li>`;
    };
    const ds = deData(seg), dd = deData(dom);
    $('semana-atual-datas').textContent = ds.getMonth() === dd.getMonth()
      ? `${ds.getDate()} a ${dd.getDate()} de ${nomeMes(dd.getFullYear(), dd.getMonth())}`
      : `${ds.getDate()} de ${nomeMes(ds.getFullYear(), ds.getMonth())} a ${dd.getDate()} de ${nomeMes(dd.getFullYear(), dd.getMonth())}`;
    // Planejado = quantas vezes cada tipo aparece na semana montada pelo usuário.
    const planejado = (g) => config.semana.flat().filter((t) => (ehTreino(t) ? 'musc' : t) === g).length;
    // Cada atividade aparece quando está na semana ou teve check-in (na ordem dos tipos cadastrados no painel).
    const outras = [...ATIVIDADES, ...new Set(daSemana.map((c) => TIPOS[c.tipo].grupo).filter((g) => g !== 'musc' && !ATIVIDADES.includes(g)))];
    $('metas').innerHTML =
      linha('Musculação', 't1', 'musc', conta('musc'), planejado('musc')) +
      outras.map((g) => linha(TIPOS[g].nome, g, g, conta(g), planejado(g))).join('');
  }

  function renderCalendario() {
    const { ano, mes } = mesExibido;
    const agora = new Date();
    $('cal-titulo').textContent = capitalizar(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(ano, mes, 1)));
    document.querySelector('[data-mes="1"]').disabled = ano === agora.getFullYear() && mes === agora.getMonth();
    const offset = (new Date(ano, mes, 1).getDay() + 6) % 7;
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const porData = agruparPorData();
    const cab = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => `<span class="cal-sem" aria-hidden="true">${d}</span>`).join('');
    const vazios = '<span></span>'.repeat(offset);
    const dias = Array.from({ length: totalDias }, (_, k) => {
      const data = `${ano}-${pad(mes + 1)}-${pad(k + 1)}`;
      const lista = porData[data] || [];
      const selos = lista.length > 2
        ? `${seloHTML(lista[0].tipo)}+${lista.length - 1}`
        : lista.map((c) => seloHTML(c.tipo)).join('');
      const rotulo = `${k + 1} de ${nomeMes(ano, mes)}` +
        (lista.length ? `, ${lista.length} check-in${lista.length > 1 ? 's' : ''}: ${lista.map((c) => TIPOS[c.tipo].nome).join(', ')}` : ', sem check-in');
      const classes = ['cal-dia', lista.length ? 'tem' : '', data === hoje() ? 'hoje' : '', data > hoje() ? 'futuro' : ''].join(' ');
      return `<button type="button" class="${classes}" data-dia="${data}" aria-pressed="${data === diaSel}" aria-label="${rotulo}">
          <span class="n">${k + 1}</span><span class="cal-selos">${selos}</span>
        </button>`;
    }).join('');
    $('cal-grade').innerHTML = cab + vazios + dias;
    renderLegendaCal(`${ano}-${pad(mes + 1)}`);
  }
  // Legenda do calendário: só as atividades da semana montada pela pessoa e as que tiveram check-in no mês
  // exibido (um check-in avulso nunca fica sem explicação). Musculação numa linha só, com os selos dos treinos.
  function renderLegendaCal(prefixo) {
    const usados = new Set([
      ...config.semana.flat(),
      ...checkins.filter((c) => dataDe(c).startsWith(prefixo)).map((c) => c.tipo),
    ].filter((t) => TIPOS[t]));
    const treinos = TIPOS_MUSC.filter((t) => usados.has(t));
    const linhas = [];
    if (treinos.length) {
      linhas.push(`<li>${treinos.map((t) => seloHTML(t)).join('')}<span>${treinos.length === 1 ? esc(TIPOS[treinos[0]].nome) : 'Musculação'}</span></li>`);
    }
    ATIVIDADES.filter((t) => usados.has(t)).forEach((t) => linhas.push(`<li>${seloHTML(t)}<span>${esc(TIPOS[t].nome)}</span></li>`));
    $('legenda-cal').innerHTML = linhas.join('');
    $('legenda-cal').hidden = !linhas.length;
  }

  // Exercícios de um check-in de musculação: os do treino de hoje e os que tiveram peso no dia
  // (o treino pode ter mudado ou sido excluído depois).
  function exerciciosDoCheckin(c) {
    const t = TREINOS[TIPOS[c.tipo].treino];
    const exs = t ? [...t.exercicios] : [];
    const pesos = pesosDoDia(dataDe(c), c.tipo);
    Object.keys(pesos).forEach((nome) => {
      if (!exs.some((ex) => ex.nome === nome) && (temCarga(pesos[nome]) || temFeito(pesos[nome]))) exs.push(exercicioCompleto({ nome }));
    });
    return exs;
  }

  function detalheHTML(c) {
    const partes = [];
    if (fotosLigadas && c.foto) {
      partes.push(`<button class="foto-moldura ck-foto" type="button" data-ver-foto="${c.id}" aria-label="Ver a foto em tela cheia"><img data-foto="${esc(c.foto)}" alt="Foto do check-in de ${esc(TIPOS[c.tipo].nome)}" loading="lazy"></button>`);
    }
    if (c.obs) partes.push(`<p class="ck-obs">${esc(c.obs)}</p>`);
    if (TIPOS[c.tipo].grupo === 'musc') {
      const exs = exerciciosDoCheckin(c);
      const pesos = pesosDoDia(dataDe(c), c.tipo);
      if (exs.some((ex) => exercicioFeito(ex, pesos)) || c.fim) {
        partes.push(`<ul class="ck-ex">${exs.map((ex, i) => {
          const s = pesos[ex.nome];
          // Exercício sem peso concluído aparece como feito, mesmo com cargas antigas (ex.: zeros).
          const valor = config.semPeso.has(ex.nome)
            ? (exercicioFeito(ex, pesos) ? '<span class="kg">feito (sem peso)</span>' : '<span class="kg sem">sem peso</span>')
            : temCarga(s)
              ? `<span class="kg">${listaKg(Array.from({ length: numSeries(ex) }, (_, n) => s[n]))} kg</span>`
              : '<span class="kg sem">sem registro</span>';
          // Check-in encerrado: tocar no exercício abre o painel para corrigir os pesos daquele dia.
          return c.fim
            ? `<li><button class="ck-ex-btn" type="button" data-editar-ex="${i}" data-ex-ck="${c.id}" aria-label="Editar ${esc(nomeDe(ex))}">
                <span>${esc(nomeDe(ex))}</span>${valor}${ICON_LAPIS}</button></li>`
            : `<li><span>${esc(nomeDe(ex))}</span>${valor}</li>`;
        }).join('')}</ul>`);
      } else {
        partes.push('<p class="ck-obs">Nenhum exercício registrado neste dia.</p>');
      }
    }
    const acoes = !c.fim
      ? `<button class="btn" type="button" data-encerrar>Encerrar check-in</button>`
      : ckExcluindo === c.id ? '' : `<button class="btn-sec" type="button" data-editar="${c.id}">Editar check-in</button>`;
    const excluir = ckExcluindo === c.id
      ? `<p>Excluir este check-in? Os pesos registrados na ficha continuam salvos.</p>
         <button class="btn-perigo cheio" type="button" data-excluir-sim="${c.id}">Excluir</button>
         <button class="btn-sec" type="button" data-excluir-nao>Cancelar</button>`
      : `<button class="btn-perigo" type="button" data-excluir="${c.id}">Excluir check-in</button>`;
    partes.push(`<div class="ck-acoes">${acoes}${excluir}</div>`);
    return partes.join('');
  }

  function renderDia() {
    $('dia-titulo').textContent = diaSel === hoje() ? `Hoje, ${fmtData(diaSel, { day: 'numeric', month: 'long' })}` : dataLonga(diaSel);
    const lista = agruparPorData()[diaSel] || [];
    if (!lista.length) {
      $('dia-lista').innerHTML = `
        <div class="vazio-dia">
          <p>${diaSel > hoje() ? 'Este dia ainda não chegou.' : 'Nenhum check-in neste dia. Toque em Fazer check-in para registrar.'}</p>
        </div>`;
      return;
    }
    $('dia-lista').innerHTML = `<ul class="cks">${lista.map((c) => {
      const dur = duracaoMin(c);
      const meta = [capitalizar(horarioTexto(c)), dur != null ? fmtDur(dur) : '', detalheCardio(c)]
        .filter(Boolean).join(', ');
      const aberto = ckExpandido === c.id;
      return `
        <li class="ck">
          <button class="ck-head" type="button" data-ck="${c.id}" aria-expanded="${aberto}">
            ${seloHTML(c.tipo, 'grande')}
            <span><b>${TIPOS[c.tipo].nome}${fotosLigadas && c.foto ? `<span class="ck-tem-foto" title="Tem foto">${ICON_CAMERA}<span class="sr-only">, com foto</span></span>` : ''}</b><span class="ck-meta">${meta}</span></span>
            ${CHEVRON}
          </button>
          ${aberto ? `<div class="ck-corpo">${detalheHTML(c)}</div>` : ''}
        </li>`;
    }).join('')}</ul>`;
    carregarFotos($('dia-lista'));
  }

  function renderBarras() {
    const { ano, mes } = mesExibido;
    const prefixo = `${ano}-${pad(mes + 1)}`;
    const doMes = checkins.filter((c) => dataDe(c).startsWith(prefixo));
    // Só os tipos que estão na semana montada pela pessoa ou que tiveram check-in no mês (como a legenda do calendário).
    const ordem = [...TIPOS_MUSC, ...ATIVIDADES];
    const tipos = [...new Set([...config.semana.flat(), ...doMes.map((c) => c.tipo)])].filter((t) => TIPOS[t])
      .sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
    const contagem = tipos.map((t) => [t, doMes.filter((c) => c.tipo === t).length]);
    const max = Math.max(1, ...contagem.map(([, n]) => n));
    $('tipos-titulo').textContent = `Por tipo em ${nomeMes(ano, mes)}`;
    $('barras').innerHTML = !contagem.length ? '<li class="barras-vazio">Nenhum treino na sua semana nem check-in neste mês.</li>' : contagem.map(([t, n]) => `
      <li class="barra">
        <span class="barra-nome">${seloHTML(t)}${TIPOS[t].nome}</span>
        <span class="barra-trilho" aria-hidden="true">${n ? `<i class="${TIPOS[t].grupo}" style="width:${(n / max) * 100}%"></i>` : ''}</span>
        <span class="barra-valor">${n}</span>
      </li>`).join('');
  }

  // ---------- Dashboard → Evolução (mês a mês) ----------
  // Treinos por mês (colunas empilhadas por tipo, 6 meses por vez) e o resumo do mês escolhido: números com a
  // comparação com o mês anterior, quais treinos foram e as maiores cargas de cada exercício. Usa só os check-ins
  // e as cargas que o app já carrega.
  // Evolução ligada para todos (dev e produção). Para esconder de novo, troque para false (ou só no dev: !!(window.AMBIENTE && window.AMBIENTE.dev)).
  const EVOLUCAO_LIGADA = true;
  // Musculação, as atividades ativas e as desativadas (check-ins antigos), na ordem dos tipos.
  const gruposEvo = () => ['musc', ...ATIVIDADES, ...Object.keys(TIPOS).filter((k) => !/^t\d+$/.test(k) && !ATIVIDADES.includes(k))];
  const NOMES_GRUPO = { musc: 'Musculação' };
  const nomeGrupo = (g) => NOMES_GRUPO[g] || TIPOS[g].nome;
  const chaveMes = (ano, mes) => `${ano}-${pad(mes + 1)}`;
  const somarMeses = (chave, n) => { const [a, m] = chave.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); return chaveMes(d.getFullYear(), d.getMonth()); };
  const nomeMesChave = (chave) => { const [a, m] = chave.split('-').map(Number); return nomeMes(a, m - 1); };
  const evo = { aba: 'resumo', fim: null, sel: null, tabela: false, animou: false };
  // ate: só até esse dia do mês (para comparar o mês em andamento com o mesmo trecho do mês anterior).
  function resumoDoMes(chave, ate = 31) {
    const doMes = checkins.filter((c) => dataDe(c).startsWith(chave) && Number(dataDe(c).slice(8, 10)) <= ate);
    const porGrupo = Object.fromEntries(gruposEvo().map((g) => [g, 0]));
    const porTipo = {};
    doMes.forEach((c) => { const g = TIPOS[c.tipo].grupo; porGrupo[g] = (porGrupo[g] || 0) + 1; porTipo[c.tipo] = (porTipo[c.tipo] || 0) + 1; });
    // % do plano: o que a semana montada pede em cada dia do mês (até hoje, no mês atual), até 100%.
    const [a, mm] = chave.split('-').map(Number);
    const ultimo = Math.min(new Date(a, mm, 0).getDate(), chave === hoje().slice(0, 7) ? Number(hoje().slice(8, 10)) : 31, ate);
    let planejado = 0;
    for (let d = 1; d <= ultimo; d++) planejado += (config.semana[new Date(a, mm - 1, d).getDay()] || []).length;
    return {
      chave, total: doMes.length, porGrupo, porTipo,
      dias: new Set(doMes.map(dataDe)).size,
      minutos: doMes.reduce((s, c) => s + (duracaoMin(c) || 0), 0),
      planejado, plano: planejado ? Math.min(1, doMes.length / planejado) : null,
    };
  }
  const primeiroMes = () => (checkins.length ? checkins.map(dataDe).sort()[0].slice(0, 7) : hoje().slice(0, 7));
  function renderEvolucao() {
    const atual = hoje().slice(0, 7);
    if (!evo.fim) evo.fim = atual;
    if (!evo.sel) evo.sel = atual;
    const meses = Array.from({ length: 6 }, (_, i) => somarMeses(evo.fim, i - 5));
    document.querySelector('[data-evo-nav="1"]').disabled = evo.fim >= atual;
    document.querySelector('[data-evo-nav="-1"]').disabled = meses[0] <= primeiroMes();
    const dados = meses.map((k) => resumoDoMes(k));
    const ano = (k) => k.slice(0, 4);
    $('evo-periodo').textContent = `${nomeMesChave(meses[0]).slice(0, 3)}${ano(meses[0]) === ano(meses[5]) ? '' : ` de ${ano(meses[0])}`} a ${nomeMesChave(meses[5]).slice(0, 3)} de ${ano(meses[5])}`;
    graficoMeses(dados);
    const usados = gruposEvo().filter((g) => dados.some((d) => d.porGrupo[g]));
    $('evo-legenda').innerHTML = usados.map((g) => `<li><span class="selo ${g}" aria-hidden="true">${g === 'musc' ? '' : TIPOS[g].selo}</span><span>${esc(nomeGrupo(g))}</span></li>`).join('');
    $('evo-legenda').hidden = !usados.length;
    $('evo-tabela').innerHTML = `<table><thead><tr><th scope="col">Mês</th>${usados.map((g) => `<th scope="col">${esc(nomeGrupo(g))}</th>`).join('')}<th scope="col">Total</th></tr></thead><tbody>
      ${dados.map((d) => `<tr><th scope="row">${esc(capitalizar(nomeMesChave(d.chave)))} ${d.chave.slice(0, 4)}</th>${usados.map((g) => `<td>${d.porGrupo[g]}</td>`).join('')}<td><b>${d.total}</b></td></tr>`).join('')}</tbody></table>`;
    $('evo-tabela').hidden = !evo.tabela;
    renderMesEvolucao();
    renderPesosEvo();
  }
  function graficoMeses(dados) {
    const caixa = $('evo-grafico');
    const W = Math.max(280, Math.round(caixa.clientWidth || 320)), H = 200, topo = 22, base = 26;
    const max = Math.max(1, ...dados.map((d) => d.total));
    // Grade discreta em números redondos.
    const passo = max <= 4 ? 1 : max <= 10 ? 2 : max <= 20 ? 5 : 10;
    const teto = Math.ceil(max / passo) * passo;
    const alto = H - topo - base;
    const y = (v) => topo + alto - (v / teto) * alto;
    const banda = W / dados.length, larg = Math.min(40, banda * 0.56);
    const grade = Array.from({ length: teto / passo + 1 }, (_, i) => i * passo)
      .map((v) => `<line class="evo-grade" x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>`).join('');
    const cols = dados.map((d, i) => {
      const x = banda * i + (banda - larg) / 2;
      let acima = y(0);
      const partes = gruposEvo().filter((g) => d.porGrupo[g]);
      const segs = partes.map((g, k) => {
        const h = (d.porGrupo[g] / teto) * alto;
        const topoSeg = acima - h;
        // 2 px de respiro entre os pedaços; o de cima tem as pontas arredondadas.
        const hh = Math.max(1, h - (k < partes.length - 1 ? 2 : 0));
        const yy = topoSeg + (k < partes.length - 1 ? 2 : 0);
        acima = topoSeg;
        const r = k === partes.length - 1 ? Math.min(4, hh / 2) : 0;
        return r
          ? `<path class="evo-${g}" d="M${x},${yy + hh}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + larg - r}Q${x + larg},${yy} ${x + larg},${yy + r}V${yy + hh}Z"/>`
          : `<rect class="evo-${g}" x="${x}" y="${yy}" width="${larg}" height="${hh}"/>`;
      }).join('');
      const nome = nomeMesChave(d.chave);
      const rotulo = `${capitalizar(nome)} de ${d.chave.slice(0, 4)}: ${d.total} ${d.total === 1 ? 'treino' : 'treinos'}${partes.length ? ` (${partes.map((g) => `${d.porGrupo[g]} ${nomeGrupo(g)}`).join(', ')})` : ''}`;
      return `<g class="evo-col" role="button" tabindex="0" data-evo-mes="${d.chave}" aria-pressed="${d.chave === evo.sel}" aria-label="${esc(rotulo)}" data-balao="${esc(rotulo)}">
        <rect class="evo-fundo" x="${banda * i + 2}" y="2" width="${banda - 4}" height="${H - 4}" rx="10"/>
        <g class="evo-barra" style="--i:${i}">${segs || `<rect class="evo-vazio" x="${x}" y="${y(0) - 2}" width="${larg}" height="2"/>`}</g>
        <text class="evo-total" x="${x + larg / 2}" y="${(d.total ? acima : y(0)) - 7}" text-anchor="middle">${d.total}</text>
        <text class="evo-mes" x="${x + larg / 2}" y="${H - 8}" text-anchor="middle">${esc(nome.slice(0, 3))}</text>
      </g>`;
    }).join('');
    caixa.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="Treinos por mês, toque num mês para ver o resumo">${grade}${cols}</svg>`;
    if (!evo.animou) { evo.animou = true; caixa.classList.add('entra'); setTimeout(() => caixa.classList.remove('entra'), 900); }
  }
  function renderMesEvolucao() {
    const r = resumoDoMes(evo.sel);
    // Mês em andamento: compara com o mesmo trecho do mês anterior (1 a hoje), para não mostrar queda falsa no começo do mês.
    const emAndamento = evo.sel === hoje().slice(0, 7);
    const diaHoje = Number(hoje().slice(8, 10));
    const ant = resumoDoMes(somarMeses(evo.sel, -1), emAndamento ? diaHoje : 31);
    const nome = capitalizar(nomeMesChave(evo.sel));
    $('evo-mes-titulo').textContent = `${nome} de ${evo.sel.slice(0, 4)}`;
    $('evo-mes-comp').textContent = emAndamento
      ? `1 a ${diaHoje} comparado a 1 a ${diaHoje} de ${nomeMesChave(somarMeses(evo.sel, -1))}`
      : `comparado a ${nomeMesChave(somarMeses(evo.sel, -1))}`;
    const delta = (a, b, fmt = (n) => fmtNum(n)) => {
      if (a === b) return '<span class="delta igual">=</span>';
      return a > b ? `<span class="delta sobe">▲ ${fmt(a - b)}</span>` : `<span class="delta desce">▼ ${fmt(b - a)}</span>`;
    };
    const pct = (v) => (v === null ? '—' : `${Math.round(v * 100)}<small>%</small>`);
    $('evo-numeros').innerHTML = `
      <div><dt>Treinos</dt><dd>${r.total}${delta(r.total, ant.total)}</dd></div>
      <div><dt>Dias com treino</dt><dd>${r.dias}${delta(r.dias, ant.dias)}</dd></div>
      <div><dt>Horas treinadas</dt><dd>${fmtNum(r.minutos / 60)}<small> h</small>${delta(Math.round(r.minutos / 6) / 10, Math.round(ant.minutos / 6) / 10, (n) => `${fmtNum(n)} h`)}</dd></div>
      <div><dt>Do plano</dt><dd>${pct(r.plano)}${r.plano !== null && ant.plano !== null ? delta(Math.round(r.plano * 100), Math.round(ant.plano * 100), (n) => `${n} p.p.`) : ''}</dd></div>`;
    // O que você treinou: por tipo, com os treinos de musculação.
    const grupos = gruposEvo().filter((g) => r.porGrupo[g]);
    $('evo-quais').innerHTML = grupos.length ? grupos.map((g) => {
      const treinos = g === 'musc' ? TIPOS_MUSC.filter((t) => r.porTipo[t]).map((t) => `${TIPOS[t].nome} · ${r.porTipo[t]}×`).join(', ') : '';
      return `<li><span class="evo-nome">${seloHTML(g === 'musc' ? (TIPOS_MUSC.find((t) => r.porTipo[t]) || 't1') : g)}${esc(nomeGrupo(g))}</span>
        <span class="evo-valor">${r.porGrupo[g]}</span>${treinos ? `<small>${esc(treinos)}</small>` : ''}</li>`;
    }).join('') : `<li class="evo-vazio-txt">${checkins.length ? `Nenhum treino em ${esc(nomeMesChave(evo.sel))}.` : 'Seus treinos vão aparecer aqui. Faça o primeiro check-in!'}</li>`;
    renderFaltaEvo(r);
    renderPlanoEvo();
  }
  const previstoNoDia = (a, m, d) => (config.semana[new Date(a, m - 1, d).getDay()] || []).filter((t) => TIPOS[t]);
  // Quanto falta (só no mês atual): o plano do mês inteiro, o que já foi feito e o ritmo de agora.
  function renderFaltaEvo(r) {
    const caixa = $('evo-falta');
    const [a, m] = evo.sel.split('-').map(Number);
    const fimMes = new Date(a, m, 0).getDate();
    let previsto = 0;
    for (let d = 1; d <= fimMes; d++) previsto += previstoNoDia(a, m, d).length;
    caixa.hidden = evo.sel !== hoje().slice(0, 7) || !previsto;
    if (caixa.hidden) return;
    const feitos = Math.min(r.total, previsto);
    const faltam = previsto - feitos;
    const dias = fimMes - Number(hoje().slice(8, 10)) + 1;
    const atrasados = Math.max(0, Math.min(r.planejado, previsto) - feitos);
    const nome = esc(nomeMesChave(evo.sel));
    caixa.innerHTML = `<strong>${faltam ? `Faltam ${faltam} ${faltam === 1 ? 'treino' : 'treinos'} para fechar ${nome} com 100% do plano` : `Plano de ${nome} completo! 🎉`}</strong>
      <span class="barra-trilho" aria-hidden="true"><i class="feito" style="width:${(feitos / previsto) * 100}%"></i><i class="ate" style="width:${(atrasados / previsto) * 100}%"></i></span>
      <p>${feitos} de ${previsto} treinos do plano feitos${faltam ? ` · ${dias} ${dias === 1 ? 'dia' : 'dias'} pela frente, contando hoje` : ''}${faltam && r.plano !== null ? ` · no ritmo de agora, você fecha com ${Math.round(r.plano * 100)}%` : ''}</p>`;
  }
  // Seu plano no mês: cada atividade da semana montada, quantas vezes ela caiu no mês (até hoje, no mês atual)
  // e quantas foram feitas; as mais puladas primeiro. No mês atual, a dica do dia da semana que mais falha.
  function renderPlanoEvo() {
    const atual = hoje().slice(0, 7);
    const [a, m] = evo.sel.split('-').map(Number);
    const ultimo = evo.sel === atual ? Number(hoje().slice(8, 10)) : new Date(a, m, 0).getDate();
    const prev = {}, dias = {}, feitos = {};
    for (let d = 1; d <= ultimo; d++) previstoNoDia(a, m, d).forEach((t) => {
      prev[t] = (prev[t] || 0) + 1;
      (dias[t] = dias[t] || new Set()).add(new Date(a, m - 1, d).getDay());
    });
    checkins.forEach((c) => { const d = dataDe(c); if (d.startsWith(evo.sel) && Number(d.slice(8, 10)) <= ultimo) feitos[c.tipo] = (feitos[c.tipo] || 0) + 1; });
    const lista = new Intl.ListFormat('pt-BR', { type: 'conjunction' });
    const itens = Object.keys(prev).map((t) => ({ t, prev: prev[t], feito: Math.min(prev[t], feitos[t] || 0), dias: [...dias[t]].sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7)) }))
      .sort((x, y) => x.feito / x.prev - y.feito / y.prev || y.prev - x.prev);
    $('evo-plano-bloco').hidden = !itens.length || evo.sel > atual;
    $('evo-plano-quando').textContent = evo.sel === atual ? 'até hoje' : 'mês inteiro';
    $('evo-plano').innerHTML = itens.map((it) => `
      <li class="meta"><span class="meta-nome">${seloHTML(it.t)}<span>${esc(nomeAtividade(it.t))}<small>${esc(lista.format(it.dias.map((d) => NOMES_DIA[d])))}</small></span></span>
        <span class="seg" aria-hidden="true">${Array.from({ length: it.prev }, (_, i) => `<i class="${i < it.feito ? 'on ' : ''}${TIPOS[it.t].grupo}"></i>`).join('')}</span>
        <span class="meta-valor">${it.feito} de ${it.prev}</span></li>`).join('');
    // Dica: nos últimos 3 meses (até ontem, desde o primeiro check-in), o dia da semana com plano que menos teve treino.
    const dica = $('evo-dica');
    dica.hidden = true;
    if (evo.sel !== atual || !checkins.length) return;
    const comTreino = new Set(checkins.map(dataDe));
    const inicio = checkins.map(dataDe).sort()[0];
    const conta = Array.from({ length: 7 }, () => ({ plano: 0, feito: 0 }));
    const dia = new Date(`${hoje()}T12:00:00`);
    for (let i = 1; i <= 91; i++) {
      dia.setDate(dia.getDate() - 1);
      const iso = `${dia.getFullYear()}-${pad(dia.getMonth() + 1)}-${pad(dia.getDate())}`;
      if (iso < inicio) break;
      if (!(config.semana[dia.getDay()] || []).some((t) => TIPOS[t])) continue;
      conta[dia.getDay()].plano += 1;
      if (comTreino.has(iso)) conta[dia.getDay()].feito += 1;
    }
    const pior = conta.map((c, d) => ({ ...c, d })).filter((c) => c.plano >= 3 && c.feito / c.plano < 0.5)
      .sort((x, y) => x.feito / x.plano - y.feito / y.plano || y.plano - x.plano)[0];
    if (!pior) return;
    dica.innerHTML = `💡 ${pior.d === 0 || pior.d === 6 ? 'O' : 'A'} <b>${NOMES_DIA[pior.d]}</b> é o dia que você mais pula nos últimos 3 meses (treinou em ${pior.feito} de ${pior.plano}). Que tal rever esse dia? <a class="link-btn" href="#voce/semana">Abrir Minha semana</a>`;
    dica.hidden = false;
  }
  // ---------- Pesos na Evolução (todo o histórico, não só o mês escolhido) ----------
  // Histórico de cada exercício: a maior carga de cada dia, em ordem de data (nome de hoje no catálogo, juntando os antigos).
  function historicoPesos() {
    const m = new Map();
    cargas.forEach((r) => Object.entries(r.series || {}).forEach(([nome, series]) => {
      if (config.semPeso.has(nome)) return;
      const kg = maxDoDia(series);
      if (kg <= 0) return;
      const chave = nomeAtual(nome);
      if (!m.has(chave)) m.set(chave, new Map());
      const dias = m.get(chave);
      dias.set(r.data, Math.max(kg, dias.get(r.data) || 0));
    }));
    return [...m.entries()].map(([chave, dias]) => {
      const h = [...dias.entries()].map(([data, kg]) => ({ data, kg })).sort((a, b) => (a.data < b.data ? -1 : 1));
      const melhor = Math.max(...h.map((x) => x.kg));
      return { chave, h, melhor, quando: h.find((x) => x.kg === melhor).data, primeiro: h[0], ultimo: h[h.length - 1] };
    });
  }
  const dataCurta = (d) => fmtData(d, { day: 'numeric', month: 'short' }).replace('.', '');
  const mesCurto = (d) => fmtData(d, { month: 'short', year: d.slice(0, 4) === hoje().slice(0, 4) ? undefined : 'numeric' }).replace('.', '');
  // Seus maiores pesos: o recorde de cada exercício, do mais pesado para o mais leve, com quanto subiu desde o
  // primeiro registro e o último treino quando ficou abaixo do recorde. 🏆 = recorde batido nos últimos 30 dias.
  function renderPesosEvo() {
    const todos = historicoPesos();
    const itens = [...todos].sort((a, b) => b.melhor - a.melhor || a.chave.localeCompare(b.chave, 'pt-BR'));
    const MOSTRAR = 5;
    const visiveis = evo.pesosTodos ? itens : itens.slice(0, MOSTRAR);
    const recente = somarDias(hoje(), -30);
    $('evo-pesos').innerHTML = itens.length ? visiveis.map((it, i) => {
      const subiu = it.melhor - it.primeiro.kg;
      const partes = [`recorde em ${dataCurta(it.quando)}`];
      if (subiu > 0) partes.push(`▲ ${fmtKg(subiu)} kg desde ${mesCurto(it.primeiro.data)} (${fmtKg(it.primeiro.kg)} kg)`);
      else if (it.h.length > 1 && it.ultimo.kg === it.melhor) partes.push(`mesma carga desde ${mesCurto(it.primeiro.data)}`);
      if (it.ultimo.kg < it.melhor) partes.push(`último treino: ${fmtKg(it.ultimo.kg)} kg`);
      return `
      <li><span class="evo-nome"><span class="evo-pos" aria-hidden="true">${i + 1}</span>${esc(it.chave)}${it.quando >= recente && it.h.length > 1 && subiu > 0 ? ' <span title="Recorde nos últimos 30 dias" aria-label="Recorde nos últimos 30 dias">🏆</span>' : ''}</span>
        <span class="evo-valor">${fmtKg(it.melhor)} kg</span>
        <small>${esc(partes.join(' · '))}</small></li>`;
    }).join('') : '<li class="evo-vazio-txt">Nenhum peso registrado ainda. Anote as cargas no treino para ver sua evolução.</li>';
    const btn = $('evo-pesos-todos');
    btn.hidden = itens.length <= MOSTRAR;
    btn.textContent = evo.pesosTodos ? 'Ver só os 5 maiores' : `Ver todos (${itens.length})`;
    btn.setAttribute('aria-expanded', String(!!evo.pesosTodos));
    renderParadosEvo(todos);
  }
  // Pesos estagnados: exercícios ainda em uso (treinados nos últimos 60 dias) que não batem o recorde há 4 semanas
  // ou mais, com pelo menos 2 treinos depois dele. Sugestão de +2 kg até 20 kg e +2,5 kg acima.
  function renderParadosEvo(todos) {
    const hj = hoje();
    const semanas = (d) => Math.floor((deData(hj) - deData(d)) / (7 * 864e5));
    const itens = todos.filter((it) => it.ultimo.data >= somarDias(hj, -60) && semanas(it.quando) >= 4)
      .map((it) => {
        const depois = it.h.filter((x) => x.data > it.quando).length;
        const sug = it.melhor + (it.melhor < 20 ? 2 : 2.5);
        const abaixo = it.ultimo.kg < it.melhor ? ` No último treino: ${fmtKg(it.ultimo.kg)} kg.` : '';
        return { ...it, depois, sem: semanas(it.quando),
          txt: `Sem subir desde ${dataCurta(it.quando)} (${semanas(it.quando)} semanas, ${depois} ${depois === 1 ? 'treino' : 'treinos'} depois).${abaixo} Se as séries estão fáceis, tente ${fmtKg(sug)} kg.` };
      })
      .filter((it) => it.depois >= 2)
      .sort((a, b) => b.sem - a.sem || a.chave.localeCompare(b.chave, 'pt-BR'));
    $('evo-parados').innerHTML = itens.length ? itens.map((it) => `
      <li><span class="evo-nome">${esc(it.chave)} <span class="evo-aviso">${it.sem} sem</span></span><span class="evo-valor">${fmtKg(it.melhor)} kg</span><small>${esc(it.txt)}</small></li>`).join('')
      : `<li class="evo-vazio-txt">${todos.length ? 'Nenhum peso estagnado: seus exercícios bateram recorde nas últimas 4 semanas. 💪' : 'Registre os pesos dos treinos para ver quais estão estagnados.'}</li>`;
  }
  function mostrarAbaDash(aba, { focar = false, url = true } = {}) {
    evo.aba = aba === 'evolucao' ? 'evolucao' : 'resumo';
    document.querySelectorAll('[data-dash-aba]').forEach((b) => {
      const sel = b.dataset.dashAba === evo.aba;
      b.setAttribute('aria-selected', String(sel)); b.tabIndex = sel ? 0 : -1;
      if (sel && focar) b.focus();
    });
    $('dash-resumo').hidden = evo.aba !== 'resumo';
    $('dash-evolucao').hidden = evo.aba !== 'evolucao';
    if (url) history.replaceState(null, '', `#dashboard${evo.aba === 'evolucao' ? '/evolucao' : ''}`);
    if (evo.aba === 'evolucao') { renderEvolucao(); if (url) registrarEvento('evolucao_aberta'); }
  }
  document.querySelector('.dash-abas').addEventListener('click', (e) => { const b = e.target.closest('[data-dash-aba]'); if (b) mostrarAbaDash(b.dataset.dashAba); });
  document.querySelector('.dash-abas').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); mostrarAbaDash(evo.aba === 'resumo' ? 'evolucao' : 'resumo', { focar: true });
  });
  function escolherMesEvo(chave) { evo.sel = chave; document.querySelectorAll('.evo-col').forEach((g) => g.setAttribute('aria-pressed', String(g.dataset.evoMes === chave))); renderMesEvolucao(); }
  $('dash-evolucao').addEventListener('click', (e) => {
    const col = e.target.closest('[data-evo-mes]');
    if (col) return escolherMesEvo(col.dataset.evoMes);
    const nav = e.target.closest('[data-evo-nav]');
    if (nav) {
      evo.fim = somarMeses(evo.fim, Number(nav.dataset.evoNav) * 6);
      if (evo.fim > hoje().slice(0, 7)) evo.fim = hoje().slice(0, 7);
      if (evo.sel < somarMeses(evo.fim, -5) || evo.sel > evo.fim) evo.sel = evo.fim;
      return renderEvolucao();
    }
    if (e.target.closest('#evo-tabela-btn')) {
      evo.tabela = !evo.tabela;
      $('evo-tabela').hidden = !evo.tabela;
      $('evo-tabela-btn').setAttribute('aria-expanded', String(evo.tabela));
      $('evo-tabela-btn').textContent = evo.tabela ? 'Esconder tabela' : 'Ver tabela';
    }
    if (e.target.closest('#evo-pesos-todos')) { evo.pesosTodos = !evo.pesosTodos; renderPesosEvo(); }
  });
  $('dash-evolucao').addEventListener('keydown', (e) => {
    const col = e.target.closest('[data-evo-mes]');
    if (col && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); escolherMesEvo(col.dataset.evoMes); }
  });
  // Balão ao passar o mouse ou focar uma coluna.
  function balaoEvo(col) {
    const b = $('evo-balao');
    if (!col) { b.hidden = true; return; }
    b.textContent = col.dataset.balao;
    b.hidden = false;
    const caixa = document.querySelector('.evo-meses').getBoundingClientRect();
    const r = col.querySelector('.evo-fundo').getBoundingClientRect();
    const larg = b.offsetWidth;
    b.style.left = `${Math.min(Math.max(8, r.left - caixa.left + r.width / 2 - larg / 2), caixa.width - larg - 8)}px`;
    b.style.top = `${Math.max(4, r.top - caixa.top - b.offsetHeight + 8)}px`;
  }
  $('evo-grafico').addEventListener('mouseover', (e) => balaoEvo(e.target.closest('.evo-col')));
  $('evo-grafico').addEventListener('mouseleave', () => balaoEvo(null));
  $('evo-grafico').addEventListener('focusin', (e) => balaoEvo(e.target.closest('.evo-col')));
  $('evo-grafico').addEventListener('focusout', () => balaoEvo(null));
  addEventListener('resize', () => { if (telaAtual() === 'dashboard' && evo.aba === 'evolucao') renderEvolucao(); });

  function renderDashboard() {
    // Com EVOLUCAO_LIGADA desligada, as abas somem e o Dashboard mostra só o Resumo.
    document.querySelector('.dash-abas').hidden = !EVOLUCAO_LIGADA;
    const aba = EVOLUCAO_LIGADA && location.hash.slice(1).split('/')[1] === 'evolucao' ? 'evolucao' : 'resumo';
    if (aba !== evo.aba) mostrarAbaDash(aba, { url: false });
    if (evo.aba === 'evolucao') renderEvolucao();
    renderNumeros();
    renderMetas();
    renderCalendario();
    renderDia();
    renderBarras();
    // Com a Evolução ligada, "Por tipo no mês" fica só lá ("O que você treinou"), sem repetir no Resumo.
    $('tipos-titulo').closest('section').hidden = EVOLUCAO_LIGADA;
    agendarFab();
  }
