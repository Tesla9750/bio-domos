document.addEventListener('DOMContentLoaded', () => {

    // ---------------------------------------------------------------
    // 🎯 ¡ACCIÓN REQUERIDA!
    //    Solo necesitas verificar que esta URL base sea la correcta.
    // ---------------------------------------------------------------
    const MOCKAPI_URL = 'https://68c60c19442c663bd0262b0a.mockapi.io/v1';

    // --- ESTADO GLOBAL ---
    let domosDisponibles = []; // Guarda la lista de todos los domos
    let domoState = null;      // Guarda el estado del domo SELECCIONADO

    // --- ELEMENTOS DEL DOM ---
    const domoSelector = document.getElementById('domo-selector');
    const irrigadoresTbody = document.getElementById('irrigadores-tbody');
    const formNuevoIrrigador = document.getElementById('form-nuevo-irrigador');

    // --- FUNCIONES ---

    /**
     * Renderiza la tabla de irrigadores del domo actualmente seleccionado.
     */
    const renderTablaIrrigadores = (irrigadores) => {
        irrigadoresTbody.innerHTML = '';
        if (!irrigadores || irrigadores.length === 0) {
            irrigadoresTbody.innerHTML = '<tr><td colspan="4" class="text-center">Este domo no tiene dispositivos de riego.</td></tr>';
            return;
        }
        irrigadores.forEach(irr => {
            const estadoBadge = irr.activo ? '<span class="badge bg-success">Activo</span>' : '<span class="badge bg-secondary">Inactivo</span>';
            const fila = `<tr><td>${irr.nombre}</td><td>${irr.ubicacion}</td><td>${estadoBadge}</td><td>${irr.humedadSuelo}%</td></tr>`;
            irrigadoresTbody.innerHTML += fila;
        });
    };

    /**
     * Carga los datos de un domo específico por su ID.
     */
    const cargarDatosDomoSeleccionado = async (domoId) => {
        if (!domoId) {
            irrigadoresTbody.innerHTML = '<tr><td colspan="4" class="text-center">Por favor, selecciona un domo.</td></tr>';
            return;
        }
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos/${domoId}`);
            if (!response.ok) throw new Error('No se pudo obtener la información del domo.');
            domoState = await response.json();

            // --- INICIO DE LA CORRECCIÓN ---
            // A veces MockAPI devuelve los arreglos como cadenas de texto.
            // Aquí nos aseguramos de que `domoState.irrigadores` sea siempre un arreglo.
            if (typeof domoState.irrigadores === 'string') {
                try {
                    // Intentamos convertir la cadena de texto a un arreglo
                    domoState.irrigadores = JSON.parse(domoState.irrigadores);
                } catch (e) {
                    console.error("Error al parsear la cadena de irrigadores:", e);
                    // Si la conversión falla, lo dejamos como un arreglo vacío para evitar más errores.
                    domoState.irrigadores = [];
                }
            }
            // Por seguridad, si no es un arreglo, lo inicializamos como uno vacío.
            if (!Array.isArray(domoState.irrigadores)) {
                domoState.irrigadores = [];
            }
            // --- FIN DE LA CORRECCIÓN ---

            renderTablaIrrigadores(domoState.irrigadores);
        } catch (error) {
            console.error("Error al cargar datos del domo:", error);
            irrigadoresTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${error.message}</td></tr>`;
        }
    };

    /**
     * Carga la lista inicial de todos los domos y los añade al selector.
     */
    const cargarYPopularDomos = async () => {
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos`);
            if (!response.ok) throw new Error('No se pudieron cargar los domos desde la API.');
            domosDisponibles = await response.json();
            
            domoSelector.innerHTML = ''; // Limpiar el "Cargando..."
            if (domosDisponibles.length === 0) {
                domoSelector.innerHTML = '<option>No se encontraron domos.</option>';
                return;
            }

            domosDisponibles.forEach(domo => {
                const option = document.createElement('option');
                option.value = domo.id;
                option.textContent = `${domo.nombre} (Ubicación: ${domo.ubicacion})`;
                domoSelector.appendChild(option);
            });

            // Cargar los datos del primer domo de la lista por defecto
            await cargarDatosDomoSeleccionado(domosDisponibles[0].id);

        } catch (error) {
            console.error("Error al cargar lista de domos:", error);
            domoSelector.innerHTML = `<option>${error.message}</option>`;
        }
    };

    /**
     * Maneja el cambio de selección en el menú de domos.
     */
    const handleDomoChange = (event) => {
        const domoIdSeleccionado = event.target.value;
        cargarDatosDomoSeleccionado(domoIdSeleccionado);
    };

    /**
     * Maneja el envío del formulario para crear un nuevo irrigador.
     */
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const domoIdSeleccionado = domoSelector.value;

        if (!domoState || domoIdSeleccionado !== domoState.id) {
            alert("Error: El domo seleccionado no es válido. Refresca la página.");
            return;
        }

        const nuevoIrrigador = {
            id_irr: `irr_${Date.now()}`,
            nombre: document.getElementById('nombre-irr').value,
            ubicacion: document.getElementById('ubicacion-irr').value,
            activo: false,
            humedadSuelo: parseInt(document.getElementById('humedad-irr').value)
        };

        domoState.irrigadores.push(nuevoIrrigador);

        try {
            const response = await fetch(`${MOCKAPI_URL}/domos/${domoIdSeleccionado}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(domoState)
            });
            if (!response.ok) throw new Error('Falló la actualización en la API.');

            domoState = await response.json();
            formNuevoIrrigador.reset();
            renderTablaIrrigadores(domoState.irrigadores);
            registrarEventoDeCreacion(domoIdSeleccionado, nuevoIrrigador);
        } catch (error) {
            console.error("Error al añadir dispositivo:", error);
            domoState.irrigadores.pop();
            alert(`Error: ${error.message}`);
        }
    };

    /**
     * Registra un evento en la bitácora.
     */
    const registrarEventoDeCreacion = (domoId, nuevoDispositivo) => {
        const evento = {
            domoId,
            dispositivoId: nuevoDispositivo.id_irr,
            type: "historial",
            mensaje: `Nuevo dispositivo '${nuevoDispositivo.nombre}' añadido.`,
            timestamp: new Date().toISOString(),
            prioridad: "media"
        };
        fetch(`${MOCKAPI_URL}/eventos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evento)
        }).catch(err => console.error("No se pudo registrar el evento:", err));
    };

    // --- INICIALIZACIÓN ---
    domoSelector.addEventListener('change', handleDomoChange);
    formNuevoIrrigador.addEventListener('submit', handleFormSubmit);
    cargarYPopularDomos(); // La ejecución ahora comienza aquí
});

