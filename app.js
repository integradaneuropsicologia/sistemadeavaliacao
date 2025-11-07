"use strict";

/* ===== CONFIG ===== */
const SHEETDB_BASE = "https://sheetdb.io/api/v1/8pmdh33s9fvy8";
const SHEETS = {
  AUTH: "Auth",
  TESTS: "Tests",
  PATIENTS: "Patients",
  TOKENS: "LinkTokens"
};
const PATIENT_PORTAL_URL = "https://integradaneuropsicologia.github.io/formularios";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxQZeGPULqpJcLXxxyOP2NC6rd73E46Q8Xoexbu1JD8SOhNc9JxXvidUuaYwWxsn07Bfg/exec";

/* ===== HELPERS DOM ===== */
const $ = (s) => document.querySelector(s);
const el = (t, o = {}) => Object.assign(document.createElement(t), o);

function show(n) {
  n && n.classList.remove("hidden");
}

function hide(n) {
  n && n.classList.add("hidden");
}

function setMsg(box, text, type = "") {
  if (!box) return;
  box.textContent = text || "";
  box.className = "msg" + (type ? " " + type : "");
  if (text) show(box);
  else hide(box);
}

/* ===== TEMA (DARK/LIGHT) ===== */
(function initThemeToggle() {
  const body = document.body;
  const toggle = $("#themeToggle");

  function applyTheme(theme) {
    body.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("integrada-theme", theme);
    } catch (e) {}
    if (toggle) {
      toggle.textContent =
        theme === "light" ? "☀️ Modo claro" : "🌙 Modo escuro";
    }
  }

  let saved = null;
  try {
    saved = localStorage.getItem("integrada-theme");
  } catch (e) {}

  if (saved === "light" || saved === "dark") {
    applyTheme(saved);
  } else {
    applyTheme("dark");
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = body.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(current);
    });
  }
})();

/* ===== HELPERS VALIDAÇÃO ===== */
function onlyDigits(s) {
  return (s || "").replace(/\D+/g, "");
}

function validaCPF(cpf) {
  cpf = onlyDigits(cpf);
  if (!cpf || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(cpf.substring(10, 11));
}

function toISODateFromInput(s) {
  return s || "";
}

function nowDateTimeLocal() {
  const d = new Date();
  const p = (n) => (n < 10 ? "0" : "") + n;
  return (
    d.getFullYear() +
    "-" +
    p(d.getMonth() + 1) +
    "-" +
    p(d.getDate()) +
    " " +
    p(d.getHours()) +
    ":" +
    p(d.getMinutes()) +
    ":" +
    p(d.getSeconds())
  );
}

function isValidEmail(s) {
  return !!(s && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()));
}

function normalizeWhats(input) {
  if (!input) return "";
  let d = onlyDigits(input);
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12 && d.length <= 13) return "+" + d;
  if (d.length === 10 || d.length === 11) return "+55" + d;
  if (d.length >= 12 && d.length <= 13) return "+" + d;
  return "";
}

function formatWhatsInput(inputEl) {
  if (!inputEl) return;
  let d = onlyDigits(inputEl.value).slice(0, 13);
  if (d.startsWith("55")) d = d.slice(2);
  if (d.length <= 2) {
    inputEl.value = d;
    return;
  }
  const ddd = d.slice(0, 2);
  let rest = d.slice(2);
  if (rest.length >= 9) {
    inputEl.value = `(${ddd}) ${rest[0]} ${rest.slice(1, 5)}-${rest.slice(5, 9)}`;
  } else if (rest.length >= 5) {
    inputEl.value = `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4, 8)}`;
  } else {
    inputEl.value = `(${ddd}) ${rest}`;
  }
}

/* ===== SheetDB ===== */
async function sheetSearch(sheet, params) {
  const usp = new URLSearchParams(params);
  const url = `${SHEETDB_BASE}/search?sheet=${encodeURIComponent(
    sheet
  )}&${usp.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Falha ao buscar em " + sheet);
  return r.json();
}

async function sheetCreate(sheet, row) {
  const url = `${SHEETDB_BASE}?sheet=${encodeURIComponent(sheet)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [row] })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error("Falha ao criar: " + t);
  }
  return r.json();
}

