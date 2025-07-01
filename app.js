// Config Firebase (use seu config aqui)
const firebaseConfig = {
  apiKey: "AIzaSyAmqwYHQeRq88QvCFsl2Y9gNJtrsssw4l8",
  authDomain: "erp-manuten.firebaseapp.com",
  projectId: "erp-manuten",
  storageBucket: "erp-manuten.firebasestorage.app",
  messagingSenderId: "925658568597",
  appId: "1:925658568597:web:5aa887878d9d19062c489c"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Navegação entre abas/telas
function mostrar(telaId) {
  document.querySelectorAll('.tela').forEach(tela => tela.classList.remove('active'));
  const tela = document.getElementById(telaId);
  tela.classList.add('active');

  if (telaId === "abaMaquinas") {
    carregarMaquinas();
  }
}
document.querySelectorAll('nav .nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tela = link.getAttribute('data-tela');
    mostrar(tela);
    document.querySelectorAll('nav .nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const bsCollapse = bootstrap.Collapse.getInstance(document.getElementById('menuNav'));
    if (bsCollapse) bsCollapse.hide();
  });
});
mostrar('solicitacao'); // tela inicial

// Formulário de solicitação de manutenção
document.getElementById("formSolicitacao").addEventListener("submit", function(e) {
  e.preventDefault();
  const maquina = document.getElementById("maquina").value;
  const problema = document.getElementById("problema").value.trim();
  const urgencia = document.getElementById("urgencia").value;
  const observacoes = document.getElementById("observacoes").value.trim();

  if (!maquina || !problema || !urgencia) {
    alert("Por favor, preencha os campos obrigatórios.");
    return;
  }

  db.collection("solicitacoes").add({
    maquina,
    problema,
    urgencia,
    observacoes,
    status: "Pendente",
    data: new Date().toISOString()
  }).then(() => {
    alert("Solicitação enviada!");
    this.reset();
  }).catch(err => {
    console.error("Erro ao enviar solicitação:", err);
    alert("Erro ao enviar solicitação.");
  });
});

// Atualiza select de máquinas pendentes no registro técnico
function atualizarSelectMaquinasPendentes() {
  const select = document.getElementById("selectMaquinaPend");
  select.innerHTML = '<option value="" disabled selected>Selecione a Máquina</option>';
  db.collection("solicitacoes").where("status", "==", "Pendente").get().then(snapshot => {
    const maquinas = new Set();
    snapshot.forEach(doc => maquinas.add(doc.data().maquina));
    maquinas.forEach(m => {
      const option = document.createElement("option");
      option.textContent = m;
      option.value = m;
      select.appendChild(option);
    });
  });
}

// Ao mudar máquina pendente selecionada, busca problema e mostra no campo descrição problema
document.getElementById("selectMaquinaPend").addEventListener("change", async function() {
  const maquina = this.value;
  const descricaoProblema = document.getElementById("descricaoProblema");
  descricaoProblema.value = "Carregando...";

  if (!maquina) {
    descricaoProblema.value = "";
    return;
  }

  const snapshot = await db.collection("solicitacoes")
    .where("maquina", "==", maquina)
    .where("status", "==", "Pendente")
    .orderBy("data")
    .limit(1)
    .get();

  if (snapshot.empty) {
    descricaoProblema.value = "Nenhuma tarefa pendente para esta máquina.";
    return;
  }

  const doc = snapshot.docs[0].data();
  descricaoProblema.value = doc.problema || "";
});

// Formulário de registro técnico para concluir tarefa
document.getElementById("formRegistro").addEventListener("submit", async function(e) {
  e.preventDefault();

  const maquina = document.getElementById("selectMaquinaPend").value;
  const acao = document.getElementById("acaoFeita").value.trim();
  const tempo = parseFloat(document.getElementById("tempoGasto").value);
  const tecnico = document.getElementById("tecnico").value.trim();

  if (!maquina || !acao || isNaN(tempo) || !tecnico) {
    alert("Por favor, preencha todos os campos corretamente.");
    return;
  }

  try {
    const snapshot = await db.collection("solicitacoes")
      .where("maquina", "==", maquina)
      .where("status", "==", "Pendente")
      .orderBy("data")
      .limit(1)
      .get();

    if (snapshot.empty) {
      alert("Nenhuma tarefa pendente encontrada para esta máquina.");
      return;
    }

    const docRef = snapshot.docs[0].ref;
    await docRef.update({
      status: "Resolvido",
      acao,
      tempo,
      tecnico,
      resolvidoEm: new Date().toISOString()
    });

    alert("Tarefa registrada com sucesso!");
    this.reset();
    document.getElementById("descricaoProblema").value = "";

    atualizarSelectMaquinasPendentes();
    carregarAtividades();
    atualizarGestao();

  } catch (error) {
    console.error("Erro ao registrar tarefa:", error);
    alert("Erro ao registrar tarefa. Veja o console para detalhes.");
  }
});

