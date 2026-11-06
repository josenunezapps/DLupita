-- CotizaPro · 0002_color_por_defecto
-- El color de marca por defecto pasa a ser el acento de CotizaPro (terracota) en vez de violeta.
-- Solo cambia el valor por defecto de negocios nuevos; no toca negocios existentes.
alter table public.organizations alter column brand_color set default '#C2410C';
