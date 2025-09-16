document.addEventListener('DOMContentLoaded', () => {
    const MOCKAPI_URL = 'https://68c60c19442c663bd0262b0a.mockapi.io/v1';
    
    // --- ▼▼▼ CAMBIO 1: VALOR DE RECARGA DE AGUA ▼▼▼ ---
    const VALOR_RELLENO_AGUA = 100; // Se cambió de 1000 a 100

    const alertasTbody = document.getElementById('alertas-tbody');
    const reservasContainer = document.getElementById('reservas-container');

    // --- ▼▼▼ CAMBIO 2: ELEMENTOS DEL MODAL Y FORMULARIO ▼▼▼ ---
    const addDomoModalElement = document.getElementById('addDomoModal');
    const addDomoModal = new bootstrap.Modal(addDomoModalElement);
    const formNuevoDomo = document.getElementById('form-nuevo-domo');

    let dispositivosMap = {};

    const mapearDispositivos = async (domos) => {
        dispositivosMap = {};
        domos.forEach(domo => {
            const irrigadores = (typeof domo.irrigadores === 'string') ? JSON.parse(domo.irrigadores || '[]') : domo.irrigadores || [];
            const luces = (typeof domo.luces === 'string') ? JSON.parse(domo.luces || '[]') : domo.luces || [];
            
            irrigadores.forEach(disp => { dispositivosMap[disp.id_irr] = { nombre: disp.nombre, domo: domo.nombre }; });
            luces.forEach(disp => { dispositivosMap[disp.id_luz] = { nombre: disp.nombre, domo: domo.nombre }; });
            dispositivosMap[`sistema_agua_${domo.id}`] = { nombre: 'Sistema de Agua', domo: domo.nombre };
        });
    };

    const renderTablaAlertas = (alertas) => {
        alertasTbody.innerHTML = '';
        if (!alertas || alertas.length === 0) {
            alertasTbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay alertas activas en el sistema.</td></tr>';
            return;
        }
        alertas.forEach(alerta => {
            const dispositivoInfo = dispositivosMap[alerta.dispositivoId] || { nombre: 'Dispositivo Desconocido', domo: 'N/A' };
            const nombreCompleto = `${dispositivoInfo.nombre} (${dispositivoInfo.domo})`;
            const fecha = new Date(alerta.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
            
            let prioridadBadge = `<span class="badge priority-low">${alerta.prioridad || 'baja'}</span>`;
            if (alerta.prioridad === 'alta') prioridadBadge = `<span class="badge priority-high">${alerta.prioridad}</span>`;
            else if (alerta.prioridad === 'media') prioridadBadge = `<span class="badge priority-medium">${alerta.prioridad}</span>`;

            const fila = `<tr><td>${nombreCompleto}</td><td>${alerta.mensaje}</td><td>${fecha}</td><td class="text-center">${prioridadBadge}</td></tr>`;
            alertasTbody.innerHTML += fila;
        });
    };

    const renderReservas = (domos) => {
        reservasContainer.innerHTML = '';
        if (!domos || domos.length === 0) return;
        domos.forEach(domo => {
            const reservaCard = `<div class="col-md-4"><div class="content-card p-3 text-center"><h5 class="mb-1">${domo.nombre}</h5><p class="h3 fw-bold text-info">${domo.reservaAgua || 0} L</p><button class="btn btn-info btn-sm mt-2 btn-rellenar" data-id="${domo.id}">+${VALOR_RELLENO_AGUA} L</button></div></div>`;
            reservasContainer.innerHTML += reservaCard;
        });
    };

    const cargarAlertas = async () => {
        try {
            const url = `${MOCKAPI_URL}/eventos?sortBy=timestamp&order=desc`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("No se pudieron cargar los eventos.");
            const eventos = await response.json();
            const alertas = eventos.filter(e => e.type === 'alerta').slice(0, 10);
            renderTablaAlertas(alertas);
        } catch (error) {
            console.error("Error al cargar alertas:", error);
            alertasTbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${error.message}</td></tr>`;
        }
    };
    
    const simularSistemaGlobal = async () => {
        try {
            const response = await fetch(`${MOCKAPI_URL}/domos`);
            const domos = await response.json();
            await mapearDispositivos(domos);
            renderReservas(domos);

            for (const domo of domos) {
                let domoModificado = false;
                let irrigadores = (typeof domo.irrigadores === 'string') ? JSON.parse(domo.irrigadores || '[]') : domo.irrigadores || [];
                let luces = (typeof domo.luces === 'string') ? JSON.parse(domo.luces || '[]') : domo.luces || [];
                let reservaActual = domo.reservaAgua || 0;

                irrigadores.forEach(irr => {
                    domoModificado = true;
                    if (irr.activo && reservaActual > 0) {
                        irr.humedadSuelo += (Math.random() * 2) + 1;
                        reservaActual -= 1;
                    } else {
                        irr.humedadSuelo -= (Math.random() * 1.5) + 1;
                    }
                    if (irr.humedadSuelo > 100) irr.humedadSuelo = 100;
                    if (irr.humedadSuelo < 0) irr.humedadSuelo = 0;
                    irr.humedadSuelo = Math.round(irr.humedadSuelo);
                    if (irr.humedadSuelo < 55) registrarEvento(domo.id, irr.id_irr, `Humedad BAJA: ${irr.humedadSuelo}%.`, 'alerta', 'alta');
                    else if (irr.humedadSuelo > 90) registrarEvento(domo.id, irr.id_irr, `Humedad ALTA: ${irr.humedadSuelo}%.`, 'alerta', 'alta');
                });
                
                luces.forEach(luz => {
                    const ahoraStr = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' });
                    let deberiaEstarActiva = (luz.horarioEncendido < luz.horarioApagado)
                        ? (ahoraStr >= luz.horarioEncendido && ahoraStr < luz.horarioApagado)
                        : (ahoraStr >= luz.horarioEncendido || ahoraStr < luz.horarioApagado);

                    if (luz.activo !== deberiaEstarActiva) {
                        const estadoEsperado = deberiaEstarActiva ? "encendida" : "apagada";
                        const mensaje = `¡FALLO! La luz no cumplió el horario (debería estar ${estadoEsperado}).`;
                        registrarEvento(domo.id, luz.id_luz, mensaje, 'alerta', 'alta');
                    }
                });

                if (reservaActual < 100 && reservaActual > 0) registrarEvento(domo.id, `sistema_agua_${domo.id}`, `Reserva de agua BAJA: ${reservaActual} L.`, 'alerta', 'media');
                if (reservaActual <= 0) {
                    reservaActual = 0;
                    registrarEvento(domo.id, `sistema_agua_${domo.id}`, `Reserva de agua AGOTADA.`, 'alerta', 'alta');
                }

                if (domoModificado) {
                    domo.irrigadores = irrigadores;
                    domo.reservaAgua = reservaActual;
                    await fetch(`${MOCKAPI_URL}/domos/${domo.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(domo) });
                }
            }
        } catch (error) { console.error("Error durante la simulación global:", error); }
    };
    
    const rellenarReserva = async (domoId) => {
        try {
            const domoResponse = await fetch(`${MOCKAPI_URL}/domos/${domoId}`);
            const domo = await domoResponse.json();
            domo.reservaAgua = (domo.reservaAgua || 0) + VALOR_RELLENO_AGUA;
            await fetch(`${MOCKAPI_URL}/domos/${domoId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(domo) });
            registrarEvento(domo.id, `sistema_agua_${domo.id}`, 'Reserva de agua rellenada.', 'historial', 'baja');
            simularSistemaGlobal();
        } catch (error) {
            console.error('Error al rellenar la reserva:', error);
        }
    };
    
    const registrarEvento = async (domoId, dispositivoId, mensaje, tipo, prioridad) => {
        const evento = { domoId, dispositivoId, type: tipo, mensaje, timestamp: new Date().toISOString(), prioridad };
        try {
            await fetch(`${MOCKAPI_URL}/eventos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(evento) });
        } catch (error) { console.error("No se pudo registrar el evento:", error); }
    };

    // --- ▼▼▼ CAMBIO 3: NUEVA FUNCIÓN PARA CREAR DOMOS ▼▼▼ ---
    const handleNuevoDomoSubmit = async (event) => {
        event.preventDefault();
        const nombre = document.getElementById('nombre-domo').value.trim();
        const ubicacion = document.getElementById('ubicacion-domo').value.trim();

        if (!nombre || !ubicacion) {
            alert('Por favor, completa todos los campos.');
            return;
        }

        const nuevoDomo = {
            nombre: nombre,
            ubicacion: ubicacion,
            reservaAgua: 0,
            irrigadores: [],
            luces: []
        };

        try {
            const response = await fetch(`${MOCKAPI_URL}/domos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoDomo)
            });

            if (!response.ok) throw new Error('No se pudo crear el nuevo domo.');

            formNuevoDomo.reset();
            addDomoModal.hide();
            await simularSistemaGlobal(); // Refresca toda la vista para incluir el nuevo domo

        } catch (error) {
            console.error("Error al crear el domo:", error);
            alert(`Error: ${error.message}`);
        }
    };

    const cicloDeRefrescoAlertas = async () => { await cargarAlertas(); };

    reservasContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-rellenar')) {
            const domoId = event.target.dataset.id;
            if (domoId) rellenarReserva(domoId);
        }
    });

    // --- ▼▼▼ CAMBIO 4: AÑADIR EVENT LISTENER PARA EL NUEVO FORMULARIO ▼▼▼ ---
    formNuevoDomo.addEventListener('submit', handleNuevoDomoSubmit);

    simularSistemaGlobal();
    setInterval(cicloDeRefrescoAlertas, 5000);
    setInterval(simularSistemaGlobal, 10000);
});