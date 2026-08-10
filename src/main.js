// Substitua o link abaixo pela sua URL do Google Sheets (certifique-se de que termina com pub?output=tsv)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQi5ktA65fZeJ9Mzxyj5pcgyuC-06SHMqlu0gmmnX3rHpBAkEQpEE1MRMc6jRgh97bqs9dCTy0rJid0/pub?output=tsv';

const resultsContainer = document.getElementById('results');
let dadosAgrupados = [];

const filters = {
  ramo: document.getElementById('filterRamo'),
  parceiro: document.getElementById('filterParceiro'),
  tipo: document.getElementById('filterTipo'),
  descricao: document.getElementById('inputDescricao'),
  faixaDesconto: document.getElementById('filterFaixaDesconto')
};

let isUpdating = false; // trava para evitar loops

// ============ CARGA INICIAL ============
async function loadData() {
  try {
    resultsContainer.innerHTML = '<p style="text-align: center; color: var(--brand-blue-dark); grid-column: 1 / -1;">Sincronizando com o banco oficial...</p>';
    const response = await fetch(SHEET_URL);
    const rows = (await response.text()).split('\n').slice(1);
    const parceirosMap = new Map();

    rows.forEach(row => {
      const col = row.split('\t').map(c => c.trim());
      if (!col[0]) return;

      const parceiro = col[0];
      if (!parceirosMap.has(parceiro)) {
        const prio = parseInt(col[11], 10); // Lê a coluna L (índice 11)
        
        parceirosMap.set(parceiro, {
          parceiro: parceiro,
          telefone: col[1] || '-',
          endereco: col[2] || '-',
          ramos: new Set(),
          tipos: new Set(),
          logo: col[10] || '',
          prioridade: isNaN(prio) ? 999 : prio, // Joga para o fim da fila quem não tem prioridade
          procedimentos: []
        });
      }

      const pData = parceirosMap.get(parceiro);
      if (col[3]) pData.ramos.add(col[3]);
      if (col[4]) pData.tipos.add(col[4]);

      pData.procedimentos.push({
        ramo: col[3] || '',
        tipo: col[4] || '',
        descricao: col[5] || '-',
        faixaDesconto: col[6] || '-',
        valPart: col[7] || '-',
        valCartao: col[8] || '-',
        desconto: col[9] || '-'
      });
    });

    // Extrai os valores do Map e já ordena na memória (Eficiência máxima na busca)
    dadosAgrupados = Array.from(parceirosMap.values()).sort((a, b) => a.prioridade - b.prioridade);
    
    updateSelectOptions(); // preenche os selects iniciais
    handleSearch();        // exibe todos (ou limitado)
  } catch (error) {
    resultsContainer.innerHTML = '<p style="text-align: center; color: #cc0000; grid-column: 1 / -1;">Lista de clientes em atualização, <br>por favor, tente novamente mais tarde. </p>';
  }
}

// ============ ATUALIZA AS OPÇÕES DOS SELECTS COM BASE NOS VALORES ATUAIS ============
function updateSelectOptions() {
  // Se não houver dados ainda, não faz nada
  if (!dadosAgrupados.length) return;

  // Lê valores atuais (sem disparar eventos)
  const vRamo = filters.ramo.value;
  const vParceiro = filters.parceiro.value;
  const vTipo = filters.tipo.value;
  const vFaixa = filters.faixaDesconto.value;

  const setR = new Set(), setP = new Set(), setT = new Set(), setF = new Set();

  dadosAgrupados.forEach(item => {
    // Filtros cruzados: só incluir se atender aos outros critérios ativos
    const matchP = !vParceiro || item.parceiro === vParceiro;
    const matchR = !vRamo || item.ramos.has(vRamo);
    const matchT = !vTipo || item.tipos.has(vTipo);

    // Opções de Ramo: disponíveis se parceiro e tipo corresponderem
    if (matchP && matchT) item.ramos.forEach(r => setR.add(r));
    // Opções de Parceiro: disponíveis se ramo e tipo corresponderem
    if (matchR && matchT) setP.add(item.parceiro);
    // Opções de Tipo: disponíveis se parceiro e ramo corresponderem
    if (matchR && matchP) item.tipos.forEach(t => setT.add(t));
    // Opções de Faixa: disponíveis se todos os três corresponderem
    if (matchR && matchP && matchT) {
      item.procedimentos.forEach(p => {
        if (p.faixaDesconto !== '-') setF.add(p.faixaDesconto);
      });
    }
  });

  // Função auxiliar para reconstruir um select preservando a seleção se válida
  const rebuildSelect = (select, optionsSet, defaultText) => {
    const currentValue = select.value;
    const sorted = Array.from(optionsSet).sort();
    let html = `<option value="">${defaultText}</option>`;
    sorted.forEach(v => { html += `<option value="${v}">${v}</option>`; });
    select.innerHTML = html;
    // Restaura valor anterior se ainda existir nas novas opções
    if (currentValue && optionsSet.has(currentValue)) {
      select.value = currentValue;
    } else {
      select.value = ''; // limpa se não for mais válido
    }
  };

  isUpdating = true; // evita que alterações disparem eventos
  rebuildSelect(filters.ramo, setR, 'Todas as Especialidades');
  rebuildSelect(filters.parceiro, setP, 'Todos os Parceiros');
  rebuildSelect(filters.tipo, setT, 'Todos os Serviços');
  rebuildSelect(filters.faixaDesconto, setF, 'Todas as Faixas');
  isUpdating = false;
}

