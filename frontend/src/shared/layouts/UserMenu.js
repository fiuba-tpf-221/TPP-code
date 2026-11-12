import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { ROUTES } from '../../config/routes';
import Icon from '../components/icons';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const handleLogout = async () => {
    await logout(); // invalida solo esta sesión
    navigate(ROUTES.LOGIN, { replace: true });
  };

  return (
    <div className="usermenu" ref={ref}>
      <button type="button" className="usermenu__button" aria-expanded={open} aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}>
        {user?.name} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="usermenu__list" role="menu">
          <Link to={ROUTES.PROFILE} role="menuitem" onClick={() => setOpen(false)}><Icon name="profile" /> Mi perfil</Link>
          <button type="button" role="menuitem" onClick={handleLogout}><Icon name="system" /> Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}
