# Animes Online Dublado para Nuvio — v0.1.1

Prova de conceito para **One Piece (1999), temporada 1, episódio 1**, com o caminho `/5831/` fornecido no pedido. **A reprodução real não foi validada.** As páginas da série e do episódio devolveram HTTP 403 (Cloudflare) no ambiente de teste. Não foi possível confirmar a rota de busca nem o HTML do player.

## Como experimentar

1. Publique `manifest.json` e `providers/animesonline.js` no mesmo repositório GitHub, mantendo a estrutura de pastas. Não é necessário servidor próprio nem build.
2. Copie a URL **Raw HTTPS** do `manifest.json`. No Nuvio com suporte a plugins, abra **Configurações → Plugins → Adicionar repositório** e cole a URL. Ative **Animes Online Dublado**.
3. Selecione **One Piece (1999)** no catálogo do Nuvio, não a adaptação live-action, e abra a reprodução de T1E1. O plugin adiciona uma fonte de reprodução, não um catálogo. Se o site bloquear o app ou não expuser mídia em HTML, ele não exibirá uma fonte.

## Desenvolvimento

O ponto de entrada é `getStreams(contentId, mediaType, season, episode)`. A implementação reconhece `37854` / `tmdb:37854` e `tt0388629` / `imdb:tt0388629`. A tabela em `providers/animesonline.js` é intencionalmente pequena: para outras temporadas, confirme a correspondência entre temporada/episódio no catálogo e numeração absoluta do site; não some temporadas por suposição.

1. Experimenta `/?s=One%20Piece%20Dublado` (**hipótese não confirmada**), aceitando apenas o título e caminho da série cadastrada; na falta de correspondência, usa a rota conhecida.
2. Na página da série, procura uma âncora numérica com o título e número exatos. Na falta de correspondência, usa o caminho cadastrado na tabela.
3. Na página do episódio, lê somente fontes HTTPS explícitas em `<video>` e `<source>` com extensão ou MIME de MP4/HLS. Não interpreta JavaScript dinâmico, não segue iframes, não muda IP nem tenta passar por desafios da Cloudflare.
4. Decodifica entidades HTML, deduplica URLs e ignora as que têm `expire` vencido ou a menos de 15 segundos. Uma nova invocação consulta a origem novamente; não armazena o link de mídia. Isso não garante que o app volte a invocar o provider ao repetir a reprodução.

As URLs de exemplo têm `expire=1795199697` (**20/11/2026 às 15:34:57 em São Paulo**) e parâmetros de assinatura e IP. Parecem endpoints de entrega MP4 do Google/Blogger (`source=blogger`, `mime=video/mp4`), não uma API documentada para obter o vídeo. Não são incluídas no plugin. Trocar o `User-Agent` não renova assinatura nem altera o IP de saída.

### Testes

`node test.cjs` (Node.js 18+). Teste simulado para o fluxo de busca, escolha de episódio, HTML, expiração, temporada e resposta 403. Não é um teste no app ou contra o CDN. Para validar a integração, é necessário obter uma resposta normal da origem e verificar se a mídia está no HTML ou se a origem disponibiliza uma integração de player autorizada.

### Referências

- [NuvioStreaming — código do app](https://github.com/tapframe/NuvioStreaming), incluindo `features/plugins` e o runtime Android.
- [Liet Nuvio — manifesto brasileiro](https://raw.githubusercontent.com/lawlietbr/liet-nuvio/main/manifest.json).
- [Streams Brasil — instalação e manifesto](https://github.com/JOAO2666/addon-nuvio).
- [Nuvio Anime Providers — contrato do provider e pipeline de anime](https://github.com/arakurumi/nuvio-anime-providers).

### Atualização 0.1.1

O Chromium headless também recebeu 403 na busca, na série e no episódio. O rastreio do usuário mostra endpoints `redirector.googlevideo.com/videoplayback` e `rr…googlevideo.com/videoplayback` com MIME `video/mp4`. O parser agora reconhece esse formato sem extensão quando o player o declara diretamente no HTML, preservando a URL assinada. O teste é sintético: ainda não se sabe se a página real declara essa URL no HTML ou monta o player de outra forma.

### Atualização 0.1.2

O HTML de `/5831/` fornecido pelo usuário declara `/?s=` no formulário GET e no `SearchAction`. Também declara o mesmo endereço `anidrive.click/token/…` em `VideoObject.embedUrl` e no `src`/`data-src` de `#pembed iframe`. O provider agora deduplica esses endereços, consulta somente o host AniDrive nessa etapa e procura vídeo explícito na resposta. Não executa scripts, não altera o token e não repassa o iframe ao player nativo. O ZIP de recursos salvo no navegador contém scripts do JW Player, mas não o documento HTML do iframe. O AniDrive retornou 403 no ambiente de teste. A extração final de mídia e a reprodução continuam sem validação real.

### Atualização 0.1.3

Se o HTML do AniDrive publicar a URL literal de `player_data=1` para o mesmo embed, o provider consulta o endpoint e lê `sources[].file`, `label` e `type`. Não gera tokens, não reutiliza cookies e não executa scripts. Se a URL for construída apenas em JavaScript ou houver HTTP 403, essa etapa não funcionará. A amostra JSON recebida é do episódio 002, não do 001; o teste usa dados sintéticos e verifica a rejeição do episódio errado. Sem validação no Nuvio.
