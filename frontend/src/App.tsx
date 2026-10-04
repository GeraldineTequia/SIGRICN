import { Route, Routes } from 'react-router-dom';
import { DisenoPrincipal } from './componentes/navegacion/DisenoPrincipal';
import {
  PaginaInicioSesion,
  PaginaRecuperarContrasena,
  PaginaRegistro,
  PaginaRestablecerContrasena,
} from './paginas/autenticacion/PaginasAutenticacion';
import { PaginaAlertas } from './paginas/PaginaAlertas';
import { PaginaDashboard } from './paginas/PaginaDashboard';
import { PaginaDetalleEmergencia } from './paginas/emergencias/PaginaDetalleEmergencia';
import { PaginaEmergencias } from './paginas/emergencias/PaginaEmergencias';
import { PaginaFormularioEmergencia } from './paginas/emergencias/PaginaFormularioEmergencia';
import { PaginaMapa } from './paginas/PaginaMapa';
import { PaginaNecesidades } from './paginas/poblacion/PaginaNecesidades';
import { PaginaPersonas } from './paginas/poblacion/PaginaPersonas';
import { PaginaReportesPdf } from './paginas/PaginaReportesPdf';
import { PaginaUsuarios } from './paginas/PaginaUsuarios';
import { PaginaAyuda, PaginaConfiguracion, PaginaEquipo, PaginaNoEncontrada, PaginaPerfil } from './paginas/PaginasCuenta';
import { PaginaCentros } from './paginas/recursos/PaginasCentrosYHumanos';
import { PaginaFondos } from './paginas/recursos/PaginaFondos';
import { PaginaZonas } from './paginas/zonas/PaginaZonas';
import { PaginaDetalleZona, PaginaFormularioZona } from './paginas/zonas/PaginasZona';

/** Rutas de la aplicación. Las privadas se protegen en DisenoPrincipal; el backend vuelve a autorizar cada solicitud. */
export function App() {
  return (
    <Routes>
      <Route path="/iniciar-sesion" element={<PaginaInicioSesion />} />
      <Route path="/registro" element={<PaginaRegistro />} />
      <Route path="/recuperar-contrasena" element={<PaginaRecuperarContrasena />} />
      <Route path="/restablecer-contrasena" element={<PaginaRestablecerContrasena />} />
      <Route element={<DisenoPrincipal />}>
        <Route index element={<PaginaDashboard />} />
        <Route path="mapa" element={<PaginaMapa />} />
        <Route path="emergencias" element={<PaginaEmergencias />} />
        <Route path="emergencias/nueva" element={<PaginaFormularioEmergencia />} />
        <Route path="emergencias/:identificador" element={<PaginaDetalleEmergencia />} />
        <Route path="emergencias/:identificador/editar" element={<PaginaFormularioEmergencia />} />
        <Route path="zonas" element={<PaginaZonas />} />
        <Route path="zonas/nueva" element={<PaginaFormularioZona />} />
        <Route path="zonas/:identificador" element={<PaginaDetalleZona />} />
        <Route path="zonas/:identificador/editar" element={<PaginaFormularioZona />} />
        <Route path="personas" element={<PaginaPersonas />} />
        <Route path="necesidades" element={<PaginaNecesidades />} />
        <Route path="fondos" element={<PaginaFondos />} />
        <Route path="centros-donacion" element={<PaginaCentros />} />
        <Route path="centros-donacion/:identificador" element={<PaginaCentros />} />
        <Route path="reportes-pdf" element={<PaginaReportesPdf />} />
        <Route path="alertas" element={<PaginaAlertas />} />
        <Route path="usuarios" element={<PaginaUsuarios />} />
        <Route path="perfil" element={<PaginaPerfil />} />
        <Route path="configuracion" element={<PaginaConfiguracion />} />
        <Route path="ayuda" element={<PaginaAyuda />} />
        <Route path="equipo" element={<PaginaEquipo />} />
        <Route path="*" element={<PaginaNoEncontrada />} />
      </Route>
    </Routes>
  );
}