async function sheetPatchBy(sheet, column, value, data) {
  const url = `${SHEETDB_BASE}/${encodeURIComponent(
    column
  )}/${encodeURIComponent(value)}?sheet=${encodeURIComponent(sheet)}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data })
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error("Falha ao atualizar: " + t);
  }
  return r.json();
}

/* ===== TOKENS / LINK PACIENTE ===== */
function randomToken(len = 22) {
  const a =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += a[Math.floor(Math.random() * a.length)];
  }
  return s;
}

function toISODate(d = new Date()) {
  return d.toISOString();
}

function plusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function getActiveTokenForCPF(cpf) {
  try {
    const rows = await sheetSearch(SHEETS.TOKENS, { cpf });
    const now = new Date();
    const valid = (rows || []).filter((r) => {
      const notDisabled =
        String(r.disabled || "não").toLowerCase() !== "sim";
      const okDate = !r.expires_at || new Date(r.expires_at) > now;
      return notDisabled && okDate;
    });
    return valid[0] || null;
  } catch (e) {
    return null;
  }
}

async function getOrCreatePatientLink(cpf) {
  let tk = await getActiveTokenForCPF(cpf);
  if (!tk) {
    const token = randomToken();
    const row = {
      token,
      cpf,
      created_at: toISODate(),
      expires_at: plusDays(30),
      disabled: "não",
      uses: "0",
      last_access_at: ""
    };
    await sheetCreate(SHEETS.TOKENS, row);
    tk = row;
  }
  return `${PATIENT_PORTAL_URL}?token=${encodeURIComponent(tk.token)}`;
}

/* ===== LOGIN ===== */
async function tryAuthVariants(user, pass) {
  const combos = [
    { u: "login", p: "senha" },
    { u: "usuario", p: "senha" },
    { u: "email", p: "senha" },
    { u: "Login", p: "Senha" }
  ];
  for (const c of combos) {
    try {
      const rows = await sheetSearch(SHEETS.AUTH, {
        [c.u]: user,
        [c.p]: pass
      });
      if (rows && rows.length) return true;
    } catch (e) {
      // ignora e tenta próximo
    }
  }
  return false;
}

/* ===== ESTADO GLOBAL ===== */
let testsCatalog = [];
let currentPatient = null;
let mode = "create";
let statusFilter = "todos";

/* ===== SOURCE NORMALIZATION ===== */
function normalizeSourceLabel(raw) {
  const s = (raw || "").trim();
  return s || "Outros";
}

function normalizeSourceKey(raw) {
  let s = (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!s) return "outros";
  if (s.startsWith("paciente")) return "paciente";
  if (s.includes("famil")) return "familiares";
  if (s.includes("pais") || s.includes("cuidad")) return "pais";
  if (s.includes("profis")) return "profissional";
  if (s.includes("prof")) return "professores";
  return "outros";
}

/* ===== TESTES ===== */
async function loadTests() {
  const info = $("#testsInfo");
  if (info) info.textContent = "carregando catálogo…";

  const rows = await sheetSearch(SHEETS.TESTS, { active: "sim" });

  testsCatalog = (rows || [])
    .map((r) => {
      const code = r.code?.trim();
      const label = r.label?.trim();
      const order = Number(r.order || 9999);
      const srcLabel = normalizeSourceLabel(r.source);
      const srcKey = normalizeSourceKey(r.source);
      return { code, label, order, srcLabel, srcKey };
    })
    .filter((r) => r.code && r.label)
    .sort((a, b) => a.order - b.order);

  renderTests();
}

function testStatus(t) {
  const code = t.code;
  const done = code + "_FEITO";

  const ja =
    !!(
      currentPatient &&
      String(currentPatient[code] || "").toLowerCase() === "sim"
    );
  const feito =
    !!(
      currentPatient &&
      String(currentPatient[done] || "").toLowerCase() === "sim"
    );

  if (ja && feito) return "preenchido";
  if (ja) return "ja";
  return "cadastrar";
}

function renderTests() {
  const grid = $("#testsGrid");
  const info = $("#testsInfo");
  if (!grid || !info) return;

  grid.innerHTML = "";

  if (!testsCatalog.length) {
    info.className = "tag new";
    info.textContent = "Nenhum teste ativo no catálogo (aba Tests).";
    return;
  }

  let cCadastrar = 0,
    cJa = 0,
    cDone = 0;
  for (const t of testsCatalog) {
    const st = testStatus(t);
    if (st === "cadastrar") cCadastrar++;
    else if (st === "ja") cJa++;
    else cDone++;
  }

  const lblMap = {
    todos: "Todos",
    cadastrar: "Cadastrar",
    ja: "Já registrados",
    preenchido: "Preenchido"
  };

  info.className = "tag";
  info.textContent = `Ativos: ${testsCatalog.length} • Cadastrar: ${cCadastrar} • Já: ${cJa} • Preenchido: ${cDone} • Filtro: ${
    lblMap[statusFilter] || "Todos"
  }`;

  for (const t of testsCatalog) {
    const st = testStatus(t);
    if (statusFilter !== "todos" && st !== statusFilter) continue;

    const wrap = el("div", { className: "check" });
    wrap.classList.add(`source-${t.srcKey}`);

    // Coluna esquerda
    let leftBox;
    if (st === "cadastrar") {
      leftBox = el("input", {
        type: "checkbox",
        id: `cb_${t.code}`
      });
    } else {
      leftBox = el("div", {
        style: "width:16px;flex-shrink:0;"
      });
    }

    // Meio
    const box = el("div", { className: "box" });
    const codeEl = el("div", {
      className: "code",
      textContent: t.code
    });
    const labelEl = el("div", {
      className: "title",
      textContent: t.label
    });
    box.appendChild(codeEl);
    box.appendChild(labelEl);

    // Tag status
    let tagClass = "new";
    let tagText = "cadastrar";
    if (st === "ja") {
      tagClass = "ok";
      tagText = "já registrado";
    }
    if (st === "preenchido") {
      tagClass = "done";
      tagText = "preenchido";
    }
    const tag = el("span", {
      className: "tag " + tagClass,
      textContent: tagText
    });

    // Chip origem
    const srcChip = el("span", {
      className: `source-chip ${t.srcKey}`,
      textContent: t.srcLabel
    });

    wrap.appendChild(leftBox);
    wrap.appendChild(box);
    wrap.appendChild(tag);
    wrap.appendChild(srcChip);

    // Remover teste liberado (status "ja")
    if (st === "ja") {
      wrap.appendChild(el("div", { style: "flex-basis:100%;" }));

      const rmWrap = el("label", { className: "rmbox" });
      const rmChk = el("input", {
        type: "checkbox",
        id: `rm_${t.code}`,
        className: "rmchk"
      });
      const rmTxt = el("div", {});
      const strongLine = el("div", {
        className: "rmnote",
        textContent: "Remover"
      });
      const smallLine = el("div", {
        textContent: ""
      });

      rmTxt.appendChild(strongLine);
      rmTxt.appendChild(smallLine);
      rmWrap.appendChild(rmChk);
      rmWrap.appendChild(rmTxt);
      wrap.appendChild(rmWrap);
    }

    grid.appendChild(wrap);
  }
}

/* ===== LOOKUP MODE ===== */
function enterLookupMode() {
  hide($("#pacForm"));
  hide($("#testsWrap"));
  show($("#lookupBar"));
  setMsg($("#pacMsg"), "");

  $("#pacNome").value = "";
  $("#pacNasc").value = "";
  $("#pacEmail").value = "";
  $("#pacWhats").value = "";
}

/* ===== PACIENTE ===== */
async function carregarPorCPF() {
  const cpf = onlyDigits($("#pacCPF").value);
  if (!cpf) {
    setMsg($("#pacMsg"), "Digite um CPF.", "warn");
    return;
  }
  if (!validaCPF(cpf)) {
    setMsg($("#pacMsg"), "CPF inválido.", "err");
    return;
  }

  setMsg($("#pacMsg"), "Buscando cadastro…");
  const found = await sheetSearch(SHEETS.PATIENTS, { cpf });

  if (found && found.length) {
    currentPatient = found[0];
    mode = "update";

    $("#pacNome").value = currentPatient.nome || "";
    $("#pacNasc").value = (currentPatient.data_nascimento || "").slice(0, 10);
    $("#pacEmail").value = currentPatient.email || "";

    const w = currentPatient.whatsapp || "";
    $("#pacWhats").value = w || "";
    if (w) formatWhatsInput($("#pacWhats"));

    setMsg($("#pacMsg"), "Cadastro encontrado.", "ok");

    show($("#pacForm"));
    show($("#testsWrap"));
  } else {
    currentPatient = null;
    mode = "create";

    $("#pacNome").value = "";
    $("#pacNasc").value = "";
    $("#pacEmail").value = "";
    $("#pacWhats").value = "";

    setMsg(
      $("#pacMsg"),
      "CPF sem cadastro. Preencha os dados e selecione os testes para cadastrar.",
      "warn"
    );
    show($("#pacForm"));
    show($("#testsWrap"));
  }

  renderTests();
}

async function salvar() {
  const btn = $("#btnSalvar");
  try {
    btn.disabled = true;
    btn.textContent = "Salvando…";

    const nome = $("#pacNome").value.trim();
    const cpf = onlyDigits($("#pacCPF").value);
    const nascISO = toISODateFromInput($("#pacNasc").value);
    const email = $("#pacEmail").value.trim();
    const whatsRaw = $("#pacWhats").value;
    const whatsE164 = normalizeWhats(whatsRaw);

    if (!nome) {
      setMsg($("#pacMsg"), "Informe o nome.", "warn");
      throw new Error("sem nome");
    }
    if (!validaCPF(cpf)) {
      setMsg($("#pacMsg"), "CPF inválido.", "err");
      throw new Error("cpf inválido");
    }
    if (!nascISO) {
      setMsg($("#pacMsg"), "Informe a data de nascimento.", "warn");
      throw new Error("sem data");
    }
    if (email && !isValidEmail(email)) {
      setMsg($("#pacMsg"), "E-mail inválido.", "warn");
      throw new Error("email inválido");
    }
    if (whatsRaw && !whatsE164) {
      setMsg($("#pacMsg"), "WhatsApp inválido. Use DDD + número.", "warn");
      throw new Error("whats inválido");
    }

    // Confirma modo
    let exists = null;
    try {
      const f = await sheetSearch(SHEETS.PATIENTS, { cpf });
      if (f && f.length) exists = f[0];
    } catch (e) {}

    if (mode === "create" && exists) {
      currentPatient = exists;
      mode = "update";
    }

    if (mode === "create") {
      const row = {
        nome,
        cpf,
        data_nascimento: nascISO,
        created_at: nowDateTimeLocal(),
        email,
        whatsapp: whatsE164
      };

      for (const t of testsCatalog) {
        const cb = document.querySelector(`#cb_${t.code}`);
        row[t.code] = cb && cb.checked ? "sim" : "não";
      }

      await sheetCreate(SHEETS.PATIENTS, row);
      currentPatient = row;
      setMsg($("#pacMsg"), "Cadastro criado com sucesso.", "ok");
      renderTests();
    } else {
      const update = {
        nome,
        data_nascimento: nascISO,
        email,
        whatsapp: whatsE164
      };

      let mudou = false;

      // Liberar novos testes
      for (const t of testsCatalog) {
        const jaTem =
          !!(
            currentPatient &&
            String(currentPatient[t.code] || "").toLowerCase() === "sim"
          );
        const cbAdd = document.querySelector(`#cb_${t.code}`);
        if (cbAdd && !jaTem && cbAdd.checked) {
          update[t.code] = "sim";
          mudou = true;
        }
      }

      // Remover testes já liberados (status "ja")
      for (const t of testsCatalog) {
        const st = testStatus(t);
        if (st === "ja") {
          const cbRm = document.querySelector(`#rm_${t.code}`);
          if (cbRm && cbRm.checked) {
            update[t.code] = "não";
            update[t.code + "_FEITO"] = "";
            mudou = true;
          }
        }
      }

      await sheetPatchBy(SHEETS.PATIENTS, "cpf", cpf, update);

      setMsg(
        $("#pacMsg"),
        mudou
          ? "Cadastro atualizado (alterações de testes aplicadas)."
          : "Cadastro atualizado.",
        "ok"
      );

      await carregarPorCPF();
    }
  } catch (e) {
    if (e && e.message && !e.message.startsWith("sem ")) {
      console.error(e.message);
      setMsg($("#pacMsg"), "Erro ao salvar: " + e.message, "err");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar";
  }
}

