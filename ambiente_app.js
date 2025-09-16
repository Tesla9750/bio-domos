document.addEventListener('DOMContentLoaded', () => {
    const MOCKAPI_URL = 'https://68c60c19442c663bd0262b0a.mockapi.io/v1';

    let domosDisponibles = [];
    let domoState = null;
    let editModalInstance = null;
    let refrescoInterval = null;

    const domoSelector = document.getElementById('domo-selector');
    const dispositivosTbody = document.getElementById('dispositivos-tbody');
    const eventosTbody = document.getElementById('eventos-tbody');
    const formNuevoDispositivo = document.getElementById('form-nuevo-dispositivo');
    const editarModalElement = document.getElementById('editarModal');
    const guardarCambiosBtn = document.getElementById('guardar-cambios-btn');

    const renderTablaDispositivos = (dispositivos) => {
        dispositivosTbody.innerHTML = '';
        if (!dispositivos || dispositivos.length === 0) {
            dispositivosTbody.innerHTML = '<tr><td colspan="5" class="text-center">Este domo no tiene dispositivos de ambiente.</td></tr>';
            return;
        }
        dispositivos.forEach(disp => {
            let imagenSrc;
            if (disp.tipo === 'Temperatura') {
                imagenSrc = disp.activo ? 'images/on_air.png' : 'images/off_air.png';
            } else { // Para Calidad de Aire
                imagenSrc = disp.activo ? 'images/on_a.png' : 'images/off_a.png';
            }
            
            const estadoBtn = `<button class="btn-icon btn-toggle" data-id="${disp.id_amb}" title="Cambiar estado"><img src="${imagenSrc}" alt="Estado" width="36"></button>`;
            const unidad = disp.tipo === 'Temperatura' ? '°C' : 'PPM';
            const fila = `<tr>
                <td>${disp.nombre}</td>
                <td>${disp.tipo}</td>
                <td class="text-center">${estadoBtn}</td>
                <td>${disp.valor} ${unidad}</td>
                <td>
                    <button class="btn btn-sm btn-warning btn-editar" data-id="${disp.id_amb}">Editar</button>
                    <button class="btn btn-sm btn-danger btn-eliminar" data-id="${disp.id_amb}">Eliminar</button>
                </td>
            </tr>`;
            dispositivosTbody.innerHTML += fila;
        });
    };

    const renderTablaEventos = (eventos) => {
        eventosTbody.innerHTML = '';
        if (!eventos || eventos.length === 0) {
            eventosTbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay eventos recientes de ambiente.</td></tr>';
            return;
        }
        const iconosPorEvento = {
            'ALTA': { src: 'images/alert.png', alt: 'Alerta de Temperatura' },
            'BAJA': { src: 'images/alert.png', alt: 'Alerta de Temperatura' },
            'MALA': { src: 'images/alert.png', alt: 'Calidad de Aire Mala' },
            'encendido': { src: 'images/on_a.png', alt: 'Encendido' },      // Ícono para encendido manual
            'apagado':   { src: 'images/off_a.png', alt: 'Apagado' },        // Ícono para apagado manual
            'creado': { src: 'images/add.png', alt: 'Creado' },
            'modificado': { src: 'images/update.png', alt: 'Modificado' },
            'eliminado': { src: 'images/delete.png', alt: 'Eliminado' },
            'default': { src: 'images/alert.png', alt: 'Alerta' }
        };
        eventos.forEach(evento => {
            const dispositivo = (domoState.ambiente || []).find(d => d.id_amb === evento.dispositivoId);
            const nombreDispositivo = dispositivo ? dispositivo.nombre : `Dispositivo (${evento.dispositivoId})`;
            const fecha = new Date(evento.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
            const claveIcono = Object.keys(iconosPorEvento).find(key => evento.mensaje.includes(key)) || 'default';
            const icono = iconosPorEvento[claveIcono];
            const iconoHtml = `<img src="${icono.src}" alt="${icono.alt}" width="36">`;
            const fila = `<tr><td class="text-center">${iconoHtml}</td><td>${nombreDispositivo}</td><td>${evento.mensaje}</td><td>${fecha}</td></tr>`;
            eventosTbody.innerHTML += fila;
        });
    };

    const cicloDeSimulacionYRefresco = async () => {
        if (!domoState || !domoState.id) return;
        try {
            const domoRes = await fetch(`${MOCKAPI_URL}/domos/${domoState.id}`);
            if (!domoRes.ok) return;
            const domoParaSimular = await domoRes.json();
            
            let ambienteSimulado = domoParaSimular.ambiente = (typeof domoParaSimular.ambiente === 'string') ? JSON.parse(domoParaSimular.ambiente || '[]') : domoParaSimular.ambiente || [];
            let huboCambios = false;

            ambienteSimulado.forEach(disp => {
                huboCambios = true;
                if (disp.tipo === 'Temperatura') {
                    if (disp.activo) { 
                        disp.valor += (22 - disp.valor) * 0.1 + (Math.random() - 0.5);
                    } else { 
                        disp.valor += (Math.random() - 0.5) * 0.5;
                    }
                    disp.valor = Math.round(disp.valor * 10) / 10;
                    if (disp.valor > disp.umbral_max) registrarEvento(disp, `ALERTA: Temperatura ALTA: ${disp.valor}°C`, 'alerta', 'alta');
                    if (disp.valor < disp.umbral_min) registrarEvento(disp, `ALERTA: Temperatura BAJA: ${disp.valor}°C`, 'alerta', 'alta');
                } else if (disp.tipo === 'Calidad de Aire') {
                    if (disp.activo) { 
                        disp.valor -= Math.round(Math.random() * 20 + 5);
                    } else { 
                        disp.valor += Math.round(Math.random() * 10 + 2);
                    }
                    if (disp.valor < 350) disp.valor = 350; 
                    if (disp.valor > disp.umbral_max) registrarEvento(disp, `ALERTA: Calidad de Aire MALA: ${disp.valor} PPM`, 'alerta', 'alta');
                }
            });

            if (huboCambios) {
                const response = await fetch(`${MOCKAPI_URL}/domos/${domoState.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(domoParaSimular)
                });
                domoState = await response.json();
            } else {
                domoState = domoParaSimular;
            }
            domoState.ambiente = (typeof domoState.ambiente === 'string') ? JSON.parse(domoState.ambiente || '[]') : domoState.ambiente || [];
            
            renderTablaDispositivos(domoState.ambiente);
            
            const eventosUrl = `${MOCKAPI_URL}/eventos?domoId=${domoState.id}&sortBy=timestamp&order=desc`;
            const eventosResponse = await fetch(eventosUrl);
            const eventos = await eventosResponse.json();
            const eventosAmbiente = eventos.filter(e => e.dispositivoId.startsWith('amb_'));
            renderTablaEventos(eventosAmbiente.slice(0, 10));

        } catch (e) { console.error("Error en el ciclo de simulación y refresco:", e); }
    };
    
    const actualizarDomoEnAPI = async () => {
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos/${domoState.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(domoState)
            });
            if (!response.ok) throw new Error('Falló la actualización en la API.');
            domoState = await response.json();
            return true;
        } catch (error) {
            console.error("Error al actualizar el domo:", error);
            alert(`Error: ${error.message}`);
            return false;
        }
    };
    
    const cargarDatosDomoSeleccionado = async (domoId) => {
        if (refrescoInterval) clearInterval(refrescoInterval);
        if (!domoId) {
            dispositivosTbody.innerHTML = '<tr><td colspan="5" class="text-center">Por favor, selecciona un domo.</td></tr>';
            return;
        }
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos/${domoId}`);
            if (!response.ok) throw new Error('No se pudo obtener la información del domo.');
            domoState = await response.json();
            domoState.ambiente = (typeof domoState.ambiente === 'string') ? JSON.parse(domoState.ambiente || '[]') : domoState.ambiente || [];
            
            await cicloDeSimulacionYRefresco();
            refrescoInterval = setInterval(cicloDeSimulacionYRefresco, 5000);
        } catch (error) {
            console.error("Error al cargar datos del domo:", error);
            dispositivosTbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${error.message}</td></tr>`;
        }
    };

    const cargarYPopularDomos = async () => {
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos`);
            if (!response.ok) throw new Error('No se pudieron cargar los domos.');
            domosDisponibles = await response.json();
            domoSelector.innerHTML = domosDisponibles.length ? '' : '<option>No se encontraron domos.</option>';
            domosDisponibles.forEach(domo => {
                domoSelector.innerHTML += `<option value="${domo.id}">${domo.nombre} (Ubicación: ${domo.ubicacion})</option>`;
            });
            if (domosDisponibles.length > 0) {
                await cargarDatosDomoSeleccionado(domosDisponibles[0].id);
            }
        } catch (error) {
            console.error("Error al cargar lista de domos:", error);
            domoSelector.innerHTML = `<option>${error.message}</option>`;
        }
    };
    
    const registrarEvento = async (dispositivo, mensaje, tipo = 'historial', prioridad = 'baja') => {
        const evento = { domoId: domoState.id, dispositivoId: dispositivo.id_amb, type: tipo, mensaje: mensaje, timestamp: new Date().toISOString(), prioridad: prioridad };
        try {
            await fetch(`${MOCKAPI_URL}/eventos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evento) });
        } catch (error) { console.error("No se pudo registrar el evento:", error); }
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const tipo = document.getElementById('tipo-dispositivo').value;
        const nuevoDispositivo = { 
            id_amb: `amb_${Date.now()}`, 
            nombre: document.getElementById('nombre-dispositivo').value, 
            tipo: tipo,
            activo: false, 
            valor: tipo === 'Temperatura' ? 20 : 400,
            umbral_min: parseInt(document.getElementById('umbral-min').value),
            umbral_max: parseInt(document.getElementById('umbral-max').value)
        };
        if (!domoState.ambiente) domoState.ambiente = [];
        domoState.ambiente.push(nuevoDispositivo);

        if (await actualizarDomoEnAPI()) {
            formNuevoDispositivo.reset();
            renderTablaDispositivos(domoState.ambiente);
            registrarEvento(nuevoDispositivo, `Dispositivo '${nuevoDispositivo.nombre}' ha sido creado.`, 'historial', 'media');
        } else {
            domoState.ambiente.pop();
        }
    };

    const handleTablaClick = (event) => {
        const target = event.target.closest('button');
        if (!target) return;
        const dispId = target.dataset.id;
        if (target.classList.contains('btn-eliminar')) {
            if (confirm('¿Estás seguro de que deseas eliminar este dispositivo?')) eliminarDispositivo(dispId);
        } else if (target.classList.contains('btn-editar')) {
            abrirModalEditar(dispId);
        } else if (target.classList.contains('btn-toggle')) {
            toggleEstadoDispositivo(dispId);
        }
    };

    // --- ▼▼▼ FUNCIÓN MODIFICADA PARA REGISTRAR EVENTO DE ENCENDIDO/APAGADO ▼▼▼ ---
    const toggleEstadoDispositivo = async (dispId) => {
        const index = domoState.ambiente.findIndex(d => d.id_amb === dispId);
        if (index === -1) return;

        const originalDispositivo = { ...domoState.ambiente[index] };
        const nuevoEstado = !originalDispositivo.activo;

        domoState.ambiente[index].activo = nuevoEstado;
        renderTablaDispositivos(domoState.ambiente);

        if (await actualizarDomoEnAPI()) {
            const dispositivoCambiado = domoState.ambiente[index];
            const textoEstado = nuevoEstado ? 'encendido' : 'apagado';
            const mensaje = `Dispositivo '${dispositivoCambiado.nombre}' se ha ${textoEstado} manualmente.`;
            registrarEvento(dispositivoCambiado, mensaje, 'historial', 'baja');
        } else {
            // Si la API falla, revierte el cambio
            domoState.ambiente[index] = originalDispositivo;
            renderTablaDispositivos(domoState.ambiente);
        }
    };

    const eliminarDispositivo = async (dispId) => {
        const dispositivoEliminado = domoState.ambiente.find(d => d.id_amb === dispId);
        domoState.ambiente = domoState.ambiente.filter(d => d.id_amb !== dispId);
        if (await actualizarDomoEnAPI()) {
            renderTablaDispositivos(domoState.ambiente);
            registrarEvento(dispositivoEliminado, `Dispositivo '${dispositivoEliminado.nombre}' ha sido eliminado.`, 'historial', 'media');
        }
    };

    const abrirModalEditar = (dispId) => {
        const dispositivo = domoState.ambiente.find(d => d.id_amb === dispId);
        if (dispositivo) {
            document.getElementById('edit-dispositivo-id').value = dispId;
            document.getElementById('edit-nombre-dispositivo').value = dispositivo.nombre;
            document.getElementById('edit-umbral-min').value = dispositivo.umbral_min;
            document.getElementById('edit-umbral-max').value = dispositivo.umbral_max;
            editModalInstance.show();
        }
    };

    const handleGuardarCambios = async () => {
        const dispId = document.getElementById('edit-dispositivo-id').value;
        const index = domoState.ambiente.findIndex(d => d.id_amb === dispId);
        if (index === -1) return;
        
        domoState.ambiente[index].nombre = document.getElementById('edit-nombre-dispositivo').value;
        domoState.ambiente[index].umbral_min = parseInt(document.getElementById('edit-umbral-min').value);
        domoState.ambiente[index].umbral_max = parseInt(document.getElementById('edit-umbral-max').value);
        
        if (await actualizarDomoEnAPI()) {
            editModalInstance.hide();
            renderTablaDispositivos(domoState.ambiente);
            registrarEvento(domoState.ambiente[index], `Dispositivo '${domoState.ambiente[index].nombre}' ha sido modificado.`, 'historial');
        }
    };

    editModalInstance = new bootstrap.Modal(editarModalElement);
    domoSelector.addEventListener('change', (e) => cargarDatosDomoSeleccionado(e.target.value));
    formNuevoDispositivo.addEventListener('submit', handleFormSubmit);
    dispositivosTbody.addEventListener('click', handleTablaClick);
    guardarCambiosBtn.addEventListener('click', handleGuardarCambios);
    
    cargarYPopularDomos(); 
});