import '@fontsource-variable/inter';
import 'leaflet/dist/leaflet.css';
import './estilos/tokens.css';
import './estilos/base.css';
import './estilos/componentes.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ProveedorConfirmacion } from './componentes/formularios/DialogoConfirmacion';
import { ProveedorAvisos } from './contextos/ContextoAvisos';
import { ProveedorSesion } from './contextos/ContextoSesion';
import { ProveedorTema } from './contextos/ContextoTema';
import { ProveedorTiempoReal } from './contextos/ContextoTiempoReal';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('No se encontró el elemento raíz.');

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorTema>
        <ProveedorAvisos>
          <ProveedorSesion>
            <ProveedorTiempoReal>
              <ProveedorConfirmacion>
                <App />
              </ProveedorConfirmacion>
            </ProveedorTiempoReal>
          </ProveedorSesion>
        </ProveedorAvisos>
      </ProveedorTema>
    </BrowserRouter>
  </StrictMode>,
);
