-- Permite um horário de funcionamento ser específico de um profissional em
-- vez de só do salão inteiro. profissional_id nulo = continua valendo pra
-- todo mundo (comportamento de hoje, sem nenhuma mudança). Puramente
-- informativo, igual ao horário do salão já era — não bloqueia agendamento
-- fora do horário, só ajuda a equipe a visualizar a disponibilidade.

alter table public.horarios_funcionamento
  add column if not exists profissional_id uuid references public.perfis(id) on delete cascade;

create index if not exists horarios_funcionamento_profissional_idx
  on public.horarios_funcionamento (profissional_id);

notify pgrst, 'reload schema';
