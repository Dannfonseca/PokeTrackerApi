// TODOLISTPOKEMON/js/ui.js
/**
 * Funções gerais de manipulação da Interface do Usuário (UI).
 * Inclui controle de visibilidade do spinner de carregamento,
 * abertura/fechamento da sidebar (menu lateral), atualização dinâmica
 * de estilos (cores de clãs), exibição de mensagens de erro/sucesso,
 * ajuste da UI baseado no tamanho da tela e formatação de datas.
 *
 * Funções Principais:
 * - showSpinner / hideSpinner: Controlam o overlay de carregamento.
 * - toggleSidebar / closeSidebar: Gerenciam a exibição da sidebar em mobile.
 * - updateClanStyles: Aplica cores e estilos específicos do clã ativo na UI.
 * - checkScreenSize: Ajusta a sidebar em redimensionamentos (desktop vs mobile).
 * - displayError / displaySuccess: Exibe mensagens ao usuário.
 * - formatBrazilianDate: Formata datas ISO para o padrão DD/MM/AAAA HH:MM:SS (fuso SP).
 */
import { dom } from './domElements.js';
import { clanData } from './config.js';


export function showSpinner() {
    if (dom.loadingSpinner) {
        dom.loadingSpinner.classList.remove('hidden');
    } else {
        console.warn("Elemento Spinner não encontrado no DOM.");
    }
}

export function hideSpinner() {
    if (dom.loadingSpinner) {
        dom.loadingSpinner.classList.add('hidden');
    }
}

export function toggleSidebar() {
    if(dom.sidebar && dom.menuOverlay && dom.menuToggle) {
        dom.sidebar.classList.toggle('active');
        dom.menuOverlay.classList.toggle('active');
        dom.menuToggle.classList.toggle('active');
    } else {
         console.error("Erro ao alternar sidebar: Elementos do DOM ausentes.");
    }
}

export function closeSidebar() {
     if(dom.sidebar && dom.menuOverlay && dom.menuToggle) {
        dom.sidebar.classList.remove('active');
        dom.menuOverlay.classList.remove('active');
        dom.menuToggle.classList.remove('active');
     }
}


export function updateClanStyles(activeClan = 'home') {

    if (dom.clanCards && dom.clanCards.length > 0) {
        dom.clanCards.forEach(card => {
            const clan = card.dataset.clan;
            if (clan && clanData[clan]) {
                const iconDiv = card.querySelector('.clan-icon');
                if (iconDiv) {
                    iconDiv.style.color = clanData[clan].color;
                }
                card.style.borderTopColor = clanData[clan].color;
            }
        });
    } else {
        // console.warn("Cards de clã na Home não encontrados para estilização."); // Opcional: Log menos verboso
    }


    if (dom.clanButtons && dom.clanButtons.length > 0) {
        dom.clanButtons.forEach(button => {
            const clan = button.dataset.clan;

            button.style.borderLeftColor = 'transparent';
            button.style.color = '';
            button.classList.remove('active');
            button.style.removeProperty('--hover-color');

            if (clan !== 'home' && clanData[clan]) {
                button.style.setProperty('--hover-color', clanData[clan].color);
            }

            if (clan === activeClan) {
                button.classList.add('active');
                if (clan !== 'home' && clanData[clan]) {
                    button.style.borderLeftColor = clanData[clan].color;
                    button.style.color = clanData[clan].color;
                } else if (clan === 'home') {
                     button.style.borderLeftColor = 'var(--primary-color)';
                     button.style.color = 'var(--primary-color)';
                }
            }
        });
    } else {
        console.warn("Botões de clã da sidebar não encontrados para estilização.");
    }


    if (dom.clanTitle && dom.clanElementsTag) {
        if (activeClan !== 'home' && clanData[activeClan]) {
             // Verifica se os elementos existem antes de tentar acessá-los
             if (dom.clanTitle) dom.clanTitle.style.color = clanData[activeClan].color;
             if (dom.clanElementsTag) {
                 dom.clanElementsTag.textContent = clanData[activeClan].elements;
                 dom.clanElementsTag.style.backgroundColor = `${clanData[activeClan].color}20`;
                 dom.clanElementsTag.style.color = clanData[activeClan].color;
                 dom.clanElementsTag.style.borderColor = clanData[activeClan].color;
                 dom.clanElementsTag.style.display = 'inline-block';
             }
        } else {
             if (dom.clanTitle) dom.clanTitle.style.color = '';
             if (dom.clanElementsTag) dom.clanElementsTag.style.display = 'none';
        }
    }
    // Adicionado verificação para clanHeader existir antes de tentar acessar seus filhos
    else if (dom.clanHeader && activeClan === 'home') {
         if (dom.clanTitle) dom.clanTitle.style.color = '';
         if (dom.clanElementsTag) dom.clanElementsTag.style.display = 'none';
    } else if (activeClan !== 'home'){
        // console.warn("Título ou tag de elementos do clã não encontrados para estilização."); // Opcional: Log menos verboso
    }
}



export function checkScreenSize() {
    if (window.innerWidth >= 768) {
        if (dom.sidebar && dom.sidebar.classList.contains('active')) {
           closeSidebar();
        }
    }
}


export function displayError(message) {
    console.error("Erro Aplicação:", message);
    // Mantém o alert para erros, conforme solicitado
    alert(`Erro: ${message}`);
}


export function displaySuccess(message) {
    console.log("Sucesso:", message);
    // REMOVIDO o alert para mensagens de sucesso
    // alert(message);
    // Você pode adicionar aqui uma lógica para mostrar a mensagem de forma não bloqueante,
    // como um toast ou uma barra de notificação, se desejar no futuro.
}


export function formatBrazilianDate(isoString) {

    // Removidos os console.log internos desta função para diminuir o ruído no console
    // console.log(`Formatando data ISO recebida: ${isoString}`);

    if (!isoString) return 'Data indisponível';
    try {
        const date = new Date(isoString);

        if (isNaN(date.getTime())) {
             const oldFormatMatch = isoString.match(/(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}:\d{2}:\d{2})/);
             if (oldFormatMatch) {
                 // console.warn(`Data em formato antigo detectada: ${isoString}. Exibindo como está.`);
                 return `${oldFormatMatch[1]}/${oldFormatMatch[2]}/${oldFormatMatch[3]} ${oldFormatMatch[4]}`;
             }
             console.warn("Data inválida ou formato irreconhecível recebido:", isoString);
             return 'Data inválida';
        }

        // console.log(`Data convertida para objeto Date:`, date, `Timestamp (ms): ${date.getTime()}`);

        const options = {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            timeZone: 'America/Sao_Paulo', // Fuso horário de São Paulo
            hour12: false
        };
        const formattedDate = new Intl.DateTimeFormat('pt-BR', options).format(date);

        // console.log(`Data formatada para ${options.timeZone}: ${formattedDate}`);

        return formattedDate.replace(',', ''); // Remove a vírgula que o Intl pode adicionar entre data e hora
    } catch (error) {
        console.error("Erro ao formatar data ISO:", isoString, error);
        return 'Erro na data';
    }
}