// ============ RENDERIZA OS CARDS ============
// ============ RENDERIZA OS CARDS ============
function renderCards(lista) {
  if (!lista.length) {
    resultsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); grid-column: 1 / -1;">Nenhum registro encontrado para estes filtros.</p>';
    return;
  }

  resultsContainer.innerHTML = lista.map(item => {
    const temLogo = item.logo && item.logo !== '-';

    return `
      <article class="card-pdf" role="listitem">
        <div class="card-pdf-header">
          <div class="brand-area">
            ${temLogo
                ? `<img src="${item.logo}" alt="Logo" style="max-width: 100%; max-height: 125px; object-fit: contain; border-radius: 4px;">`
                : `<h2>${item.parceiro}</h2><p>${Array.from(item.ramos).join(' / ')}</p>`}
          </div>
          
          <hr class="divisor-mobile">
          
          <div class="contact-area">
            <p>📞 ${item.telefone}</p>
            ${item.endereco.split(/\s*\|\s*/).map(end => `<p>📍 ${end}</p>`).join('')}
          </div>
        </div>
        </div>
        <div class="card-pdf-body">
          <table class="price-table">
            <thead>
              <tr>
                <th class="text-left">Descrição</th>
                <th>Valor Particular</th>
                <th class="col-cartao">Valor Cartão Saúde</th>
                <th class="col-desconto">% Desconto</th>
              </tr>
            </thead>
            <tbody>
              ${item.procedimentos.map(proc => `
                <tr>
                  <td class="text-left">${proc.descricao.replace(/\s*\|\s*/g, '<br>')}</td>
                  <td>${proc.valPart}</td>
                  <td class="destaque-cartao">${proc.valCartao}</td>
                  <td>${proc.desconto}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }).join('');
}
// ============ BUSCA PRINCIPAL ============
function handleSearch(e) {
  // Se a atualização veio de uma alteração programática, ignorar
  if (isUpdating) return;

  // Se o evento veio de qualquer filtro (exceto campo de texto), primeiro atualizar opções
  if (e && e.target !== filters.descricao) {
    updateSelectOptions();
  }
  // Se for o campo de texto, não precisa atualizar selects

  const vRamo = filters.ramo.value.toLowerCase();
  const vParceiro = filters.parceiro.value.toLowerCase();
  const vTipo = filters.tipo.value.toLowerCase();
  const vDesc = filters.descricao.value.toLowerCase().trim();
  const vFaixa = filters.faixaDesconto.value.toLowerCase();

  const isDefaultView = !vRamo && !vParceiro && !vTipo && !vDesc && !vFaixa;
  const filtered = [];
  let count = 0;

  for (let item of dadosAgrupados) {
    if (isDefaultView && count >= 100) break;

    // Filtros por select
    if ((vParceiro && item.parceiro.toLowerCase() !== vParceiro) ||
        (vRamo && !Array.from(item.ramos).some(r => r.toLowerCase() === vRamo)) ||
        (vTipo && !Array.from(item.tipos).some(t => t.toLowerCase() === vTipo))) continue;

    // Filtro por texto: busca em parceiro, ramo, tipo e procedimentos
    const parentMatch = !vDesc || item.parceiro.toLowerCase().includes(vDesc);

    const matches = item.procedimentos.filter(p => {
      // descMatch agora varre a descrição, o ramo e o tipo específicos DESTA linha
      const descMatch = !vDesc || 
                        p.descricao.toLowerCase().includes(vDesc) ||
                        p.ramo.toLowerCase().includes(vDesc) ||
                        p.tipo.toLowerCase().includes(vDesc);
                        
      const faixaMatch = !vFaixa || p.faixaDesconto.toLowerCase() === vFaixa;
      
      // Retorna a linha se a clínica for o alvo OU se o termo estiver nesta linha exata
      return (parentMatch || descMatch) && faixaMatch;
    });

    if (matches.length > 0) {
      filtered.push({ ...item, procedimentos: matches });
      count += matches.length;
    }
  }

  renderCards(filtered);
}

// ============ EVENTOS ============
Object.values(filters).forEach(input => {
  input.addEventListener('input', handleSearch);
  // Para selects, também escutamos 'change' por segurança em navegadores antigos
  if (input.tagName === 'SELECT') {
    input.addEventListener('change', handleSearch);
  }
});

loadData();
