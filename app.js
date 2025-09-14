document.addEventListener('DOMContentLoaded', () => {

    // ---------------------------------------------------------------
    // 🎯 URL de tu API
    // ---------------------------------------------------------------
    const MOCKAPI_URL = 'https://68c60c19442c663bd0262b0a.mockapi.io/v1';

    // --- ESTADO GLOBAL ---
    let domosDisponibles = [];
    let domoState = null;
    let editModalInstance = null;
    let eventosInterval = null; // Guardará la referencia al intervalo de refresco

    // --- ELEMENTOS DEL DOM ---
    const domoSelector = document.getElementById('domo-selector');
    const irrigadoresTbody = document.getElementById('irrigadores-tbody');
    const eventosTbody = document.getElementById('eventos-tbody'); // <-- Nuevo elemento para la tabla de eventos
    const formNuevoIrrigador = document.getElementById('form-nuevo-irrigador');
    const editarModalElement = document.getElementById('editarModal');
    const guardarCambiosBtn = document.getElementById('guardar-cambios-btn');
    const formEditarIrrigador = document.getElementById('form-editar-irrigador');


    // --- FUNCIONES ---

    /**
     * Renderiza la tabla de irrigadores con un interruptor para el estado.
     */
    const renderTablaIrrigadores = (irrigadores) => {
        irrigadoresTbody.innerHTML = '';
        if (!irrigadores || irrigadores.length === 0) {
            irrigadoresTbody.innerHTML = '<tr><td colspan="5" class="text-center">Este domo no tiene dispositivos de riego.</td></tr>';
            return;
        }
        irrigadores.forEach(irr => {
            const checkedAttribute = irr.activo ? 'checked' : '';
            const estadoToggle = `
                <div class="form-check form-switch d-flex justify-content-center align-items-center" style="height: 100%;">
                    <input class="form-check-input btn-toggle" type="checkbox" role="switch" data-id="${irr.id_irr}" ${checkedAttribute}>
                </div>
            `;
            const fila = `
                <tr>
                    <td>${irr.nombre}</td>
                    <td>${irr.ubicacion}</td>
                    <td class="text-center">${estadoToggle}</td>
                    <td>${irr.humedadSuelo}%</td>
                    <td>
                        <button class="btn btn-sm btn-warning btn-editar" data-id="${irr.id_irr}">Editar</button>
                        <button class="btn btn-sm btn-danger btn-eliminar" data-id="${irr.id_irr}">Eliminar</button>
                    </td>
                </tr>`;
            irrigadoresTbody.innerHTML += fila;
        });
    };

    /**
     * NUEVA FUNCIÓN: Renderiza la tabla de eventos.
     */
    const renderTablaEventos = (eventos) => {
        eventosTbody.innerHTML = '';
        if (!eventos || eventos.length === 0) {
            eventosTbody.innerHTML = '<tr><td colspan="3" class="text-center">No hay eventos recientes para este domo.</td></tr>';
            return;
        }
        eventos.forEach(evento => {
            const dispositivo = domoState.irrigadores.find(irr => irr.id_irr === evento.dispositivoId);
            const nombreDispositivo = dispositivo ? dispositivo.nombre : `ID: ${evento.dispositivoId}`;
            const fecha = new Date(evento.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });

            const fila = `
                <tr>
                    <td>${nombreDispositivo}</td>
                    <td>${evento.mensaje}</td>
                    <td>${fecha}</td>
                </tr>`;
            eventosTbody.innerHTML += fila;
        });
    };

    /**
     * NUEVA FUNCIÓN: Carga los últimos 10 eventos desde la API.
     */
    const cargarUltimosEventos = async () => {
        if (!domoState) return;
        try {
            const domoId = domoState.id;
            const url = `${MOCKAPI_URL}/eventos?domoId=${domoId}&sortBy=timestamp&order=desc&limit=10`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('No se pudieron cargar los eventos.');
            const eventos = await response.json();
            renderTablaEventos(eventos);
        } catch (error) {
            console.error("Error al refrescar eventos:", error);
            eventosTbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error al cargar eventos.</td></tr>`;
        }
    };
    
    /**
     * Actualiza el domo completo en la API.
     */
    const actualizarDomoEnAPI = async () => {
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos/${domoState.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(domoState)
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
    
    /**
     * Carga los datos de un domo específico e inicia el monitoreo de eventos.
     */
    const cargarDatosDomoSeleccionado = async (domoId) => {
        if (eventosInterval) clearInterval(eventosInterval);

        if (!domoId) {
            irrigadoresTbody.innerHTML = '<tr><td colspan="5" class="text-center">Por favor, selecciona un domo.</td></tr>';
            return;
        }
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos/${domoId}`);
            if (!response.ok) throw new Error('No se pudo obtener la información del domo.');
            domoState = await response.json();

            if (typeof domoState.irrigadores === 'string') {
                domoState.irrigadores = JSON.parse(domoState.irrigadores || '[]');
            }
            if (!Array.isArray(domoState.irrigadores)) {
                domoState.irrigadores = [];
            }
            renderTablaIrrigadores(domoState.irrigadores);

            await cargarUltimosEventos();
            eventosInterval = setInterval(cargarUltimosEventos, 2000);

        } catch (error) {
            console.error("Error al cargar datos del domo:", error);
            irrigadoresTbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${error.message}</td></tr>`;
        }
    };

    /**
     * Carga la lista inicial de todos los domos y los añade al selector.
     */
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

    /**
     * Maneja el envío del formulario para crear un nuevo irrigador.
     */
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        
        const nuevoIrrigador = {
            id_irr: `irr_${Date.now()}`,
            nombre: document.getElementById('nombre-irr').value,
            ubicacion: document.getElementById('ubicacion-irr').value,
            activo: false,
            humedadSuelo: parseInt(document.getElementById('humedad-irr').value)
        };

        domoState.irrigadores.push(nuevoIrrigador);

        if (await actualizarDomoEnAPI()) {
            formNuevoIrrigador.reset();
            renderTablaIrrigadores(domoState.irrigadores);
        } else {
            domoState.irrigadores.pop(); 
        }
    };

    /**
     * Maneja los clics en la tabla para delegar a las funciones correspondientes.
     */
    const handleTablaClick = (event) => {
        const target = event.target;
        const irrId = target.dataset.id;
        
        if (target.classList.contains('btn-eliminar')) {
            if (confirm('¿Estás seguro de que deseas eliminar este dispositivo?')) {
                eliminarIrrigador(irrId);
            }
        } else if (target.classList.contains('btn-editar')) {
            abrirModalEditar(irrId);
        } else if (target.classList.contains('btn-toggle')) {
            toggleEstadoIrrigador(irrId, target.checked);
        }
    };
    
    /**
     * Registra un evento de cambio de estado en la API.
     */
    const registrarEventoDeEstado = async (domoId, dispositivoId, dispositivoNombre, nuevoEstado) => {
        const textoEstado = nuevoEstado ? 'activado' : 'desactivado';
        const evento = {
            domoId: domoId,
            dispositivoId: dispositivoId,
            type: "historial",
            mensaje: `El dispositivo '${dispositivoNombre}' se ha ${textoEstado}.`,
            timestamp: new Date().toISOString(),
            prioridad: "baja"
        };
        try {
            await fetch(`${MOCKAPI_URL}/eventos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(evento)
            });
        } catch (error) {
            console.error("No se pudo registrar el evento:", error);
        }
    };

    /**
     * Cambia el estado (activo/inactivo) de un irrigador y registra el evento.
     */
    const toggleEstadoIrrigador = async (irrId, nuevoEstado) => {
        const index = domoState.irrigadores.findIndex(irr => irr.id_irr === irrId);
        if (index === -1) return;

        const originalIrrigador = { ...domoState.irrigadores[index] };
        domoState.irrigadores[index].activo = nuevoEstado;

        if (await actualizarDomoEnAPI()) {
            const irrigadorCambiado = domoState.irrigadores.find(irr => irr.id_irr === irrId);
            registrarEventoDeEstado(
                domoState.id, 
                irrigadorCambiado.id_irr, 
                irrigadorCambiado.nombre, 
                nuevoEstado
            );
        } else {
            domoState.irrigadores[index] = originalIrrigador;
            renderTablaIrrigadores(domoState.irrigadores);
        }
    };

    const eliminarIrrigador = async (irrId) => {
        const originalIrrigadores = [...domoState.irrigadores];
        domoState.irrigadores = domoState.irrigadores.filter(irr => irr.id_irr !== irrId);
        
        if (!(await actualizarDomoEnAPI())) {
            domoState.irrigadores = originalIrrigadores;
        } else {
            renderTablaIrrigadores(domoState.irrigadores);
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

        const irrigadorActualizado = {
            ...domoState.irrigadores[index], 
            nombre: document.getElementById('edit-nombre-irr').value,
            ubicacion: document.getElementById('edit-ubicacion-irr').value,
            humedadSuelo: parseInt(document.getElementById('edit-humedad-irr').value),
        };

        const originalIrrigadores = [...domoState.irrigadores];
        domoState.irrigadores[index] = irrigadorActualizado;

        if (await actualizarDomoEnAPI()) {
            editModalInstance.hide();
            renderTablaIrrigadores(domoState.irrigadores);
        } else {
            domoState.irrigadores = originalIrrigadores;
        }
    };

    // --- INICIALIZACIÓN Y EVENT LISTENERS ---
    editModalInstance = new bootstrap.Modal(editarModalElement);
    domoSelector.addEventListener('change', (e) => cargarDatosDomoSeleccionado(e.target.value));
    formNuevoIrrigador.addEventListener('submit', handleFormSubmit);
    irrigadoresTbody.addEventListener('click', handleTablaClick);
    guardarCambiosBtn.addEventListener('click', handleGuardarCambios);
    
    cargarYPopularDomos(); 
});

