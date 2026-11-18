# Integração: check-in do app do dojo no Gestão de Treinos

Para o desenvolvedor do app do dojo. Quando um aluno faz check-in numa aula no app do dojo, o servidor do dojo avisa o Gestão de Treinos, e o check-in de Jiu Jitsu aparece sozinho na conta do aluno.

## O que fazer no app do dojo

1. **Campo no perfil do aluno:** "Código do Gestão de Treinos" (texto, opcional). O aluno gera o código no Gestão de Treinos, em Você → Integrações → Conectar (formato `GT-XXXX-XXXX`), e cola aqui uma vez. Guarde o código como foi digitado; maiúsculas, espaços e traços não importam.
2. **Depois de cada check-in** de um aluno com esse código, o **servidor** do dojo faz a chamada abaixo. Não faça a chamada pelo navegador ou pelo celular do aluno: a chave do dojo não pode ficar no app.
3. **Se der erro de rede ou 5xx**, tente de novo mais tarde (ex.: 1 min, 5 min, 30 min). Repetir é seguro: o mesmo `id_externo` nunca entra duas vezes.

## A chamada

```
POST https://<projeto>.supabase.co/functions/v1/checkin-externo
Content-Type: application/json
x-api-key: <chave do dojo>
```

```json
{
  "codigo": "GT-ABCD-2345",
  "id_externo": "id do check-in no app do dojo",
  "inicio": "2026-11-17T19:00:00-03:00",
  "fim": "2026-11-17T20:30:00-03:00"
}
```

| Campo | Obrigatório | Como |
|---|---|---|
| `codigo` | sim | O código que o aluno colou no perfil |
| `id_externo` | sim | Id único do check-in no app do dojo (texto ou número, até 100 caracteres) |
| `inicio` | sim | Data e hora da aula **com fuso** (`-03:00` ou `Z`), ISO 8601 |
| `fim` | não | Fim da aula, com fuso, até 6 h depois do início. Sem ele, vale a duração padrão do Jiu Jitsu |

O endereço do projeto e a chave do dojo são enviados à parte, nunca por este documento. Há um endereço e uma chave para testes e outros para produção.

## Respostas

O corpo vem sempre como `{ "resultado": "..." }`.

| HTTP | `resultado` | O que fazer |
|---|---|---|
| 201 | `criado` | Pronto |
| 200 | `duplicado` | Já estava registrado (mesmo `id_externo`, ou o aluno já tinha feito o check-in de jiu no Gestão de Treinos perto desse horário). Nada a fazer |
| 401 | `chave_invalida` | Confira o header `x-api-key` |
| 404 | `codigo_invalido` | O código não existe ou o aluno desconectou ou gerou outro. Não tente de novo; se quiser, avise o aluno para colar o código novo |
| 403 | `nao_liberado` | A conta do aluno ainda não foi liberada no Gestão de Treinos. Não tente de novo |
| 422 | `dados_invalidos` | Algum campo veio errado (ex.: `inicio` sem fuso, data no futuro). Corrija antes de tentar de novo |
| 405 | `metodo` | Use POST |
| 500 | `erro` | Tente de novo mais tarde |

## Exemplo

```bash
curl -s -X POST "https://<projeto>.supabase.co/functions/v1/checkin-externo" \
  -H "Content-Type: application/json" \
  -H "x-api-key: <chave do dojo>" \
  -d '{"codigo":"GT-ABCD-2345","id_externo":"aula-123","inicio":"2026-11-17T19:00:00-03:00"}'
```

## Privacidade

O Gestão de Treinos só **recebe** o check-in (data e horário da aula). Nada volta para o app do dojo, e o dojo não precisa mandar nome, e-mail ou outro dado do aluno.
