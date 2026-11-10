# SBM ON Seguros — landing page com quiz

Site estático (sem build), pronto para a Netlify. Visual replicado de `sbm-on-seguros.lovable.app`,
trocando o formulário longo por um **quiz de 5 passos**.

| URL | Arquivo |
|---|---|
| `/` | `public/index.html` — landing + quiz |
| `/privacidade/` | `public/privacidade/index.html` — Política de Privacidade (LGPD) |
| 404 | `public/404.html` |
| `POST /api/meta` | `netlify/functions/meta-capi.mts` — API de Conversões do Meta |

Estilos em `public/assets/styles.css`, lógica do quiz em `public/assets/quiz.js`, imagens em `public/assets/img/`.

## Quiz
1. Veículo (carro, moto, autopropelido, caminhão)
2. Uso (APP, particular, comercial, táxi)
3. Bônus: tem plano de saúde? (+3%)
4. Bônus: tem seguro de vida? (+3%) → 4% vira 10%
5. Nome, WhatsApp, e-mail (opcional) + caixa "Li e concordo"
6. Pronto → abre o WhatsApp (11) 95027-9767 com a mensagem montada

## Cadê o Lead
Script no `<head>` de todas as páginas (`data-key="pk_4b3e…"`, `data-consent="banner"`).

**Regra: um lead = um envio com nome + WhatsApp.** Nenhum botão abre o WhatsApp sem dados.

- **Quiz:** cada resposta vai para `LeadHub.set(...)`. O lead é criado quando a pessoa marca
  "Li e concordo" com nome e WhatsApp válidos (`LeadHub.submit`, origem "Quiz de cotação").
- **Botões de WhatsApp** (topo, dúvidas, rodapé, flutuante, página de privacidade): abrem a janela
  "Fale com um corretor da SBM ON" — nome, WhatsApp e a confirmação
  "tenho interesse em falar sobre seguros com a SBM ON". Só depois disso o lead é criado
  (origem "Botão WhatsApp (flutuante/header/faq/footer)") e o WhatsApp abre.
- O WhatsApp é aberto sem passar pelos links/`window.open` que o tracker observa, para não criar
  uma segunda linha (nem linha vazia). Por isso não há link `wa.me` direto nas páginas.
- Também dispara `dataLayer.push({event:'generate_lead'})` e a cópia de segurança no **Netlify Forms**
  (formulários `cotacao` e `contato-whatsapp`).

## Meta (Pixel + API de Conversões)
- Pixel `1154264370403111` no `<head>`. Começa com `fbq('consent','revoke')` (LGPD) e é liberado
  quando a pessoa clica em "Aceitar" no aviso do Cadê o Lead.
- Eventos: `Lead` (ao marcar "Li e concordo") e `Contact` (ao abrir o WhatsApp).
  Cada um vai pelo navegador **e** pelo servidor (`/api/meta`) com o mesmo `event_id` → a Meta deduplica.
- A função criptografa (SHA-256) telefone, e-mail e nome antes de enviar, e adiciona IP, user agent, `fbp`/`fbc`.

### Variáveis de ambiente (Netlify → Site configuration → Environment variables)
| Variável | Valor |
|---|---|
| `META_PIXEL_ID` | `1154264370403111` |
| `META_CAPI_TOKEN` | token da API de Conversões (**secreto — nunca no código**) |
| `META_GRAPH_VERSION` | opcional, padrão `v23.0` |
| `META_TEST_EVENT_CODE` | opcional: código "Testar eventos" do Gerenciador de Eventos (remova depois do teste) |

Mudou uma variável? Faça um novo deploy para valer.

## Deploy na Netlify
Publish directory: `public` · Functions: `netlify/functions` · sem build (já no `netlify.toml`).
Ative **Forms** no painel da Netlify para ver a cópia dos leads.
