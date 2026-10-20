---
sidebar_position: 6
title: Procedência da receita
description: De onde vem uma receita, com o país, a região e as culinárias.
---

# Procedência da receita

A procedência diz de onde vem uma receita. O Norish registra:

- **País**
- **Região**, quando o prato pertence a uma
- **Culinárias**, uma ou mais
- **Nota**, algumas frases sobre como o Norish chegou a essa conclusão

A bandeira do país aparece antes do título da receita e ao lado da receita no
seu painel.

![A procedência em uma página de receita](/img/screenshots/provenance-recipe.png)

O nome do país e a nota ficam no idioma da receita, não no seu. Uma receita
holandesa de um prato turco diz _Turkije_. A nota nunca é traduzida.

Quando vários países reivindicam um prato, o Norish escolhe o que tem mais
argumentos e cita os outros na nota.

## Culinárias {#cuisines}

As culinárias vêm de uma lista que o administrador mantém em
**Configurações => Admin => IA e processamento => Culinárias**. O Norish já vem
com uma lista inicial.

![Gerenciando o vocabulário de culinárias nas configurações de administração](/img/screenshots/admin-cuisines.png)

- Renomear uma culinária muda o nome dela em todas as receitas.
- Excluir uma culinária a remove de todas as receitas. Notas antigas ainda podem
  citá-la.
- Os nomes das culinárias aparecem como foram escritos, em todos os idiomas.
  Renomeie-os para usar o seu idioma.

A [estratégia de culinárias](/configuration/ai-provider#cuisine-strategy)
decide se a IA pode acrescentar culinárias à lista. Por padrão, ela só pode
escolher entre as que já existem.

## Como executar {#running-it}

- O administrador pode ativar **Procedência da receita** para receitas novas em
  **Configurações => Admin => IA e processamento**. Vem desligado por padrão.
- **Descobrir a procedência**, no menu de ações da receita, executa a qualquer
  momento e substitui de uma vez o país, a região, as culinárias e a nota.

Uma execução automática só preenche o que falta e mantém o que você ou a fonte
informaram. Uma receita com país, nota e pelo menos uma culinária fica como
está.

![Editando a procedência no formulário da receita](/img/screenshots/provenance-form.png)

:::note
Apagar a procedência não inicia uma execução automática. Execute você mesmo, ou
o **Enriquecer todas as receitas** de um administrador preenche esses dados.
:::