// Carrega atividades pendentes para painel técnico
function carregarAtividades() {
  const lista = document.getElementById("listaAtividades");
  db.collection("solicitacoes").where("status", "==", "Pendente").onSnapshot(snapshot => {
    lista.innerHTML = "";
    snapshot.forEach(doc => {
      const d = doc.data();
      lista.innerHTML += `
      <div class="card mb-2 p-2">
        <b>Máquina:</b> ${d.maquina}<br>
        <b>Problema:</b> ${d.problema}<br>
        <b>Urgência:</b> ${d.urgencia}<br>
        <b>Observações:</b> ${d.observacoes || '-'}<br>
        <b>Data:</b> ${new Date(d.data).toLocaleString()}
      </div>`;
    });
  });
}

// Atualiza painel de gestão com dados e tarefas concluídas
function atualizarGestao() {
  db.collection("solicitacoes").onSnapshot(snapshot => {
    const total = snapshot.size;
    let tempoTotal = 0;
    const maquinas = {};
    const concluidas = [];
    const problemasContagem = {};

    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.status === "Resolvido") concluidas.push(d);
      if (d.tempo) tempoTotal += d.tempo;
      maquinas[d.maquina] = (maquinas[d.maquina] || 0) + 1;

      // Contagem problemas para gráfico (5 opções fixas)
      const p = d.problema || "Outro";
      problemasContagem[p] = (problemasContagem[p] || 0) + 1;
    });

    document.getElementById("totalRegs").textContent = total;
    document.getElementById("totalTempo").textContent = tempoTotal.toFixed(2);

    const top = Object.entries(maquinas).sort((a,b) => b[1]-a[1]).slice(0,3);
    document.getElementById("maquinasTop").textContent = top.length > 0
      ? top.map(m => `${m[0]} (${m[1]})`).join(", ")
      : "-";

    const conclDiv = document.getElementById("concluidas");
    conclDiv.innerHTML = "";
    concluidas.forEach(d => {
      conclDiv.innerHTML += `
      <div class="card mb-2 p-2">
        <b>Máquina:</b> ${d.maquina}<br>
        <b>Problema:</b> ${d.problema}<br>
        <b>Ação:</b> ${d.acao}<br>
        <b>Técnico:</b> ${d.tecnico}<br>
        <b>Tempo:</b> ${d.tempo}h
      </div>`;
    });

    // Atualiza gráfico com 5 opções da descrição do problema fixas
    const problemasFixos = [
      "Problemas Mecânicos",
      "Problemas Eletricos",
      "Problema de controle / automação",
      "Problemas pneumáticos / hidráulicos",
      "Problemas de limpeza"
    ];
    const dataGrafico = problemasFixos.map(p => problemasContagem[p] || 0);

    const ctx = document.getElementById("graficoGestao");
    if (ctx) {
      if (window.grafico) window.grafico.destroy();
      window.grafico = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: problemasFixos,
          datasets: [{
            label: 'Ocorrências',
            data: dataGrafico,
            backgroundColor: '#0d6efd'
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } }
        }
      });
    }
  });
}

// Inicializações
atualizarSelectMaquinasPendentes();
carregarAtividades();
atualizarGestao();

const maquinas = [
  // Exemplo de máquinas pré-cadastradas (você pode carregar dinamicamente do Firebase se quiser)
  {
    numero: "001",
    nome: "Laser",
    modelo: "LX200",
    marca: "Cortech",
    ano: 2018,
    potencia: "2kW",
    pressao: "12 bar",
    capacidade: "500mm",
    numeroSerie: "ABC1234"
  },
  // Adicione mais conforme sua planilha...
];

function carregarMaquinas() {
  const tbody = document.getElementById("listaMaquinas");
  tbody.innerHTML = "";
  maquinas.forEach((m, i) => {
    tbody.innerHTML += `
      <tr>
        <td>${m.numero}</td>
        <td>${m.nome}</td>
        <td>${m.modelo}</td>
        <td>${m.marca}</td>
        <td>${m.ano}</td>
        <td>${m.potencia}</td>
        <td>${m.pressao}</td>
        <td>${m.capacidade}</td>
        <td>${m.numeroSerie}</td>
        <td><button class="btn btn-sm btn-primary" onclick="verHistorico('${m.numero}', '${m.nome}')">Ver Histórico</button></td>
      </tr>`;
  });
}

async function verHistorico(numero, nome) {
  document.getElementById("abaMaquinas").querySelector(".table-responsive").style.display = "none";
  document.getElementById("historicoMaquina").style.display = "block";
  document.getElementById("nomeMaquinaSelecionada").textContent = nome;
  document.getElementById("numeroMaquinaSelecionada").textContent = numero;

  const tbody = document.getElementById("historicoTabela");
  tbody.innerHTML = "Carregando...";

  const snapshot = await db.collection("solicitacoes")
    .where("status", "==", "Resolvido")
    .where("numero", "==", numero)
    .get();

  tbody.innerHTML = "";
  snapshot.forEach(doc => {
    const d = doc.data();
    tbody.innerHTML += `
      <tr>
        <td>${new Date(d.resolvidoEm).toLocaleDateString()}</td>
        <td>${d.problema}</td>
        <td>${d.acao}</td>
        <td>${d.tecnico}</td>
        <td>${d.tempo}</td>
        <td>${d.observacoes || "-"}</td>
      </tr>`;
  });
}

function voltarListaMaquinas() {
  document.getElementById("historicoMaquina").style.display = "none";
  document.getElementById("abaMaquinas").querySelector(".table-responsive").style.display = "block";
}
