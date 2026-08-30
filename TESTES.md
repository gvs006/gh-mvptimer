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
/g/zz-teste     membro: ifrit-farao-farao-11
```

O `zz-` no começo mantém ela no fim do seletor da home, longe das reais.