/* ===== EVENTOS INICIAIS ===== */
window.addEventListener("DOMContentLoaded", () => {
  const pacWhats = $("#pacWhats");
  if (pacWhats) {
    pacWhats.addEventListener("input", () => formatWhatsInput(pacWhats));
  }

  // Login
  $("#btnLogin")?.addEventListener("click", doLogin);
  ["loginUser", "loginPass"].forEach((id) => {
    const inp = document.getElementById(id);
    if (inp) {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doLogin();
      });
    }
  });

  // Logout
  $("#btnLogout")?.addEventListener("click", () => {
    currentPatient = null;
    mode = "create";
    $("#loginUser").value = "";
    $("#loginPass").value = "";
    hide($("#viewApp"));
    hide($("#btnLogout"));
    show($("#viewLogin"));
    setMsg($("#loginMsg"), "");
  });

  // CPF: Enter para buscar + blur inteligente
  $("#pacCPF")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") carregarPorCPF();
  });
  $("#pacCPF")?.addEventListener("blur", () => {
    const d = onlyDigits($("#pacCPF").value);
    if (d.length === 11 && validaCPF(d)) carregarPorCPF();
  });

  // Botões principais
  $("#btnBuscar")?.addEventListener("click", carregarPorCPF);
  $("#btnSalvar")?.addEventListener("click", salvar);

  // Filtro status
  $("#statusFilter")?.addEventListener("change", (e) => {
    statusFilter = e.target.value;
    renderTests();
  });

  // Copiar link
  $("#btnCopyLink")?.addEventListener("click", async () => {
    const cpf = onlyDigits($("#pacCPF").value);
    if (!validaCPF(cpf)) {
      setMsg($("#pacMsg"), "CPF inválido.", "err");
      return;
    }
    try {
      const nome =
        $("#pacNome").value.trim() ||
        (currentPatient?.nome || "Paciente");
      const link = await getOrCreatePatientLink(cpf);
      const texto = `Olá, tudo bem? ${nome}! Segue seu link de acesso aos formulários. OBS: os que tiverem a observação de copiar link, você deve clicar no botão (irá copiar o link para ser enviado para um familiar ou amigo que lhe conheça para responder com informações ao seu respeito). ${link}`;

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
      } else {
        const ta = document.createElement("textarea");
        ta.value = texto;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      setMsg(
        $("#pacMsg"),
        "Link copiado! Cole no WhatsApp do paciente. ✔️",
        "ok"
      );
    } catch (e) {
      setMsg(
        $("#pacMsg"),
        "Erro ao gerar/copiar link: " + e.message,
        "err"
      );
    }
  });

  // Botão baixar anamnese (PDF)
  $("#btnBaixarAnamnese")?.addEventListener("click", async () => {
    const cpf = onlyDigits($("#pacCPF").value);
    if (!validaCPF(cpf)) {
      setMsg($("#pacMsg"), "CPF inválido.", "err");
      return;
    }
    try {
      setMsg($("#pacMsg"), "Gerando PDF da anamnese...");
      const url = `${SCRIPT_URL}?cpf=${cpf}`;
      window.open(url, "_blank");
      setMsg($("#pacMsg"), "PDF gerado com sucesso! ✔️", "ok");
    } catch (e) {
      setMsg($("#pacMsg"), "Erro: " + e.message, "err");
    }
  });
});

/* ===== LOGIN FLOW ===== */
async function doLogin() {
  const user = $("#loginUser").value.trim();
  const pass = $("#loginPass").value;
  const msg = $("#loginMsg");

  if (!user || !pass) {
    setMsg(msg, "Preencha usuário e senha.", "warn");
    return;
  }

  setMsg(msg, "Verificando…");
  try {
    const ok = await tryAuthVariants(user, pass);
    if (!ok) {
      setMsg(msg, "Usuário ou senha inválidos.", "err");
      return;
    }

    setMsg(msg, "Login ok.", "ok");
    hide($("#viewLogin"));
    show($("#viewApp"));
    show($("#btnLogout"));

    await loadTests();
    enterLookupMode();
    $("#pacCPF").focus();
  } catch (e) {
    setMsg(msg, "Erro no login: " + e.message, "err");
  }
}
