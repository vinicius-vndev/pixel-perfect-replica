# DetailHub: correções e configurações

## O que mudou
- Um pedido com telefone existente não altera o nome cadastrado. Nome e telefone declarados ficam no pedido; reservas antigas não são reescritas.
- Os horários oferecidos e aceitos usam a abertura como referência, inclusive 08:15 e 08:10.
- A gravação rejeita datas nulas, passadas e posteriores ao dia local atual + 90 dias.
- Consultas com falha mostram erro e “Tentar novamente”, em vez de parecerem listas vazias.
- Reservas públicas não podem mais ser criadas diretamente pela RPC. O envio passa por verificação antirrobô no servidor.
- Os contadores são atômicos e persistentes: cinco tentativas por hora por estética e dez por hora entre estéticas, por credencial de navegador verificada. Tentativas inválidas também consomem quota; reenvios já concluídos com mesma credencial/chave não criam outra reserva.
- O bucket de imagens continua privado; imagens comerciais são acessadas por URLs assinadas. Limite de 5 MB e MIME JPG/PNG/WEBP no servidor. Escrita exige participação na estética do caminho; atualização também valida destino e formato.
- A proteção GiST contra sobreposição foi preservada.

## Configuração externa obrigatória
1. Crie um widget Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/get-started/.
2. Autorize os nomes de domínio usados pelo site e pela prévia. A validação exige o hostname exato e a ação `booking`.
3. Cadastre `TURNSTILE_SITE_KEY` (chave pública do widget) e `TURNSTILE_SECRET_KEY` (chave secreta) nos segredos do Lovable Cloud, sem colar a chave secreta no chat.
4. `BOOKING_COOKIE_SECRET` já foi gerado e armazenado com segurança.
5. Após configurar, publique a versão atual e teste uma reserva completa. Enquanto faltarem as chaves, o envio fica bloqueado; a consulta e o painel continuam funcionando.

## Limitações explícitas
- Credencial de navegador não é uma identidade de pessoa ou um IP verificado. Apagar cookies ou usar outro navegador pode gerar nova quota após uma nova verificação Turnstile. Não usamos IP fornecido pelo navegador nem presumimos confiança em cabeçalhos de proxy sem garantia documentada da hospedagem.
- Os limites usam janelas por hora, não uma janela deslizante. Turnstile reduz automação, mas não oferece segurança total.
- A limpeza periódica dos contadores antigos ainda não está agendada; não apague a janela corrente. Planeje uma rotina administrativa de retenção antes de grande volume.
- MIME e tamanho não substituem análise antivírus ou decodificação real de imagens.
- Testes locais usam PostgreSQL real e equivalentes mínimos de Auth/Storage; não substituem testes do serviço de upload hospedado e de Turnstile em produção.
- O fluxo completo de envio no navegador não foi validado: faltam as chaves Turnstile e a estética atual não tem serviço ativo. Nenhum cadastro/serviço fictício foi criado na conta real.

## Testes reproduzíveis
Use exclusivamente um banco temporário vazio; nunca produção.
```sh
psql "$DETAILHUB_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f src/test/database-bootstrap.sql \
  -f drizzle/migrations/0000_migration.sql \
  -f drizzle/migrations/0001_harden_booking_integrity_and_media.sql
DETAILHUB_TEST_DATABASE_URL="postgres://usuario@localhost:55432/postgres" \
  bunx vitest run src/test/booking.database.test.ts src/lib/detailhub.test.ts src/test/app-routing.test.tsx
bunx eslint .
```
Sem `DETAILHUB_TEST_DATABASE_URL`, os testes de banco são marcados como ignorados, não como aprovados.