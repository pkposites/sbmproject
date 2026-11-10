/* SBM ON Seguros — quiz de cotação + integração Cadê o Lead (window.LeadHub)
 *
 * Fluxo:
 *  1. Veículo  2. Uso  3. Plano de saúde (bônus)  4. Seguro de vida (bônus)
 *  5. Contato (nome, WhatsApp, e-mail opcional) + caixa "Li e concordo"
 *  6. Pronto -> WhatsApp com a mensagem montada
 *
 * Cadê o Lead:
 *  - Cada resposta do quiz é enviada com LeadHub.set(...) e vira coluna na planilha.
 *  - O lead é CRIADO no momento em que a pessoa marca "Li e concordo"
 *    (com nome e WhatsApp válidos), via LeadHub.submit(...).
 *    Se ela marcar antes de terminar de digitar, o lead é criado assim que
 *    nome + WhatsApp ficarem válidos (a caixa continuando marcada).
 *  - O botão final só abre o WhatsApp (o tracker anota o clique e o código).
 */
(function () {
  "use strict";

  var WHATSAPP = "5511950279767";
  var BASE = 4;
  var BONUS = 3; // cada pergunta bônus respondida: +3% (4 -> 7 -> 10)
  var STEPS = ["veiculo", "uso", "plano_saude", "seguro_vida", "contato", "done"];
  var QUESTIONS = 5;

  var form = document.getElementById("quizForm");
  if (!form) return;

  var state = { veiculo: "", uso: "", plano_saude: "", seguro_vida: "" };
  var current = 0;
  var captured = ""; // telefone (só dígitos) já enviado ao Cadê o Lead
  var lastDiscount = BASE;

  var $ = function (id) { return document.getElementById(id); };
  var steps = Array.prototype.slice.call(form.querySelectorAll(".step"));
  var nome = $("nome"), tel = $("telefone"), email = $("email"), consent = $("consent");

  // ---------- Cadê o Lead (o script carrega async; guardamos o que vier antes) ----------
  var pending = [];
  function lead(fn) {
    if (window.LeadHub && window.LeadHub.__loaded) {
      try { fn(window.LeadHub); } catch (e) {}
    } else {
      pending.push(fn);
    }
  }
  (function flush(tries) {
    if (window.LeadHub && window.LeadHub.__loaded) {
      while (pending.length) { try { pending.shift()(window.LeadHub); } catch (e) {} }
    } else if (tries < 100) {
      setTimeout(function () { flush(tries + 1); }, 150);
    }
  })(0);

  function answers() {
    return {
      veiculo: state.veiculo,
      uso: state.uso,
      plano_saude: state.plano_saude || "não respondeu",
      seguro_vida: state.seguro_vida || "não respondeu",
      desconto: discount() + "%",
    };
  }

  // ---------- desconto ----------
  function discount() {
    var d = BASE;
    if (state.plano_saude) d += BONUS;
    if (state.seguro_vida) d += BONUS;
    return d;
  }
  function renderDiscount() {
    var d = discount();
    $("badgeValue").textContent = d;
    $("f_desconto").value = d + "%";
    Array.prototype.forEach.call(document.querySelectorAll(".js-cur"), function (el) { el.textContent = d; });
    var missing = (state.plano_saude ? 0 : 1) + (state.seguro_vida ? 0 : 1);
    var pct = ((d - BASE) / (10 - BASE)) * 100;
    Array.prototype.forEach.call(document.querySelectorAll(".js-meter"), function (el) { el.style.width = Math.max(pct, 8) + "%"; });
    Array.prototype.forEach.call(document.querySelectorAll(".js-meter-text"), function (el) {
      el.textContent = missing
        ? "Você já garantiu " + d + "%. Falta" + (missing > 1 ? "m " : " ") + missing + " resposta" + (missing > 1 ? "s" : "") + " para 10%."
        : "Pronto! Você garantiu os 10% de desconto.";
    });
    if (d !== lastDiscount) {
      var b = $("badge");
      b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
      lastDiscount = d;
    }
  }

  // ---------- navegação ----------
  function go(index, back) {
    current = Math.max(0, Math.min(index, STEPS.length - 1));
    steps.forEach(function (s, i) {
      s.classList.toggle("is-active", i === current);
      s.classList.toggle("is-back", i === current && !!back);
    });
    var done = STEPS[current] === "done";
    $("progress").style.display = done ? "none" : "";
    $("back").hidden = current === 0 || done;
    $("stepLabel").textContent = "Pergunta " + (current + 1) + " de " + QUESTIONS;
    $("progressBar").style.width = ((current + 1) / QUESTIONS) * 100 + "%";
    if (STEPS[current] === "contato") renderSummary();
    if (done) { var el = steps[current]; el.focus({ preventScroll: true }); }
  }

  $("back").addEventListener("click", function () { go(current - 1, true); });

  steps.forEach(function (step) {
    var key = step.getAttribute("data-step");
    Array.prototype.forEach.call(step.querySelectorAll(".option"), function (btn) {
      btn.addEventListener("click", function () {
        choose(key, btn.getAttribute("data-value"));
        setTimeout(function () { go(STEPS.indexOf(key) + 1); }, 220);
      });
    });
    var skip = step.querySelector(".js-skip");
    if (skip) skip.addEventListener("click", function () {
      choose(key, "");
      go(STEPS.indexOf(key) + 1);
    });
  });

  function choose(key, value) {
    state[key] = value;
    var hidden = $("f_" + key);
    if (hidden) hidden.value = value;
    var step = form.querySelector('[data-step="' + key + '"]');
    Array.prototype.forEach.call(step.querySelectorAll(".option"), function (b) {
      b.setAttribute("aria-pressed", String(!!value && b.getAttribute("data-value") === value));
    });
    renderDiscount();
    lead(function (LH) { LH.set(answers()); });
  }

  function renderSummary() {
    var box = $("summary");
    box.innerHTML = "";
    [[state.veiculo, ""], [state.uso, ""], [discount() + "% de desconto", "chip-wine"]].forEach(function (c) {
      if (!c[0]) return;
      var s = document.createElement("span");
      s.className = "chip " + c[1];
      s.textContent = c[0];
      box.appendChild(s);
    });
  }

  // Links "Cotar carro" etc.: já escolhem o veículo e pulam para a pergunta 2.
  Array.prototype.forEach.call(document.querySelectorAll(".js-prefill"), function (a) {
    a.addEventListener("click", function () {
      choose("veiculo", a.getAttribute("data-veiculo"));
      go(1);
    });
  });

  // ---------- máscara e validação ----------
  function digits(v) { return String(v || "").replace(/\D/g, ""); }
  function maskPhone(v) {
    var d = digits(v);
    if (d.indexOf("55") === 0 && d.length > 11) d = d.slice(2);
    d = d.slice(0, 11);
    if (d.length <= 2) return d.length ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }
  tel.addEventListener("input", function () { tel.value = maskPhone(tel.value); });

  function validName() { return nome.value.trim().length >= 2; }
  function validPhone() { var d = digits(tel.value); return d.length === 10 || d.length === 11; }
  function validEmail() { var v = email.value.trim(); return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function setErr(input, errId, msg) {
    $(errId).textContent = msg || "";
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  }
  function validate(show) {
    var ok = true;
    if (!validName()) { ok = false; if (show) setErr(nome, "nomeErr", "Digite seu nome."); } else setErr(nome, "nomeErr", "");
    if (!validPhone()) { ok = false; if (show) setErr(tel, "telefoneErr", "Digite um WhatsApp com DDD."); } else setErr(tel, "telefoneErr", "");
    if (!validEmail()) { ok = false; if (show) setErr(email, "emailErr", "E-mail inválido."); } else setErr(email, "emailErr", "");
    return ok;
  }

  // ---------- captura do lead: ao marcar "Li e concordo" ----------
  function capture() {
    if (!consent.checked || !validate(false)) return false;
    var phone = digits(tel.value);
    if (captured === phone) return true;
    captured = phone;

    var info = { name: nome.value.trim(), phone: tel.value.trim(), email: email.value.trim() || undefined };
    leadSubmit(info, Object.assign({ origem: "Quiz de cotação", interesse: "Cotação de seguro" }, answers()));

    // GTM / pixel (se existirem na página)
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "generate_lead", lead_veiculo: state.veiculo, lead_uso: state.uso, lead_desconto: discount() });
    metaEvent("Lead", info, { content_name: "Cotação " + state.veiculo, content_category: state.uso, value: discount(), currency: "BRL" });
    try { window.dispatchEvent(new CustomEvent("sbm:lead", { detail: Object.assign({}, info, answers()) })); } catch (e) {}

    // Cópia de segurança no Netlify Forms
    saveToNetlify();
    return true;
  }

  consent.addEventListener("change", function () {
    if (consent.checked) {
      $("formErr").textContent = "";
      if (!capture()) validate(true);
    }
  });
  [nome, tel, email].forEach(function (input) {
    input.addEventListener("input", function () {
      if (input.getAttribute("aria-invalid") === "true") validate(true);
      capture();
    });
  });

  function fillHidden() {
    var params = new URLSearchParams(window.location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"].forEach(function (k) {
      var el = form.querySelector('input[name="' + k + '"]');
      var v = params.get(k);
      if (el && v) el.value = v.slice(0, 300);
    });
    form.querySelector('input[name="pagina"]').value = window.location.href.split("#")[0];
  }

  function saveToNetlify() {
    fillHidden();
    try {
      var body = new URLSearchParams(new FormData(form)).toString();
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body, keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  // ---------- Meta: Pixel (navegador) + API de Conversões (servidor, /api/meta) ----------
  // O mesmo event_id vai nos dois, então a Meta conta uma vez só.
  function cookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : undefined;
  }
  function fbc() {
    var c = cookie("_fbc");
    if (c) return c;
    var id = new URLSearchParams(window.location.search).get("fbclid");
    return id ? "fb.1." + FBC_TS + "." + id : undefined;
  }
  var FBC_TS = Date.now(); // momento em que o clique do anúncio chegou à página
  var lastMeta = {};
  function metaEvent(name, contact, custom) {
    var now = Date.now();
    if (lastMeta[name] && now - lastMeta[name] < 4000) return;
    lastMeta[name] = now;
    var eventId = name.toLowerCase() + "-" + now + "-" + Math.random().toString(36).slice(2, 10);
    try { if (typeof window.fbq === "function") window.fbq("track", name, custom || {}, { eventID: eventId }); } catch (e) {}
    contact = contact || {};
    var payload = {
      event_name: name,
      event_id: eventId,
      event_source_url: window.location.href,
      user_data: {
        name: contact.name, phone: contact.phone, email: contact.email,
        fbp: cookie("_fbp"), fbc: fbc(),
        external_id: window.LeadHub && window.LeadHub.visitorId,
      },
      custom_data: custom || {},
    };
    try {
      fetch("/api/meta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  function contactInfo() {
    return captured ? { name: nome.value.trim(), phone: tel.value.trim(), email: email.value.trim() || undefined } : {};
  }

  // ---------- Cadê o Lead: um lead = um envio COM dados ----------
  // O lead é criado só com nome + WhatsApp (LeadHub.submit). O WhatsApp é aberto
  // sem passar pelo window.open/links observados pelo tracker, para não gerar uma
  // segunda linha (nem uma linha vazia).
  var submittedPhones = {};
  function leadSubmit(info, extra) {
    var key = digits(info.phone);
    if (submittedPhones[key]) return;
    submittedPhones[key] = true;
    lead(function (LH) {
      if (extra) LH.set(extra);
      LH.submit(info);
    });
  }

  function openWhatsApp(url) {
    var w = null;
    try { w = window.open("", "_blank"); } catch (e) {}
    if (w) {
      try { w.opener = null; } catch (e) {}
      w.location.href = url;
    } else {
      window.location.href = url;
    }
  }

  // ---------- Janela "Fale com a SBM ON" (todos os botões de WhatsApp) ----------
  var dlg = $("waDialog");
  var waForm = $("waForm"), waNome = $("waNome"), waTel = $("waTel"), waConsent = $("waConsent");
  var waOrigin = "site";

  function openContact(origin) {
    waOrigin = origin || "site";
    $("waErr").textContent = "";
    if (!waNome.value && nome.value) waNome.value = nome.value;
    if (!waTel.value && tel.value) waTel.value = tel.value;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    document.body.classList.add("modal-open");
    setTimeout(function () { (waNome.value ? waTel : waNome).focus(); }, 50);
  }
  function closeContact() {
    if (dlg.close) dlg.close(); else dlg.removeAttribute("open");
  }
  dlg.addEventListener("close", function () {
    document.body.classList.remove("modal-open");
    if (window.location.hash === "#fale-conosco") history.replaceState(null, "", window.location.pathname + window.location.search);
  });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) closeContact(); });
  $("waClose").addEventListener("click", closeContact);
  waTel.addEventListener("input", function () { waTel.value = maskPhone(waTel.value); });

  Array.prototype.forEach.call(document.querySelectorAll(".js-wa"), function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      openContact(a.getAttribute("data-wa-origin"));
    });
  });
  if (window.location.hash === "#fale-conosco") openContact("link");

  function waValidate() {
    var ok = true;
    var nOk = waNome.value.trim().length >= 2, d = digits(waTel.value), tOk = d.length === 10 || d.length === 11;
    $("waNomeErr").textContent = nOk ? "" : "Digite seu nome.";
    waNome.setAttribute("aria-invalid", String(!nOk));
    $("waTelErr").textContent = tOk ? "" : "Digite um WhatsApp com DDD.";
    waTel.setAttribute("aria-invalid", String(!tOk));
    if (!nOk || !tOk) ok = false;
    if (ok && !waConsent.checked) {
      $("waErr").textContent = "Marque a confirmação de interesse para continuar.";
      ok = false;
    } else if (ok) $("waErr").textContent = "";
    return ok;
  }

  function sendContact() {
    if (!waValidate()) return;
    var info = { name: waNome.value.trim(), phone: waTel.value.trim() };
    var extra = { origem: "Botão WhatsApp (" + waOrigin + ")", interesse: "Falar sobre seguros com a SBM ON" };
    if (state.veiculo) extra.veiculo = state.veiculo;
    if (state.uso) extra.uso = state.uso;
    leadSubmit(info, extra);

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "generate_lead", lead_origem: waOrigin });
    metaEvent("Lead", info, { content_name: "Contato WhatsApp", content_category: waOrigin });
    metaEvent("Contact", info, { content_name: waOrigin });

    // cópia no Netlify Forms
    $("waOrigem").value = waOrigin;
    $("waPagina").value = window.location.href.split("#")[0];
    try {
      fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(new FormData(waForm)).toString(), keepalive: true }).catch(function () {});
    } catch (e) {}

    var msg = "Olá! Meu nome é " + info.name + ". Tenho interesse em falar sobre seguros com a SBM ON.";
    if (state.veiculo) msg += "\nVeículo: " + state.veiculo + (state.uso ? " (" + state.uso + ")" : "");
    openWhatsApp("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(msg));
    closeContact();
  }

  // Botão comum (não "submit"): o tracker cria lead em qualquer envio de formulário,
  // então só registramos depois de validar nome, WhatsApp e a confirmação.
  var waBtn = waForm.querySelector('button[type="submit"]');
  waBtn.type = "button";
  waBtn.addEventListener("click", sendContact);
  waForm.addEventListener("submit", function (e) { e.preventDefault(); });
  [waNome, waTel].forEach(function (input) {
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); sendContact(); } });
  });

  // ---------- WhatsApp ----------
  function whatsappUrl() {
    var a = answers();
    var lines = [
      "Olá! Quero fazer a cotação do meu seguro pelo site da SBM ON.",
      "",
      "Nome: " + nome.value.trim(),
      "Veículo: " + a.veiculo,
      "Uso: " + a.uso,
      "Tem plano de saúde: " + a.plano_saude,
      "Tem seguro de vida: " + a.seguro_vida,
      "Desconto garantido: " + a.desconto,
    ];
    if (email.value.trim()) lines.splice(3, 0, "E-mail: " + email.value.trim());
    return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(lines.join("\n"));
  }

  function finish() {
    $("formErr").textContent = "";
    if (!validate(true)) return;
    if (!consent.checked) {
      $("formErr").textContent = "Para continuar, marque que concorda com a Política de Privacidade.";
      consent.focus();
      return;
    }
    capture();
    var url = whatsappUrl();
    lastWaUrl = url;
    $("doneTitle").firstChild.textContent = "Pronto, " + nome.value.trim().split(" ")[0] + "! Seus ";
    go(STEPS.indexOf("done"));
    metaEvent("Contact", contactInfo(), { content_name: "quiz" });
    openWhatsApp(url); // se bloqueado, a pessoa usa o botão "Abrir WhatsApp"
  }
  var lastWaUrl = "";
  $("doneWa").addEventListener("click", function (e) {
    e.preventDefault();
    if (lastWaUrl) openWhatsApp(lastWaUrl);
  });

  var submitBtn = $("submitBtn");
  submitBtn.type = "button"; // o envio do formulário é tratado aqui (evita lead duplicado)
  submitBtn.addEventListener("click", finish);
  form.addEventListener("submit", function (e) { e.preventDefault(); finish(); });

  // ---------- extras da página ----------
  var y = $("year"); if (y) y.textContent = new Date().getFullYear();

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    Array.prototype.forEach.call(document.querySelectorAll(".reveal"), function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll(".reveal"), function (el) { el.classList.add("in"); });
  }

  renderDiscount();
  go(0);
})();
