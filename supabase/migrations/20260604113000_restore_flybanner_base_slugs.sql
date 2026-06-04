-- Restore canonical flybanner slugs for bases that were edited while the admin
-- UI regenerated slugs from the display name, causing them to disappear from
-- the Flybanner catalog views.

update public.bases_fixacao
set slug = 'flybanner-base-hercules-12kg'
where id = 21
  and slug = 'base-hercules-12kg'
  and not exists (
    select 1
    from public.bases_fixacao as other_base
    where other_base.slug = 'flybanner-base-hercules-12kg'
      and other_base.id <> 21
  );

update public.bases_fixacao
set slug = 'flybanner-base-agua'
where id = 22
  and slug = 'base-de-agua'
  and not exists (
    select 1
    from public.bases_fixacao as other_base
    where other_base.slug = 'flybanner-base-agua'
      and other_base.id <> 22
  );

update public.bases_fixacao
set slug = 'flybanner-base-deluxe-4kg'
where id = 23
  and slug = 'base-deluxe-4-kg'
  and not exists (
    select 1
    from public.bases_fixacao as other_base
    where other_base.slug = 'flybanner-base-deluxe-4kg'
      and other_base.id <> 23
  );
