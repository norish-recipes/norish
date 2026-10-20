---
sidebar_position: 3
title: Use o Norish offline
description: Como usar o Norish offline.
---

# Use o Norish offline

O app web do Norish mantém um cache offline no seu dispositivo, para continuar
funcionando quando o servidor não pode ser acessado. O cache guarda:

- suas 50 receitas mais recentes
- todos os livros de receitas que você pode ver e as receitas de cada um
- compras, compras recorrentes e lojas
- o calendário em torno de hoje

O restante do que você abriu enquanto estava online costuma ficar no cache até
você fechar o app.

Páginas que não estão no cache mostram o seguinte:

![A tela de conteúdo indisponível offline](/img/screenshots/offline-unavailable.png)

## Ver o que está guardado {#seeing-what-is-stored}

Abra o menu do usuário e selecione o indicador **Conectado** ou **Offline** na
parte de baixo. A janela mostra o que este dispositivo guardou.

![Status da conexão e do modo offline no Norish](/img/screenshots/offline-status-modal.png)

**Limpar dados em cache** remove o cache offline e mantém suas alterações na
fila.

## Alterações feitas offline {#changes-made-offline}

As alterações que você faz offline ficam na fila e aparecem como
**Na fila**. O Norish as envia quando o servidor volta. Você não precisa manter
a página aberta.

Uma alteração na fila pode ter os seguintes estados:

- **Sincronizando**: a alteração está aguardando envio ou sendo enviada.
- **Requer atenção**: o envio falhou várias vezes e o Norish parou de tentar.
- **Conflito**: a mesma coisa foi alterada antes no servidor. Confira e tente
  de novo se ainda quiser a sua alteração.

**Sincronizar agora**, na janela, envia tudo na hora. **Tentar todas
novamente** reenvia as alterações que requerem atenção ou estão em conflito.
**Descartar todas** apaga todas as alterações na fila.

## Contas e dispositivos compartilhados {#accounts-and-shared-devices}

O cache offline e a fila pertencem à conta conectada naquele
navegador. Sair da conta descarta as alterações não enviadas e limpa o cache
offline.
