-- =====================================================================
-- Otimização de desempenho da RLS de payment_requests
-- STATUS: APLICADO em 2026-11-16 (autorizado pelo usuário), migração
--         "rls_performance_payment_requests". O banco é o mesmo usado por
--         localhost e produção.
--         Verificação pós-aplicação com o papel real "authenticated": os 28
--         usuários veem exatamente as mesmas solicitações de antes
--         (0 diferenças); varredura com RLS: média 2,4 ms, máx. 4,5 ms.
-- =====================================================================
--
-- PROBLEMA
--   As policies de SELECT/UPDATE chamam can_access_payment_request(...) para
--   CADA linha. A função é SECURITY DEFINER (não pode ser incorporada à query)
--   e, a cada linha, executa is_active_user() (JOIN em auth.users),
--   get_my_role() e get_my_sector(). Medido em 2026-11-16 com 475 linhas:
--     - varredura com a função:  ~380 ms a ~1.400 ms por consulta
--     - varredura sem a função:  ~1,5 ms
--   Como o app consulta a tabela milhares de vezes por hora (polling + realtime),
--   as leituras ficaram com média de 2,4 s e picos de até 28 s.
--
-- SOLUÇÃO
--   Mesma regra de acesso, mas os valores que dependem só do usuário logado
--   (ativo?, papel, id, membros do setor) passam a ser calculados UMA vez por
--   consulta, via (select ...), em vez de uma vez por linha.
--
-- EQUIVALÊNCIA VERIFICADA (somente leitura, 2026-11-16)
--   Comparação regra atual x regra nova para os 28 usuários x 475 solicitações
--   (13.300 combinações): 0 divergências. Tempo total: 40.445 ms -> 64 ms.
--
-- O QUE NÃO MUDA
--   - Quem pode ver/alterar cada solicitação (regra idêntica).
--   - A policy de INSERT e a função can_access_payment_request (continua
--     existindo; outras partes do sistema podem usá-la).
-- =====================================================================

begin;

-- 1) Helper: ids dos perfis do mesmo setor do usuário logado (array vazio se sem setor).
create or replace function public.get_my_sector_member_ids()
returns uuid[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profiles p
  where public.get_my_sector() is not null
    and p.sector::text = public.get_my_sector();
$$;

revoke all on function public.get_my_sector_member_ids() from public;
revoke all on function public.get_my_sector_member_ids() from anon;
grant execute on function public.get_my_sector_member_ids() to authenticated, service_role;

-- 2) SELECT: mesma regra, avaliada uma vez por consulta.
alter policy payment_requests_select_authorized on public.payment_requests
using (
  (select public.is_active_user())
  and (
    (select public.get_my_role()) in ('MASTER', 'FINANCEIRO')
    or created_by = (select auth.uid())
    or real_requester_id = (select auth.uid())
    or (
      coalesce(visibility, 'COMPARTILHADA') = 'COMPARTILHADA'
      and (
        created_by = any ((select public.get_my_sector_member_ids())::uuid[])
        or real_requester_id = any ((select public.get_my_sector_member_ids())::uuid[])
      )
    )
  )
);

-- 3) UPDATE: USING e WITH CHECK com a mesma regra.
--    (O WITH CHECK atual é "ativo E (MASTER/FINANCEIRO OU can_access)", que é
--     logicamente igual à expressão abaixo.)
alter policy payment_requests_update_authorized on public.payment_requests
using (
  (select public.is_active_user())
  and (
    (select public.get_my_role()) in ('MASTER', 'FINANCEIRO')
    or created_by = (select auth.uid())
    or real_requester_id = (select auth.uid())
    or (
      coalesce(visibility, 'COMPARTILHADA') = 'COMPARTILHADA'
      and (
        created_by = any ((select public.get_my_sector_member_ids())::uuid[])
        or real_requester_id = any ((select public.get_my_sector_member_ids())::uuid[])
      )
    )
  )
)
with check (
  (select public.is_active_user())
  and (
    (select public.get_my_role()) in ('MASTER', 'FINANCEIRO')
    or created_by = (select auth.uid())
    or real_requester_id = (select auth.uid())
    or (
      coalesce(visibility, 'COMPARTILHADA') = 'COMPARTILHADA'
      and (
        created_by = any ((select public.get_my_sector_member_ids())::uuid[])
        or real_requester_id = any ((select public.get_my_sector_member_ids())::uuid[])
      )
    )
  )
);

commit;

-- =====================================================================
-- ROLLBACK (volta exatamente ao estado anterior)
-- =====================================================================
-- begin;
-- alter policy payment_requests_select_authorized on public.payment_requests
--   using (public.can_access_payment_request(created_by, real_requester_id, visibility));
-- alter policy payment_requests_update_authorized on public.payment_requests
--   using (public.can_access_payment_request(created_by, real_requester_id, visibility))
--   with check (
--     public.is_active_user()
--     and (
--       public.get_my_role() = any (array['MASTER'::text, 'FINANCEIRO'::text])
--       or public.can_access_payment_request(created_by, real_requester_id, visibility)
--     )
--   );
-- drop function if exists public.get_my_sector_member_ids();
-- commit;
