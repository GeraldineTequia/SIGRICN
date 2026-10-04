import {
  AlertTriangle,
  Bell,
  BookOpen,
  ClipboardList,
  DollarSign,
  FileText,
  Flame,
  Gauge,
  HandHeart,
  LayoutGrid,
  Map,
  PieChart,
  Settings,
  Shield,
  ShieldCheck,
  User,
  UserCog,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { Permiso } from '@dominio/reglas/permisos';

export interface ElementoMenu {
  ruta: string;
  texto: string;
  icono: LucideIcon;
  /** Si se indica, el enlace sólo se muestra a quien tenga el permiso (el backend vuelve a validar). */
  permiso?: Permiso;
}

export interface GrupoMenu {
  clave: string;
  titulo: string;
  icono: LucideIcon;
  elementos: ElementoMenu[];
}

/** Estructura de navegación del mockup, con los módulos adicionales exigidos. */
export const GRUPOS_MENU: GrupoMenu[] = [
  {
    clave: 'control',
    titulo: 'Centro de control',
    icono: LayoutGrid,
    elementos: [
      { ruta: '/', texto: 'Dashboard General', icono: Gauge },
      { ruta: '/mapa', texto: 'Mapa en tiempo real', icono: Map },
    ],
  },
  {
    clave: 'crisis',
    titulo: 'Gestión de crisis',
    icono: AlertTriangle,
    elementos: [
      { ruta: '/emergencias', texto: 'Emergencias', icono: Flame },
      { ruta: '/zonas', texto: 'Zonas', icono: UsersRound },
      { ruta: '/personas', texto: 'Población afectada', icono: Users, permiso: 'consultar_informacion_operativa' },
      { ruta: '/necesidades', texto: 'Necesidades', icono: ClipboardList },
    ],
  },
  {
    clave: 'recursos',
    titulo: 'Recursos y logística',
    icono: DollarSign,
    elementos: [
      { ruta: '/fondos', texto: 'Donaciones', icono: DollarSign },
      { ruta: '/centros-donacion', texto: 'Centros de donación', icono: HandHeart },
    ],
  },
  {
    clave: 'informes',
    titulo: 'Informes y análisis',
    icono: PieChart,
    elementos: [
      { ruta: '/reportes-pdf', texto: 'Reportes PDF', icono: FileText },
      { ruta: '/alertas', texto: 'Alertas y Notif.', icono: Bell },
    ],
  },
  {
    clave: 'administracion',
    titulo: 'Administración',
    icono: Shield,
    elementos: [
      { ruta: '/usuarios', texto: 'Usuarios y Roles', icono: UserCog, permiso: 'administrar_cuentas' },
      { ruta: '/perfil', texto: 'Mi perfil', icono: User },
    ],
  },
];

export const ELEMENTOS_PIE: ElementoMenu[] = [
  { ruta: '/configuracion', texto: 'Ayuda y configuración', icono: Settings },
  { ruta: '/ayuda', texto: 'Ayuda y documentación', icono: BookOpen },
  { ruta: '/equipo', texto: 'Equipo de desarrollo', icono: ShieldCheck },
];
