// O site e a API usam o mesmo endereço. Abra http://localhost:5080.
let produtos = [];
let carrinho = [];
let usuarioAtual = null;
let taxaEntrega = 10;
let idOrigem = null;
let enviandoPedido = false;
const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function mensagem(texto, erro = false) {
    const caixa = document.getElementById("mensagem");
    caixa.textContent = texto;
    caixa.classList.toggle("erro", erro);
    caixa.hidden = false;
}

async function api(caminho, metodo = "GET", dados = null) {
    let resposta;
    try {
        resposta = await fetch("/api" + caminho, {
            method: metodo,
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", "X-Delivery": "1" },
            body: dados == null ? null : JSON.stringify(dados)
        });
    } catch {
        throw new Error("Não foi possível conectar ao servidor. Verifique se o site está em execução e atualize a página.");
    }
    const conteudo = await resposta.json().catch(function () { return {}; });
    if (!resposta.ok) {
        if (resposta.status === 401) throw new Error("Faça login com e-mail e senha válidos.");
        throw new Error(conteudo.mensagem || "Não foi possível concluir a operação.");
    }
    return conteudo;
}

function rolarPara(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function alternarModo() {
    const escuro = document.body.dataset.theme !== "dark";
    document.body.dataset.theme = escuro ? "dark" : "light";
    document.getElementById("iconeTema").src = escuro ? "assets/icone-lua.png" : "assets/icone-sol.png";
    try { localStorage.setItem("temaOishi", escuro ? "dark" : "light"); } catch {}
}

function alternarBusca() {
    const campo = document.getElementById("campoBusca");
    campo.hidden = !campo.hidden;
    if (!campo.hidden) { campo.focus(); rolarPara("cardapio"); }
}

function normalizar(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function mostrarProdutos() {
    const lista = document.querySelector(".lista-produtos");
    const modelo = document.getElementById("modeloProduto");
    const busca = normalizar(document.getElementById("campoBusca").value.trim());
    lista.replaceChildren();

    for (const produto of produtos) {
        if (!normalizar(produto.nome + " " + produto.descricao).includes(busca)) continue;

        const card = modelo.content.firstElementChild.cloneNode(true);
        const imagem = card.querySelector("img");
        imagem.src = /^assets\/[a-zA-Z0-9_-]+\.png$/.test(produto.imagem) ? produto.imagem : "assets/logo.png";
        imagem.alt = produto.nome;
        card.querySelector(".nome-produto").textContent = produto.nome.toUpperCase();
        card.querySelector("h4").textContent = produto.descricao;
        card.querySelector(".preco-produto").textContent = formatoMoeda.format(produto.preco);
        card.querySelector("button").onclick = function () { adicionarItem(produto.id); };
        lista.append(card);
    }

    if (!lista.children.length) lista.textContent = "Nenhum produto encontrado.";
}

function guardarCarrinho() {
    try { localStorage.setItem("carrinhoOishi", JSON.stringify({ itens: carrinho, idOrigem: idOrigem })); } catch {}
}

function mudarCarrinho() {
    idOrigem = null;
    guardarCarrinho();
    mostrarCarrinho();
}

function adicionarItem(id) {
    if (enviandoPedido) return;
    const item = carrinho.find(function (item) { return item.produtoId === id; });
    if (item) {
        if (item.quantidade >= 99) return mensagem("O limite é de 99 unidades por produto.", true);
        item.quantidade++;
    } else {
        carrinho.push({ produtoId: id, quantidade: 1 });
    }
    mudarCarrinho();
    mensagem("Produto adicionado ao carrinho.");
}

function alterarQuantidade(id, diferenca) {
    if (enviandoPedido) return;
    const item = carrinho.find(function (item) { return item.produtoId === id; });
    item.quantidade += diferenca;
    if (item.quantidade <= 0) carrinho = carrinho.filter(function (item) { return item.produtoId !== id; });
    else if (item.quantidade > 99) item.quantidade = 99;
    mudarCarrinho();
}

function mostrarCarrinho() {
    const lista = document.getElementById("listaItens");
    const modelo = document.getElementById("modeloItemCarrinho");
    let subtotal = 0;
    lista.replaceChildren();

    for (const item of carrinho) {
        const produto = produtos.find(function (produto) { return produto.id === item.produtoId; });
        if (!produto) continue;

        subtotal += produto.preco * item.quantidade;
        const linha = modelo.content.firstElementChild.cloneNode(true);
        linha.querySelector("span").textContent = item.quantidade + " x " + produto.nome + " - " + formatoMoeda.format(produto.preco * item.quantidade);
        const menos = linha.querySelector(".diminuir");
        menos.setAttribute("aria-label", "Remover uma unidade de " + produto.nome);
        menos.onclick = function () { alterarQuantidade(item.produtoId, -1); };
        const mais = linha.querySelector(".aumentar");
        mais.setAttribute("aria-label", "Adicionar uma unidade de " + produto.nome);
        mais.onclick = function () { alterarQuantidade(item.produtoId, 1); };
        lista.append(linha);
    }

    document.getElementById("subtotal").textContent = subtotal.toFixed(2).replace(".", ",");
    document.getElementById("taxaEntrega").textContent = (carrinho.length ? taxaEntrega : 0).toFixed(2).replace(".", ",");
    document.getElementById("total").textContent = (carrinho.length ? subtotal + taxaEntrega : 0).toFixed(2).replace(".", ",");
}

function camposValidos(ids) {
    return ids.every(function (id) { return document.getElementById(id).reportValidity(); });
}

async function validarCadastro() {
    if (!camposValidos(["nome", "email", "telefone", "senha", "confirmarSenha", "aceitouTermos"])) return;
    if (document.getElementById("senha").value !== document.getElementById("confirmarSenha").value)
        return mensagem("As senhas não conferem.", true);
    const botao = document.getElementById("btnCadastrar");
    botao.disabled = true;
    try {
        const resultado = await api("/usuarios", "POST", {
            nome: document.getElementById("nome").value,
            email: document.getElementById("email").value,
            telefone: document.getElementById("telefone").value,
            senha: document.getElementById("senha").value,
            confirmarSenha: document.getElementById("confirmarSenha").value,
            aceitouTermos: document.getElementById("aceitouTermos").checked
        });
        document.getElementById("loginEmail").value = document.getElementById("email").value;
        document.getElementById("senha").value = "";
        document.getElementById("confirmarSenha").value = "";
        mensagem(resultado.mensagem);
        rolarPara("login");
    } catch (erro) { mensagem(erro.message, true); }
    finally { botao.disabled = false; }
}

async function validarLogin() {
    if (!camposValidos(["loginEmail", "loginSenha"])) return;
    const botao = document.getElementById("btnEntrar");
    botao.disabled = true;
    try {
        await api("/login", "POST", {
            email: document.getElementById("loginEmail").value,
            senha: document.getElementById("loginSenha").value,
            lembrar: document.getElementById("lembrarLogin").checked
        });
        document.getElementById("loginSenha").value = "";
        idOrigem = null;
        guardarCarrinho();
        await carregarPerfil();
        await carregarPedidos();
        mensagem("Login realizado.");
        rolarPara("perfil");
    } catch (erro) { mensagem(erro.message, true); }
    finally { botao.disabled = false; }
}

async function carregarPerfil() {
    const resposta = await fetch("/api/perfil", { credentials: "same-origin" });
    if (resposta.status === 401) {
        usuarioAtual = null;
        document.getElementById("formPerfil").hidden = true;
        document.getElementById("situacaoConta").textContent = "Faça login para acessar sua conta.";
        return;
    }
    if (!resposta.ok) throw new Error("Não foi possível carregar o perfil.");
    usuarioAtual = await resposta.json();
    document.getElementById("formPerfil").hidden = false;
    document.getElementById("situacaoConta").textContent = "Olá, " + usuarioAtual.nome + "!";
    document.getElementById("emailPerfil").textContent = usuarioAtual.email;
    document.getElementById("perfilNome").value = usuarioAtual.nome;
    document.getElementById("perfilTelefone").value = formatarTelefone(usuarioAtual.telefone);
    document.getElementById("perfilEndereco").value = usuarioAtual.endereco;
    document.getElementById("enderecoEntrega").value = usuarioAtual.endereco;
}

async function salvarPerfil(evento) {
    evento.preventDefault();
    try {
        const resultado = await api("/perfil", "PUT", {
            nome: document.getElementById("perfilNome").value,
            telefone: document.getElementById("perfilTelefone").value,
            endereco: document.getElementById("perfilEndereco").value
        });
        await carregarPerfil();
        mensagem(resultado.mensagem);
    } catch (erro) { mensagem(erro.message, true); }
}

async function sair() {
    try {
        await api("/logout", "POST");
        usuarioAtual = null;
        idOrigem = null;
        guardarCarrinho();
        document.getElementById("perfilNome").value = "";
        document.getElementById("perfilTelefone").value = "";
        document.getElementById("perfilEndereco").value = "";
        document.getElementById("emailPerfil").textContent = "";
        document.getElementById("enderecoEntrega").value = "";
        await carregarPerfil();
        await carregarPedidos();
        mensagem("Você saiu da conta.");
    } catch (erro) { mensagem(erro.message, true); }
}

async function finalizarCompra() {
    if (enviandoPedido) return;
    if (!usuarioAtual) { mensagem("Faça login antes de finalizar o pedido.", true); return rolarPara("login"); }
    if (!carrinho.length) return mensagem("Adicione um produto ao carrinho.", true);
    const endereco = document.getElementById("enderecoEntrega").value.trim();
    if (endereco.length < 8) return mensagem("Preencha o endereço de entrega com rua, número, bairro e cidade.", true);
    enviandoPedido = true;
    const botao = document.getElementById("btnFinalizarCompra");
    botao.disabled = true;
    if (!idOrigem) idOrigem = crypto.randomUUID();
    guardarCarrinho();
    try {
        const resultado = await api("/pedidos", "POST", {
            versao: 1, idOrigem: idOrigem, endereco: endereco, itens: carrinho
        });
        carrinho = [];
        idOrigem = null;
        guardarCarrinho();
        mostrarCarrinho();
        mensagem("Pedido #" + resultado.id + " registrado! Total: " + formatoMoeda.format(resultado.total) + ". Pagamento na entrega.");
        await carregarPedidos();
        rolarPara("pedidos");
    } catch (erro) {
        mensagem(erro.message + " Confira seus pedidos antes de tentar novamente; o mesmo envio não será duplicado.", true);
    } finally { enviandoPedido = false; botao.disabled = false; }
}

async function carregarPedidos() {
    const lista = document.getElementById("listaPedidos");
    const situacao = document.getElementById("situacaoPedidos");
    const modelo = document.getElementById("modeloPedido");
    lista.replaceChildren();

    if (!usuarioAtual) {
        situacao.textContent = "Faça login para consultar seus pedidos.";
        return;
    }

    try {
        const pedidos = await api("/pedidos");
        situacao.textContent = pedidos.length ? "" : "Você ainda não tem pedidos.";

        for (const pedido of pedidos) {
            const artigo = modelo.content.firstElementChild.cloneNode(true);
            artigo.querySelector("h3").textContent = "Pedido #" + pedido.id + " - " + pedido.status;
            artigo.querySelector("p").textContent = formatoMoeda.format(pedido.total) + " | " + pedido.endereco;
            artigo.querySelector("a").href = "/api/pedidos/" + pedido.id + "/json";
            artigo.querySelector("button").onclick = function () {
                mostrarItensPedido(pedido.id, artigo.querySelector("ul"));
            };
            lista.append(artigo);
        }
    } catch (erro) {
        situacao.textContent = erro.message;
    }
}

async function mostrarItensPedido(id, lista) {
    try {
        const itens = await api("/pedidos/" + id + "/itens");
        lista.replaceChildren();
        for (const item of itens) {
            const linha = document.createElement("li");
            linha.textContent = item.quantidade + " x " + item.nome + " - " + formatoMoeda.format(item.preco);
            lista.append(linha);
        }
    } catch (erro) {
        mensagem(erro.message, true);
    }
}

function formatarTelefone(texto) {
    const numeros = texto.replace(/\D/g, "").slice(0, 11);
    if (numeros.length > 10) return numeros.replace(/^(\d{2})(\d{5})(\d{0,4})$/, "($1) $2-$3");
    if (numeros.length > 6) return numeros.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    if (numeros.length > 2) return numeros.replace(/^(\d{2})(\d*)$/, "($1) $2");
    return numeros.length ? "(" + numeros : "";
}

function restaurarPreferencias() {
    try {
        if (localStorage.getItem("temaOishi") === "dark") alternarModo();
        const salvo = JSON.parse(localStorage.getItem("carrinhoOishi") || "null");
        if (salvo && Array.isArray(salvo.itens)) {
            const ids = new Set();
            carrinho = salvo.itens.filter(function (item) {
                if (!item || !Number.isInteger(item.produtoId) || item.produtoId < 1 ||
                    !Number.isInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 99 || ids.has(item.produtoId))
                    return false;
                ids.add(item.produtoId);
                return true;
            }).slice(0, 50);
            idOrigem = typeof salvo.idOrigem === "string" && /^[0-9a-f-]{36}$/i.test(salvo.idOrigem) ? salvo.idOrigem : null;
        }
    } catch {
        // Preferências inválidas ou bloqueadas não impedem o uso do site.
    }
}

async function iniciar() {
    document.getElementById("campoBusca").addEventListener("input", mostrarProdutos);
    document.getElementById("formPerfil").addEventListener("submit", salvarPerfil);
    ["telefone", "perfilTelefone"].forEach(function (id) {
        document.getElementById(id).addEventListener("input", function () { this.value = formatarTelefone(this.value); });
    });
    ["loginEmail", "loginSenha"].forEach(function (id) {
        document.getElementById(id).addEventListener("keydown", function (evento) {
            if (evento.key === "Enter") validarLogin();
        });
    });
    restaurarPreferencias();
    try {
        const configuracao = await api("/configuracao");
        taxaEntrega = configuracao.taxaEntrega;
        produtos = await api("/produtos");
        const disponiveis = carrinho.filter(function (item) {
            return produtos.some(function (produto) { return produto.id === item.produtoId; });
        });
        if (disponiveis.length !== carrinho.length) {
            carrinho = disponiveis;
            idOrigem = null;
            mensagem("Produtos indisponíveis foram retirados do carrinho.");
        }
        guardarCarrinho();
        mostrarProdutos();
        mostrarCarrinho();
        await carregarPerfil();
        await carregarPedidos();
    } catch (erro) {
        document.querySelector(".lista-produtos").textContent = "Não foi possível carregar o cardápio.";
        mensagem("Confira se a API e o MySQL estão ligados. " + erro.message, true);
    }
}
iniciar();
