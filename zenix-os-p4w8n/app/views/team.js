import { h, mount, banner, busy, toast } from '../lib/dom.js';
import { db, getSession } from '../lib/api.js';
import { ROLE_LABEL } from '../lib/roles.js';
import { shell } from './shell.js';

function inviteLink(code) {
  return `${location.origin}${location.pathname}#/unirme/${code}`;
}

function fmtDate(ts, tz) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts));
}

export async function teamView(ctx) {
  const { org } = ctx.state;
  const me = getSession()?.user?.id;
  const status = h('div', { class: 'form-status' });
  const members = h('div', { class: 'list' }, h('div', { class: 'skeleton row' }));
  const invites = h('div', { class: 'list' });
  const newInvite = h('div', {});

  const roleSel = h('select', { id: 'inv-role', 'aria-label': 'Rol de la persona invitada' },
    h('option', { value: 'vendedor' }, 'Vendedor: vende y carga clientes'),
    h('option', { value: 'supervisor' }, 'Supervisor: además maneja productos y stock'),
  );
  const inviteBtn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Generar invitación');
  inviteBtn.addEventListener('click', async () => {
    mount(status);
    try {
      const inv = await busy(inviteBtn, () => db.rpc('create_invitation', { p_role: roleSel.value }), 'Generando…');
      showInvite(inv);
      loadInvites();
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });

  function showInvite(inv) {
    const link = inviteLink(inv.code);
    const text = `Te invito a sumarte a ${org.name} en Zenix OS como ${ROLE_LABEL[inv.role].toLowerCase()}. Entrá acá: ${link} (código ${inv.code}, vence el ${fmtDate(inv.expires_at, org.timezone)}).`;
    newInvite.replaceChildren(h('div', { class: 'invite-box' },
      h('span', { class: 'small' }, `Invitación para ${ROLE_LABEL[inv.role].toLowerCase()} · vence el ${fmtDate(inv.expires_at, org.timezone)}`),
      h('span', { class: 'invite-code' }, inv.code),
      h('div', { class: 'invite-actions' },
        h('a', { class: 'btn btn-primary btn-sm', href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener' }, 'Enviar por WhatsApp'),
        h('button', {
          type: 'button', class: 'btn btn-secondary btn-sm',
          onclick: async () => { try { await navigator.clipboard.writeText(link); toast('Enlace copiado'); } catch { toast('No se pudo copiar'); } },
        }, 'Copiar enlace'),
      ),
      h('p', { class: 'hint' }, 'Sirve para una sola persona. Si no la usa en 7 días, vence.'),
    ));
  }

  async function loadMembers() {
    try {
      const rows = await db.select('organization_members', 'select=user_id,role,email,active,created_at&order=created_at.asc');
      members.replaceChildren(...rows.map((m) => {
        const isMe = m.user_id === me;
        const sel = h('select', { 'aria-label': `Rol de ${m.email || 'este miembro'}`, disabled: isMe },
          Object.entries(ROLE_LABEL).map(([k, t]) => h('option', { value: k, selected: k === m.role }, t)));
        const toggle = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', hidden: isMe }, m.active ? 'Desactivar' : 'Activar');
        const save = async (role, active) => {
          try {
            await db.rpc('update_member', { p_user: m.user_id, p_role: role, p_active: active });
            toast('Equipo actualizado');
            loadMembers();
          } catch (err) {
            mount(status, banner('error', err.message));
            loadMembers();
          }
        };
        sel.addEventListener('change', () => save(sel.value, m.active));
        toggle.addEventListener('click', () => save(m.role, !m.active));
        return h('div', { class: 'row-item' },
          h('span', { class: 'avatar', 'aria-hidden': 'true' }, (m.email || '?')[0].toUpperCase()),
          h('span', { class: 'row-main' },
            h('span', { class: 'row-title' }, m.email || 'Sin email', isMe ? ' (vos)' : ''),
            h('span', { class: 'row-sub' }, m.active ? `Desde ${fmtDate(m.created_at, org.timezone)}` : 'Desactivado: no puede entrar'),
          ),
          h('span', { class: 'member-actions' }, sel, toggle),
        );
      }));
    } catch (err) {
      members.replaceChildren(banner('error', err.message));
    }
  }

  async function loadInvites() {
    try {
      const rows = await db.select('invitations', 'select=id,code,role,expires_at,used_at,revoked&order=created_at.desc&limit=20');
      const pending = rows.filter((r) => !r.used_at && !r.revoked && new Date(r.expires_at) > new Date());
      invites.replaceChildren(...(pending.length ? pending.map((r) => {
        const revoke = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Revocar');
        revoke.addEventListener('click', async () => {
          try {
            await busy(revoke, () => db.rpc('revoke_invitation', { p_id: r.id }), '…');
            toast('Invitación revocada');
            loadInvites();
          } catch (err) {
            mount(status, banner('error', err.message));
          }
        });
        return h('div', { class: 'row-item' },
          h('span', { class: 'row-main' },
            h('span', { class: 'row-title', style: 'font-family:var(--mono);letter-spacing:.1em' }, r.code),
            h('span', { class: 'row-sub' }, `${ROLE_LABEL[r.role]} · vence el ${fmtDate(r.expires_at, org.timezone)}`),
          ),
          revoke,
        );
      }) : [h('p', { class: 'muted pad' }, 'No hay invitaciones pendientes.')]));
    } catch (err) {
      invites.replaceChildren(banner('error', err.message));
    }
  }

  shell(ctx, { section: 'equipo', title: 'Equipo' },
    status,
    h('section', { class: 'card stack' },
      h('h2', {}, 'Invitar a alguien'),
      h('p', { class: 'muted' }, 'Generá un código y mandáselo. La persona crea su cuenta y entra directo a tu negocio con el rol que elijas.'),
      h('div', { class: 'toolbar' }, roleSel, inviteBtn),
      newInvite,
    ),
    h('section', { class: 'stack-sm' }, h('h2', {}, 'Personas'), members),
    h('section', { class: 'stack-sm' }, h('h2', {}, 'Invitaciones pendientes'), invites),
  );
  loadMembers();
  loadInvites();
}
