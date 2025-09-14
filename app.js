document.addEventListener('DOMContentLoaded', () => {

    const MOCKAPI_URL = 'https://68c60c19442c663bd0262b0a.mockapi.io/v1';

    let domosDisponibles = [];
    let domoState = null;
    let editModalInstance = null;
    let refrescoInterval = null;

    const domoSelector = document.getElementById('domo-selector');
    const irrigadoresTbody = document.getElementById('irrigadores-tbody');
    const eventosTbody = document.getElementById('eventos-tbody');
    const formNuevoIrrigador = document.getElementById('form-nuevo-irrigador');
    const editarModalElement = document.getElementById('editarModal');
    const guardarCambiosBtn = document.getElementById('guardar-cambios-btn');

    const renderTablaIrrigadores = (irrigadores) => {
        irrigadoresTbody.innerHTML = '';
        if (!irrigadores || irrigadores.length === 0) {
            irrigadoresTbody.innerHTML = '<tr><td colspan="5" class="text-center">Este domo no tiene dispositivos de riego.</td></tr>';
            return;
        }
        irrigadores.forEach(irr => {
            const imagenSrc = irr.activo ? 'images/on_i.png' : 'images/off_i.png';
            const estadoBtn = `<button class="btn-icon btn-toggle" data-id="${irr.id_irr}" title="Cambiar estado"><img src="${imagenSrc}" alt="Estado" width="36"></button>`;
            const fila = `<tr><td>${irr.nombre}</td><td>${irr.ubicacion}</td><td class="text-center">${estadoBtn}</td><td>${irr.humedadSuelo}%</td><td><button class="btn btn-sm btn-warning btn-editar" data-id="${irr.id_irr}">Editar</button><button class="btn btn-sm btn-danger btn-eliminar" data-id="${irr.id_irr}">Eliminar</button></td></tr>`;
            irrigadoresTbody.innerHTML += fila;
        });
    };

    const renderTablaEventos = (eventos) => {
        eventosTbody.innerHTML = '';
        if (!eventos || eventos.length === 0) {
            eventosTbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay eventos recientes para este domo.</td></tr>';
            return;
        }
        eventos.forEach(evento => {
            const dispositivo = domoState.irrigadores.find(irr => irr.id_irr === evento.dispositivoId);
            const nombreDispositivo = dispositivo ? dispositivo.nombre : `Dispositivo eliminado`;
            const fecha = new Date(evento.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
            let iconoHtml = `<img src="images/alert.png" alt="evento" width="36">`;
            if (evento.mensaje.includes('desactivado')) iconoHtml = `<img src="images/off_i.png" alt="Desactivado" width="36">`;
            else if (evento.mensaje.includes('activado')) iconoHtml = `<img src="images/on_i.png" alt="Activado" width="36">`;
            else if (evento.mensaje.includes('creado')) iconoHtml = `<img src="images/add.png" alt="Creado" width="36">`;
            else if (evento.mensaje.includes('modificado')) iconoHtml = `<img src="images/update.png" alt="Modificado" width="36">`;
            else if (evento.mensaje.includes('eliminado')) iconoHtml = `<img src="images/delete.png" alt="Eliminado" width="36">`;
            const fila = `<tr><td class="text-center">${iconoHtml}</td><td>${nombreDispositivo}</td><td>${evento.mensaje}</td><td>${fecha}</td></tr>`;
            eventosTbody.innerHTML += fila;
        });
    };

    const refrescarDatosCompletos = async () => {
        if (!domoState || !domoState.id) return;
        try {
            const domoResponse = await fetch(`${MOCKAPI_URL}/domos/${domoState.id}`);
            const domoActualizado = await domoResponse.json();
            domoState = domoActualizado;
            domoState.irrigadores = (typeof domoState.irrigadores === 'string') ? JSON.parse(domoState.irrigadores || '[]') : domoState.irrigadores || [];
            renderTablaIrrigadores(domoState.irrigadores);
            const eventosUrl = `${MOCKAPI_URL}/eventos?domoId=${domoState.id}&sortBy=timestamp&order=desc`;
            const eventosResponse = await fetch(eventosUrl);
            const eventos = await eventosResponse.json();
            renderTablaEventos(eventos.slice(0, 10));
        } catch(e) { console.error("Error refrescando datos", e); }
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
            irrigadoresTbody.innerHTML = '<tr><td colspan="5" class="text-center">Por favor, selecciona un domo.</td></tr>';
            return;
        }
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos/${domoId}`);
            if (!response.ok) throw new Error('No se pudo obtener la información del domo.');
            domoState = await response.json();
            domoState.irrigadores = (typeof domoState.irrigadores === 'string') ? JSON.parse(domoState.irrigadores || '[]') : domoState.irrigadores || [];
            renderTablaIrrigadores(domoState.irrigadores);
            const eventosUrl = `${MOCKAPI_URL}/eventos?domoId=${domoState.id}&sortBy=timestamp&order=desc`;
            const eventosResponse = await fetch(eventosUrl);
            const eventos = await eventosResponse.json();
            renderTablaEventos(eventos.slice(0, 10));
            refrescoInterval = setInterval(refrescarDatosCompletos, 2000);
        } catch (error) {
            console.error("Error al cargar datos del domo:", error);
            irrigadoresTbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${error.message}</td></tr>`;
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
        const evento = { domoId: domoState.id, dispositivoId: dispositivo.id_irr, type: tipo, mensaje: mensaje, timestamp: new Date().toISOString(), prioridad: prioridad };
        try {
            await fetch(`${MOCKAPI_URL}/eventos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evento) });
        } catch (error) { console.error("No se pudo registrar el evento:", error); }
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const nuevoIrrigador = { id_irr: `irr_${Date.now()}`, nombre: document.getElementById('nombre-irr').value, ubicacion: document.getElementById('ubicacion-irr').value, activo: false, humedadSuelo: parseInt(document.getElementById('humedad-irr').value) };
        domoState.irrigadores.push(nuevoIrrigador);
        if (await actualizarDomoEnAPI()) {
            formNuevoIrrigador.reset();
            renderTablaIrrigadores(domoState.irrigadores);
            registrarEvento(nuevoIrrigador, `Dispositivo '${nuevoIrrigador.nombre}' ha sido creado.`, 'historial', 'media');
        } else {
            domoState.irrigadores.pop();
        }
    };

    const handleTablaClick = (event) => {
        const target = event.target.closest('button');
        if (!target) return;
        const irrId = target.dataset.id;
        if (target.classList.contains('btn-eliminar')) {
            if (confirm('¿Estás seguro de que deseas eliminar este dispositivo?')) eliminarIrrigador(irrId);
        } else if (target.classList.contains('btn-editar')) {
            abrirModalEditar(irrId);
        } else if (target.classList.contains('btn-toggle')) {
            const irrigador = domoState.irrigadores.find(irr => irr.id_irr === irrId);
            if (irrigador) toggleEstadoIrrigador(irrId, !irrigador.activo);
        }
    };

    const toggleEstadoIrrigador = async (irrId, nuevoEstado) => {
        const index = domoState.irrigadores.findIndex(irr => irr.id_irr === irrId);
        if (index === -1) return;
        const originalIrrigador = { ...domoState.irrigadores[index] };
        domoState.irrigadores[index].activo = nuevoEstado;
        renderTablaIrrigadores(domoState.irrigadores);
        if (await actualizarDomoEnAPI()) {
            const irrigadorCambiado = domoState.irrigadores[index];
            const textoEstado = nuevoEstado ? 'activado' : 'desactivado';
            registrarEvento(irrigadorCambiado, `El dispositivo '${irrigadorCambiado.nombre}' se ha ${textoEstado}.`);
        } else {
            domoState.irrigadores[index] = originalIrrigador;
            renderTablaIrrigadores(domoState.irrigadores);
        }
    };

    const eliminarIrrigador = async (irrId) => {
        const irrigadorEliminado = domoState.irrigadores.find(irr => irr.id_irr === irrId);
        const originalIrrigadores = [...domoState.irrigadores];
        domoState.irrigadores = domoState.irrigadores.filter(irr => irr.id_irr !== irrId);
        if (await actualizarDomoEnAPI()) {
            renderTablaIrrigadores(domoState.irrigadores);
            registrarEvento(irrigadorEliminado, `Dispositivo '${irrigadorEliminado.nombre}' ha sido eliminado.`, 'historial', 'media');
        } else {
            domoState.irrigadores = originalIrrigadores;
        }
    };

    const abrirModalEditar = (irrId) => {
        const irrigador = domoState.irrigadores.find(irr => irr.id_irr === irrId);
        if (irrigador) {
            document.getElementById('edit-irr-id').value = irrId;
            document.getElementById('edit-nombre-irr').value = irrigador.nombre;
            document.getElementById('edit-ubicacion-irr').value = irrigador.ubicacion;
            document.getElementById('edit-humedad-irr').value = irrigador.humedadSuelo;
            editModalInstance.show();
        }
    };

    const handleGuardarCambios = async () => {
        const irrId = document.getElementById('edit-irr-id').value;
        const index = domoState.irrigadores.findIndex(irr => irr.id_irr === irrId);
        if (index === -1) return;
        const irrigadorActualizado = { ...domoState.irrigadores[index], nombre: document.getElementById('edit-nombre-irr').value, ubicacion: document.getElementById('edit-ubicacion-irr').value, humedadSuelo: parseInt(document.getElementById('edit-humedad-irr').value), };
        const originalIrrigadores = [...domoState.irrigadores];
        domoState.irrigadores[index] = irrigadorActualizado;
        if (await actualizarDomoEnAPI()) {
            editModalInstance.hide();
            renderTablaIrrigadores(domoState.irrigadores);
            registrarEvento(irrigadorActualizado, `Dispositivo '${irrigadorActualizado.nombre}' ha sido modificado.`, 'historial');
        } else {
            domoState.irrigadores = originalIrrigadores;
        }
    };

    editModalInstance = new bootstrap.Modal(editarModalElement);
    domoSelector.addEventListener('change', (e) => cargarDatosDomoSeleccionado(e.target.value));
    formNuevoIrrigador.addEventListener('submit', handleFormSubmit);
    irrigadoresTbody.addEventListener('click', handleTablaClick);
    guardarCambiosBtn.addEventListener('click', handleGuardarCambios);
    
    cargarYPopularDomos(); 
});