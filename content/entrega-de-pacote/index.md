---
title: "Controle PWM na Entrega de Pacote"
author: "Ana Machado e João Fornazeiro"
date: "2026-10-07"
tags: ["drone", "hardware", "pwm", "delivery"]
---

# Controle PWM na Entrega de Pacote

*Como controlamos a garra via software na Task 3 da Black Bee Challenge 2026*

**Missão Realizada por Ana Machado e João Fornazeiro - Equipe Black Bee Drones**

**Documento feito por Ana Machado e João Fornazeiro**

---

Na robótica, o PWM (Pulse Width Modulation) é um conceito fundamental e muito abrangente. O controle dos motores que mantêm nosso drone no ar, por exemplo, depende dessa técnica. Neste artigo, porém, focaremos em uma aplicação mais pontual desse conceito: o acionamento de servomotores.

Primeiro, vamos explicar o funcionamento do controle PWM e, em seguida, demonstrar como aplicamos esse conceito na **Task 2 (Package Delivery)** da Black Bee Challenge 2026. Por fim, finalizaremos com os resultados que obtivemos e o que aprendemos ao desenvolver essa missão.

## O que é o PWM?
PWM, ou Pulse Width Modulation (Modulação por Largura de Pulso), é uma técnica engenhosa para obter valores analógicos (contínuos, com valores intermediários) a partir de sinais digitais (descontínuos, binários).

Sistemas digitais operam em apenas dois estados extremos: ligado (HIGH) ou desligado (LOW). No entanto, muitas aplicações no mundo real precisam de estados intermediários. Se quisermos controlar o brilho de um LED ou a velocidade de rotação das hélices do nosso drone, não podemos simplesmente usar "tudo ou nada". É aí que o PWM entra em cena: ele cria a "ilusão" de um valor intermediário alternando muito rápido entre o estado ligado e o desligado.

O formato desse sinal é definido por duas grandezas principais:
  1. Frequência: A quantidade de vezes que o ciclo de liga/desliga se repete em um segundo, medido em Hertz (Hz).
  2. Duty Cycle (Ciclo de Trabalho): A porcentagem de tempo em que o sinal permanece "ligado" (HIGH) dentro de um único ciclo, em relação ao tempo total.

Por exemplo: se um sinal PWM tem um duty cycle de 50%, ele passa metade do tempo em HIGH e metade em LOW. Desse modo, supondo que o sistema opere em 5V, o componente conectado àquele pino "enxergará" uma tensão média de 2,5V.

<div align="center">
    <img src="assets/duty_cycle_example.png" alt="Comportamento de um sinal PWM operadno em 5V" style="max-width: 400px; width: 100%; height: auto;"/>
</div>

### Servos e o PWM
Quando aplicamos PWM em um LED ou em motores DC convencionais, a variação do duty cycle imita uma variação de energia contínua. No entanto, com servomotores (como o responsável por abrir e fechar a garra que carrega o nosso pacote), a lógica muda.

Nos servos, a placa de controle lê o tempo que o pulso fica em nível HIGH (a largura do pulso) e traduz essa duração em um ângulo específico.

A maioria dos servomotores trabalha em uma frequência fixa de 50 Hz. Isso significa que um pulso é enviado a cada 20 milissegundos (ms). O que determina o ângulo é quanto desses 20 ms o sinal fica ligado:
- Um pulso de 1 ms (duty cycle de ~5%) comanda o servo para a posição 0°.
- Um pulso de 1,5 ms (duty cycle de ~7,5%) comanda o servo para a posição central 90°.
- Um pulso de 2 ms (duty cycle de ~10%) comanda o servo para o limite 180°.


-- colocar algum exemplo de codigo simples aqui

## Aplicando o PWM na missão

### O teste de bancada
explicar como usa o test_servo do nectar

### Configurando a garra
como ficou as config no arquivo de constantes

### O estador Gripper
explicar como funciona o estado

## Resultados no dia da missão
explicar que no dia deu errado, mas por conta do modelo de detecção. nos testes, a garra funcionou perfeitamente

## Conclusão
conclusão uau
