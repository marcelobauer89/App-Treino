// Supabase falso para testes: guarda o "banco" no localStorage da página de teste.
(function () {
  const CHAVE = 'mock-supabase';
  const vazio = { sessao: null, perfis: [], checkins: [], cargas: [], eventos: [], admins: [], push_inscricoes: [], falhar: false, log: [] };
  const ler = () => Object.assign({}, vazio, JSON.parse(localStorage.getItem(CHAVE) || 'null') || {});
  const gravar = (db) => localStorage.setItem(CHAVE, JSON.stringify(db));
  const ouvintes = [];
  const emitir = (ev, s) => ouvintes.forEach((cb) => cb(ev, s));
  const USUARIO = { id: 'u1', email: 'marcelo@exemplo.com', user_metadata: { full_name: 'Marcelo Bauer', avatar_url: '' } };

  class Consulta {
    constructor(tabela) { this.tabela = tabela; this.op = 'select'; this.filtros = []; this.unico = false; }
    select(c) { this.cols = c; return this; }
    limit() { return this; }
    order(c) { this.ordens = (this.ordens || []).concat(c); return this; }
    // Como o Supabase: .range(de, ate) pega uma página, e maxLinhas (o "Max rows" do projeto) corta qualquer lista.
    range(de, ate) { this.faixa = [de, ate]; return this; }
    eq(c, v) { this.filtros.push([c, v]); return this; }
    maybeSingle() { this.unico = true; return this; }
    insert(r) { this.op = 'insert'; this.dados = [].concat(r); return this; }
    upsert(r, o) { this.op = 'upsert'; this.dados = [].concat(r); this.chaves = o && o.onConflict ? o.onConflict.split(',') : ['id']; return this; }
    update(v) { this.op = 'update'; this.dados = v; return this; }
    delete() { this.op = 'delete'; return this; }
    then(ok, falha) { return new Promise((r) => setTimeout(r, this.op === 'select' || !this.op ? (ler().atrasoDados || 5) : 5)).then(() => this.executar()).then(ok, falha); }
    executar() {
      const db = ler();
      db.log.push(`${this.op}:${this.tabela}${this.op === 'select' && this.cols && this.cols !== '*' ? `:${this.cols}` : ''}`);
      if (this.faixa) db.log.push(`range:${this.tabela}:${this.faixa[0]}-${this.faixa[1]}`);
      // semRede: sem internet, toda chamada falha como no navegador (TypeError: Failed to fetch).
      if (db.semRede) { gravar(db); return { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }; }
      if (db.semTabelaEventos && this.tabela === 'eventos') {
        gravar(db); return { data: null, error: { message: "Could not find the table 'public.eventos' in the schema cache" } };
      }
      // Eventos: falhas da próxima tentativa (eventosErros: ['rede', 'sessao', ...]) e as regras do banco (tipo e 2.000 bytes).
      if (this.tabela === 'eventos' && this.op === 'insert') {
        const falha = (db.eventosErros || []).shift();
        if (falha) {
          db.log.push(`eventos:falhou:${falha}`); gravar(db);
          return falha === 'rede' ? { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }
            : falha === 'tabela' ? { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.eventos' in the schema cache" } }
              : { data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "eventos"' } };
        }
        const invalido = this.dados.find((r) => r.tipo === db.eventoInvalido || !/^[a-z_]{2,40}$/.test(r.tipo) || new TextEncoder().encode(JSON.stringify(r.dados || {})).length > 2000);
        if (invalido) { db.log.push('eventos:recusado'); gravar(db); return { data: null, error: { code: '23514', message: 'new row for relation "eventos" violates check constraint "eventos_dados_check"' } }; }
      }
      // Banco com o schema antigo, sem a tabela cargas.
      if (db.semTabelaCargas && this.tabela === 'cargas') {
        gravar(db); return { data: null, error: { message: "Could not find the table 'public.cargas' in the schema cache" } };
      }
      if (db.falharLeitura && this.op === 'select' && this.tabela === 'perfis') { db.falharLeitura--; gravar(db); return { data: null, error: { message: 'Failed to fetch' } }; }
      if (db.falhar && this.op !== 'select') { gravar(db); return { data: null, error: { message: 'erro no servidor', code: 'XX000' } }; }
      // Banco com o schema antigo, sem a coluna perfis.semana.
      if (db.semColunaSemPeso && this.op === 'update' && this.dados && 'sem_peso' in this.dados) {
        gravar(db); return { data: null, error: { message: "Could not find the 'sem_peso' column of 'perfis' in the schema cache" } };
      }
      if (db.semColunaEmailsResumo && this.op === 'update' && this.dados && 'emails_resumo' in this.dados) {
        gravar(db); return { data: null, error: { message: "Could not find the 'emails_resumo' column of 'perfis' in the schema cache" } };
      }
      // semPermissao: ['jornada', …] = colunas que existem mas ficaram fora do grant update (erro 42501, sem citar a coluna).
      if (this.op === 'update' && this.dados && (db.semPermissao || []).some((c) => c in this.dados)) {
        gravar(db); return { data: null, error: { code: '42501', message: 'permission denied for table perfis' } };
      }
      // semColunas: ['treinos_anterior', …] = colunas que ainda não existem no banco.
      const faltando = this.op === 'update' && this.dados && (db.semColunas || []).find((c) => c in this.dados);
      if (faltando) { gravar(db); return { data: null, error: { message: `Could not find the '${faltando}' column of 'perfis' in the schema cache` } }; }
      if (db.semColunaSemana && this.op === 'update' && this.dados && 'semana' in this.dados) {
        gravar(db); return { data: null, error: { message: "Could not find the 'semana' column of 'perfis' in the schema cache" } };
      }
      // semFotos: banco sem a coluna checkins.foto (schema antigo).
      if (db.semFotos && this.tabela === 'checkins' && ((this.cols && /foto/.test(this.cols)) || (this.dados && [].concat(this.dados).some((r) => r && 'foto' in r)))) {
        gravar(db); return { data: null, error: { message: "column checkins.foto does not exist" } };
      }
      // Catálogo (exercicios, jornadas): sem a lista no banco falso = SQL ainda não rodado (tabela não existe).
      // falharCatalogo: a leitura falha (sem internet). Só leitura pela API, como no banco.
      if (['exercicios', 'jornadas'].includes(this.tabela)) {
        if (!Array.isArray(db[this.tabela])) { gravar(db); return { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${this.tabela}' in the schema cache` } }; }
        if (db.falharCatalogo) { gravar(db); return { data: null, error: { message: 'TypeError: Failed to fetch' } }; }
        if (this.op !== 'select') { gravar(db); return { data: null, error: { code: '42501', message: `permission denied for table ${this.tabela}` } }; }
      }
      const casa = (r) => this.filtros.every(([c, v]) => r[c] === v);
      const linhas = db[this.tabela];
      if (this.op === 'select') {
        let d = linhas.filter(casa);
        if (this.ordens) d.sort((a, b) => { for (const c of this.ordens) { const x = String(a[c] ?? '').localeCompare(String(b[c] ?? '')); if (x) return x; } return 0; });
        if (this.faixa) d = d.slice(this.faixa[0], this.faixa[1] + 1);
        if (!this.unico) d = d.slice(0, db.maxLinhas || Infinity);
        gravar(db);
        return { data: this.unico ? d[0] || null : d, error: null };
      }
      if (this.op === 'insert' || this.op === 'upsert') {
        for (const r of this.dados) {
          const chaves = this.chaves || ['id'];
          // Linhas sem a chave (ex.: eventos, id gerado pelo banco) nunca colidem.
          const i = chaves.every((k) => r[k] !== undefined) ? linhas.findIndex((x) => chaves.every((k) => x[k] === r[k])) : -1;
          if (i >= 0 && this.op === 'insert') return { data: null, error: { message: 'duplicate key' } };
          if (i >= 0) linhas[i] = Object.assign({}, linhas[i], r); else linhas.push(Object.assign({}, r));
        }
        // Mesmo índice único do schema: um check-in aberto por usuário.
        if (this.tabela === 'checkins' && linhas.filter((x) => !x.fim).length > 1) {
          return { data: null, error: { message: 'checkins_um_aberto' } };
        }
      }
      if (this.op === 'update') linhas.filter(casa).forEach((r) => Object.assign(r, this.dados));
      if (this.op === 'delete') db[this.tabela] = linhas.filter((r) => !casa(r));
      gravar(db);
      return { data: null, error: null };
    }
  }

  window.supabase = {
    createClient(url, chave, opcoes) {
      const db = ler(); db.cliente = { url, chave, flowType: opcoes && opcoes.auth && opcoes.auth.flowType }; gravar(db);
      return {
        auth: {
          onAuthStateChange(cb) {
            ouvintes.push(cb);
            // atrasoSessao (ms): a resposta do login demora, como a biblioteca real tentando renovar sem internet (até 30 s).
            setTimeout(() => {
              const d = ler();
              // sessaoVencida + semRede: a biblioteca não consegue renovar a sessão e responde "sem sessão".
              cb('INITIAL_SESSION', d.semRede && d.sessaoVencida ? null : d.sessao);
              // Como a biblioteca real na volta do Google: também chega SIGNED_IN com a mesma sessão.
              if (d.sessao && d.doisEventos) cb('SIGNED_IN', d.sessao);
            }, ler().atrasoSessao || 0);
            return { data: { subscription: { unsubscribe() {} } } };
          },
          async getSession() { return { data: { session: ler().sessao } }; },
          async refreshSession() { const d = ler(); d.log.push('refreshSession'); gravar(d); return { data: { session: d.semRede ? null : d.sessao }, error: d.semRede ? { message: 'Failed to fetch' } : null }; },
          async initialize() {
            const d = ler();
            return { error: d.erroInit ? { message: d.erroInit } : null };
          },
          async signInWithOAuth(o) {
            const d = ler();
            d.sessao = { user: USUARIO };
            d.oauth = o;
            if (!d.perfis.find((p) => p.id === USUARIO.id)) {
              d.perfis.push({ id: USUARIO.id, nome: 'Marcelo Bauer', email: USUARIO.email, foto: '', tema: 'auto', dias_jiu: [2, 4] });
            }
            gravar(d);
            setTimeout(() => emitir('SIGNED_IN', d.sessao), 0);
            return { error: null };
          },
          async signOut() {
            const d = ler(); d.sessao = null; gravar(d);
            setTimeout(() => emitir('SIGNED_OUT', null), 0);
            return { error: null };
          },
        },
        from: (t) => new Consulta(t),
        // Storage falso: db.fotos = { caminho: { bytes, tipo } }; falharFoto faz o envio falhar.
        storage: {
          from(bucket) {
            const pausa = () => new Promise((r) => setTimeout(r, 5));
            return {
              async upload(caminho, arquivo, op = {}) {
                await pausa(); const d = ler(); d.log.push(`storage:upload:${bucket}/${caminho}`);
                if (d.falharFoto) { gravar(d); return { data: null, error: { message: 'erro no servidor' } }; }
                d.fotos = d.fotos || {}; d.fotos[caminho] = { bytes: arquivo.size, tipo: op.contentType || arquivo.type, upsert: !!op.upsert, bucket };
                gravar(d); return { data: { path: caminho }, error: null };
              },
              async remove(caminhos) {
                await pausa(); const d = ler(); d.fotos = d.fotos || {};
                caminhos.forEach((k) => { d.log.push(`storage:remove:${bucket}/${k}`); delete d.fotos[k]; });
                gravar(d); return { data: [], error: null };
              },
              async createSignedUrl(caminho, s) { await pausa(); return { data: { signedUrl: `https://teste.supabase.co/storage/v1/object/sign/${bucket}/${caminho}?t=${s}` }, error: null }; },
              async createSignedUrls(caminhos, s) { await pausa(); return { data: caminhos.map((k) => ({ path: k, signedUrl: `https://teste.supabase.co/storage/v1/object/sign/${bucket}/${k}?t=${s}` })), error: null }; },
            };
          },
        },
        // Realtime falso: presença guardada em db.presenca[topico] = { chave: [meta] }; cada canal confere a cada 200 ms.
        realtime: { async setAuth() { const d = ler(); d.log.push('realtime:setAuth'); gravar(d); } },
        channel(topico, opcoes = {}) {
          const d0 = ler(); d0.canais = d0.canais || []; d0.canais.push({ topico, opcoes }); gravar(d0);
          const ouv = [];
          let ultimo = null, timer = null;
          const chave = (opcoes.config && opcoes.config.presence && opcoes.config.presence.key) || 'anon';
          const canal = {
            topic: `realtime:${topico}`,
            on(tipo, filtro, cb) {
              if (tipo === 'presence' && filtro.event === 'sync') ouv.push(cb);
              const d = ler(); d.log.push(`on:${tipo}:${topico}`); gravar(d);
              return canal;
            },
            subscribe(cb) {
              setTimeout(() => {
                const d = ler();
                if (d.realtimeFalhar || (d.realtimeFalharTopicos || []).includes(topico)) {
                  return cb && cb('CHANNEL_ERROR', new Error(`Unauthorized: You do not have permissions to read from this Channel topic: ${topico}`));
                }
                // Queda passageira: erro de transporte e, 2 s depois, reconecta.
                if (d.realtimeTransporte) return cb && cb('CHANNEL_ERROR', new Error('channel error: transport failure'));
                if (d.realtimeOscila) {
                  cb && cb('CHANNEL_ERROR', new Error('channel error: transport failure'));
                  setTimeout(() => cb && cb('SUBSCRIBED'), 2000);
                } else cb && cb('SUBSCRIBED');
                const conferir = () => {
                  const atual = JSON.stringify((ler().presenca || {})[topico] || {});
                  if (atual !== ultimo) { ultimo = atual; ouv.forEach((f) => f()); }
                };
                conferir();
                timer = setInterval(conferir, 200);
              }, 10);
              return canal;
            },
            presenceState() { return (ler().presenca || {})[topico] || {}; },
            async track(meta) {
              const d = ler();
              if (d.trackTimeout) { d.log.push(`trackTimeout:${topico}`); gravar(d); return 'timed out'; }
              if (d.trackFalhar) { d.log.push(`trackFalhou:${topico}`); gravar(d); return 'error'; } d.presenca = d.presenca || {}; d.presenca[topico] = { [chave]: [meta] };
              d.log.push(`track:${topico}:${meta.tela}`); gravar(d); return 'ok';
            },
            async untrack() {
              const d = ler(); if (d.presenca) delete d.presenca[topico];
              d.log.push(`untrack:${topico}`); gravar(d); return 'ok';
            },
            _parar() { clearInterval(timer); },
          };
          return canal;
        },
        async removeChannel(c) { c._parar(); const d = ler(); d.log.push(`removeChannel:${c.topic}`); gravar(d); return 'ok'; },
        // Como o Supabase: .range(de, ate) pega uma página do resultado, e maxLinhas (padrão sem limite)
        // corta qualquer lista nesse tamanho (o "Max rows" do projeto, 1.000 no Supabase).
        rpc(nome, args) {
          const cliente = this;
          let faixa = null;
          const cortar = (r) => {
            if (!r || r.error || !Array.isArray(r.data)) return r;
            let d = r.data;
            if (faixa) d = d.slice(faixa[0], faixa[1] + 1);
            return { ...r, data: d.slice(0, ler().maxLinhas || Infinity) };
          };
          const q = {
            range(de, ate) { faixa = [de, ate]; const d = ler(); d.log.push(`range:${nome}:${de}-${ate}`); gravar(d); return q; },
            then(ok, falha) { return cliente.rpcBruto(nome, args).then(cortar).then(ok, falha); },
            catch(falha) { return q.then(undefined, falha); },
          };
          return q;
        },
        rpcBruto(nome, args) {
          // admin.atraso (ms): segura as respostas das funções do painel, para ver o carregamento.
          const espera = (nome === 'eh_admin' || nome.startsWith('admin_')) ? ((ler().admin || {}).atraso || 5) : 5;
          return new Promise((r) => setTimeout(r, espera)).then(() => {
            const db = ler();
            db.log.push(`rpc:${nome}`);
            if (db.semRede) { gravar(db); return { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }; }
            // Apps conectados: db.integracoes = [{ id, nome, prefixo, criada_em, ultimo_uso_em, revogada_em }]; semIntegracoes = schema antigo.
            if (['criar_codigo_conexao', 'minhas_integracoes', 'revogar_integracao'].includes(nome)) {
              if (db.semIntegracoes) { gravar(db); return { data: null, error: { message: `Could not find the function public.${nome} in the schema cache` } }; }
              db.integracoes = db.integracoes || [];
              let data = null, erro = null;
              if (nome === 'criar_codigo_conexao') {
                data = [{ codigo: db.proximoCodigoConexao || 'K7P2QX9M', expira_em: new Date(Date.now() + 10 * 60000).toISOString() }];
                db.codigosConexao = (db.codigosConexao || 0) + 1;
              } else if (nome === 'minhas_integracoes') {
                data = db.integracoes.filter((i) => !i.revogada_em).map(({ id, nome: n, prefixo, criada_em, ultimo_uso_em }) => ({ id, nome: n, prefixo, criada_em, ultimo_uso_em }));
              } else {
                const i = db.integracoes.find((x) => x.id === args.p_id && !x.revogada_em);
                if (i) i.revogada_em = new Date().toISOString(); else erro = 'App conectado não encontrado.';
              }
              gravar(db); return { data: erro ? null : data, error: erro ? { message: erro } : null };
            }
            if (nome === 'registrar_push') {
              if (db.semPush) { gravar(db); return { data: null, error: { message: 'Could not find the function public.registrar_push' } }; }
              db.push_inscricoes = (db.push_inscricoes || []).filter((x) => x.endpoint !== args.p_endpoint);
              db.push_inscricoes.push({ usuario_id: db.sessao.user.id, endpoint: args.p_endpoint, p256dh: args.p_p256dh, auth: args.p_auth, sistema: args.p_sistema });
              gravar(db); return { data: null, error: null };
            }
            // Convites: db.convites = [{ codigo, nome, criado_em, expira_em, usado_por, usado_em, cancelado_em }]
            if (nome === 'usar_convite') {
              const eu = db.sessao && db.sessao.user.id; const p = db.perfis.find((x) => x.id === eu);
              const cod = String(args.p_codigo || '').replace(/\s/g, '').toUpperCase();
              const c = (db.convites || []).find((x) => x.codigo === cod);
              let r = 'ok';
              if (p && p.liberado) r = 'ja_liberado';
              else if (!c) r = 'invalido'; else if (c.cancelado_em) r = 'cancelado'; else if (c.usado_em) r = 'usado';
              else if (new Date(c.expira_em) < new Date()) r = 'expirado';
              if (r === 'ok') { c.usado_por = eu; c.usado_em = new Date().toISOString(); p.liberado = true; p.acesso_pedido_em = null; }
              gravar(db); return { data: r, error: null };
            }
            if (nome === 'pedir_acesso') {
              const p = db.perfis.find((x) => x.id === (db.sessao && db.sessao.user.id));
              if (p && !p.liberado) p.acesso_pedido_em = new Date().toISOString();
              gravar(db); return { data: null, error: null };
            }
            if (nome === 'admin_excluir_convite' && db.semExcluirConvite) { gravar(db); return { data: null, error: { message: 'Could not find the function public.admin_excluir_convite(p_codigo) in the schema cache' } }; }
            if (['admin_criar_convite', 'admin_convites', 'admin_cancelar_convite', 'admin_excluir_convite', 'admin_liberar_usuario', 'admin_bloquear_usuario', 'admin_recusar_pedido', 'admin_liberar_videos'].includes(nome)) {
              const a = db.admin || {}; const eu = db.sessao && db.sessao.user.id;
              if (!(a.ids || []).includes(eu)) { gravar(db); return { data: null, error: { message: 'Acesso restrito a administradores.' } }; }
              a.convites = a.convites || [];
              const usuario = (id) => (a.usuarios || []).find((x) => x.id === id);
              let data = null, erro = null;
              if (nome === 'admin_criar_convite') {
                data = (a.proximoCodigo || []).shift() || Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01IO]/g, 'K');
                a.convites.unshift({ codigo: data, nome: args.p_nome || '', criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 7 * 864e5).toISOString(), usado_em: null, cancelado_em: null, usado_por: null });
              } else if (nome === 'admin_convites') {
                data = a.convites.map((c) => { const u = usuario(c.usado_por); return { ...c, usado_por_nome: u ? u.nome : null, usado_por_email: u ? u.email : null }; });
              } else if (nome === 'admin_excluir_convite') {
                const i = a.convites.findIndex((x) => x.codigo === args.p_codigo);
                if (i >= 0) a.convites.splice(i, 1); else erro = 'Convite não encontrado.';
              } else if (nome === 'admin_cancelar_convite') {
                const c = a.convites.find((x) => x.codigo === args.p_codigo && !x.usado_em && !x.cancelado_em);
                if (c) c.cancelado_em = new Date().toISOString(); else erro = 'Convite não encontrado ou já usado.';
              } else {
                const u = usuario(args.alvo);
                if (!u) erro = 'Usuário não encontrado.';
                else if (nome === 'admin_liberar_usuario') { if (!u.liberado) { u.liberado_como = u.acesso_pedido_em ? 'pedido' : 'admin'; u.liberado_em = new Date().toISOString(); } u.liberado = true; u.acesso_pedido_em = null; }
                else if (nome === 'admin_recusar_pedido') u.acesso_pedido_em = null;
                else if (nome === 'admin_liberar_videos') u.videos_liberados = !!args.liberar;
                else if (args.alvo === eu) erro = 'Você não pode bloquear a sua própria conta.';
                else if ((a.ids || []).includes(args.alvo)) erro = 'Não é possível bloquear outro administrador.';
                else u.liberado = false;
              }
              db.log.push(`${nome}:${JSON.stringify(args || {})}`);
              gravar(db); return { data: erro ? null : data, error: erro ? { message: erro } : null };
            }
            // Vídeos: db.videos = [{ exercicio, video_id }]; só para o perfil com videos_liberados. semFuncaoVideos = schema antigo.
            if (nome === 'meus_videos') {
              if (db.semFuncaoVideos) { gravar(db); return { data: null, error: { message: 'Could not find the function public.meus_videos without parameters' } }; }
              const p = db.perfis.find((x) => x.id === (db.sessao && db.sessao.user.id));
              gravar(db); return { data: p && p.videos_liberados ? (db.videos || []) : [], error: null };
            }
            if (nome === 'meus_dados_extras') {
              if (db.semDadosExtras) { gravar(db); return { data: null, error: { message: 'Could not find the function public.meus_dados_extras without parameters' } }; }
              const id = db.sessao && db.sessao.user.id;
              gravar(db);
              return { data: { eventos: (db.eventos || []).filter((e) => e.usuario_id === id).map(({ tipo, dados }) => ({ tipo, dados })), emails_enviados: (db.emails_enviados || []).filter((e) => e.usuario_id === id) }, error: null };
            }
            if (nome === 'excluir_conta') {
              if (db.semExcluir) { gravar(db); return { data: null, error: { message: 'Could not find the function public.excluir_conta without parameters' } }; }
              const id = db.sessao && db.sessao.user.id;
              ['perfis', 'checkins', 'cargas', 'eventos'].forEach((t) => { db[t] = (db[t] || []).filter((x) => (x.usuario_id || x.id) !== id); });
              db.contasExcluidas = (db.contasExcluidas || []).concat(id);
              gravar(db); return { data: null, error: null };
            }
            if (nome === 'admin_excluir_usuario') {
              const a = db.admin || {}; const eu = db.sessao && db.sessao.user.id;
              let erro = null;
              if (!(a.ids || []).includes(eu)) erro = 'Acesso restrito a administradores.';
              else if (args.alvo === eu) erro = 'Para excluir a sua própria conta, use o app (Você → Excluir conta).';
              else if ((a.ids || []).includes(args.alvo)) erro = 'Não é possível excluir a conta de outro administrador.';
              else if (a.falharExcluir) erro = 'falha simulada';
              if (erro) { gravar(db); return { data: null, error: { message: erro } }; }
              ['usuarios', 'checkins', 'eventos'].forEach((t) => { a[t] = (a[t] || []).filter((x) => (x.usuario_id || x.id) !== args.alvo); });
              db.contasExcluidas = (db.contasExcluidas || []).concat(args.alvo);
              gravar(db); return { data: null, error: null };
            }
            // Catálogo pelo painel: db.exercicios (como a tabela), vídeos em db.videos e uso em admin.usos = { nome: n }.
            if (nome === 'admin_excluir_exercicio') {
              const a = db.admin || {}; const eu = db.sessao && db.sessao.user.id;
              if (!(a.ids || []).includes(eu)) { gravar(db); return { data: null, error: { message: 'Acesso restrito a administradores.' } }; }
              const e = (db.exercicios || []).find((x) => x.nome === args.p_nome);
              const usos = (a.usos || {})[args.p_nome] || 0;
              const obj = (db.jornadas || []).find((j) => Object.values(j.dados.treinos).some((t) => t.exercicios.some((x) => x.nome === args.p_nome)));
              const erro = !e ? 'Exercício não encontrado.' : usos ? `Está nos treinos de ${usos} ${usos === 1 ? 'conta' : 'contas'}. Desative em vez de excluir.`
                : obj ? `Faz parte do objetivo pronto ${obj.dados.nome}. Desative em vez de excluir.` : null;
              if (!erro) { db.exercicios = db.exercicios.filter((x) => x !== e); db.videos = (db.videos || []).filter((v) => v.exercicio !== args.p_nome); db.log.push(`admin_excluir_exercicio:${args.p_nome}`); }
              gravar(db); return { data: null, error: erro ? { message: erro } : null };
            }
            if (nome === 'admin_exercicios' || nome === 'admin_salvar_exercicio') {
              const a = db.admin || {}; const eu = db.sessao && db.sessao.user.id;
              if (!(a.ids || []).includes(eu)) { gravar(db); return { data: null, error: { code: '42501', message: 'acesso restrito' } }; }
              if (!Array.isArray(db.exercicios)) { gravar(db); return { data: null, error: { message: `Could not find the function public.${nome} in the schema cache` } }; }
              db.videos = db.videos || [];
              const chave = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
              if (nome === 'admin_exercicios') {
                const data = db.exercicios.map((e) => ({ ...e, video_id: (db.videos.find((v) => v.exercicio === e.nome) || {}).video_id || null, usos: (a.usos || {})[e.nome] || 0 }))
                  .sort((x, y) => x.nome.localeCompare(y.nome));
                gravar(db); return { data, error: null };
              }
              const p = args.p || {}; const atual = args.p_nome_atual || null;
              let n = String(p.nome || '').trim().replace(/\s+/g, ' ');
              n = n ? n[0].toUpperCase() + n.slice(1) : n;
              const video = String(p.video_id || '').trim();
              let erro = null;
              const outro = db.exercicios.find((e) => chave(e.nome) === chave(n) && e.nome !== atual);
              const antigo = db.exercicios.find((e) => e.nome !== atual && (e.nomes_antigos || []).some((x) => chave(x) === chave(n)));
              if (!n || n.length > 80) erro = 'Informe o nome do exercício (até 80 letras).';
              else if (outro) erro = `Já existe um exercício com esse nome: ${outro.nome}.`;
              else if (antigo) erro = `Esse nome já foi do exercício ${antigo.nome}. Escolha outro.`;
              else if (video && !/^[\w-]{11}$/.test(video)) erro = 'Vídeo inválido: use o link ou o código de 11 letras do YouTube.';
              else if (a.falharSalvarExercicio) erro = 'falha simulada';
              if (erro) { gravar(db); return { data: null, error: { message: erro } }; }
              const campos = { nome: n, grupo: p.grupo, dose: p.dose || '3×10', pse: Number(p.pse) || 8, hipertrofia: p.hipertrofia || 'baixa', mobilidade: p.mobilidade || 'baixa',
                forca: p.forca || 'baixa', explosao: p.explosao || 'baixa', explicacao: String(p.explicacao || '').trim(), variacoes: p.variacoes || [], ativo: p.ativo !== false, atualizado_em: new Date().toISOString() };
              if ('objetivos' in p) campos.objetivos = p.objetivos || [];
              if (!atual) db.exercicios.push({ objetivos: [], ...campos, nomes_antigos: [] });
              else {
                const e = db.exercicios.find((x) => x.nome === atual);
                if (!e) { gravar(db); return { data: null, error: { message: 'Exercício não encontrado.' } }; }
                let antigos = (e.nomes_antigos || []).filter((x) => x !== n);
                if (n !== atual && !antigos.includes(atual)) antigos = [...antigos, atual];
                Object.assign(e, campos, { nomes_antigos: antigos });
                if (n !== atual) db.videos.forEach((v) => { if (v.exercicio === atual) v.exercicio = n; });
              }
              if ('video_id' in p) {
                db.videos = db.videos.filter((v) => v.exercicio !== n);
                if (video) db.videos.push({ exercicio: n, video_id: video });
              }
              db.log.push(`admin_salvar_exercicio:${atual || ''}>${n}`);
              gravar(db); return { data: n, error: null };
            }
            if (nome === 'eh_admin' || nome.startsWith('admin_')) {
              gravar(db);
              const a = db.admin || {};
              if (a.falhar) return { data: null, error: { message: 'falha simulada' } };
              const eh = !!(db.sessao && (a.ids || []).includes(db.sessao.user.id));
              if (nome === 'eh_admin') return { data: eh, error: null };
              if (!eh) return { data: null, error: { message: 'acesso restrito' } };
              if (nome === 'admin_emails' && a.semEmails) return { data: null, error: { message: 'Could not find the function public.admin_emails without parameters' } };
              // admin_eventos(desde): como no banco, só os eventos a partir do instante pedido.
              if (nome === 'admin_eventos' && args && args.desde) {
                const d2 = ler(); d2.log.push(`admin_eventos:desde:${args.desde}`); gravar(d2);
                return { data: (a.eventos || []).filter((e) => e.criado_em >= args.desde), error: null };
              }
              return { data: a[nome.slice(6)] || [], error: null };
            }
            if (db.semFuncaoAcesso) { gravar(db); return { data: null, error: { message: `Could not find the function public.${nome} without parameters` } }; }
            const p = db.perfis.find((x) => x.id === (db.sessao && db.sessao.user.id));
            if (p) { p.acessos = (p.acessos || 0) + 1; p.ultimo_acesso = new Date().toISOString(); }
            gravar(db);
            return { data: null, error: null };
          });
        },
      };
    },
  };
})();
