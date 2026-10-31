-- Doña Lupita · instalación segura en proyecto Supabase Zenix Sites
-- Publico: lectura de carta. Solo usuarios expresamente autorizados: edicion.
create table if not exists public.dona_lupita_catalog (
  id integer primary key check (id = 1),
  content jsonb not null check (jsonb_typeof(content->'menu') = 'object' and jsonb_typeof(content->'site') = 'object'),
  updated_at timestamptz not null default now()
);
create table if not exists public.dona_lupita_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.dona_lupita_catalog enable row level security;
alter table public.dona_lupita_admins enable row level security;
revoke all on public.dona_lupita_catalog from anon, authenticated;
revoke all on public.dona_lupita_admins from anon, authenticated;
grant select on public.dona_lupita_catalog to anon, authenticated;
grant update on public.dona_lupita_catalog to authenticated;
grant select on public.dona_lupita_admins to authenticated;
create policy "dona_lupita_catalog_read" on public.dona_lupita_catalog
  for select to anon, authenticated using (true);
create policy "dona_lupita_admin_self" on public.dona_lupita_admins
  for select to authenticated using (user_id = (select auth.uid()));
create policy "dona_lupita_catalog_admin_update" on public.dona_lupita_catalog
  for update to authenticated
  using (exists (select 1 from public.dona_lupita_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.dona_lupita_admins a where a.user_id = (select auth.uid())));
insert into public.dona_lupita_catalog(id, content)
values (1, '{
  "version": 1,
  "updatedAt": "2026-10-31",
  "site": {
    "businessName": "Doña Lupita",
    "address": "Don Bosco 314, esquina Gobernador Paz, Ushuaia",
    "phone": "2901437675",
    "mobile": "2901559998",
    "whatsapp": "5492901535229",
    "whatsappVerified": false,
    "email": "lupitapizzas@hotmail.com.ar",
    "instagram": "https://www.instagram.com/lupitaushuaia/",
    "notice": "Carta orientativa: consultá disponibilidad y precio final con el local.",
    "openingLunch": "12:00",
    "closingLunch": "15:00",
    "openingDinner": "20:00",
    "closingDinner": "00:00",
    "closedSunday": true
  },
  "menu": {
    "empanadas": [
      {
        "name": "Carne cortada a cuchillo",
        "desc": "Corte tradicional, uno de los sabores mencionados por NASA.",
        "tag": "Clásico",
        "price": null,
        "enabled": true
      },
      {
        "name": "Matambre",
        "desc": "Especialidad de la casa mencionada en la historia de NASA.",
        "tag": "De la casa",
        "price": null,
        "enabled": true
      },
      {
        "name": "Cordero",
        "desc": "Sabor regional de Tierra del Fuego.",
        "tag": "Patagónica",
        "price": null,
        "enabled": true
      },
      {
        "name": "Pollo",
        "desc": "Relleno clásico de pollo.",
        "tag": "Clásico",
        "price": null,
        "enabled": true
      },
      {
        "name": "Roquefort",
        "desc": "Queso azul de sabor intenso.",
        "tag": "Quesos",
        "price": null,
        "enabled": true
      },
      {
        "name": "Jamón y queso",
        "desc": "Un favorito tradicional.",
        "tag": "Clásico",
        "price": null,
        "enabled": true
      },
      {
        "name": "Cebolla y queso",
        "desc": "Para quienes prefieren un relleno suave.",
        "tag": "Vegetariana",
        "price": null,
        "enabled": true
      },
      {
        "name": "Mariscos",
        "desc": "Consultar disponibilidad del día.",
        "tag": "Regional",
        "price": null,
        "enabled": true
      },
      {
        "name": "Otros sabores",
        "desc": "Consultá por todas las variedades disponibles.",
        "tag": "Consultar",
        "price": null,
        "enabled": true
      }
    ],
    "pizzas": [
      {
        "name": "Muzzarella",
        "desc": "La clásica con muzzarella.",
        "tag": "Clásica",
        "price": null,
        "enabled": true
      },
      {
        "name": "Jamón y huevo",
        "desc": "Una combinación tradicional para compartir.",
        "tag": "Popular",
        "price": null,
        "enabled": true
      },
      {
        "name": "Cuatro quesos",
        "desc": "Combinación de quesos.",
        "tag": "Quesos",
        "price": null,
        "enabled": true
      },
      {
        "name": "Napolitana",
        "desc": "Tomate y muzzarella.",
        "tag": "Clásica",
        "price": null,
        "enabled": true
      },
      {
        "name": "Calabresa",
        "desc": "Con el sabor característico de la calabresa.",
        "tag": "Intensa",
        "price": null,
        "enabled": true
      },
      {
        "name": "Fugazzetta",
        "desc": "Cebolla y queso.",
        "tag": "Clásica",
        "price": null,
        "enabled": true
      },
      {
        "name": "Pizza de la casa",
        "desc": "Consultá por las variedades especiales.",
        "tag": "Consultar",
        "price": null,
        "enabled": true
      }
    ],
    "cocina": [
      {
        "name": "Milanesas",
        "desc": "Opciones de cocina argentina.",
        "tag": "Casero",
        "price": null,
        "enabled": true
      },
      {
        "name": "Pastas",
        "desc": "Consultá las variedades del día.",
        "tag": "Casero",
        "price": null,
        "enabled": true
      },
      {
        "name": "Sándwiches y lomitos",
        "desc": "Opciones de cocina rápida.",
        "tag": "Para llevar",
        "price": null,
        "enabled": true
      },
      {
        "name": "Hamburguesas",
        "desc": "Consultá disponibilidad.",
        "tag": "Consultar",
        "price": null,
        "enabled": true
      }
    ],
    "paraCompartir": [
      {
        "name": "Docena de empanadas",
        "desc": "Elegí los sabores disponibles.",
        "tag": "Grupo",
        "price": null,
        "enabled": true
      },
      {
        "name": "Media docena de empanadas",
        "desc": "Combiná tus variedades favoritas.",
        "tag": "Variado",
        "price": null,
        "enabled": true
      },
      {
        "name": "Pizza + empanadas",
        "desc": "Armá tu combinación.",
        "tag": "Combo",
        "price": null,
        "enabled": true
      },
      {
        "name": "Pedido para grupo",
        "desc": "Consultá por pedidos grandes.",
        "tag": "Consultar",
        "price": null,
        "enabled": true
      }
    ]
  }
}'::jsonb)
on conflict (id) do nothing;
-- Tras verificar el correo del usuario creado en /admin, el propietario ejecuta:
-- insert into public.dona_lupita_admins(user_id)
-- select id from auth.users where email = 'CORREO_AUTORIZADO'
-- on conflict (user_id) do nothing;
