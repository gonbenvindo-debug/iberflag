-- Rename fly banner slugs from size-based format to height-based format.

update public.produtos
set slug = case slug
    when 'fly-banner-drop-75-x-194-cm' then 'fly-banner-drop-245cm'
    when 'fly-banner-drop-92-x-228-cm' then 'fly-banner-drop-300cm'
    when 'fly-banner-drop-103-x-298-cm' then 'fly-banner-drop-350cm'
    when 'fly-banner-drop-132-x-352-cm' then 'fly-banner-drop-440cm'
    when 'fly-banner-drop-145-x-446-cm' then 'fly-banner-drop-540cm'
    when 'fly-banner-surf-55-x-226-cm' then 'fly-banner-surf-290cm'
    when 'fly-banner-surf-65-x-272-cm' then 'fly-banner-surf-340cm'
    when 'fly-banner-surf-75-5-x-351-cm' then 'fly-banner-surf-400cm'
    when 'fly-banner-surf-75-5-x-417-cm' then 'fly-banner-surf-500cm'
    when 'fly-banner-surf-90-x-516-cm' then 'fly-banner-surf-600cm'
    else slug
end
where slug in (
    'fly-banner-drop-75-x-194-cm',
    'fly-banner-drop-92-x-228-cm',
    'fly-banner-drop-103-x-298-cm',
    'fly-banner-drop-132-x-352-cm',
    'fly-banner-drop-145-x-446-cm',
    'fly-banner-surf-55-x-226-cm',
    'fly-banner-surf-65-x-272-cm',
    'fly-banner-surf-75-5-x-351-cm',
    'fly-banner-surf-75-5-x-417-cm',
    'fly-banner-surf-90-x-516-cm'
);
