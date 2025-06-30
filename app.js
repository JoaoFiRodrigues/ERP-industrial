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
  document.getElementById(telaId).classList.add('active');
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
  db.collection("solicitacoes").where("status", "==", "Pendente").onSnapshot(snapshot => {
    const maquinas = new Set();
    snapshot.forEach(doc => maquinas.add(doc.data().maquina));
    select.innerHTML = "";
    maquinas.forEach(m => {
      const option = document.createElement("option");
      option.textContent = m;
      option.value = m;
      select.appendChild(option);
    });
  });
}

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

    snapshot.forEach(doc => {
      const d = doc.data();
      if (d.status === "Resolvido") concluidas.push(d);
      if (d.tempo) tempoTotal += d.tempo;
      maquinas[d.maquina] = (maquinas[d.maquina] || 0) + 1;
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

    // Atualiza gráfico, se canvas existir
    const tipos = { Corretiva: 0, Preventiva: 0, Preditiva: 0 };
    snapshot.forEach(doc => {
      const tipo = doc.data().tipo || "Corretiva";
      tipos[tipo] = (tipos[tipo] || 0) + 1;
    });

    const ctx = document.getElementById("graficoGestao");
    if (ctx) {
      if (window.grafico) window.grafico.destroy();
      window.grafico = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(tipos),
          datasets: [{
            label: 'Distribuição por Tipo',
            data: Object.values(tipos),
            backgroundColor: ['#dc3545', '#0d6efd', '#ffc107']
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
