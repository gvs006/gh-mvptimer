# Regras de teste contra o banco

Escritas depois de um incidente real: um script de teste terminava com
`delete()` para limpar o que ele mesmo criou, e apagou **13 timers reais da
BloodFalls**. Os horários não foram recuperáveis — o free tier do Supabase não
tem point-in-time recovery.

O erro de raiz não foi o `delete`. Foi ter verificado que o banco estava vazio
**antes** e tratado isso como verdade permanente. Entre a verificação e o
teste, a guilda começou a usar. Banco compartilhado muda sozinho.

## As regras

**1. Teste sempre na guilda `zz-teste`, nunca na guilda real.**
Ela existe para isso, é isolada por `guild_id`, e nada nela importa.

**2. Nenhum `delete` sem `guild_id` no filtro.**
`delete().neq('mvp_id', 0)` apaga a tabela inteira, de todas as guildas. O
filtro por guilda tem que estar em toda escrita destrutiva:

```js
await db.from('timers').delete().eq('guild_id', GUILD_DE_TESTE)
```

**3. Antes de qualquer escrita destrutiva, conte o que vai sumir.**
Se o número não for o que o teste criou, pare — tem dado de gente ali.

**4. "Estava vazio quando olhei" não é garantia.**
A verificação e o `delete` são momentos diferentes, e alguém pode ter marcado
um MVP no meio. A proteção é o filtro, não a observação.

## Guilda de teste

```
/g/zz-teste
```

**As senhas não ficam aqui.** Este repositório é público, e senha em README é
senha vazada — mesmo a de uma guilda descartável, porque quem achar pode
escrever nela e sujar os testes de outra pessoa.

Elas ficam em `.env.local.testes`, que o `.gitignore` cobre. Para (re)definir:

```bash
npm run guild:senha -- zz-teste membro "<uma senha>"
npm run guild:senha -- zz-teste admin  "<outra senha>"
```

> Nota histórica: a primeira versão deste arquivo trazia a senha de membro no
> texto e foi commitada assim. Aquela senha já foi trocada e não vale mais, mas
> continua no histórico do git — motivo de sobra para não repetir.

O prefixo `zz-` a mantém **fora** do seletor da home (`/api/guilds` filtra por
ele). Ela continua existindo e acessível pela URL direta — que é o que os
testes usam —, só não aparece para quem é jogador de verdade.
