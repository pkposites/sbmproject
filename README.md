# SBM ON Seguros — landing page com quiz

Site estático (sem build), pronto para a Netlify. Visual replicado de `sbm-on-seguros.lovable.app`,
trocando o formulário longo por um **quiz de 5 passos**.

| URL | Arquivo |
|---|---|
| `/` | `index.html` — landing + quiz |
| `/privacidade/` | `privacidade/index.html` — Política de Privacidade (LGPD) |
| 404 | `404.html` |

Estilos em `assets/styles.css`, lógica do quiz em `assets/quiz.js`, imagens em `assets/img/`.

## Quiz
1. Veículo (carro, moto, autopropelido, caminhão)
2. Uso (APP, particular, comercial, táxi)
3. Bônus: tem plano de saúde? (+3%)
4. Bônus: tem seguro de vida? (+3%) → 4% vira 10%
5. Nome, WhatsApp, e-mail (opcional) + caixa "Li e concordo"
6. Pronto → abre o WhatsApp (11) 95027-9767 com a mensagem montada

## Cadê o Lead
Script no `<head>` de todas as páginas (`data-key="pk_9440…"`, `data-consent="banner"`).

- Cada resposta do quiz vai para `LeadHub.set(...)` (vira coluna na planilha).
- **O lead é criado quando a pessoa marca "Li e concordo"** com nome e WhatsApp válidos
  (`LeadHub.identify` + `LeadHub.submit`). Se marcar antes de terminar de digitar,
  o lead é criado assim que os dados ficarem válidos.
- O botão final abre o WhatsApp; o tracker anota o clique e coloca o código na mensagem.
- Também dispara `dataLayer.push({event:'generate_lead'})`, `fbq('track','Lead')` (se houver pixel)
  e uma cópia de segurança no **Netlify Forms** (formulário `cotacao`).

## Deploy na Netlify
New site → Import from Git → `pkposites/sbmproject`, branch `main`.
Build command: vazio. Publish directory: `.` (já está no `netlify.toml`).
Depois ative **Forms** no painel da Netlify para ver a cópia dos leads.
