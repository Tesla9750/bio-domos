document.addEventListener('DOMContentLoaded', () => {

    const MOCKAPI_URL = 'https://68c60c19442c663bd0262b0a.mockapi.io/v1';

    let domosDisponibles = [];
    let domoState = null;
    let editModalInstance = null;
    let refrescoInterval = null;

    const domoSelector = document.getElementById('domo-selector');
    const lucesTbody = document.getElementById('luces-tbody');
    const eventosTbody = document.getElementById('eventos-tbody');
    const formNuevaLuz = document.getElementById('form-nueva-luz');
    const editarModalElement = document.getElementById('editarModal');
    const guardarCambiosBtn = document.getElementById('guardar-cambios-btn');
    const intensidadValor = document.getElementById('intensidad-valor');
    const intensidadSlider = document.getElementById('intensidad-luz');
    const editIntensidadValor = document.getElementById('edit-intensidad-valor');
    const editIntensidadSlider = document.getElementById('edit-intensidad-luz');
    
    intensidadSlider.addEventListener('input', () => intensidadValor.textContent = intensidadSlider.value);
    editIntensidadSlider.addEventListener('input', () => editIntensidadValor.textContent = editIntensidadSlider.value);

    const registrarEvento = async (dispositivoId, mensaje, prioridad) => {
        const nuevoEvento = {
            domoId: domoState.id,
            dispositivoId: dispositivoId,
            type: prioridad === 'alta' ? 'alerta' : 'historial',
            mensaje: mensaje,
            timestamp: new Date().toISOString(),
            prioridad: prioridad
        };
        try {
            await fetch(`${MOCKAPI_URL}/eventos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoEvento)
            });
            await cargarHistorialLuces(domoState.id);
        } catch (error) {
            console.error("Error al registrar evento:", error);
        }
    };

    const renderTablaLuces = (luces) => {
        lucesTbody.innerHTML = '';
        if (!luces || luces.length === 0) {
            lucesTbody.innerHTML = '<tr><td colspan="6" class="text-center">Este domo no tiene luces.</td></tr>';
            return;
        }
        luces.forEach(luz => {
            const imagenSrc = luz.activo ? 'images/on.png' : 'images/off.png';
            const estadoBtn = `<button class="btn-icon btn-toggle" data-id="${luz.id_luz}" title="Cambiar estado"><img src="${imagenSrc}" alt="Estado" width="36"></button>`;
            const colorSwatch = `<div style="width: 30px; height: 30px; background-color: ${luz.color}; border-radius: 50%; margin: auto;"></div>`;
            const horario = `${luz.horarioEncendido} - ${luz.horarioApagado}`;
            const fila = `<tr><td>${luz.nombre}</td><td class="text-center">${estadoBtn}</td><td>${luz.intensidad}%</td><td class="text-center">${colorSwatch}</td><td>${horario}</td><td><button class="btn btn-sm btn-warning btn-editar" data-id="${luz.id_luz}">Editar</button><button class="btn btn-sm btn-danger btn-eliminar" data-id="${luz.id_luz}">Eliminar</button></td></tr>`;
            lucesTbody.innerHTML += fila;
        });
    };

    // --- ▼▼▼ ÚNICO CAMBIO REALIZADO AQUÍ ▼▼▼ ---
    const renderTablaHistorial = (historial) => {
        eventosTbody.innerHTML = '';
        if (!historial || historial.length === 0) {
            eventosTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay actividad reciente de luces.</td></tr>';
            return;
        }

        historial.forEach(evento => {
            const luz = domoState.luces.find(l => l.id_luz === evento.dispositivoId);
            const nombreDispositivo = luz ? luz.nombre : `Dispositivo (${evento.dispositivoId})`;
            const fecha = new Date(evento.timestamp).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
            
            let iconoHtml;
            
            // Lógica específica para seleccionar el ícono correcto
            if (evento.mensaje.includes('¡FALLO!')) {
                iconoHtml = `<img src="images/alert.png" alt="Alerta de Fallo" width="36">`;
            } else if (evento.mensaje.includes('encendida')) {
                iconoHtml = `<img src="images/on.png" alt="Encendida" width="36">`;
            } else if (evento.mensaje.includes('apagada')) {
                iconoHtml = `<img src="images/off.png" alt="Apagada" width="36">`;
            } else if (evento.mensaje.includes('añadió')) {
                iconoHtml = `<img src="images/add.png" alt="Añadida" width="36">`;
            } else if (evento.mensaje.includes('modificó')) {
                iconoHtml = `<img src="images/update.png" alt="Modificada" width="36">`;
            } else if (evento.mensaje.includes('eliminó')) {
                iconoHtml = `<img src="images/delete.png" alt="Eliminada" width="36">`;
            } else {
                iconoHtml = `<img src="images/alert.png" alt="Evento" width="36">`; // Ícono por defecto
            }

            const fila = `<tr><td class="text-center">${iconoHtml}</td><td>${nombreDispositivo}</td><td>${evento.mensaje}</td><td>${fecha}</td></tr>`;
            eventosTbody.innerHTML += fila;
        });
    };
    
    const cargarHistorialLuces = async (domoId) => {
        try {
            const response = await fetch(`${MOCKAPI_URL}/eventos`); 
            if (!response.ok) throw new Error('No se pudo cargar el historial.');
            const historialCompleto = await response.json();
            const historialFiltrado = historialCompleto
                .filter(evento => evento.domoId === domoId && evento.dispositivoId.startsWith('luz_'))
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10);
            renderTablaHistorial(historialFiltrado);
        } catch (error) {
            console.error("Error al cargar el historial:", error);
            eventosTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${error.message}</td></tr>`;
        }
    };

    const verificarHorarios = async () => {
        if (!domoState || !domoState.luces || !domoState.luces.length === 0) return;
        
        const horaActual = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

        for (const luz of domoState.luces) {
            let deberiaEstarActiva;
            if (luz.horarioEncendido < luz.horarioApagado) {
                deberiaEstarActiva = (horaActual >= luz.horarioEncendido && horaActual < luz.horarioApagado);
            } else {
                deberiaEstarActiva = (horaActual >= luz.horarioEncendido || horaActual < luz.horarioApagado);
            }

            if (luz.activo !== deberiaEstarActiva) {
                const estadoEsperado = deberiaEstarActiva ? "encendida" : "apagada";
                const mensaje = `¡FALLO! La luz '${luz.nombre}' debería estar ${estadoEsperado}.`;
                await registrarEvento(luz.id_luz, mensaje, 'alta');
            }
        }
    };

    const refrescarDatosCompletos = async () => {
        if (!domoState || !domoState.id) return;
        try {
            const domoResponse = await fetch(`${MOCKAPI_URL}/domos/${domoState.id}`);
            const domoActualizado = await domoResponse.json();
            domoState = domoActualizado;
            domoState.luces = (typeof domoState.luces === 'string') ? JSON.parse(domoState.luces || '[]') : domoState.luces || [];
            
            await verificarHorarios(); 

            renderTablaLuces(domoState.luces);
        } catch(e) { console.error("Error refrescando datos", e); }
    };
    
    const actualizarDomoEnAPI = async () => {
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos/${domoState.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(domoState) });
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
            lucesTbody.innerHTML = '<tr><td colspan="6" class="text-center">Selecciona un domo.</td></tr>';
            eventosTbody.innerHTML = '';
            return;
        }
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos/${domoId}`);
            if (!response.ok) throw new Error('No se pudo obtener la información del domo.');
            domoState = await response.json();
            domoState.luces = (typeof domoState.luces === 'string') ? JSON.parse(domoState.luces || '[]') : domoState.luces || [];
            
            renderTablaLuces(domoState.luces);
            await cargarHistorialLuces(domoId);

            refrescoInterval = setInterval(refrescarDatosCompletos, 10000); 
        } catch (error) {
            console.error("Error al cargar datos del domo:", error);
            lucesTbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${error.message}</td></tr>`;
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
    
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const nuevaLuz = { id_luz: `luz_${Date.now()}`, nombre: document.getElementById('nombre-luz').value, ubicacion: document.getElementById('ubicacion-luz').value, activo: false, intensidad: parseInt(intensidadSlider.value), color: document.getElementById('color-luz').value, horarioEncendido: document.getElementById('encendido-luz').value, horarioApagado: document.getElementById('apagado-luz').value };
        if (!domoState.luces) domoState.luces = [];
        domoState.luces.push(nuevaLuz);
        if (await actualizarDomoEnAPI()) {
            formNuevaLuz.reset();
            intensidadValor.textContent = '80';
            renderTablaLuces(domoState.luces);
            await registrarEvento(nuevaLuz.id_luz, `Se añadió la luz '${nuevaLuz.nombre}'.`, 'media');
        } else {
            domoState.luces.pop();
        }
    };

    const handleTablaClick = (event) => {
        const target = event.target.closest('button');
        if (!target) return;
        const luzId = target.dataset.id;
        if (target.classList.contains('btn-eliminar')) {
            if (confirm('¿Seguro que deseas eliminar esta luz?')) eliminarLuz(luzId);
        } else if (target.classList.contains('btn-editar')) {
            abrirModalEditar(luzId);
        } else if (target.classList.contains('btn-toggle')) {
            const luz = domoState.luces.find(l => l.id_luz === luzId);
            if (luz) toggleEstadoLuz(luzId, !luz.activo);
        }
    };

    const toggleEstadoLuz = async (luzId, nuevoEstado) => {
        const index = domoState.luces.findIndex(l => l.id_luz === luzId);
        if (index === -1) return;
        const luz = domoState.luces[index]; 
        const originalLuz = { ...luz };
        luz.activo = nuevoEstado;
        renderTablaLuces(domoState.luces);
        if (await actualizarDomoEnAPI()) {
             const mensaje = `Luz '${luz.nombre}' ${nuevoEstado ? 'encendida' : 'apagada'} manualmente.`;
             await registrarEvento(luzId, mensaje, 'baja');
        } else {
            domoState.luces[index] = originalLuz;
            renderTablaLuces(domoState.luces);
        }
    };

    const eliminarLuz = async (luzId) => {
        const luzEliminada = domoState.luces.find(l => l.id_luz === luzId);
        if (!luzEliminada) return;

        const originalLuces = [...domoState.luces];
        domoState.luces = domoState.luces.filter(l => l.id_luz !== luzId);
        if (await actualizarDomoEnAPI()){
            renderTablaLuces(domoState.luces);
            await registrarEvento(luzId, `Se eliminó la luz '${luzEliminada.nombre}'.`, 'media');
        } else {
             domoState.luces = originalLuces;
        }
    };

    const abrirModalEditar = (luzId) => {
        const luz = domoState.luces.find(l => l.id_luz === luzId);
        if (luz) {
            document.getElementById('edit-luz-id').value = luzId;
            document.getElementById('edit-nombre-luz').value = luz.nombre;
            document.getElementById('edit-ubicacion-luz').value = luz.ubicacion;
            editIntensidadSlider.value = luz.intensidad;
            editIntensidadValor.textContent = luz.intensidad;
            document.getElementById('edit-color-luz').value = luz.color;
            document.getElementById('edit-encendido-luz').value = luz.horarioEncendido;
            document.getElementById('edit-apagado-luz').value = luz.horarioApagado;
            editModalInstance.show();
        }
    };

    const handleGuardarCambios = async () => {
        const luzId = document.getElementById('edit-luz-id').value;
        const index = domoState.luces.findIndex(l => l.id_luz === luzId);
        if (index === -1) return;
        const luzActualizada = { ...domoState.luces[index], nombre: document.getElementById('edit-nombre-luz').value, ubicacion: document.getElementById('edit-ubicacion-luz').value, intensidad: parseInt(editIntensidadSlider.value), color: document.getElementById('edit-color-luz').value, horarioEncendido: document.getElementById('edit-encendido-luz').value, horarioApagado: document.getElementById('edit-apagado-luz').value };
        const originalLuces = [...domoState.luces];
        domoState.luces[index] = luzActualizada;
        if (await actualizarDomoEnAPI()) {
            editModalInstance.hide();
            renderTablaLuces(domoState.luces);
            await registrarEvento(luzId, `Se modificó la luz '${luzActualizada.nombre}'.`, 'baja');
        } else {
            domoState.luces = originalLuces;
        }
    };

    editModalInstance = new bootstrap.Modal(editarModalElement);
    domoSelector.addEventListener('change', (e) => cargarDatosDomoSeleccionado(e.target.value));
    formNuevaLuz.addEventListener('submit', handleFormSubmit);
    lucesTbody.addEventListener('click', handleTablaClick);
    guardarCambiosBtn.addEventListener('click', handleGuardarCambios);
    
    cargarYPopularDomos(); 
});